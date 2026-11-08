# Patch 2 — Supabase-verificatie (alleen lezen) en sleutelcontrole

## Doel
Vóór een besluit over productie aantoonbaar kunnen vaststellen hoe project `ckodnfshelblddfypmmv` is ingericht. **Er wordt niets aan productie gewijzigd.**

## Wijziging
- `supabase/verify/verify-production.sql` uitgebreid. Detailqueries: RLS van alle tabellen in `public` en `storage`, alle tabelrechten van `anon`/`authenticated`/`public`, alle policies, buckets, aantallen. Als **laatste query een samenvatting** met per controle `OK / RISICO / AANDACHT / INFO` (de SQL Editor toont alleen het resultaat van de laatste query):
  - `coach_data_auth`: bestaat, RLS aan, geen rechten voor anon, geen DELETE/TRUNCATE voor authenticated, policies alleen eigen rij (`auth.uid()`), geen anon-/ALL-/DELETE-policy.
  - Oude tabel `coach_data`: bestaat nog? anon-toegang?
  - `storage.objects`: RLS aan, tabelrechten (ter info), policies zónder bucketfilter (die gelden voor álle buckets).
  - **Per bucket apart**: `coach-knowledge` (privé? anon lezen? anon schrijven/overschrijven? authenticated alleen eigen map?) en `vc2` (privé? anon lezen = AANDACHT; anon schrijven = RISICO).
  - `public`: tabellen zonder RLS; SECURITY DEFINER-functies uitvoerbaar door anon.
- `supabase/tests/40_verify_scenario.sh` + uitbreiding `run-local.sh`: het verify-script draait lokaal in vier scenario's (veilige basis, huidige app-policies, na voorstel 0002, bewust verzwakt) en de verwachte statussen worden gecontroleerd. Ook gecontroleerd: het script bevat geen schrijvende opdrachten. Mutatietest: een verify-controle die RISICO als OK meldt, laat de test falen.
- `sleutels.test.js` (4): clientcode bevat alleen een `sb_publishable_`-sleutel; geen `sb_secret_`, geen JWT met een andere rol dan `anon`, geen `service_role`; zelftest van de scanner; de “Secret key” van de app gaat bij sync en kennisbank-upload nooit over het netwerk (ook niet in versleutelde uploads); bevinding S17 vastgelegd.

## Welke sleutel is de “Secret key”?
| Naam in de app | Wat het is | Waar | Verstuurd? |
|---|---|---|---|
| `SYNC_PUBLIC_KEY` (`sb_publishable_…`) | Supabase **publishable** key, bedoeld voor browsercode | `app.js` | Ja, als `apikey`-header (normaal) |
| “Secret key” (Instellingen → Sync) | **Geen Supabase-sleutel.** Een zelfgekozen wachtwoordzin waarmee de app je gegevens versleutelt (AES-GCM, PBKDF2) | `localStorage` `footballCoachSyncV1`, alleen op je apparaat | Nee (test). Wel een **ongezouten SHA-256-afgeleide** als mapnaam in `coach-knowledge` (S17) |
| Supabase `service_role` / `sb_secret_` | Volledige beheerrechten, omzeilt RLS | Hoort alleen in het Supabase-dashboard of op een server | Komt niet voor in de code (test) |

De naam “Secret key” in de app is verwarrend naast Supabase’s eigen “secret key”. Voorstel (later, aparte UI-PR): hernoemen naar “Versleutelingswachtwoord”.

## Nieuwe bevindingen
- **S17** — Mapnaam in `coach-knowledge` = `sha256("football-coach-v2:" + Secret key)`, zonder salt en zonder PBKDF2. Wie objectnamen kan oplijsten (met de huidige anon-SELECT-policy), kan een zwakke Secret key offline snel raden en daarna de versleutelde kennisbankbestanden openen. Ernst: middel (afhankelijk van de sterkte van de sleutel en de productie-policies). Oplossing: PR-10 (map = `auth.uid()`). Tot dan: een lange, unieke Secret key gebruiken.
- **S18** — De oude anonieme tabel `coach_data` kan in productie nog bestaan met anon-toegang. Het verify-script meldt dit; niets wijzigen zonder akkoord en zonder back-up.

## Uitvoeren door de eigenaar
1. Supabase-dashboard → project B → SQL Editor → inhoud van `verify-production.sql` plakken → Run.
2. De samenvatting (laatste resultaat) overnemen in `docs/SUPABASE.md` § Productieverificatie. Bij RISICO: niets zelf aanpassen, eerst een voorstel.
3. Optioneel: Security Advisor in het dashboard bekijken.

## Risico's
Geen voor de app (alleen SQL om te lezen, tests en documentatie). Lokaal getest op PostgreSQL 16 met een Supabase-nabootsing, **niet** op echte Supabase. Kleine verschillen in de catalogusinhoud zijn mogelijk; een query die faalt, wijzigt niets.
