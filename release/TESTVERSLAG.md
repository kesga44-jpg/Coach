# Test- en validatierapport — Coach 2.10.1 (herstelronde)

Datum: 2026-11-08 · Basis: `verbetering/2.10.0` · Resultaat: `herstel/2.10.1`
Omgeving: Linux-container, Node.js v22.23.4, PostgreSQL 16.15, git 2.43, git-filter-repo 2.47.0, Playwright 1.63 / Chromium. Netwerk naar Supabase, jsDelivr en GitHub-API geblokkeerd.

## Totaal (samengevoegd 2.10.1)

| Suite | Resultaat | Bewijsniveau |
|---|---|---|
| `npm run check` | ✅ | Lokaal |
| `npm test` (`node --test`, 12 bestanden) | ✅ **161/161**, 0 mislukt, 0 overgeslagen | Lokaal; CI na PR |
| Originele 81 tests van `main` met originele harness tegen 2.10.1-code | ✅ 81/81 | Lokaal (regressie) |
| `npm run test:db` | ✅ alle SQL-tests + 24 statuscontroles van het verify-script in 4 scenario's, 0 fouten | Lokaal (PostgreSQL + Supabase-nabootsing) |
| `npm run test:e2e` | ✅ 7/7 browserstappen (incl. nieuwe AI-preview: geen namen, annuleren = niets verstuurd, versturen = precies 1 verzoek) | Lokaal (Chromium; mobiel = emulatie) |

## Per patch, los toegepast op 2.10.0

| Patch | `npm test` | Extra |
|---|---|---|
| P1 Startdata | ✅ 126/126 | `test:db` ✅ |
| P2 Supabase-verificatie | ✅ 124/124 | `test:db` ✅ incl. verify-scenario's |
| P3 Sync-veiligheidsrem | ✅ 142/142 | – |
| P4 AI-privacy | ✅ 126/126 | – |
| P1+P2+P3+P4 (drie volgordes) | ✅ 158/158, identieke boom | `test:db` ✅, e2e 6/6 |

## Mutatietests (tests falen als de beveiliging wordt weggehaald)

| Ingreep | Gevolg |
|---|---|
| Echte naam terug in startdata | `startdata.test.js`: 2 falen |
| Verify-controle “anon schrijven coach-knowledge” meldt OK i.p.v. RISICO | `test:db` faalt |
| Extra DELETE-recht / `using (true)` op `coach_data_auth` (uit 2.10.0) | `test:db` faalt |
| Veiligheidsrem sync uitgeschakeld | `sync-veiligheid.test.js`: 14 falen |
| Laatste AI-controle uitgeschakeld | `ai-privacy.test.js`: 2 falen |
| Gezondheidsfilter uitgeschakeld | `ai-privacy.test.js`: 1 faalt |
| XSS-detectie (positieve controle) | detecteert 1 uitvoering |

## Git-geschiedenis: lokale proefuitvoering

Op een kopie met 50 commits (36 van `main` + gesimuleerde merges): inventaris 34 spelers in 46 commits → `git filter-repo --sensitive-data-removal --invert-paths --path starter-data.json --path starter-data.js --replace-text` → controle **SCHOON** (0 commits), huidige `app.js` byte-voor-byte gelijk, `npm test` 158/158, geforceerde push naar lokale origin + controle in nieuwe clone SCHOON. Het vervangbestand met namen is daarna verwijderd.

## Patchbestanden en privacy

- Alle 14 patchbestanden en alle repositorybestanden zijn gescand op de 34 echte namen en spelers-id's (lijst alleen in het geheugen, uit `main`): **0 treffers**.
- Daarvoor is de reeks opnieuw opgebouwd: regel 1 van `app.js` wordt niet meer gewijzigd (die wijziging trok de startdataregel als context mee in patch 0004 van 2.10.0), P1 bevat `app.js` niet (generator schrijft de regel), en per ongeluk meegecommitte losse patchbestanden zijn verwijderd.
- Workflow nagespeeld vanaf `main`: 9 patches 2.10.0 → 120/120 en identieke boom; P1 (+ generator) → 126/126, identieke boom; P2/P3/P4 los → 124/142/126; alles + P5 → 161/161 en identieke boom met de opgeleverde code.

## Niet uitgevoerd

| Wat | Waarom |
|---|---|
| GitHub CI | Niets gepusht (opdracht). |
| Productie-Supabase en het verify-script daar | Geen toegang; geen productiewijzigingen toegestaan. |
| Git-geschiedenis op GitHub herschrijven, Support, Pages-controle | Handmatig door de eigenaar (stappenplan). |
| Echte iPhone/iPad, echt Ollama-model, CDN-bibliotheken | Niet beschikbaar in de ontwikkelomgeving. |

## Tijdens de ontwikkeling gevonden en opgelost

- Fictieve achternaam “Demo” botste met een tegenstandersnaam → namen gekozen die geen gewone woorden zijn.
- Eerste versie van het historie-vervangbestand verving ook de nieuwe fictieve startdata (24 tests faalden in de proef) → regel spaart nu `"fictional":true`.
- Eerste versie van de laatste AI-controle blokkeerde op de vaste instructietekst (“geen medisch advies”) → vaste teksten uitgezonderd.
- Veiligheidsrem telde registraties van een bewust verwijderde training dubbel → geneste registraties alleen binnen trainingen/wedstrijden die blijven bestaan.

Resultaten van 2.10.0: zie de 2.10.0-ZIP (`release/TESTVERSLAG.md` daar: 120/120, SQL, 6/6 browser).
