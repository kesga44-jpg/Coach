#!/usr/bin/env bash
# Draait de SQL-tests tegen een TIJDELIJKE lokale PostgreSQL-cluster (geen Supabase, geen netwerk).
# Een geslaagde lokale test bewijst NIET dat productie veilig is; zie supabase/verify/verify-production.sql.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PGBIN/initdb" ] || PGBIN="$(dirname "$(command -v initdb || echo /nonexistent)")"
if [ ! -x "$PGBIN/initdb" ]; then echo "OVERGESLAGEN: PostgreSQL (initdb) niet gevonden"; exit 0; fi
TMP="$(mktemp -d)"; PORT="${PGPORT_TEST:-54329}"
RUN=(); if [ "$(id -u)" = "0" ]; then chown -R postgres "$TMP"; RUN=(runuser -u postgres --); fi
cleanup(){ "${RUN[@]}" "$PGBIN/pg_ctl" -D "$TMP/data" -m fast stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"${RUN[@]}" "$PGBIN/initdb" -D "$TMP/data" -A trust -U coachtest >/dev/null
"${RUN[@]}" "$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null
PSQL=("${RUN[@]}" "$PGBIN/psql" -h "$TMP" -p "$PORT" -U coachtest -d postgres -v ON_ERROR_STOP=1 -q)
run(){ echo "== $1"; "${PSQL[@]}" -f "$1"; }
run "$HERE/00_supabase_stub.sql"
run "$ROOT/reference/0001_coach_data_auth.sql"
run "$ROOT/reference/0001_coach_data_auth.sql"   # idempotentie
run "$HERE/10_coach_data_auth.test.sql"
run "$ROOT/reference/0001_coach_data_auth.rollback.sql"
run "$ROOT/reference/0001_coach_data_auth.sql"
VERIFY=(bash "$HERE/40_verify_scenario.sh" "${PSQL[*]}")
echo "== verify-production.sql: basis (tabel + RLS, nog geen storage-policies)"
"${PSQL[@]}" -c "insert into storage.buckets(id,name,public) values ('vc2','vc2',false) on conflict do nothing"
"${VERIFY[@]}" "coach_data_auth bestaat|OK" "coach_data_auth RLS aan|OK" "coach_data_auth: geen tabelrechten voor anon|OK" \
  "coach_data_auth: geen DELETE/TRUNCATE voor authenticated|OK" "coach_data_auth: policies alleen eigen rij (auth.uid)|OK" \
  "storage.objects RLS aan|OK" "coach-knowledge: anon mag schrijven/overschrijven|OK" "public: tabellen zonder RLS|OK"
run "$HERE/20_storage_current.test.sql"
"${PSQL[@]}" -c "create policy \"vc2 read\" on storage.objects for select to anon using (bucket_id='vc2')"
echo "== verify-production.sql: huidige app-policies (anon op coach-knowledge, anon lezen vc2)"
"${VERIFY[@]}" "coach-knowledge: anon mag lezen/oplijsten|RISICO" "coach-knowledge: anon mag schrijven/overschrijven|RISICO" \
  "vc2: anon mag lezen/oplijsten|AANDACHT" "vc2: anon mag schrijven/overschrijven|OK" "bucket coach-knowledge bestaat en is privé|OK"
run "$ROOT/proposals/0002_coach_knowledge_owner_only.sql"
echo "== verify-production.sql: na voorstel 0002"
"${VERIFY[@]}" "coach-knowledge: anon mag lezen/oplijsten|OK" "coach-knowledge: anon mag schrijven/overschrijven|OK" "coach-knowledge: authenticated alleen eigen map|OK"
echo "== verify-production.sql: detecteert verzwakkingen (worden daarna hersteld)"
"${PSQL[@]}" -c "begin; alter table public.coach_data_auth disable row level security; grant select on public.coach_data_auth to anon;
  create policy wide on storage.objects for select to anon using (true); update storage.buckets set public=true where id='vc2';
  create table public.lek(x int); create policy own_all on public.coach_data_auth for all to authenticated using (true);
  create table public.coach_data(id text primary key, payload jsonb); grant select, insert, update on public.coach_data to anon; commit;" >/dev/null
"${VERIFY[@]}" "coach_data_auth RLS aan|RISICO" "coach_data_auth: geen tabelrechten voor anon|RISICO" "coach_data_auth: policies alleen eigen rij (auth.uid)|RISICO" \
  "storage.objects: policies zonder bucketfilter|RISICO" "bucket vc2 bestaat en is privé|RISICO" "public: tabellen zonder RLS|RISICO" "oude tabel coach_data|RISICO"
"${PSQL[@]}" -c "drop table public.coach_data; alter table public.coach_data_auth enable row level security; revoke all on public.coach_data_auth from anon;
  drop policy wide on storage.objects; drop policy own_all on public.coach_data_auth; update storage.buckets set public=false where id='vc2'; drop table public.lek;" >/dev/null
"${PSQL[@]}" -c "alter table storage.objects disable row level security" >/dev/null
"${VERIFY[@]}" "storage.objects RLS aan|RISICO"
"${PSQL[@]}" -c "alter table storage.objects enable row level security" >/dev/null
run "$HERE/30_storage_proposal.test.sql"
run "$ROOT/proposals/0002_coach_knowledge_owner_only.rollback.sql"
run "$ROOT/proposals/0002_coach_knowledge_owner_only.sql"
echo "ALLE LOKALE SQL-TESTS GESLAAGD (lokaal aangetoond, niet productiegeverifieerd)"
