-- QC Band dashboard extras: sleep window + last blood pressure.
alter table public.wearable_days
  add column if not exists sleep_start text,
  add column if not exists sleep_end text,
  add column if not exists systolic integer,
  add column if not exists diastolic integer,
  add column if not exists measured_at text;
