-- Rollback van de AANVULLINGEN uit 0001 (trigger en grootte-check). Tabel, gegevens en policies blijven bestaan:
-- die horen bij de bestaande productieconfiguratie en worden nooit door een rollback verwijderd.
drop trigger if exists coach_data_auth_guard on public.coach_data_auth;
drop function if exists public.coach_data_auth_guard();
alter table public.coach_data_auth drop constraint if exists coach_data_auth_payload_size;
