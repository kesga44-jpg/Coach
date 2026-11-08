-- Test van voorstel 0002 (na toepassen): alleen de ingelogde eigenaar in de eigen map.
\set ON_ERROR_STOP on
insert into storage.objects(bucket_id,name) values ('coach-knowledge','11111111-1111-1111-1111-111111111111/pvb1.fckb') on conflict do nothing;
begin;
set local role anon;
do $$ declare n int; begin
  select count(*) into n from storage.objects where bucket_id='coach-knowledge';
  if n<>0 then raise exception 'FOUT: anon ziet nog objecten'; end if;
  begin insert into storage.objects(bucket_id,name) values ('coach-knowledge','x/y.fckb'); raise exception 'FOUT: anon kan uploaden';
  exception when insufficient_privilege then null; end;
  update storage.objects set metadata='{}' where bucket_id='coach-knowledge';
  get diagnostics n=row_count; if n<>0 then raise exception 'FOUT: anon kan overschrijven'; end if;
end $$;
commit;
begin;
select set_config('role','authenticated',true), set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
do $$ declare n int; begin
  select count(*) into n from storage.objects where bucket_id='coach-knowledge';
  if n<>0 then raise exception 'FOUT: ander account ziet bestanden van eigenaar'; end if;
  begin insert into storage.objects(bucket_id,name) values ('coach-knowledge','11111111-1111-1111-1111-111111111111/inbraak.fckb'); raise exception 'FOUT: schrijven in map van ander';
  exception when insufficient_privilege then null; end;
  insert into storage.objects(bucket_id,name) values ('coach-knowledge','22222222-2222-2222-2222-222222222222/eigen.fckb');
end $$;
commit;
begin;
select set_config('role','authenticated',true), set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
do $$ declare n int; begin
  select count(*) into n from storage.objects where bucket_id='coach-knowledge';
  if n<>1 then raise exception 'FOUT: eigenaar ziet precies zijn eigen bestand niet (%)', n; end if;
  update storage.objects set metadata='{"size":5}' where name='11111111-1111-1111-1111-111111111111/pvb1.fckb';
  get diagnostics n=row_count; if n<>1 then raise exception 'FOUT: eigenaar kan eigen bestand niet vervangen'; end if;
end $$;
commit;
\echo 'OK voorstel 0002: anon niets, ander account niets, eigenaar alleen eigen map'
