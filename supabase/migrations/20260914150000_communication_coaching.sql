-- Layer 7: client messages, prefs, follow-ups, audit. Coaching assistant, not a clinician.

create table if not exists public.comms_preferences (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid not null unique references public.clients (id) on delete cascade,
  preferred_name text,
  preferred_contact_method text not null default 'IN_APP',
  allow_automated_email boolean not null default true,
  allow_push_notifications boolean not null default false,
  email_enabled boolean not null default true,
  push_enabled boolean not null default false,
  contact_frequency text not null default 'STANDARD',
  communication_style_preference text not null default 'casual_professional',
  quiet_hours text,
  explained_absence boolean not null default false,
  absence_note text,
  updated_at timestamptz not null default now()
);

create table if not exists public.practitioner_comms (
  practitioner_id uuid primary key references public.practitioners (id) on delete cascade,
  tone text not null default 'casual_professional',
  automation text not null default 'LEVEL_1_ROUTINE_AUTO',
  max_routine_messages_per_week integer not null default 2,
  minimum_days_between_encouragement integer not null default 10,
  updated_at timestamptz not null default now()
);

create table if not exists public.client_messages (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  assessment_id uuid,
  program_id uuid references public.programs (id) on delete set null,
  event_type text not null,
  priority text not null default 'NORMAL',
  message_channel text not null default 'IN_APP',
  message_text text not null,
  generated_by text not null default 'TEMPLATE',
  automation_status text not null default 'DRAFT' check (automation_status in ('DRAFT', 'PENDING_APPROVAL', 'SCHEDULED', 'SENT', 'CANCELLED')),
  trigger_data jsonb not null default '{}'::jsonb,
  practitioner_reviewed boolean not null default false,
  practitioner_notes text,
  direction text not null default 'OUT' check (direction in ('OUT', 'IN')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists client_messages_client_idx on public.client_messages (client_id, created_at desc);
create index if not exists client_messages_status_idx on public.client_messages (practitioner_id, automation_status);

create table if not exists public.comms_follow_ups (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  related_message_id uuid references public.client_messages (id) on delete set null,
  issue text not null,
  due_on date not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'DONE', 'OVERDUE')),
  created_at timestamptz not null default now()
);

create table if not exists public.comms_audit (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  event text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.comms_templates (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid references public.practitioners (id) on delete cascade,
  slug text not null,
  name text not null,
  event_type text not null,
  body text not null,
  unique (practitioner_id, slug)
);
create unique index if not exists comms_templates_shared_slug on public.comms_templates (slug) where practitioner_id is null;

drop trigger if exists comms_preferences_updated_at on public.comms_preferences;
create trigger comms_preferences_updated_at before update on public.comms_preferences
  for each row execute function public.set_updated_at();
drop trigger if exists practitioner_comms_updated_at on public.practitioner_comms;
create trigger practitioner_comms_updated_at before update on public.practitioner_comms
  for each row execute function public.set_updated_at();

alter table public.comms_preferences enable row level security;
alter table public.practitioner_comms enable row level security;
alter table public.client_messages enable row level security;
alter table public.comms_follow_ups enable row level security;
alter table public.comms_audit enable row level security;
alter table public.comms_templates enable row level security;

grant select, insert, update, delete on public.comms_preferences to authenticated;
grant select, insert, update, delete on public.practitioner_comms to authenticated;
grant select, insert, update, delete on public.client_messages to authenticated;
grant select, insert, update, delete on public.comms_follow_ups to authenticated;
grant select, insert, update, delete on public.comms_audit to authenticated;
grant select, insert, update, delete on public.comms_templates to authenticated;

create policy comms_preferences_practitioner on public.comms_preferences
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

create policy comms_preferences_client on public.comms_preferences
  for select to authenticated
  using (client_id = public.current_client_id());

create policy practitioner_comms_self on public.practitioner_comms
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

create policy client_messages_practitioner on public.client_messages
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

create policy client_messages_client_read on public.client_messages
  for select to authenticated
  using (
    client_id = public.current_client_id()
    and (automation_status = 'SENT' or direction = 'IN')
  );

create policy client_messages_client_write on public.client_messages
  for insert to authenticated
  with check (
    client_id = public.current_client_id()
    and (
      direction = 'IN'
      or (generated_by in ('AI', 'TEMPLATE') and event_type in ('COACH_REPLY', 'PAIN_REPORTED', 'CHECK_IN_REQUIRED'))
    )
  );

create policy comms_follow_ups_practitioner on public.comms_follow_ups
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

create policy comms_audit_practitioner on public.comms_audit
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

create policy comms_templates_read on public.comms_templates
  for select to authenticated
  using (practitioner_id is null or (select auth.uid()) = practitioner_id);

create policy comms_templates_write on public.comms_templates
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

insert into public.comms_templates (practitioner_id, slug, name, event_type, body) values
  (null, 'progress', 'Positive progress', 'PROGRESS_POSITIVE', 'Hey {{name}}, great work over the last couple of weeks. {{detail}} Keep it up, and please sing out if you need any help.'),
  (null, 'missed', 'Missed sessions', 'MISSED_SESSIONS', 'Hey {{name}}, I noticed you''ve missed a couple of sessions recently. Just checking everything''s going okay and whether the current schedule is still working for you.'),
  (null, 'pain', 'Pain follow-up', 'PAIN_REPORTED', 'Hi {{name}}, I noticed you reported discomfort. I''ve paused progression on that exercise for now. Please don''t continue it if it is causing significant discomfort.'),
  (null, 'retest', 'Retest reminder', 'RETEST_DUE', 'Hey {{name}}, you''re approaching the end of this block. A retest will show how things have changed since baseline.'),
  (null, 'adjusted', 'Program adjusted', 'PROGRAM_ADJUSTED', 'Hi {{name}}, I''ve made a small adjustment to your program. {{detail}}'),
  (null, 'welcome', 'Welcome', 'OTHER', 'Hey {{name}}, your program is in the portal. Log sessions as you go so we can adjust from real data.')
on conflict do nothing;
