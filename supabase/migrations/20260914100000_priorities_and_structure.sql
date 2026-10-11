-- Layer 2 (ranked priorities) and Layer 3 (weekly structure).
-- One row per client. Engines recompute on load; these tables persist
-- practitioner overrides and the last confirmed snapshot.

create table if not exists public.programming_priorities (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid not null unique references public.clients (id) on delete cascade,
  assessment_session_id uuid references public.assessment_sessions (id) on delete set null,
  programming_profile_id uuid references public.programming_profiles (id) on delete set null,
  findings jsonb not null default '[]'::jsonb,
  priorities jsonb not null default '[]'::jsonb,
  auto jsonb not null default '{}'::jsonb,
  overrides jsonb not null default '{}'::jsonb,
  summary text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.program_structures (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid not null unique references public.clients (id) on delete cascade,
  programming_priorities_id uuid references public.programming_priorities (id) on delete set null,
  auto jsonb not null default '{}'::jsonb,
  overrides jsonb,
  structure jsonb not null default '{}'::jsonb,
  rationale jsonb not null default '[]'::jsonb,
  constraint_flags jsonb not null default '[]'::jsonb,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists programming_priorities_client_idx on public.programming_priorities (client_id);
create index if not exists program_structures_client_idx on public.program_structures (client_id);

drop trigger if exists programming_priorities_updated_at on public.programming_priorities;
create trigger programming_priorities_updated_at before update on public.programming_priorities
  for each row execute function public.set_updated_at();

drop trigger if exists program_structures_updated_at on public.program_structures;
create trigger program_structures_updated_at before update on public.program_structures
  for each row execute function public.set_updated_at();

alter table public.programming_priorities enable row level security;
alter table public.program_structures enable row level security;

grant select, insert, update, delete on public.programming_priorities to authenticated;
grant select, insert, update, delete on public.program_structures to authenticated;

drop policy if exists programming_priorities_practitioner on public.programming_priorities;
create policy programming_priorities_practitioner on public.programming_priorities
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

drop policy if exists program_structures_practitioner on public.program_structures;
create policy program_structures_practitioner on public.program_structures
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);
