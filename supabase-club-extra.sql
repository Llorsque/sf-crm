-- =============================================================
-- Sport Fryslân CRM - Data Import voor club extra informatie
-- Optie B: direct upsert naar club_extra
-- Optie C: staging + merge via SECURITY DEFINER functie
-- Idempotent waar mogelijk
-- =============================================================

create extension if not exists pgcrypto;

-- 1) Basistabel 'club_extra' (doel)
create table if not exists public.club_extra (
  club_nr text primary key references public.clubs(club_nr) on delete cascade,
  profit boolean,
  leden integer,
  contributie_avg numeric,
  updated_at timestamptz default now()
);

-- 2) Staging tabel (wordt bij elk import leeggehaald)
create table if not exists public.club_extra_staging (
  club_nr text,
  profit boolean,
  leden integer,
  contributie_avg numeric
);

-- 3) Indexen
create index if not exists idx_club_extra_staging_club_nr on public.club_extra_staging(club_nr);

-- 4) RLS
alter table public.club_extra enable row level security;
alter table public.club_extra_staging enable row level security;

-- Policies voor prototype (anon mag lezen/schrijven).
do $$ begin
  drop policy if exists "club_extra_all" on public.club_extra;
  drop policy if exists "club_extra_staging_rw" on public.club_extra_staging;
exception when undefined_object then null; end $$;

create policy "club_extra_all" on public.club_extra
  for all to anon using (true) with check (true);

create policy "club_extra_staging_rw" on public.club_extra_staging
  for all to anon using (true) with check (true);

-- 5) Merge-functie (Optie C) — draait als eigenaar, negeert RLS
create or replace function public.import_merge_club_extra()
returns table(inserted integer, updated integer) 
language plpgsql
security definer
as $$
declare
  v_ins int := 0;
  v_upd int := 0;
begin
  with up as (
    insert into public.club_extra as e (club_nr, profit, leden, contributie_avg, updated_at)
    select club_nr, profit, leden, contributie_avg, now()
    from public.club_extra_staging s
    on conflict (club_nr) do update
      set profit = excluded.profit,
          leden = excluded.leden,
          contributie_avg = excluded.contributie_avg,
          updated_at = excluded.updated_at
    returning (xmax = 0) as is_insert
  )
  select 
    count(*) filter (where is_insert) as inserted,
    count(*) filter (where not is_insert) as updated
  into v_ins, v_upd
  from up;

  -- staging leegmaken na merge
  truncate table public.club_extra_staging;

  return query select v_ins, v_upd;
end $$;

-- Geef anon-execute rechten (prototype)
grant execute on function public.import_merge_club_extra() to anon;
