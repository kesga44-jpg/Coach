#!/usr/bin/env bash
# Draait verify-production.sql (alleen lezen) en controleert de samenvatting tegen verwachte statussen.
# Gebruik: 40_verify_scenario.sh "<psql-commando>" <verwachting-bestand-of-regels...>
# Elke verwachting: "<controle>|<status>"
set -euo pipefail
PSQL="$1"; shift; SQL="$(cd "$(dirname "$0")/.." && pwd)/verify/verify-production.sql"
OUT="$($PSQL -At -F '|' -f "$SQL")"
fail=0
for exp in "$@"; do
  c="${exp%|*}"; s="${exp##*|}"
  got="$(printf '%s\n' "$OUT" | awk -F'|' -v c="$c" '$1==c{print $2}' | tail -1)"
  if [ "$got" != "$s" ]; then echo "FOUT verify: '$c' verwacht $s, kreeg '${got:-niets}'"; fail=1; else echo "  ok  $c = $s"; fi
done
# Het script mag niets wijzigen: geen INSERT/UPDATE/DELETE/ALTER/CREATE/DROP/GRANT/REVOKE buiten commentaar
if grep -v '^\s*--' "$SQL" | grep -Eiq '\b(insert|update|delete|alter|create|drop|grant|revoke|truncate)\b[^,]*\b(into|table|policy|on|from|set|role|function|schema|bucket)\b'; then
  echo "FOUT: verify-production.sql bevat een schrijvende opdracht"; fail=1; fi
exit $fail
