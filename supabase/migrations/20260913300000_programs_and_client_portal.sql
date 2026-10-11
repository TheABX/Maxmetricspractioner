-- Client portal, questionnaire, training programs, logging, notifications.
-- Run after the mobility migration.

-- ---------------------------------------------------------------------------
-- Roles: a client is an auth user bound to a clients row. Everyone else is a
-- practitioner. New sign-ups with raw_user_meta_data.role = 'client' do not
-- get a practitioners row.
-- ---------------------------------------------------------------------------

alter table public.clients
  add column if not exists auth_user_id uuid unique references auth.users (id) on delete set null,
  add column if not exists invited_at timestamptz,
  add column if not exists portal_activated_at timestamptz;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.raw_user_meta_data->>'role', 'practitioner') = 'client' then
    return new;
  end if;
  insert into public.practitioners (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Current caller's client row (null for practitioners).
create or replace function public.current_client_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.clients where auth_user_id = auth.uid() limit 1;
$$;
revoke all on function public.current_client_id() from public;
grant execute on function public.current_client_id() to authenticated;

-- Bind the signed-in user to the client record that carries their email.
create or replace function public.claim_client_profile()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  user_email text;
  cid uuid;
begin
  if uid is null then return null; end if;
  select id into cid from public.clients where auth_user_id = uid limit 1;
  if cid is not null then return cid; end if;
  select lower(email) into user_email from auth.users where id = uid;
  if user_email is null then return null; end if;
  update public.clients
     set auth_user_id = uid, portal_activated_at = now()
   where lower(email) = user_email and auth_user_id is null
   returning id into cid;
  return cid;
end;
$$;
revoke all on function public.claim_client_profile() from public;
grant execute on function public.claim_client_profile() to authenticated;

-- ---------------------------------------------------------------------------
-- Reports gain an approval state.
-- ---------------------------------------------------------------------------
alter table public.generated_reports
  add column if not exists status text not null default 'draft'
    check (status in ('draft', 'approved', 'sent')),
  add column if not exists approved_at timestamptz,
  add column if not exists sent_at timestamptz;

-- ---------------------------------------------------------------------------
-- Questionnaire
-- ---------------------------------------------------------------------------
create table if not exists public.questionnaires (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique,
  title text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.questionnaires (version, title)
values (1, 'Client intake — goals, training history, health, lifestyle')
on conflict (version) do nothing;

create table if not exists public.questionnaire_responses (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  assessment_session_id uuid references public.assessment_sessions (id) on delete set null,
  questionnaire_version integer not null default 1 references public.questionnaires (version),
  answers jsonb not null default '{}'::jsonb,
  load_bucket text check (load_bucket in ('knows_loads', 'trains_no_numbers', 'untrained')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists questionnaire_responses_client_idx on public.questionnaire_responses (client_id);

-- ---------------------------------------------------------------------------
-- Exercise library
-- ---------------------------------------------------------------------------
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid references public.practitioners (id) on delete cascade,
  name text not null,
  pattern text not null check (pattern in ('squat','hinge','lunge','push','pull','carry','core','mobility','power','conditioning','other')),
  regions jsonb not null default '[]'::jsonb,
  equipment text,
  unilateral boolean not null default false,
  video_url text,
  cues text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (practitioner_id, name)
);

insert into public.exercises (name, pattern, regions, equipment, unilateral) values
  ('Goblet Squat', 'squat', '["quads","hips"]', 'dumbbell/kettlebell', false),
  ('Box Squat', 'squat', '["quads","hips"]', 'barbell/bodyweight', false),
  ('Back Squat', 'squat', '["quads","hips"]', 'barbell', false),
  ('Split Squat', 'lunge', '["quads","hips"]', 'dumbbell', true),
  ('Reverse Lunge', 'lunge', '["quads","hips"]', 'dumbbell', true),
  ('Step-up', 'lunge', '["quads","hips"]', 'box', true),
  ('Trap Bar Deadlift', 'hinge', '["posterior_chain","hips"]', 'trap bar', false),
  ('Romanian Deadlift', 'hinge', '["hamstrings","hips"]', 'barbell/dumbbell', false),
  ('Single-leg RDL', 'hinge', '["hamstrings","hips"]', 'dumbbell', true),
  ('Hip Thrust', 'hinge', '["hips"]', 'barbell/bench', false),
  ('Side-lying Hip Abduction', 'other', '["lateral_hip"]', 'bodyweight/band', true),
  ('Lateral Band Walk', 'other', '["lateral_hip"]', 'band', false),
  ('Dumbbell Bench Press', 'push', '["chest","shoulders"]', 'dumbbell', false),
  ('Push-up', 'push', '["chest","shoulders"]', 'bodyweight', false),
  ('Landmine Press', 'push', '["shoulders"]', 'barbell', true),
  ('Dumbbell Row', 'pull', '["upper_back","arms"]', 'dumbbell', true),
  ('Cable Row', 'pull', '["upper_back"]', 'cable', false),
  ('Lat Pulldown', 'pull', '["upper_back"]', 'cable', false),
  ('Farmer Carry', 'carry', '["grip","trunk"]', 'dumbbell/kettlebell', false),
  ('Suitcase Carry', 'carry', '["grip","trunk","lateral_hip"]', 'dumbbell/kettlebell', true),
  ('Dead Hang', 'carry', '["grip","shoulders"]', 'bar', false),
  ('Pallof Press', 'core', '["trunk"]', 'cable/band', true),
  ('Dead Bug', 'core', '["trunk"]', 'bodyweight', false),
  ('Ankle Dorsiflexion Rock', 'mobility', '["ankle"]', 'wall/bench', true),
  ('90/90 Hip Switch', 'mobility', '["hips"]', 'bodyweight', false),
  ('Wall Slide', 'mobility', '["shoulders"]', 'wall', false),
  ('Med Ball Slam', 'power', '["full_body"]', 'medicine ball', false),
  ('Box Jump (step down)', 'power', '["quads","hips"]', 'box', false),
  ('Bike Intervals', 'conditioning', '["full_body"]', 'bike', false),
  ('Incline Walk', 'conditioning', '["full_body"]', 'treadmill', false)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Programs
-- ---------------------------------------------------------------------------
create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  assessment_session_id uuid references public.assessment_sessions (id) on delete set null,
  questionnaire_response_id uuid references public.questionnaire_responses (id) on delete set null,
  parent_program_id uuid references public.programs (id) on delete set null,
  version integer not null default 1,
  title text not null default '12-week program',
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'sent', 'active', 'completed', 'archived')),
  start_date date,
  weeks integer not null default 12 check (weeks between 1 and 52),
  days_per_week integer not null default 3 check (days_per_week between 1 and 7),
  rationale jsonb not null default '{}'::jsonb,
  practitioner_notes text,
  client_message text,
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists programs_client_idx on public.programs (client_id);

create table if not exists public.program_sessions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  week integer not null,
  day integer not null,
  title text not null default '',
  focus text,
  notes text,
  unique (program_id, week, day)
);
create index if not exists program_sessions_program_idx on public.program_sessions (program_id);

