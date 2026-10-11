-- Practitioner Exercise Library Manager: control flags, families, tags, mastery, audit.

alter table public.exercises add column if not exists ai_selection_enabled boolean;
alter table public.exercises add column if not exists practitioner_approved boolean;
alter table public.exercises add column if not exists review_status text not null default 'PENDING_REVIEW';
alter table public.exercises add column if not exists source text not null default 'PRACTITIONER';
alter table public.exercises add column if not exists family_id uuid;
alter table public.exercises add column if not exists common_errors text;
alter table public.exercises add column if not exists progression_potential text;
alter table public.exercises add column if not exists updated_at timestamptz not null default now();

-- New and existing rows start locked. Catalog seed (ensureCatalog) marks
-- curated shared rows approved + AI-enabled. Practitioner-added rows stay locked.

update public.exercises
  set ai_selection_enabled = coalesce(ai_selection_enabled, false),
      practitioner_approved = coalesce(practitioner_approved, false);

alter table public.exercises alter column ai_selection_enabled set default false;
alter table public.exercises alter column practitioner_approved set default false;
alter table public.exercises alter column ai_selection_enabled set not null;
alter table public.exercises alter column practitioner_approved set not null;

alter table public.exercises drop constraint if exists exercises_review_status_check;
alter table public.exercises add constraint exercises_review_status_check
  check (review_status in ('LIVE', 'PENDING_REVIEW', 'REJECTED'));
alter table public.exercises drop constraint if exists exercises_source_check;
alter table public.exercises add constraint exercises_source_check
  check (source in ('CATALOG', 'PRACTITIONER', 'AI_SUGGESTED'));

drop trigger if exists exercises_updated_at on public.exercises;
create trigger exercises_updated_at before update on public.exercises
  for each row execute function public.set_updated_at();

