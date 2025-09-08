-- Create table for trajecten
create extension if not exists pgcrypto;

create table if not exists public.trajecten (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz,

  club_nr text,
  club_naam text,
  gemeente text,
  plaats text,

  titel text,
  type text,
  status text,              -- Intake | Uitvoering | Evaluatie | Afgerond | Geannuleerd
  eigenaar text,            -- Clubondersteuner / begeleider
  notities text,
  tags jsonb,

  start_datum date,
  eind_datum date,
  laatste_update date,

  begroot_eur numeric(12,2),
  financiering_type text,
  financiering_pct numeric(6,2),
  financiering_eur numeric(12,2),
  eigen_pct numeric(6,2),
  eigen_eur numeric(12,2)
);

-- Helpful indexes
create index if not exists idx_trajecten_club_nr on public.trajecten (club_nr);
create index if not exists idx_trajecten_status on public.trajecten (status);
create index if not exists idx_trajecten_type on public.trajecten (type);

-- Row Level Security
alter table public.trajecten enable row level security;

-- Open prototype policies (allow everything for anon, for demo/prototype only)
drop policy if exists "trajecten_select_all" on public.trajecten;
drop policy if exists "trajecten_insert_all" on public.trajecten;
drop policy if exists "trajecten_update_all" on public.trajecten;
drop policy if exists "trajecten_delete_all" on public.trajecten;

create policy "trajecten_select_all" on public.trajecten for select using (true);
create policy "trajecten_insert_all" on public.trajecten for insert with check (true);
create policy "trajecten_update_all" on public.trajecten for update using (true) with check (true);
create policy "trajecten_delete_all" on public.trajecten for delete using (true);

-- Optional trigger to auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_set_updated_at on public.trajecten;
create trigger trg_set_updated_at before update on public.trajecten
for each row execute function public.set_updated_at();