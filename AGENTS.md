# AGENTS.md — regels voor AI-codeassistenten in de Coach-repository

Leidend kader: `personal-ecosystem/CLAUDE.md`, `DECISIONS.md` en `docs/adr/`. Bij strijd wint de strengste regel. Bij twijfel: stoppen en vragen.

## Altijd

1. Lees eerst `README.md`, `LEESMIJ.md`, `docs/ARCHITECTURE.md` en `docs/DATAMODEL.md`.
2. Vanilla JS, geen buildstap. **Geen** React, TypeScript, Tailwind of grote refactor (ecosysteem-CLAUDE.md §1).
3. Bestaand patroon voor uitbreidingen: een functie in `app.js` uitbreiden door hem te omhullen (`const xBase=x; x=function(){…}`), in een gemarkeerd versieblok vóór `document.addEventListener('click',handleClick)`. Klikhandlers lopen via `handleClick`; die wordt pas daarna geregistreerd.
4. Bestaande gegevens blijven leesbaar: nieuwe velden zijn optioneel en worden in `normalize()` aangevuld; `validateStateData()` mag niet strenger worden voor bestaande back-ups.
5. Kennis & Ontwikkeling (`kennis.js`, sleutel `footballCoachKnowledgeV1`) wordt nooit overschreven of verwijderd door herstel of sync; alleen aangevuld via `kdImport`.
6. Versie ophogen = `APP_VERSION` in `app.js` (niet het commentaar op regel 1: dat staat naast de startdata op regel 2 en trekt die regel mee in elke diff/patch), `?v=` in `index.html`, `CACHE` en `CORE` in `sw.js`, `package.json`, `manifest.json`. `static.test.js` controleert dit.
7. Voor elke wijziging tests toevoegen; `npm run check && npm test` moet groen zijn. Bij database/Storage ook `npm run test:db`.
8. Eén onderwerp per PR, eerst een voorstel, nooit zelf mergen (ADR 0011). Geen directe commits naar `main`.

## Nooit

- SQL uitvoeren tegen productie of policies wijzigen in project `ckodnfshelblddfypmmv` zonder afzonderlijk akkoord.
- Een `service_role`/secret key, wachtwoord of token in code, tests, documentatie of logs.
- Externe of betaalde AI-API's; spelersgegevens naar een dienst buiten het apparaat/eigen netwerk (R9, ADR 0008).
- Strava-/Garmin-koppelingen (ADR 0009); GPX/FIT/TCX hoort bij de Sportapp.
- Nieuwe CDN-scripts; bestaande alleen exact gepind (SRI is nog open, zie `docs/SECURITY.md`).
- `innerHTML` met gebruikersinvoer zonder `esc()`.
- Huisstijl wijzigen zonder apart akkoord (zie `docs/HUISSTIJL_VOORSTEL.md`).
- Aannames als feit opschrijven: schrijf “niet geverifieerd”.

## Rapportage na een taak

```
Gewijzigd: <bestanden>
Waarom: <1–2 zinnen>
Getest: <commando's + resultaat>
Niet getest: <eerlijk>
Risico's / open punten: <lijst>
```
