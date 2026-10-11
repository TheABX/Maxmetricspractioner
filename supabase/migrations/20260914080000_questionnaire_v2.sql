-- Questionnaire v2: goal profile, training appetite, lift familiarity,
-- movement confidence, access detail, preferences. Field definitions live in
-- lib/questionnaire/schema.ts; this row records the version for provenance.
insert into public.questionnaires (version, title)
values (2, 'Client intake v2 — goals, appetite, experience, movement, access, preferences, health, lifestyle')
on conflict (version) do nothing;