create table if not exists public.exercise_families (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

insert into public.exercise_families (slug, name, description) values
  ('squat', 'Squat family', 'Knee-dominant bilateral squat variations'),
  ('hinge', 'Hinge family', 'Hip-dominant hinge and hip-extension variations'),
  ('split_squat', 'Split squat family', 'Lunge, split squat and step variations'),
  ('horizontal_push', 'Horizontal push family', 'Pressing in the horizontal plane'),
  ('vertical_push', 'Vertical push family', 'Overhead pressing'),
  ('horizontal_pull', 'Horizontal pull family', 'Rowing variations'),
  ('vertical_pull', 'Vertical pull family', 'Pulldown and pull-up variations'),
  ('knee_extension', 'Knee extension family', 'Isolated knee-extensor work'),
  ('knee_flexion', 'Knee flexion family', 'Isolated knee-flexor work'),
  ('hip_abduction', 'Hip abduction family', 'Frontal-plane hip work'),
  ('carry', 'Carry family', 'Loaded carries and grip'),
  ('trunk', 'Trunk family', 'Anti-rotation, anti-extension and related trunk work'),
  ('power_jump', 'Power / jump family', 'Throws, jumps and sprint work'),
  ('aerobic', 'Aerobic family', 'Locomotor aerobic modes'),
  ('mobility', 'Mobility family', 'Mobility and other accessory work')
on conflict (slug) do nothing;

alter table public.exercises
  drop constraint if exists exercises_family_id_fkey;
alter table public.exercises
  add constraint exercises_family_id_fkey
  foreign key (family_id) references public.exercise_families (id) on delete set null;

create table if not exists public.exercise_tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.exercise_tags (slug, name) values
  ('BEGINNER_FRIENDLY', 'Beginner friendly'),
  ('HOME_FRIENDLY', 'Home friendly'),
  ('TIME_EFFICIENT', 'Time efficient'),
  ('LOW_FATIGUE', 'Low fatigue'),
  ('HIGH_LOADING', 'High loading'),
  ('UNILATERAL', 'Unilateral'),
  ('LOW_IMPACT', 'Low impact'),
  ('GOOD_FOR_SUPERSETS', 'Good for supersets'),
  ('MACHINE', 'Machine'),
  ('FREE_WEIGHT', 'Free weight'),
  ('POWER', 'Power'),
  ('BALANCE', 'Balance'),
  ('ASYMMETRY_FRIENDLY', 'Asymmetry friendly')
on conflict (slug) do nothing;

create table if not exists public.exercise_tag_assignments (
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  tag_id uuid not null references public.exercise_tags (id) on delete cascade,
  primary key (exercise_id, tag_id)
);

alter table public.exercise_relationships drop constraint if exists exercise_relationships_relationship_type_check;
alter table public.exercise_relationships add constraint exercise_relationships_relationship_type_check
  check (relationship_type in ('REGRESSION', 'PROGRESSION', 'ALTERNATIVE', 'SIMILAR_STIMULUS'));
alter table public.exercise_relationships add column if not exists practitioner_notes text;
alter table public.exercise_relationships add column if not exists sort_rank integer not null default 0;

create table if not exists public.client_exercise_mastery (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  mastery_level text not null check (mastery_level in ('NOT_ATTEMPTED', 'LEARNING', 'COMPETENT', 'PROFICIENT')),
  last_assessed timestamptz not null default now(),
  source text not null default 'PRACTITIONER',
  practitioner_override boolean not null default false,
  notes text,
  unique (client_id, exercise_id)
);

create table if not exists public.exercise_library_audit (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid references public.exercises (id) on delete set null,
  changed_by uuid references public.practitioners (id) on delete set null,
  changed_at timestamptz not null default now(),
  field_changed text not null,
  old_value text,
  new_value text
);

alter table public.exercise_families enable row level security;
alter table public.exercise_tags enable row level security;
alter table public.exercise_tag_assignments enable row level security;
alter table public.client_exercise_mastery enable row level security;
alter table public.exercise_library_audit enable row level security;

grant select, insert, update, delete on public.exercise_families to authenticated;
grant select, insert, update, delete on public.exercise_tags to authenticated;
grant select, insert, update, delete on public.exercise_tag_assignments to authenticated;
grant select, insert, update, delete on public.client_exercise_mastery to authenticated;
grant select, insert on public.exercise_library_audit to authenticated;

drop policy if exists exercise_families_read on public.exercise_families;
create policy exercise_families_read on public.exercise_families for select to authenticated using (true);
drop policy if exists exercise_families_write on public.exercise_families;
create policy exercise_families_write on public.exercise_families for all to authenticated
  using (exists (select 1 from public.practitioners p where p.id = (select auth.uid())))
  with check (exists (select 1 from public.practitioners p where p.id = (select auth.uid())));

drop policy if exists exercise_tags_read on public.exercise_tags;
create policy exercise_tags_read on public.exercise_tags for select to authenticated using (true);
drop policy if exists exercise_tags_write on public.exercise_tags;
create policy exercise_tags_write on public.exercise_tags for all to authenticated
  using (exists (select 1 from public.practitioners p where p.id = (select auth.uid())))
  with check (exists (select 1 from public.practitioners p where p.id = (select auth.uid())));

drop policy if exists exercise_tag_assignments_read on public.exercise_tag_assignments;
create policy exercise_tag_assignments_read on public.exercise_tag_assignments for select to authenticated using (true);
drop policy if exists exercise_tag_assignments_write on public.exercise_tag_assignments;
create policy exercise_tag_assignments_write on public.exercise_tag_assignments for all to authenticated
  using (exists (select 1 from public.practitioners p where p.id = (select auth.uid())))
  with check (exists (select 1 from public.practitioners p where p.id = (select auth.uid())));

drop policy if exists client_exercise_mastery_practitioner on public.client_exercise_mastery;
create policy client_exercise_mastery_practitioner on public.client_exercise_mastery for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

drop policy if exists exercise_library_audit_read on public.exercise_library_audit;
create policy exercise_library_audit_read on public.exercise_library_audit for select to authenticated
  using (exists (select 1 from public.practitioners p where p.id = (select auth.uid())));
drop policy if exists exercise_library_audit_insert on public.exercise_library_audit;
create policy exercise_library_audit_insert on public.exercise_library_audit for insert to authenticated
  with check (exists (select 1 from public.practitioners p where p.id = (select auth.uid())));
