-- Patch: align status constraint with app statuses
-- 1) Update existing rows to a valid status (optional safeguard)
update public.trajecten
set status = 'Intake'
where status is null or status not in ('Intake','Uitvoering','Evaluatie','Afgerond','Geannuleerd');

-- 2) Drop old constraint and change default
alter table public.trajecten drop constraint if exists trajecten_status_chk;
alter table public.trajecten alter column status set default 'Intake';

-- 3) Add new constraint matching the app
alter table public.trajecten
  add constraint trajecten_status_chk
  check (status in ('Intake','Uitvoering','Evaluatie','Afgerond','Geannuleerd'));