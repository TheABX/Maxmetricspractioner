-- Mobility & Movement module.
-- Test battery lives in mobility_test_definitions so tests can be activated/replaced
-- without redesigning trials/results. Do not invent reference rows here.

alter table public.reference_values
  add column if not exists test_name text,
  add column if not exists protocol text,
  add column if not exists side text,
  add column if not exists sample_size integer,
  add column if not exists mean_value numeric,
  add column if not exists standard_deviation numeric,
  add column if not exists percentile_5 numeric,
  add column if not exists percentile_25 numeric,
  add column if not exists percentile_75 numeric,
  add column if not exists percentile_95 numeric,
  add column if not exists authors text,
  add column if not exists year integer,
  add column if not exists doi text,
  add column if not exists notes text;

create table if not exists public.mobility_test_definitions (
  id uuid primary key default gen_random_uuid(),
  test_key text not null unique,
  display_name text not null,
  category text not null check (category in ('quantitative', 'observational')),
  unit text,
  laterality text not null default 'unilateral',
  body_regions jsonb not null default '[]'::jsonb,
  trial_selection_method text not null default 'SINGLE'
    check (trial_selection_method in ('BEST', 'MEAN', 'MEDIAN', 'FINAL', 'SINGLE', 'PRACTITIONER_SELECTED')),
  higher_is_favourable boolean not null default true,
  active boolean not null default true,
  protocol_id text,
  protocol_version text not null default 'v1',
  testing_position text,
  hip_angle text,
  measurement_method text,
  device_used text,
  what_this_measures text,
  why_it_matters text,
  notes text,
  created_at timestamptz not null default now()
);

insert into public.mobility_test_definitions (
  test_key, display_name, category, unit, laterality, body_regions,
  trial_selection_method, higher_is_favourable, protocol_id, protocol_version,
  testing_position, hip_angle, measurement_method,
  what_this_measures, why_it_matters, notes
) values
  (
    'MOBILITY_KNEE_TO_WALL',
    'Ankle Mobility (Knee-to-Wall)',
    'quantitative',
    'cm',
    'unilateral',
    '["left_ankle","right_ankle"]'::jsonb,
    'PRACTITIONER_SELECTED',
    true,
    'MOB_KNEE_TO_WALL_V1',
    'v1',
    'weight_bearing_lunge',
    null,
    'toe-to-wall distance with heel down',
    'Measures weight-bearing ankle dorsiflexion as the distance from the great toe to the wall while the knee contacts the wall and the heel stays down.',
    'Ankle range shows up in stairs, squatting, and walking. A lower side is a measurement, not a diagnosis of injury.',
    'Optional dorsiflexion angle fields can be added later. Do not require angle for V1.'
  ),
  (
    'MOBILITY_ASLR',
    'Active Straight-Leg Raise',
    'quantitative',
    'deg',
    'unilateral',
    '["left_posterior_chain","right_posterior_chain"]'::jsonb,
    'PRACTITIONER_SELECTED',
    true,
    'MOB_ASLR_V1',
    'v1',
    'supine',
    null,
    'inclinometer or goniometer',
    'Measures active hip-flexion / posterior-chain mobility under a standardised straight-leg-raise protocol. Multiple structures can influence the angle.',
    'This is how far you can raise a straight leg while staying in the test position. It is not an isolated hamstring diagnosis.',
    'Do not label this test as isolated hamstring flexibility.'
  ),
  (
    'MOBILITY_HIP_IR',
    'Hip Internal Rotation',
    'quantitative',
    'deg',
    'unilateral',
    '["left_hip","right_hip"]'::jsonb,
    'PRACTITIONER_SELECTED',
    true,
    'MOB_HIP_IR_V1',
    'v1',
    'seated',
    'hip flexed ~90°',
    'goniometer',
    'Measures hip internal-rotation range in the stored testing position. Results are only directly comparable when the same protocol is used.',
    'Hip rotation range is one part of how you sit, turn, and squat. A difference between sides is not automatically a problem.',
    'Protocol (position, hip angle, method, device, version) must be stored with every result.'
  ),
  (
    'MOBILITY_SHOULDER_FLEXION',
    'Shoulder Flexion',
    'quantitative',
    'deg',
    'unilateral',
    '["left_shoulder","right_shoulder"]'::jsonb,
    'PRACTITIONER_SELECTED',
    true,
    'MOB_SHOULDER_FLEX_V1',
    'v1',
    'standing_or_supine_active',
    null,
    'goniometer',
    'Measures active shoulder flexion range independently on each side.',
    'Shoulder flexion is how far you can reach overhead. It matters for shelves, hanging, and overhead work — it is not a diagnosis.',
    'Validated datasets may report left and right separately; store side with any loaded reference.'
  ),
  (
    'MOBILITY_OVERHEAD_SQUAT',
    'Overhead Squat Observation',
    'observational',
    null,
    'bilateral',
    '[]'::jsonb,
    'SINGLE',
    true,
    'MOB_OHS_OBS_V1',
    'v1',
    'standing_overhead_squat',
    null,
    'practitioner observation',
    'Structured movement observation of a deep / overhead squat. This is not a longevity biomarker and is not assigned a population percentile.',
    'Observations may help programming when read together with measured ankle, hip, and shoulder results. They are not a diagnosis.',
    'Do not convert observations into injury language or fake scores.'
  )
