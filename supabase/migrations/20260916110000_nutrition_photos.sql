-- Photo meal logs: custom macros plus a private meal-photos bucket.

alter table public.nutrition_entries
  add column if not exists source text not null default 'library',
  add column if not exists custom_name text,
  add column if not exists kcal numeric,
  add column if not exists protein_g numeric,
  add column if not exists carb_g numeric,
  add column if not exists fat_g numeric,
  add column if not exists photo_path text,
  add column if not exists estimate jsonb not null default '{}'::jsonb;

alter table public.nutrition_entries drop constraint if exists nutrition_entries_source_check;
alter table public.nutrition_entries
  add constraint nutrition_entries_source_check check (source in ('library', 'photo'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meal-photos',
  'meal-photos',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists meal_photos_client_select on storage.objects;
create policy meal_photos_client_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = public.current_client_id()::text
  );

drop policy if exists meal_photos_client_write on storage.objects;
create policy meal_photos_client_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = public.current_client_id()::text
  );

drop policy if exists meal_photos_client_update on storage.objects;
create policy meal_photos_client_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = public.current_client_id()::text
  )
  with check (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = public.current_client_id()::text
  );

drop policy if exists meal_photos_client_delete on storage.objects;
create policy meal_photos_client_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = public.current_client_id()::text
  );

drop policy if exists meal_photos_practitioner_select on storage.objects;
create policy meal_photos_practitioner_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'meal-photos'
    and exists (
      select 1 from public.clients c
      where c.id::text = (storage.foldername(name))[1]
        and c.practitioner_id = (select auth.uid())
    )
  );
