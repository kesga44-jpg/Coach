-- ALLEEN LEZEN. Productieverificatie Coach — project ckodnfshelblddfypmmv.
-- Wijzigt niets (alleen SELECT op catalogus en aantallen; geen inhoud van gegevens of bestanden).
-- Uitvoeren in Supabase → SQL Editor. De editor toont alleen het resultaat van de LAATSTE query:
-- dat is de samenvatting (controle / status / toelichting). Voor details: selecteer een losse sectie en voer die uit.
-- Status: OK · RISICO (actie nodig) · AANDACHT (beoordelen) · INFO.
-- Uitkomst vastleggen in docs/SUPABASE.md § Productieverificatie (zonder gegevensinhoud).

-- ===== Detail 1: tabellen in public en RLS =====
select n.nspname as schema, c.relname as tabel, c.relrowsecurity as rls_aan, c.relforcerowsecurity as rls_geforceerd
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind in ('r','p') and n.nspname in ('public','storage') order by 1,2;

-- ===== Detail 2: tabelrechten anon/authenticated/public =====
select table_schema, table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as rechten
from information_schema.role_table_grants
where table_schema in ('public','storage') and grantee in ('anon','authenticated','public')
group by 1,2,3 order by 1,2,3;

-- ===== Detail 3: alle policies in public en op storage.objects/buckets =====
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname in ('public','storage') order by schemaname, tablename, policyname;

-- ===== Detail 4: buckets =====
select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id;

-- ===== Detail 5: aantallen (geen inhoud) =====
select bucket_id, (storage.foldername(name))[1] as map, count(*) as bestanden from storage.objects
where bucket_id in ('coach-knowledge','vc2') group by 1,2 order by 1,2;

