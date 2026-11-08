# Testhandleiding — Coach

## Overzicht

| Commando | Wat | Vereist | In CI |
|---|---|---|---|
| `npm run check` | Syntaxcontrole `app.js`, `kennis.js`, `sw.js` | Node.js 22 | ✅ (bestaande workflow) |
| `npm test` | `node --test`: alle `*.test.js` (geen dependencies; `app.js`+`kennis.js` draaien in een `vm` met browserstubs, zie `harness.js`) | Node.js 22 | ✅ |
| `npm run test:db` | RLS-/Storage-tests in een tijdelijke PostgreSQL-cluster met Supabase-nabootsing | PostgreSQL ≥ 14 (`initdb`), niet als root (script schakelt over naar `postgres`) | – |
| `npm run test:e2e` | Chromium: alle pagina's, iPhone/iPad-emulatie, XSS, back-up-download, offline | `npm i -D playwright && npx playwright install chromium` | – |

## Testbestanden

| Bestand | Inhoud |
|---|---|
| `app.test.js` | Bestaand (63): opslag, V1→V2, validatie, sync/sessie/conflict, kennisbank-zoeken, sjablonen, spelers, aanwezigheid, gastspelers, groepen, wedstrijdstatus, rugnummers, wedstrijdblad |
| `kennis.test.js` | Bestaand (18): Kennis & Ontwikkeling raakt andere data niet; dubbelen; export/import |
| `backup.test.js` | Nieuw (12): back-up/herstel inclusief kennis |
| `sync.test.js` | Nieuw (9): fast-forward, conflict met ander apparaat, tijdnotatie, veiligheidsrem, herstel → handmatig, ander account, pull, offline |
| `ai.test.js` | Nieuw (9): alleen lokale endpoints, geen netwerk zonder endpoint/bevestiging, geen namen/id's/geboortedata/e-mail/blessure in verzending, Ollama-formaat, terugval, instellingen |
| `rekenregels.test.js` | Nieuw (5): gouden vergelijking met v2.9.1 (hashes, geen namen) + randgevallen aanwezigheid en rugnummers |
| `startdata.test.js` | 2.10.1 (6): startdata = fictieve generatoruitvoer, bestaande installaties ongemoeid |
| `sleutels.test.js` | 2.10.1 (4): alleen publishable key, Secret key nooit verstuurd, bevinding S17 |
| `sync-veiligheid.test.js` | 2.10.1 (22, waarvan 13 verliesscenario's): twee apparaten, race, alle categorieën, reset, archief, herstel |
| `ai-privacy.test.js` | 2.10.1 (6): gezondheidsfilter, exacte preview, bij twijfel niet verzenden |
| `historie-inventaris.test.js` | 2.10.1 (3): hulpscript Git-geschiedenis op synthetische repository |
| `static.test.js` | Nieuw (4): versies index/sw/app gelijk, CORE-bestanden bestaan, geen geheimen, CDN-versies gepind, service worker offline (gesimuleerde cache) |
| `supabase/tests/*.sql`, `40_verify_scenario.sh` | RLS `coach_data_auth`, huidig Storage-risico, voorstel 0002, verify-script in vier scenario's |
| `tests/e2e/chromium.e2e.js` | Browserstappen |

## Wat de tests níét bewijzen

- Geen test draait tegen de echte Supabase (netwerk geblokkeerd, en productie mag niet worden aangeraakt).
- Mobiel = Chromium-emulatie, geen echte iOS Safari/WebKit. Test op een echte iPhone/iPad vóór release (zie `docs/RELEASE.md`).
- CDN-bibliotheken (PDF-export, PDF/DOCX/XLSX-import) zijn in de ontwikkelomgeving niet geladen; wedstrijdblad-export is alleen op modelniveau getest (bestaande tests).
- Ollama is niet met een echt model getest.

## Nieuwe tests schrijven

Gebruik `createApp({store,failWrites,confirmAnswer})` uit `harness.js`. Exporteer nieuwe functies via de lijst in `harness.js`. Let op: arrays/objecten uit de `vm` hebben een ander prototype — vergelijk met `.length`/`JSON.stringify` in plaats van `deepStrictEqual` op lege arrays.
