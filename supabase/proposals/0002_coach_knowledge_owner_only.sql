-- VOORSTEL — bucket coach-knowledge alleen voor de ingelogde eigenaar (R8 / PR-10).
-- Status: NIET uitgevoerd. Vereist eerst: akkoord eigenaar, PR-9 (backend geverifieerd), PR-3 (back-up opslag)
-- en een app-wijziging (PR-10) die uploadt naar <auth.uid()>/<id>.fckb met het access token i.p.v. de publieke sleutel.
-- Zonder die app-wijziging breekt dit het koppelen/openen van kennisbankoriginelen in de huidige app.
--
-- Huidige situatie volgens de SQL die de app zelf toont (app.js knowledgeStorageSql):
--   anon mag SELECT, INSERT en UPDATE op ALLE objecten in de bucket. Daarmee kan iedereen met de publishable key
--   de objectnamen opvragen (list), versleutelde bestanden downloaden en bestaande bestanden overschrijven (x-upsert).
--   Of productie exact zo is ingericht is NIET geverifieerd.
--
-- Bestaande bestanden staan in <sha256(namespace:secret)>/<id>.fckb. Die worden door dit voorstel NIET verplaatst
-- of verwijderd; een overgangsscript (kopiëren naar <uid>/…, pas na controle oude map opruimen) hoort bij PR-10.

update storage.buckets set public = false where id = 'coach-knowledge';

drop policy if exists "coach knowledge read"   on storage.objects;
drop policy if exists "coach knowledge insert" on storage.objects;
drop policy if exists "coach knowledge update" on storage.objects;

create policy "coach knowledge owner read" on storage.objects for select to authenticated
  using (bucket_id = 'coach-knowledge' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "coach knowledge owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'coach-knowledge' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "coach knowledge owner update" on storage.objects for update to authenticated
  using (bucket_id = 'coach-knowledge' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'coach-knowledge' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Bewust GEEN delete-policy: verwijderen gebeurt alleen bewust via het dashboard.
