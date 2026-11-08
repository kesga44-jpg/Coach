-- Toont LOKAAL het risico van de huidige (door de app voorgestelde) anon-policies op coach-knowledge.
\set ON_ERROR_STOP on
-- policies zoals app.js knowledgeStorageSql() ze voorschrijft
create policy "coach knowledge read" on storage.objects for select to anon using (bucket_id='coach-knowledge');
create policy "coach knowledge insert" on storage.objects for insert to anon with check (bucket_id='coach-knowledge');
create policy "coach knowledge update" on storage.objects for update to anon using (bucket_id='coach-knowledge') with check (bucket_id='coach-knowledge');
insert into storage.objects(bucket_id,name,metadata) values ('coach-knowledge','a1b2c3/pvb1.fckb','{"size":100}');
begin;
set local role anon;
do $$ declare n int; begin
  select count(*) into n from storage.objects where bucket_id='coach-knowledge';
  if n<>1 then raise exception 'verwacht: anon kan objectnamen zien'; end if;
  update storage.objects set metadata='{"size":1}' where name='a1b2c3/pvb1.fckb';
  get diagnostics n=row_count;
  if n<>1 then raise exception 'verwacht: anon kan bestaand object overschrijven'; end if;
  insert into storage.objects(bucket_id,name) values ('coach-knowledge','vreemd/bestand.fckb');
end $$;
commit;
\echo 'AANGETOOND (lokaal): met de huidige app-policies kan anon objecten in coach-knowledge zien, toevoegen en overschrijven'