on conflict (test_key) do nothing;

insert into public.test_protocols (protocol_id, test_name, version, body_position, joint_angle, trial_selection_rule, notes)
values
  ('MOB_KNEE_TO_WALL_V1', 'Ankle Mobility (Knee-to-Wall)', 'v1', 'weight_bearing_lunge', null, 'practitioner_selected_or_final', 'Distance in cm. Store all trials. Do not auto-apply best-of-three.'),
  ('MOB_ASLR_V1', 'Active Straight-Leg Raise', 'v1', 'supine', null, 'practitioner_selected_or_final', 'Angle in degrees. Not an isolated hamstring test.'),
  ('MOB_HIP_IR_V1', 'Hip Internal Rotation', 'v1', 'seated', 'hip flexed ~90°', 'practitioner_selected_or_final', 'Protocol must travel with the result.'),
  ('MOB_SHOULDER_FLEX_V1', 'Shoulder Flexion', 'v1', 'standing_or_supine_active', null, 'practitioner_selected_or_final', 'Active flexion, both sides.'),
  ('MOB_OHS_OBS_V1', 'Overhead Squat Observation', 'v1', 'standing_overhead_squat', null, 'single', 'Observational only. No population percentile.')
on conflict (protocol_id) do nothing;

create table if not exists public.mobility_trials (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  assessment_session_id uuid not null references public.assessment_sessions (id) on delete cascade,
  test_instance_id uuid not null references public.test_instances (id) on delete cascade,
  test_key text not null,
  side text not null,
  trial_number integer not null,
  value numeric,
  unit text,
  valid boolean not null default true,
  excluded_reason text,
  selected boolean not null default false,
  practitioner_notes text,
  source_type public.source_type not null default 'practitioner_entered',
  raw_source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (test_instance_id, side, trial_number)
);

create table if not exists public.mobility_results (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  assessment_session_id uuid not null references public.assessment_sessions (id) on delete cascade,
  test_instance_id uuid not null unique references public.test_instances (id) on delete cascade,
  test_key text not null,
  protocol_id text,
  protocol_snapshot jsonb not null default '{}'::jsonb,
  unit text,
  left_value numeric,
  right_value numeric,
  absolute_difference numeric,
  percentage_difference numeric,
  lower_side text,
  trial_selection_method text not null,
  left_percentile numeric,
  right_percentile numeric,
  left_reference_mean numeric,
  right_reference_mean numeric,
  left_reference_category text,
  right_reference_category text,
  reference_dataset_id uuid references public.reference_datasets (id),
  reference_available boolean not null default false,
  population_status text not null default 'reference_pending',
  symmetry_status text not null default 'unavailable',
  higher_is_favourable boolean not null default true,
  interpretation jsonb not null default '{}'::jsonb,
  frozen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mobility_observations (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  assessment_session_id uuid not null references public.assessment_sessions (id) on delete cascade,
  test_instance_id uuid not null unique references public.test_instances (id) on delete cascade,
  test_key text not null default 'MOBILITY_OVERHEAD_SQUAT',
  depth_achieved text,
  heel_contact text,
  left_right_weight_shift text,
  knee_tracking text,
  trunk_control text,
  overhead_arm_position text,
  pain_reported text,
  practitioner_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mobility_trials_test_idx on public.mobility_trials (test_instance_id);
create index if not exists mobility_results_session_idx on public.mobility_results (assessment_session_id);
create index if not exists mobility_definitions_active_idx on public.mobility_test_definitions (active);

alter table public.mobility_test_definitions enable row level security;
alter table public.mobility_trials enable row level security;
alter table public.mobility_results enable row level security;
alter table public.mobility_observations enable row level security;

grant select on public.mobility_test_definitions to authenticated;
grant select, insert, update, delete on public.mobility_trials to authenticated;
grant select, insert, update, delete on public.mobility_results to authenticated;
grant select, insert, update, delete on public.mobility_observations to authenticated;

drop policy if exists mobility_definitions_read on public.mobility_test_definitions;
create policy mobility_definitions_read on public.mobility_test_definitions
  for select to authenticated using (true);

drop policy if exists mobility_trials_own on public.mobility_trials;
create policy mobility_trials_own on public.mobility_trials
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

drop policy if exists mobility_results_own on public.mobility_results;
create policy mobility_results_own on public.mobility_results
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

drop policy if exists mobility_observations_own on public.mobility_observations;
create policy mobility_observations_own on public.mobility_observations
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);