create table if not exists public.program_exercises (
  id uuid primary key default gen_random_uuid(),
  program_session_id uuid not null references public.program_sessions (id) on delete cascade,
  position integer not null default 0,
  exercise_id uuid references public.exercises (id) on delete set null,
  exercise_name text not null,
  side text not null default 'both' check (side in ('both', 'left', 'right', 'each')),
  sets integer not null default 3,
  reps text not null default '8',
  load_prescription text,
  rpe_target numeric,
  tempo text,
  rest_seconds integer,
  notes text
);
create index if not exists program_exercises_session_idx on public.program_exercises (program_session_id);

-- ---------------------------------------------------------------------------
-- Client logging
-- ---------------------------------------------------------------------------
create table if not exists public.session_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  program_session_id uuid not null references public.program_sessions (id) on delete cascade,
  completed_at timestamptz,
  skipped boolean not null default false,
  overall_rpe numeric,
  duration_minutes integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, program_session_id)
);

create table if not exists public.set_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  program_exercise_id uuid not null references public.program_exercises (id) on delete cascade,
  set_number integer not null,
  side text not null default 'both' check (side in ('both', 'left', 'right')),
  reps_done integer,
  load_used numeric,
  rpe numeric,
  pain_0_10 integer check (pain_0_10 between 0 and 10),
  notes text,
  logged_at timestamptz not null default now(),
  unique (client_id, program_exercise_id, set_number, side)
);
create index if not exists set_logs_exercise_idx on public.set_logs (program_exercise_id);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  type text not null,
  to_email text,
  subject text,
  provider text,
  provider_id text,
  status text not null default 'queued',
  error text,
  created_at timestamptz not null default now()
);

-- updated_at triggers
drop trigger if exists programs_updated_at on public.programs;
create trigger programs_updated_at before update on public.programs
  for each row execute function public.set_updated_at();
drop trigger if exists questionnaire_responses_updated_at on public.questionnaire_responses;
create trigger questionnaire_responses_updated_at before update on public.questionnaire_responses
  for each row execute function public.set_updated_at();
drop trigger if exists session_logs_updated_at on public.session_logs;
create trigger session_logs_updated_at before update on public.session_logs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.questionnaires enable row level security;
alter table public.questionnaire_responses enable row level security;
alter table public.exercises enable row level security;
alter table public.programs enable row level security;
alter table public.program_sessions enable row level security;
alter table public.program_exercises enable row level security;
alter table public.session_logs enable row level security;
alter table public.set_logs enable row level security;
alter table public.notifications enable row level security;