-- ===== Samenvatting (laatste query) =====
with
pol as (
  select p.*, coalesce(p.qual,'')||' '||coalesce(p.with_check,'') as expr,
         (p.roles::text[] && array['anon','public']) as voor_anon,
         (p.roles::text[] && array['authenticated','public']) as voor_auth
  from pg_policies p
),
sto as (select * from pol where schemaname='storage' and tablename='objects'),
bk as (select b.id, b.public from storage.buckets b where b.id in ('coach-knowledge','vc2')),
cda as (select to_regclass('public.coach_data_auth') as t),
cd  as (select to_regclass('public.coach_data') as t),
checks(volgorde, controle, status, toelichting) as (
  select 10,'coach_data_auth bestaat',
         case when (select t from cda) is null then 'RISICO' else 'OK' end,
         coalesce((select t::text from cda),'tabel ontbreekt')
  union all
  select 11,'coach_data_auth RLS aan',
         case when (select c.relrowsecurity from pg_class c where c.oid=(select t from cda)) then 'OK' else 'RISICO' end,
         'row level security'
  union all
  select 12,'coach_data_auth: geen tabelrechten voor anon',
         case when (select t from cda) is null then 'INFO'
              when has_table_privilege('anon',(select t from cda),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then 'RISICO' else 'OK' end,
         'anon hoort geen rechten te hebben (RLS is dan tweede verdedigingslinie)'
  union all
  select 13,'coach_data_auth: geen DELETE/TRUNCATE voor authenticated',
         case when (select t from cda) is null then 'INFO'
              when has_table_privilege('authenticated',(select t from cda),'DELETE,TRUNCATE') then 'AANDACHT' else 'OK' end,
         'de app verwijdert nooit; minimale rechten'
  union all
  select 14,'coach_data_auth: policies alleen eigen rij (auth.uid)',
         case when not exists (select 1 from pol where schemaname='public' and tablename='coach_data_auth') then 'RISICO'
              when exists (select 1 from pol where schemaname='public' and tablename='coach_data_auth'
                           and (voor_anon or expr not like '%auth.uid()%' or cmd in ('DELETE','ALL'))) then 'RISICO'
              else 'OK' end,
         (select coalesce(string_agg(policyname||' ['||cmd||' '||roles::text||']',', '),'geen policies') from pol where schemaname='public' and tablename='coach_data_auth')
  union all
  select 20,'oude tabel coach_data',
         case when (select t from cd) is null then 'OK'
              when has_table_privilege('anon',(select t from cd),'SELECT,INSERT,UPDATE,DELETE')
                   and (not (select c.relrowsecurity from pg_class c where c.oid=(select t from cd))
                        or exists (select 1 from pol where schemaname='public' and tablename='coach_data' and voor_anon)) then 'RISICO'
              else 'AANDACHT' end,
         'wordt door de app niet meer gebruikt; anon-toegang = versleutelde maar openbare/overschrijfbare data. Niets wijzigen zonder akkoord.'
  union all
  select 30,'storage.objects RLS aan',
         case when (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='storage' and c.relname='objects') then 'OK' else 'RISICO' end,
         'zonder RLS bepalen alleen tabelrechten de toegang'
  union all
  select 31,'storage.objects tabelrechten anon/authenticated',
         'INFO',
         (select coalesce(string_agg(grantee||': '||privilege_type,', ' order by grantee,privilege_type),'geen') from information_schema.role_table_grants
          where table_schema='storage' and table_name='objects' and grantee in ('anon','authenticated'))
         ||' — normaal bij Supabase; bescherming komt uit RLS-policies'
  union all
  select 32,'storage.objects: policies zonder bucketfilter',
         case when exists (select 1 from sto where expr not like '%bucket_id%' and (voor_anon or voor_auth)) then 'RISICO' else 'OK' end,
         (select coalesce(string_agg(policyname||' ['||cmd||']',', '),'geen') from sto where expr not like '%bucket_id%' and (voor_anon or voor_auth))
         ||' — gelden voor ALLE buckets'
  union all
  select 40,'bucket coach-knowledge bestaat en is privé',
         case when not exists (select 1 from bk where id='coach-knowledge') then 'AANDACHT'
              when (select public from bk where id='coach-knowledge') then 'RISICO' else 'OK' end,
         'public=true maakt bestanden via openbare URL leesbaar'
  union all
  select 41,'coach-knowledge: anon mag lezen/oplijsten',
         case when exists (select 1 from sto where voor_anon and cmd in ('SELECT','ALL') and expr like '%coach-knowledge%') then 'RISICO' else 'OK' end,
         'objectnamen en versleutelde bestanden opvraagbaar met de publishable key; mapnaam = SHA-256 van de Secret key'
  union all
  select 42,'coach-knowledge: anon mag schrijven/overschrijven',
         case when exists (select 1 from sto where voor_anon and cmd in ('INSERT','UPDATE','DELETE','ALL') and expr like '%coach-knowledge%') then 'RISICO' else 'OK' end,
         (select coalesce(string_agg(policyname||' ['||cmd||']',', '),'geen') from sto where voor_anon and expr like '%coach-knowledge%')
  union all
  select 43,'coach-knowledge: authenticated alleen eigen map',
         case when not exists (select 1 from sto where voor_auth and not voor_anon and expr like '%coach-knowledge%') then 'INFO'
              when exists (select 1 from sto where voor_auth and not voor_anon and expr like '%coach-knowledge%' and expr not like '%auth.uid()%') then 'RISICO'
              else 'OK' end,
         'INFO = nog geen authenticated-policies (huidige app gebruikt anon)'
  union all
  select 50,'bucket vc2 bestaat en is privé',
         case when not exists (select 1 from bk where id='vc2') then 'AANDACHT'
              when (select public from bk where id='vc2') then 'RISICO' else 'OK' end,
         'public=true maakt documenten via openbare URL leesbaar'
  union all
  select 51,'vc2: anon mag lezen/oplijsten',
         case when exists (select 1 from sto where voor_anon and cmd in ('SELECT','ALL') and expr like '%vc2%') then 'AANDACHT' else 'INFO' end,
         'de huidige app leest vc2 met de publishable key; AANDACHT = documenten leesbaar voor iedereen met die sleutel. INFO = geen anon-leesrecht (dan werkt VC2-lezen in de app niet)'
  union all
  select 52,'vc2: anon mag schrijven/overschrijven',
         case when exists (select 1 from sto where voor_anon and cmd in ('INSERT','UPDATE','DELETE','ALL') and expr like '%vc2%') then 'RISICO' else 'OK' end,
         'de app schrijft nooit naar vc2'
  union all
  select 60,'public: tabellen zonder RLS',
         case when exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity) then 'RISICO' else 'OK' end,
         (select coalesce(string_agg(c.relname,', '),'geen') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity)
  union all
  select 61,'public: SECURITY DEFINER-functies uitvoerbaar door anon',
         case when exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and has_function_privilege('anon',p.oid,'EXECUTE')) then 'AANDACHT' else 'OK' end,
         (select coalesce(string_agg(p.proname,', '),'geen') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and has_function_privilege('anon',p.oid,'EXECUTE'))
)
select controle, status, toelichting from checks order by volgorde;
