-- Nightly wearable snapshots + optional device bind. Free QC SDK fields only
-- (steps, HR, SpO2, sleep). No HRV / RR / ECG / apnea.

create table if not exists public.wearable_devices (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid not null unique references public.clients (id) on delete cascade,
  vendor text not null default 'qc',
  device_kind text not null default 'band' check (device_kind in ('band', 'ring')),
  platform text check (platform in ('ios', 'android')),
  hardware_id text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wearable_days (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  day date not null,
  steps integer,
  active_kcal integer,
  resting_hr numeric,
  avg_hr numeric,
  spo2 numeric,
  sleep_minutes integer,
  feel text check (feel in ('good', 'off', 'wrecked')),
  synced_at timestamptz,
  source text not null default 'app' check (source in ('app', 'demo', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, day)
);

create index if not exists wearable_days_client_day_idx on public.wearable_days (client_id, day desc);

create trigger wearable_devices_updated_at before update on public.wearable_devices
  for each row execute function public.set_updated_at();
create trigger wearable_days_updated_at before update on public.wearable_days
  for each row execute function public.set_updated_at();

alter table public.wearable_devices enable row level security;
alter table public.wearable_days enable row level security;

grant select, insert, update, delete on public.wearable_devices to authenticated;
grant select, insert, update, delete on public.wearable_days to authenticated;

create policy wearable_devices_practitioner on public.wearable_devices
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

create policy wearable_devices_client on public.wearable_devices
  for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

create policy wearable_days_practitioner on public.wearable_days
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

create policy wearable_days_client on public.wearable_days
  for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());
