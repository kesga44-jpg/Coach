# Releasehandleiding — Coach

Coach wordt als statische site gehost (huidige werkwijze; ecosysteem DEPLOYMENT.md: GitHub Pages). Er is geen buildstap.

## Checklist

1. Branch vanaf `main`; één onderwerp per PR (ADR 0011). Voorstel eerst laten goedkeuren.
2. Versie ophogen op alle plaatsen: `APP_VERSION` (app.js, 2.10-blok; regel 1 van app.js niet aanpassen), `?v=` in `index.html` (style, app, kennis), `CACHE` + `CORE` in `sw.js`, `package.json`, `manifest.json` (description).
3. `npm run check && npm test` → groen. `static.test.js` faalt als versies niet gelijk lopen.
4. Bij Supabase-wijzigingen: `npm run test:db`. **Nooit** SQL tegen productie zonder apart akkoord, verse back-up en hersteltest.
5. Optioneel `npm run test:e2e`.
6. Handmatige rooktest op echte apparaten: iPhone (Safari + geïnstalleerde PWA), iPad, laptop:
   - app opent, laatste gegevens zichtbaar; navigatie onder/zijbalk;
   - training openen, aanwezigheid zetten, opslaan; wedstrijd: selectie, opstelling, wedstrijdblad PDF + PNG;
   - back-up downloaden en (op een testprofiel) herstellen;
   - vliegtuigmodus: app start opnieuw.
7. `CHANGELOG.md` bijwerken.
8. PR openen; CI moet groen zijn; **de eigenaar merget**.
9. Na publicatie: PWA's halen de nieuwe versie op bij de volgende start (nieuwe `CACHE`-naam ruimt de oude cache op). Vraag gebruikers zo nodig de app één keer volledig te sluiten.

## Terugdraaien

Revert de merge-commit en publiceer opnieuw. Gebruikersgegevens staan lokaal en blijven bestaan; 2.10 voegt alleen optionele velden/sleutels toe (`backupMeta`, `knowledgeModule` in back-upbestanden; `footballCoachSyncBaseV1`, `state.ai.model` lokaal), die oudere versies negeren.

## Deze oplevering (2.10.0)

Geleverd als ZIP met per onderwerp een patch in `release/patches/2.10.0/` en `release/patches/2.10.1-herstel/`, zodat elk onderwerp als afzonderlijke PR kan worden ingediend. Zie `release/UPLOADMANIFEST.md`. Geen enkel bestand in de ZIP bevat echte spelersgegevens (gescand).
