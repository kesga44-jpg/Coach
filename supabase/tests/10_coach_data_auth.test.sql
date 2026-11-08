-- RLS-tests coach_data_auth: eigenaar mag, ander niet, anon niets. Faalt met een exception bij een fout.
\set ON_ERROR_STOP on
create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$
begin
  if u is null then perform set_config('role','anon',true); perform set_config('request.jwt.claim.sub','',true);
  else perform set_config('role','authenticated',true); perform set_config('request.jwt.claim.sub',u,true); end if;
end $$;

begin;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into public.coach_data_auth(user_id,id,payload) values ('11111111-1111-1111-1111-111111111111','football-coach-v2','{"v":1}');
do $$ begin
  if (select count(*) from public.coach_data_auth)<>1 then raise exception 'FOUT: eigenaar ziet eigen rij niet'; end if;
  begin
    insert into public.coach_data_auth(user_id,id,payload) values ('22222222-2222-2222-2222-222222222222','football-coach-v2','{}');
    raise exception 'FOUT: insert voor ander account toegestaan';
  exception when insufficient_privilege then null; end;
  begin delete from public.coach_data_auth; raise exception 'FOUT: delete toegestaan';
  exception when insufficient_privilege then null; end;
  begin update public.coach_data_auth set user_id='22222222-2222-2222-2222-222222222222';
    raise exception 'FOUT: eigenaar wijzigen toegestaan';
  exception when insufficient_privilege or raise_exception then
    if sqlerrm like 'FOUT:%' then raise; end if; end;
end $$;
commit;

begin;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
do $$ begin
  if (select count(*) from public.coach_data_auth)<>0 then raise exception 'FOUT: ander account ziet rij van eigenaar'; end if;
  update public.coach_data_auth set payload='{"x":1}';
end $$;
commit;
select count(*) filter (where payload='{"x":1}') = 0 as ander_kon_niet_wijzigen from public.coach_data_auth \gset
\if :ander_kon_niet_wijzigen
\else
  \echo 'FOUT: ander account kon rij wijzigen' \q
\endif

begin;
select pg_temp.as_user(null);
do $$ begin
  begin perform 1 from public.coach_data_auth; raise exception 'FOUT: anon kan lezen';
  exception when insufficient_privilege then null; end;
  begin insert into public.coach_data_auth(user_id,id,payload) values ('11111111-1111-1111-1111-111111111111','x','{}'); raise exception 'FOUT: anon kan schrijven';
  exception when insufficient_privilege then null; end;
end $$;
commit;

begin;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
-- optimistische conflictcontrole zoals de app: update met updated_at-filter op oude waarde raakt 0 rijen
do $$ declare n int; old timestamptz; begin
  select updated_at into old from public.coach_data_auth;
  update public.coach_data_auth set payload='{"v":2}', updated_at=old+interval '1 second' where updated_at=old;
  get diagnostics n=row_count; if n<>1 then raise exception 'FOUT: eerste update moet slagen'; end if;
  update public.coach_data_auth set payload='{"v":3}', updated_at=old+interval '2 second' where updated_at=old;
  get diagnostics n=row_count; if n<>0 then raise exception 'FOUT: verouderde update mag niets raken'; end if;
end $$;
commit;
\echo 'OK coach_data_auth: eigenaar/ander/anon/conflictcontrole'
