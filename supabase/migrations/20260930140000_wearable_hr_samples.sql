-- Timed heart-rate samples for the client graph (minutes through days).
-- Recovery still uses nightly resting HR on wearable_days, not this series.

create table if not exists public.wearable_hr_samples (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  recorded_at timestamptz not null,
  bpm smallint not null check (bpm between 30 and 220),
  source text not null default 'scheduled' check (source in ('scheduled', 'minute', 'live', 'manual')),
  created_at timestamptz not null default now(),
  unique (client_id, recorded_at)
);

create index if not exists wearable_hr_samples_client_time_idx
  on public.wearable_hr_samples (client_id, recorded_at desc);

alter table public.wearable_hr_samples enable row level security;

grant select, insert, update, delete on public.wearable_hr_samples to authenticated;

create policy wearable_hr_samples_practitioner on public.wearable_hr_samples
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

create policy wearable_hr_samples_client on public.wearable_hr_samples
  for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());
