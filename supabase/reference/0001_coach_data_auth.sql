-- REFERENTIE — coach_data_auth zoals Coach (app.js) die verwacht en LEESMIJ.md hem beschrijft.
-- Status: NIET uitgevoerd op productie (project ckodnfshelblddfypmmv). Of productie hiermee overeenkomt is
-- NIET geverifieerd. Gebruik verify/verify-production.sql (alleen lezen) om te vergelijken.
-- Deel A (tabel, RLS, rechten, 3 policies) = de gedocumenteerde bestaande configuratie.
-- Deel B (trigger en grootte-check onderaan) = AANVULLING/voorstel, bestaat waarschijnlijk niet in productie.
-- Idempotent en additief: maakt niets kapot als de tabel al bestaat, verwijdert geen gegevens.
-- Uitvoeren op productie alleen na expliciet akkoord, verse back-up en hersteltest (ADR 0010, ADR 0011).

create table if not exists public.coach_data_auth (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  id         text        not null,
  payload    jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.coach_data_auth enable row level security;

-- Minimale rechten: anon niets; authenticated alleen SELECT/INSERT/UPDATE (geen DELETE, geen TRUNCATE).
revoke all on table public.coach_data_auth from anon, authenticated;
grant select, insert, update on table public.coach_data_auth to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='coach_data_auth' and policyname='coach_data_auth_select_own') then
    create policy coach_data_auth_select_own on public.coach_data_auth for select to authenticated using (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='coach_data_auth' and policyname='coach_data_auth_insert_own') then
    create policy coach_data_auth_insert_own on public.coach_data_auth for insert to authenticated with check (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='coach_data_auth' and policyname='coach_data_auth_update_own') then
    create policy coach_data_auth_update_own on public.coach_data_auth for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
end $$;

-- ===== Deel B: aanvullingen (voorstel) =====
-- Voorkomt dat een rij via UPDATE naar een andere eigenaar of rij-id wordt verplaatst.
create or replace function public.coach_data_auth_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.user_id is distinct from old.user_id or new.id is distinct from old.id then
    raise exception 'user_id en id zijn onveranderlijk';
  end if;
  return new;
end $$;
revoke execute on function public.coach_data_auth_guard() from public, anon, authenticated;
drop trigger if exists coach_data_auth_guard on public.coach_data_auth;
create trigger coach_data_auth_guard before update on public.coach_data_auth for each row execute function public.coach_data_auth_guard();

-- Grootte begrenzen (versleutelde payload; localStorage is in de praktijk ~5 MB). Voorkomt misbruik als opslagruimte.
do $$
begin
  if not exists (select 1 from pg_constraint where conname='coach_data_auth_payload_size') then
    alter table public.coach_data_auth add constraint coach_data_auth_payload_size check (pg_column_size(payload) <= 10485760) not valid;
  end if;
end $$;
