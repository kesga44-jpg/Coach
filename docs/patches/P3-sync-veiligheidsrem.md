# Patch 3 — Synchronisatie: veiligheidsrem voor alle gegevenscategorieën

## Probleem
De veiligheidsrem uit 2.10.0 keek alleen naar het **aantal** spelers, trainingen, wedstrijden en oefeningen. Andere onderdelen (notities, teams, sjablonen, spelprincipes, aanwezigheid, opstellingen, statistieken, kennisbankkoppelingen, ontwikkeldoelen …) konden ongemerkt verdwijnen, en “3 verwijderd + 3 nieuw” werd niet gezien.

## Wijziging (`app.js`, sync-blok)
- `syncLossReport(referentie, lokaal)` vergelijkt **alle** onderdelen van de state:
  - lijsten **op id** (vervangen telt als verlies): spelers, trainingen, wedstrijden, oefeningen, tactiekborden, seizoensitems, teams, coachnotities, bronnen, staf, reflecties, teamdiagnoses, trainings- en wedstrijdsjablonen, spelprincipes;
  - koppelingen: kennisbankkoppelingen, teamstructuren;
  - geneste registraties binnen trainingen/wedstrijden/spelers die blijven bestaan: aanwezigheid, opstellingsplaatsen, bank, wedstrijdstatistieken, beschikbaarheidsmeldingen, trainingsonderdelen, meetrainers, ontwikkeldoelen, gesprekken, ontwikkelmomenten;
  - onderdelen die leeg raken: team, club, instellingen, AI-instellingen, periodisering.
- Regel: geen stille upload bij ≥ 10 weg, of ≥ 3 weg én ≥ 20 % van dat onderdeel, of **elk** verwijderd team, of een onderdeel dat leeg raakt. Handmatig uploaden kan nog steeds, na een vraag die het verlies per onderdeel noemt.
- **Ophalen** uit de cloud noemt vooraf wat lokaal zou verdwijnen (herstelpunt blijft zoals voorheen).
- Kennis & Ontwikkeling zit niet in de sync en kan door uploaden of ophalen niet veranderen (test).

## Tests (`sync-veiligheid.test.js`, 22)
Twee apparaten heen en terug · gelijktijdige wijzigingen (conflict, niets stil verloren, bewuste keuze mogelijk) · race tussen ophalen en schrijven · 13 verliesscenario's (o.a. notities, team, aanwezigheid, opstellingen, statistieken, trainingsonderdelen, spelprincipes, sjablonen, kennisbankkoppelingen, ontwikkeldoelen, oefeningen, club leeg, spelers vervangen) · normale bewerkingen gaan wél stil mee · kennis onaangeroerd · ophalen noemt verlies · reset · seizoensarchief · herstel.
Mutatietest: veiligheidsrem uitgeschakeld → 14 tests falen.

## Risico's
- Iets vaker een vraag bij handmatig uploaden na grote opruimacties (bedoeld).
- Niet getest tegen echte Supabase (gesimuleerde PostgREST met dezelfde `updated_at`-controle).

## Implementatie
`git am -3` op een branch vanaf 2.10.0 → `npm test` → PR → merge door eigenaar. Na merge: op twee echte apparaten een rondje upload/ophalen doen.
