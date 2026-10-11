-- MAXMetrics Force Plate V1
-- Run this in the Supabase SQL Editor (Dashboard → SQL) if the CLI is not linked.

create extension if not exists pgcrypto;

do $$ begin
  create type public.sex_type as enum ('male', 'female', 'other', 'unspecified');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.dominance_type as enum ('left', 'right', 'unknown');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.assessment_type as enum (
    'baseline',
    'twelve_week_retest',
    'follow_up',
    'partial'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.session_status as enum (
    'draft',
    'in_progress',
    'complete',
    'report_generated'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.source_type as enum (
    'device_measured',
    'derived',
    'reference_calculated'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.side_code as enum ('L', 'R');
exception when duplicate_object then null;
end $$;

create table if not exists public.practitioners (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  dob date not null,
  sex public.sex_type not null,
  height_cm numeric(6, 2) not null,
  bodyweight_kg numeric(6, 2) not null,
  dominant_hand public.dominance_type not null default 'unknown',
  dominant_leg public.dominance_type not null default 'unknown',
  email text,
  phone text,
  goals text,
  training_history text,
  occupation_activity_level text,
  injuries text,
  exercise_limitations text,
  medications text,
  notes text,
  emergency_contact text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  assessment_type public.assessment_type not null default 'baseline',
  assessment_date date not null default (timezone('Australia/Sydney', now()))::date,
  bodyweight_kg numeric(6, 2) not null,
  height_cm numeric(6, 2) not null,
  practitioner_name text not null default 'Deon Kenzie',
  status public.session_status not null default 'in_progress',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.test_instances (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  assessment_session_id uuid not null references public.assessment_sessions (id) on delete cascade,
  test_type text not null,
  movement_name text,
  status text not null default 'draft',
  is_invalid boolean not null default false,
  invalid_reason text,
  notes text,
  created_at timestamptz not null default now(),
  unique (assessment_session_id, test_type)
);

create table if not exists public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  assessment_session_id uuid not null references public.assessment_sessions (id) on delete cascade,
  test_instance_id uuid references public.test_instances (id) on delete set null,
  original_name text not null,
  storage_path text not null unique,
  file_type text not null,
  content_sha256 text not null,
  byte_size integer not null,
  created_at timestamptz not null default now()
);

create unique index if not exists uploaded_files_sha_per_session
  on public.uploaded_files (assessment_session_id, content_sha256);

create table if not exists public.force_plate_trials (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  assessment_session_id uuid not null references public.assessment_sessions (id) on delete cascade,
  test_instance_id uuid not null references public.test_instances (id) on delete cascade,
  trial_number integer not null,
  performed_at timestamptz,
  athlete_name text,
  movement_name text,
  is_excluded boolean not null default false,
  exclusion_reason text,
  is_best_trial boolean not null default false,
  is_valid boolean not null default true,
  raw_rows jsonb not null default '{}'::jsonb,

  combined_peak_force_kg numeric,
  left_peak_force_kg numeric,
  right_peak_force_kg numeric,
  combined_peak_force_percent numeric,
  left_peak_force_percent numeric,
  right_peak_force_percent numeric,
  combined_relative_peak_force numeric,
  left_relative_peak_force numeric,
  right_relative_peak_force numeric,
  combined_time_to_peak_force_ms numeric,
  left_time_to_peak_force_ms numeric,
  right_time_to_peak_force_ms numeric,
  combined_mean_force_kg numeric,
  left_mean_force_kg numeric,
  right_mean_force_kg numeric,
  combined_mean_force_percent numeric,
  left_mean_force_percent numeric,
  right_mean_force_percent numeric,
  combined_force_at_peak_kg numeric,
  left_force_at_peak_kg numeric,
  right_force_at_peak_kg numeric,
  combined_force_100ms_kg numeric,
  left_force_100ms_kg numeric,
  right_force_100ms_kg numeric,
  combined_force_200ms_kg numeric,
  left_force_200ms_kg numeric,
  right_force_200ms_kg numeric,
  combined_force_300ms_kg numeric,
  left_force_300ms_kg numeric,
  right_force_300ms_kg numeric,
  combined_rfd_peak_ns numeric,
  left_rfd_peak_ns numeric,
  right_rfd_peak_ns numeric,
  combined_rfd_100ms_ns numeric,
  left_rfd_100ms_ns numeric,
  right_rfd_100ms_ns numeric,
  combined_rfd_200ms_ns numeric,
  left_rfd_200ms_ns numeric,
  right_rfd_200ms_ns numeric,
  combined_rfd_300ms_ns numeric,
  left_rfd_300ms_ns numeric,
  right_rfd_300ms_ns numeric,
  combined_impulse_peak_ns numeric,
  left_impulse_peak_ns numeric,
  right_impulse_peak_ns numeric,
  combined_impulse_100ms_ns numeric,
  left_impulse_100ms_ns numeric,
  right_impulse_100ms_ns numeric,
  combined_impulse_200ms_ns numeric,
  left_impulse_200ms_ns numeric,
  right_impulse_200ms_ns numeric,
  combined_impulse_300ms_ns numeric,
  left_impulse_300ms_ns numeric,
  right_impulse_300ms_ns numeric,
  combined_mean_force_at_peak_kg numeric,
  left_mean_force_at_peak_kg numeric,
  right_mean_force_at_peak_kg numeric,
  combined_mean_force_100ms_kg numeric,
  left_mean_force_100ms_kg numeric,
  right_mean_force_100ms_kg numeric,
  combined_mean_force_200ms_kg numeric,
  left_mean_force_200ms_kg numeric,
  right_mean_force_200ms_kg numeric,
  combined_mean_force_300ms_kg numeric,
  left_mean_force_300ms_kg numeric,
  right_mean_force_300ms_kg numeric,

  peak_force_asymmetry_percent numeric,
  weaker_side public.side_code,
  stronger_side public.side_code,
  absolute_difference_kg numeric,
  manufacturer_left_contribution numeric,
  manufacturer_right_contribution numeric,
  calculated_left_contribution numeric,
  calculated_right_contribution numeric,
  manufacturer_relative_peak_force numeric,
  calculated_relative_peak_force numeric,
  unique (test_instance_id, trial_number)
);

create table if not exists public.force_plate_results (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  assessment_session_id uuid not null references public.assessment_sessions (id) on delete cascade,
  test_instance_id uuid not null unique references public.test_instances (id) on delete cascade,
  best_trial_id uuid references public.force_plate_trials (id) on delete set null,
  selected_trial_id uuid references public.force_plate_trials (id) on delete set null,
  selection_mode text not null default 'algorithm',
  trial_count integer not null default 0,
  valid_trial_count integer not null default 0,
  trial_consistency_cv_percent numeric,
  trial_consistency_status text,
  peak_force_kg numeric,
  relative_peak_force numeric,
  force_200ms_kg numeric,
  rfd_peak_ns numeric,
  time_to_peak_force_ms numeric,
  peak_force_asymmetry_percent numeric,
  weaker_side public.side_code,
  stronger_side public.side_code,
  left_contribution numeric,
  right_contribution numeric,
  interpretation jsonb not null default '{}'::jsonb,
  body_map jsonb not null default '{}'::jsonb,
  frozen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.metric_values (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  test_instance_id uuid not null references public.test_instances (id) on delete cascade,
  trial_id uuid references public.force_plate_trials (id) on delete cascade,
  metric_key text not null,
  value numeric,
  unit text,
  source_type public.source_type not null,
  reference_dataset_id uuid,
  reference_available boolean not null default false,
  percentile numeric,
  category text,
  unique (test_instance_id, trial_id, metric_key, source_type)
);

create table if not exists public.reference_datasets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  population text,
  protocol text,
  source text,
  publication text,
  created_at timestamptz not null default now()
);

create table if not exists public.reference_values (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.reference_datasets (id) on delete cascade,
  metric_key text not null,
  sex public.sex_type,
  age_min integer,
  age_max integer,
  population text,
  percentile_10 numeric,
  percentile_20 numeric,
  percentile_30 numeric,
  percentile_40 numeric,
  percentile_50 numeric,
  percentile_60 numeric,
  percentile_70 numeric,
  percentile_80 numeric,
  percentile_90 numeric
);

create table if not exists public.practitioner_notes (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  assessment_session_id uuid references public.assessment_sessions (id) on delete cascade,
  test_instance_id uuid references public.test_instances (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.generated_reports (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  assessment_session_id uuid not null references public.assessment_sessions (id) on delete cascade,
  title text not null,
  storage_path text,
  warnings jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);

create table if not exists public.report_sections (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.generated_reports (id) on delete cascade,
  section_key text not null,
  payload jsonb not null default '{}'::jsonb,
  unique (report_id, section_key)
);

create index if not exists clients_practitioner_idx on public.clients (practitioner_id);
create index if not exists clients_name_idx on public.clients (last_name, first_name);
create index if not exists assessment_sessions_client_idx on public.assessment_sessions (client_id);
create index if not exists assessment_sessions_practitioner_idx on public.assessment_sessions (practitioner_id);
create index if not exists test_instances_session_idx on public.test_instances (assessment_session_id);
create index if not exists force_plate_trials_test_idx on public.force_plate_trials (test_instance_id);
create index if not exists metric_values_test_idx on public.metric_values (test_instance_id);
create index if not exists generated_reports_session_idx on public.generated_reports (assessment_session_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.practitioners (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public;
grant execute on function public.handle_new_user() to postgres, service_role;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clients_updated_at on public.clients;
create trigger clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

drop trigger if exists assessment_sessions_updated_at on public.assessment_sessions;
create trigger assessment_sessions_updated_at
  before update on public.assessment_sessions
  for each row execute function public.set_updated_at();

drop trigger if exists force_plate_results_updated_at on public.force_plate_results;
create trigger force_plate_results_updated_at
  before update on public.force_plate_results
  for each row execute function public.set_updated_at();

alter table public.practitioners enable row level security;
alter table public.clients enable row level security;
alter table public.assessment_sessions enable row level security;
alter table public.test_instances enable row level security;
alter table public.uploaded_files enable row level security;
alter table public.force_plate_trials enable row level security;
alter table public.force_plate_results enable row level security;
alter table public.metric_values enable row level security;
alter table public.reference_datasets enable row level security;
alter table public.reference_values enable row level security;
alter table public.practitioner_notes enable row level security;
alter table public.generated_reports enable row level security;
alter table public.report_sections enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant select on public.reference_datasets to authenticated;
grant select on public.reference_values to authenticated;

drop policy if exists practitioners_own on public.practitioners;
create policy practitioners_own on public.practitioners
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists clients_own on public.clients;
create policy clients_own on public.clients
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

drop policy if exists assessment_sessions_own on public.assessment_sessions;
create policy assessment_sessions_own on public.assessment_sessions
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

drop policy if exists test_instances_own on public.test_instances;
create policy test_instances_own on public.test_instances
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

drop policy if exists uploaded_files_own on public.uploaded_files;
create policy uploaded_files_own on public.uploaded_files
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

drop policy if exists force_plate_trials_own on public.force_plate_trials;
create policy force_plate_trials_own on public.force_plate_trials
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

drop policy if exists force_plate_results_own on public.force_plate_results;
create policy force_plate_results_own on public.force_plate_results
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

drop policy if exists metric_values_own on public.metric_values;
create policy metric_values_own on public.metric_values
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

drop policy if exists reference_datasets_read on public.reference_datasets;
create policy reference_datasets_read on public.reference_datasets
  for select to authenticated
  using (true);

drop policy if exists reference_values_read on public.reference_values;
create policy reference_values_read on public.reference_values
  for select to authenticated
  using (true);

drop policy if exists practitioner_notes_own on public.practitioner_notes;
create policy practitioner_notes_own on public.practitioner_notes
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

drop policy if exists generated_reports_own on public.generated_reports;
create policy generated_reports_own on public.generated_reports
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

drop policy if exists report_sections_own on public.report_sections;
create policy report_sections_own on public.report_sections
  for all to authenticated
  using (
    exists (
      select 1 from public.generated_reports r
      where r.id = report_id and r.practitioner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.generated_reports r
      where r.id = report_id and r.practitioner_id = (select auth.uid())
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assessment-files',
  'assessment-files',
  false,
  52428800,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/pdf'
  ]
)
on conflict (id) do nothing;

drop policy if exists assessment_files_select on storage.objects;
create policy assessment_files_select on storage.objects
  for select to authenticated
  using (bucket_id = 'assessment-files' and (select auth.uid())::text = (storage.foldername(name))[1]);

drop policy if exists assessment_files_insert on storage.objects;
create policy assessment_files_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'assessment-files' and (select auth.uid())::text = (storage.foldername(name))[1]);

drop policy if exists assessment_files_update on storage.objects;
create policy assessment_files_update on storage.objects
  for update to authenticated
  using (bucket_id = 'assessment-files' and (select auth.uid())::text = (storage.foldername(name))[1])
  with check (bucket_id = 'assessment-files' and (select auth.uid())::text = (storage.foldername(name))[1]);