grant select on public.questionnaires to authenticated;
grant select, insert, update, delete on public.questionnaire_responses to authenticated;
grant select, insert, update, delete on public.exercises to authenticated;
grant select, insert, update, delete on public.programs to authenticated;
grant select, insert, update, delete on public.program_sessions to authenticated;
grant select, insert, update, delete on public.program_exercises to authenticated;
grant select, insert, update, delete on public.session_logs to authenticated;
grant select, insert, update, delete on public.set_logs to authenticated;
grant select, insert, update on public.notifications to authenticated;

-- Clients can read their own client row.
drop policy if exists clients_self_read on public.clients;
create policy clients_self_read on public.clients
  for select to authenticated
  using (auth_user_id = (select auth.uid()));

-- Clients can read their own sent reports.
drop policy if exists generated_reports_client_read on public.generated_reports;
create policy generated_reports_client_read on public.generated_reports
  for select to authenticated
  using (client_id = public.current_client_id() and status = 'sent');

drop policy if exists questionnaires_read on public.questionnaires;
create policy questionnaires_read on public.questionnaires
  for select to authenticated using (true);

drop policy if exists questionnaire_responses_practitioner on public.questionnaire_responses;
create policy questionnaire_responses_practitioner on public.questionnaire_responses
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

drop policy if exists questionnaire_responses_client_read on public.questionnaire_responses;
create policy questionnaire_responses_client_read on public.questionnaire_responses
  for select to authenticated
  using (client_id = public.current_client_id());

drop policy if exists questionnaire_responses_client_insert on public.questionnaire_responses;
create policy questionnaire_responses_client_insert on public.questionnaire_responses
  for insert to authenticated
  with check (
    client_id = public.current_client_id()
    and practitioner_id = (select practitioner_id from public.clients where id = public.current_client_id())
  );

drop policy if exists questionnaire_responses_client_update on public.questionnaire_responses;
create policy questionnaire_responses_client_update on public.questionnaire_responses
  for update to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

drop policy if exists exercises_read on public.exercises;
create policy exercises_read on public.exercises
  for select to authenticated
  using (practitioner_id is null or practitioner_id = (select auth.uid()));

drop policy if exists exercises_write on public.exercises;
create policy exercises_write on public.exercises
  for all to authenticated
  using (practitioner_id = (select auth.uid()))
  with check (practitioner_id = (select auth.uid()));

drop policy if exists programs_practitioner on public.programs;
create policy programs_practitioner on public.programs
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

drop policy if exists programs_client_read on public.programs;
create policy programs_client_read on public.programs
  for select to authenticated
  using (client_id = public.current_client_id() and status in ('sent', 'active', 'completed'));

drop policy if exists program_sessions_practitioner on public.program_sessions;
create policy program_sessions_practitioner on public.program_sessions
  for all to authenticated
  using (exists (select 1 from public.programs p where p.id = program_id and p.practitioner_id = (select auth.uid())))
  with check (exists (select 1 from public.programs p where p.id = program_id and p.practitioner_id = (select auth.uid())));

drop policy if exists program_sessions_client_read on public.program_sessions;
create policy program_sessions_client_read on public.program_sessions
  for select to authenticated
  using (exists (
    select 1 from public.programs p
    where p.id = program_id and p.client_id = public.current_client_id() and p.status in ('sent','active','completed')
  ));

drop policy if exists program_exercises_practitioner on public.program_exercises;
create policy program_exercises_practitioner on public.program_exercises
  for all to authenticated
  using (exists (
    select 1 from public.program_sessions s join public.programs p on p.id = s.program_id
    where s.id = program_session_id and p.practitioner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.program_sessions s join public.programs p on p.id = s.program_id
    where s.id = program_session_id and p.practitioner_id = (select auth.uid())
  ));

drop policy if exists program_exercises_client_read on public.program_exercises;
create policy program_exercises_client_read on public.program_exercises
  for select to authenticated
  using (exists (
    select 1 from public.program_sessions s join public.programs p on p.id = s.program_id
    where s.id = program_session_id and p.client_id = public.current_client_id() and p.status in ('sent','active','completed')
  ));

drop policy if exists session_logs_client on public.session_logs;
create policy session_logs_client on public.session_logs
  for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

drop policy if exists session_logs_practitioner_read on public.session_logs;
create policy session_logs_practitioner_read on public.session_logs
  for select to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.practitioner_id = (select auth.uid())));

drop policy if exists set_logs_client on public.set_logs;
create policy set_logs_client on public.set_logs
  for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

drop policy if exists set_logs_practitioner_read on public.set_logs;
create policy set_logs_practitioner_read on public.set_logs
  for select to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.practitioner_id = (select auth.uid())));

drop policy if exists notifications_practitioner on public.notifications;
create policy notifications_practitioner on public.notifications
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

-- Clients may read the PDF object of a report that has been sent to them.
drop policy if exists assessment_files_client_select on storage.objects;
create policy assessment_files_client_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'assessment-files'
    and exists (
      select 1 from public.generated_reports r
      where r.storage_path = name and r.status = 'sent' and r.client_id = public.current_client_id()
    )
  );
