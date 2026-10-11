-- Grip strength uses the same trial/result tables as isometric tests.
-- test_type = GRIP_STRENGTH. Headline is best valid peak each side.

insert into public.test_protocols (protocol_id, test_name, notes)
values
  (
    'GRIP_STRENGTH',
    'Grip Strength',
    'Three left and three right maximal dynamometer trials. Primary result is best valid peak each side. Mean and CV are QC only.'
  )
on conflict (protocol_id) do nothing;
