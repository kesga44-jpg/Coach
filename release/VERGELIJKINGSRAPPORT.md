# Vergelijkingsrapport — Coach 2.10.0 → 2.10.1 (herstelronde)

Basis: `verbetering/2.10.0` (ZIP 2.10.0). Resultaat: `herstel/2.10.1`. Omvang: 40 bestanden, +3.853 / −74 regels (waarvan ca. 3.100 de vervangen startdataregel).

## Per patch

| | P1 Startdata | P2 Supabase-verificatie | P3 Sync-veiligheidsrem | P4 AI-privacy |
|---|---|---|---|---|
| **Was (2.10.0)** | 34 echte spelers, 101 trainingen met afwezigheidsredenen (o.a. ziek/blessure) in de publieke `app.js` | Verify-script miste RLS/rechten van `storage.objects`, policies zonder bucketfilter, `vc2` apart, oude tabel `coach_data`; geen samenvatting | Controle op 4 categorieën, alleen op aantallen | Namen gepseudonimiseerd, maar gezondheidsinformatie in vrije tekst ging mee; `confirm()` zonder inzicht |
| **Wordt (2.10.1)** | 18 fictieve spelers, 26 trainingen, 5 wedstrijden uit een deterministische generator; `meta.fictional` | Alleen-lezen script met samenvatting OK/RISICO/AANDACHT per controle, beide buckets apart; sleutelscan | Alle categorieën, op id; geneste registraties; lege onderdelen; waarschuwing bij ophalen | Gezondheidsvelden weggelaten, vraag geblokkeerd, laatste controle (bij twijfel niets), exacte preview + aparte verzendknop |
| **Bestanden** | `app.js` (regel 2 + zoekvoorbeeld; via `node tools/maak-fictieve-startdata.js --schrijf`, niet in het patchbestand), `tools/maak-fictieve-startdata.js`, `startdata.test.js`, `rekenregels.test.js` + fixtures, `package.json`, docs | `supabase/verify/verify-production.sql`, `supabase/tests/40_verify_scenario.sh`, `run-local.sh`, `sleutels.test.js`, `package.json`, docs | `app.js` (sync-blok), `sync-veiligheid.test.js`, `package.json`, docs | `app.js` (nieuw AI-blok), `ai-privacy.test.js`, `ai.test.js` (3 tests aangepast), `package.json`, docs |
| **Nieuwe tests** | 6 | 4 Node + 24 SQL-controles | 22 | 6 (+3 aangepast) |
| **Mutatietest** | echte naam terug → 2 falen | verify meldt RISICO als OK → faalt | rem uit → 14 falen | eindcontrole uit → 2 falen; filter uit → 1 faalt |
| **Functioneel risico** | Laag; alleen nieuwe installaties zien andere voorbeelddata | Geen (alleen lezen) | Iets vaker een vraag bij grote opruimacties | Alleen optionele lokale AI |
| **Los toepasbaar op 2.10.0** | ✅ 126/126 | ✅ 124/124 + SQL | ✅ 142/142 | ✅ 126/126 |

Samen in drie volgordes (1-2-3-4, 4-3-2-1, 2-4-1-3) met `git am -3`: identieke boom, 158/158. De samenvoegcommit (versie 2.10.1, stappenplan, hulpscript, browserstap) brengt het totaal op 161.

## Gedrag dat bewust gelijk blijft

- Alle rekenregels: gouden vergelijking met v2.9.1 (nu op een fictieve dataset; in 2.10.0 ook op de echte startdata) identiek.
- Bestaande lokale gegevens, back-upformaat, cloudformaat, Supabase-configuratie en productie: ongewijzigd.
- De originele 81 tests van `main` slagen met de originele harness tegen de 2.10.1-code.

## Gedrag dat verandert voor de gebruiker

| Situatie | 2.10.0 | 2.10.1 |
|---|---|---|
| Nieuwe installatie zonder sync/back-up | Echte spelers van Full Speed O23 | Fictieve voorbeeldspelers |
| “Terug naar startdata” | Echte spelers | Fictieve voorbeeldspelers |
| Stille sync na het wissen van bijv. 5 notities of een opstelling | Ging stil mee | Wacht op bevestiging |
| Ophalen uit de cloud | Algemene vraag | Vraag noemt wat lokaal verdwijnt |
| Coachassistent met lokaal model | `confirm()`; gezondheidsinfo in vrije tekst kon meegaan | Preview met exacte tekst; gezondheidsvelden weggelaten; bij twijfel niets verstuurd |
