-- Rollback van voorstel 0002: zet de policies terug zoals de app ze in 2.9.1 voorschreef (anon lezen/schrijven).
drop policy if exists "coach knowledge owner read"   on storage.objects;
drop policy if exists "coach knowledge owner insert" on storage.objects;
drop policy if exists "coach knowledge owner update" on storage.objects;
create policy "coach knowledge read" on storage.objects for select to anon using (bucket_id='coach-knowledge');
create policy "coach knowledge insert" on storage.objects for insert to anon with check (bucket_id='coach-knowledge');
create policy "coach knowledge update" on storage.objects for update to anon using (bucket_id='coach-knowledge') with check (bucket_id='coach-knowledge');
