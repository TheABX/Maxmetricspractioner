-- Layer 8: retest reviews, priority history, schedule. Assessments stay immutable.

alter table public.programs add column if not exists expected_retest_date date;

alter table public.generated_reports add column if not exists report_version integer not null default 1;
alter table public.generated_reports add column if not exists calculation_engine_version text;
alter table public.generated_reports add column if not exists protocol_versions jsonb not null default '{}'::jsonb;
alter table public.generated_reports add column if not exists reference_dataset_versions jsonb not null default '{}'::jsonb;

create table if not exists public.retest_reviews (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  current_assessment_id uuid not null references public.assessment_sessions (id) on delete cascade,
  compare_assessment_id uuid references public.assessment_sessions (id) on delete set null,
  baseline_assessment_id uuid references public.assessment_sessions (id) on delete set null,
  auto jsonb not null default '{}'::jsonb,
  review jsonb not null default '{}'::jsonb,
  overrides jsonb,
  goals_confirmed boolean,
  contextual_change text,
  practitioner_notes text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, current_assessment_id, compare_assessment_id)
);

create index if not exists retest_reviews_client_idx on public.retest_reviews (client_id, updated_at desc);

create table if not exists public.priority_history (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  assessment_session_id uuid references public.assessment_sessions (id) on delete cascade,
  quality text not null,
  laterality text,
  priority_level text not null,
  outcome text,
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists priority_history_client_idx on public.priority_history (client_id, assessment_session_id);

create table if not exists public.retest_schedules (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  program_id uuid references public.programs (id) on delete set null,
  expected_retest_date date not null,
  kind text not null default 'FULL_BLOCK' check (kind in ('FULL_BLOCK', 'INTERIM')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists retest_reviews_updated_at on public.retest_reviews;
create trigger retest_reviews_updated_at before update on public.retest_reviews
  for each row execute function public.set_updated_at();
drop trigger if exists retest_schedules_updated_at on public.retest_schedules;
create trigger retest_schedules_updated_at before update on public.retest_schedules
  for each row execute function public.set_updated_at();

alter table public.retest_reviews enable row level security;
alter table public.priority_history enable row level security;
alter table public.retest_schedules enable row level security;

grant select, insert, update, delete on public.retest_reviews to authenticated;
grant select, insert, update, delete on public.priority_history to authenticated;
grant select, insert, update, delete on public.retest_schedules to authenticated;

create policy retest_reviews_practitioner on public.retest_reviews
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

create policy retest_reviews_client on public.retest_reviews
  for select to authenticated
  using (client_id = public.current_client_id() and confirmed_at is not null);

create policy priority_history_practitioner on public.priority_history
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

create policy retest_schedules_practitioner on public.retest_schedules
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

create policy retest_schedules_client on public.retest_schedules
  for select to authenticated
  using (client_id = public.current_client_id());
