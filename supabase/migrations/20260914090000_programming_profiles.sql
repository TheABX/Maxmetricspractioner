-- Client Programming Profile V1.
-- One editable profile per client. Sits alongside assessment results and is
-- the input to the programming engines. It does not generate a program.
--
-- profile   : practitioner/client-entered fields (goals, availability, equipment, ...)
-- auto      : classifications computed by lib/programming-profile/derive.ts
-- overrides : { field: { value, reason } } — practitioner overrides of auto values
-- Effective value for any classified field = overrides[field].value ?? auto[field].

create table if not exists public.programming_profiles (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid not null unique references public.clients (id) on delete cascade,
  questionnaire_response_id uuid references public.questionnaire_responses (id) on delete set null,
  assessment_session_id uuid references public.assessment_sessions (id) on delete set null,
  version integer not null default 1,
  program_mode text not null default 'GENERAL_WELLNESS'
    check (program_mode in ('GENERAL_WELLNESS', 'PERFORMANCE')),
  primary_goal text,
  training_stage text check (training_stage in ('FOUNDATION', 'DEVELOPMENT', 'ADVANCED')),
  foundation_phase_recommended boolean,
  profile jsonb not null default '{}'::jsonb,
  auto jsonb not null default '{}'::jsonb,
  overrides jsonb not null default '{}'::jsonb,
  summary text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists programming_profiles_client_idx on public.programming_profiles (client_id);

drop trigger if exists programming_profiles_updated_at on public.programming_profiles;
create trigger programming_profiles_updated_at before update on public.programming_profiles
  for each row execute function public.set_updated_at();

alter table public.programming_profiles enable row level security;
grant select, insert, update, delete on public.programming_profiles to authenticated;

drop policy if exists programming_profiles_practitioner on public.programming_profiles;
create policy programming_profiles_practitioner on public.programming_profiles
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);
