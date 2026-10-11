-- Layer 6: progression / adaptation snapshot, richer session logs, review queue.

alter table public.set_logs add column if not exists rir numeric;

alter table public.session_logs add column if not exists energy_0_10 integer;
alter table public.session_logs add column if not exists motivation_0_10 integer;
alter table public.session_logs add column if not exists sleep_quality_0_10 integer;
alter table public.session_logs add column if not exists soreness_0_10 integer;
alter table public.session_logs add column if not exists fatigue_0_10 integer;

create table if not exists public.program_adaptations (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid not null unique references public.clients (id) on delete cascade,
  auto jsonb not null default '{}'::jsonb,
  overrides jsonb,
  adaptation jsonb not null default '{}'::jsonb,
  rationale jsonb not null default '[]'::jsonb,
  flags jsonb not null default '[]'::jsonb,
  automation_level text not null default 'LEVEL_1_SUGGEST',
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists program_adaptations_updated_at on public.program_adaptations;
create trigger program_adaptations_updated_at before update on public.program_adaptations
  for each row execute function public.set_updated_at();

create table if not exists public.adaptation_queue (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  slot_id text,
  exercise_name text,
  severity text not null default 'AMBER',
  trigger text,
  issue text not null,
  suggested_action text,
  draft_message text,
  date_detected timestamptz not null default now(),
  status text not null default 'NEW' check (status in ('NEW', 'REVIEWED', 'ACTIONED', 'DISMISSED')),
  override_reason text
);

create index if not exists adaptation_queue_practitioner_idx on public.adaptation_queue (practitioner_id, status, severity);

alter table public.program_adaptations enable row level security;
alter table public.adaptation_queue enable row level security;

grant select, insert, update, delete on public.program_adaptations to authenticated;
grant select, insert, update, delete on public.adaptation_queue to authenticated;

drop policy if exists program_adaptations_practitioner on public.program_adaptations;
create policy program_adaptations_practitioner on public.program_adaptations
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

drop policy if exists adaptation_queue_practitioner on public.adaptation_queue;
create policy adaptation_queue_practitioner on public.adaptation_queue
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);
