-- Isometric module, protocols, provenance, audit
-- Run in the Supabase SQL Editor after the Force Plate V1 migration.

do $$ begin
  alter type public.source_type add value if not exists 'practitioner_entered';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.source_type add value if not exists 'ai_interpreted';
exception when duplicate_object then null;
end $$;

create table if not exists public.test_protocols (
  id uuid primary key default gen_random_uuid(),
  protocol_id text not null unique,
  test_name text not null,
  version text not null default 'v1',
  equipment text,
  body_position text,
  joint_angle text,
  warm_up text,
  familiarisation text,
  contraction_duration text,
  number_of_trials integer not null default 3,
  rest_between_trials text,
  trial_selection_rule text not null default 'best_valid_peak',
  cv_review_percent numeric not null default 10,
  symmetry_monitor_percent numeric not null default 10,
  symmetry_priority_percent numeric not null default 20,
  reference_dataset_id uuid references public.reference_datasets (id),
  notes text
);

insert into public.test_protocols (protocol_id, test_name, notes)
values
  ('ISO_GLOBAL_LOWER_BODY', 'Global Lower-Body Isometric', 'Three bilateral maximal trials. Primary result is best valid peak force.'),
  ('ISO_KNEE_EXTENSION', 'Knee Extension', 'Three left and three right maximal trials. Report best valid each side.'),
  ('ISO_KNEE_FLEXION', 'Knee Flexion', 'Three left and three right maximal trials. Report best valid each side.'),
  ('ISO_HIP_ABDUCTION', 'Hip Abduction', 'Three left and three right maximal trials. Report best valid each side.'),
  ('ISO_UPPER_PULL', 'Upper-Body Pull', 'Three left and three right maximal trials. Report best valid each side.'),
  ('FORCE_PLATE_IMTP', 'Force Plate IMTP', 'Three combined trials. Primary result is highest valid combined peak force.')
on conflict (protocol_id) do nothing;

create table if not exists public.isometric_trials (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  assessment_session_id uuid not null references public.assessment_sessions (id) on delete cascade,
  test_instance_id uuid not null references public.test_instances (id) on delete cascade,
  movement text not null,
  side text not null,
  trial_number integer not null,
  peak_force numeric,
  relative_peak_force numeric,
  mean_force numeric,
  time_to_peak_force numeric,
  peak_rfd numeric,
  rfd_100ms numeric,
  rfd_200ms numeric,
  rfd_300ms numeric,
  peak_impulse numeric,
  impulse_100ms numeric,
  impulse_200ms numeric,
  impulse_300ms numeric,
  force_100ms numeric,
  force_200ms numeric,
  force_300ms numeric,
  force_decay numeric,
  force_drift numeric,
  coefficient_of_variation numeric,
  valid boolean not null default true,
  excluded_reason text,
  selected_as_best boolean not null default false,
  practitioner_notes text,
  source_type public.source_type not null default 'practitioner_entered',
  raw_source_data jsonb not null default '{}'::jsonb,
  unique (test_instance_id, side, trial_number)
);

create table if not exists public.isometric_results (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  assessment_session_id uuid not null references public.assessment_sessions (id) on delete cascade,
  test_instance_id uuid not null unique references public.test_instances (id) on delete cascade,
  best_left_peak_force numeric,
  best_right_peak_force numeric,
  best_bilateral_peak_force numeric,
  mean_left_peak_force numeric,
  mean_right_peak_force numeric,
  mean_bilateral_peak_force numeric,
  cv_left_percent numeric,
  cv_right_percent numeric,
  cv_bilateral_percent numeric,
  high_variability boolean not null default false,
  asymmetry_percent numeric,
  absolute_difference numeric,
  stronger_side text,
  weaker_side text,
  left_relative_force numeric,
  right_relative_force numeric,
  bilateral_relative_force numeric,
  population_strength_status text not null default 'reference_pending',
  symmetry_status text not null default 'unavailable',
  reference_available boolean not null default false,
  interpretation jsonb not null default '{}'::jsonb,
  frozen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists isometric_trials_test_idx on public.isometric_trials (test_instance_id);
create index if not exists isometric_results_session_idx on public.isometric_results (assessment_session_id);

alter table public.test_protocols enable row level security;
alter table public.isometric_trials enable row level security;
alter table public.isometric_results enable row level security;
alter table public.audit_events enable row level security;

grant select, insert, update, delete on public.test_protocols to authenticated;
grant select, insert, update, delete on public.isometric_trials to authenticated;
grant select, insert, update, delete on public.isometric_results to authenticated;
grant select, insert on public.audit_events to authenticated;

drop policy if exists test_protocols_read on public.test_protocols;
create policy test_protocols_read on public.test_protocols
  for select to authenticated using (true);

drop policy if exists isometric_trials_own on public.isometric_trials;
create policy isometric_trials_own on public.isometric_trials
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

drop policy if exists isometric_results_own on public.isometric_results;
create policy isometric_results_own on public.isometric_results
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

drop policy if exists audit_events_own on public.audit_events;
create policy audit_events_own on public.audit_events
  for select to authenticated
  using ((select auth.uid()) = practitioner_id);

drop policy if exists audit_events_insert on public.audit_events;
create policy audit_events_insert on public.audit_events
  for insert to authenticated
  with check ((select auth.uid()) = practitioner_id);
