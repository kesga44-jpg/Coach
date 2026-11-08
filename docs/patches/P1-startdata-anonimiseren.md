# Patch 1 — Startdata anonimiseren

## Probleem
`app.js` (regel 2, `window.STARTER_DATA`) bevatte 34 echte spelers met 101 trainingen en 5 wedstrijden, inclusief aanwezigheid met redenen als “Afwezig (ziek)” en “Afwezig (blessure)” (gezondheidsgegevens). De repository en de GitHub Pages-site zijn openbaar: iedereen die de app voor het eerst opent, kreeg deze gegevens als startdata.

## Wijziging
- Spelers, trainingen en wedstrijden in de startdata zijn vervangen door **fictieve** voorbeelddata uit `tools/maak-fictieve-startdata.js` (vaste seed, 18 verzonnen spelers, 26 trainingen, 5 wedstrijden). Team, club, oefeningen, tactiek, periodisering en instellingen blijven (bevatten geen persoonsgegevens; gecontroleerd).
- `meta.fictional: true`; geen verwijzing meer naar het echte bronbestand.
- Zoekplaceholder “Bijv. Sem, …” → “Bijv. spelernaam, …” (Sem is een voornaam uit de echte selectie).
- De gouden rekenregeltest gebruikt nu een vaste fictieve dataset (`tests/fixtures/rekenregels-dataset.json`); de hashes zijn met de v2.9.1-code berekend. Op de oude echte data was de vergelijking in 2.10.0 al identiek.
- `npm test` = `node --test` (vindt alle `*.test.js` automatisch; nodig zodat de vier patches onafhankelijk hun eigen testbestand meenemen).

## Gedrag voor gebruikers
| Situatie | Gedrag |
|---|---|
| Bestaande installatie (gegevens in `footballCoachDataV2` of `V1`) | **Ongewijzigd.** Startdata wordt alleen gebruikt als er geen lokale gegevens zijn. Geen reset bij update. |
| Nieuwe installatie zonder sync | Fictieve voorbeeldspelers. Eigen gegevens: Instellingen → Back-up importeren. |
| Nieuwe installatie met sync | Na inloggen vervangt de clouddata de voorbeelddata automatisch (bestaand gedrag `initialSync`). |
| “Terug naar startdata” | Geeft nu de fictieve voorbeelddata (met herstelpunt, zoals voorheen). |
| Kapotte lokale opslag | Ongewijzigd: opslag wordt niet overschreven; app blokkeert opslaan. |

## Tests (`startdata.test.js`, 6)
Startdata = generatoruitvoer · alleen namen uit de fictieve lijst en alleen `p-fictief-`-id's · testdataset fictief · bestaande V2 byte-voor-byte ongewijzigd na twee keer opstarten · V1 wordt gekopieerd, geen bijmenging · nieuwe installatie fictief en clouddata vervangt die.
Mutatietest: een echte naam terugzetten → 2 tests falen.

## Risico's
- Laag functioneel risico (alleen startdata). Wie op een **nieuw** apparaat zonder back-up of sync begint, ziet niet meer de echte spelers: maak vóór het uitrollen een back-up op elk apparaat.
- **Lost de historie niet op**: de echte gegevens staan nog in alle 36 commits (ook in `starter-data.json` en `starter-data.js` uit vroege commits). Zie `docs/GIT_GESCHIEDENIS_OPSCHONEN.md`.

## Implementatie
Het patchbestand bevat `app.js` **bewust niet**: een patch die regel 2 vervangt, moet de oude regel met de echte namen bevatten. De nieuwe regel wordt daarom door de generator geschreven.
1. Back-up downloaden op elk apparaat dat Coach gebruikt.
2. Op een branch vanaf 2.10.0:
   ```bash
   git am -3 release/patches/2.10.1-herstel/P1-startdata-anonimiseren.patch
   node tools/maak-fictieve-startdata.js --schrijf      # schrijft regel 2 en het zoekvoorbeeld
   git commit --amend -a --no-edit
   npm test                                            # 126/126
   ```
3. PR, review, merge door de eigenaar. Let op: de PR-diff op GitHub toont de verwijderde regel (met namen) — die verdwijnt pas na het opschonen van de geschiedenis (stap 7 van het stappenplan: GitHub Support verwijdert ook PR-verwijzingen).
4. Direct daarna het stappenplan voor de Git-geschiedenis uitvoeren.
