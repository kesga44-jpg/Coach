# Changelog — Coach

Formaat: per versie Toegevoegd / Gewijzigd / Beveiliging / Tests / Documentatie / Niet gedaan. Oudere versies: zie [LEESMIJ.md](LEESMIJ.md).

## [2.11.0] — 2026-11-13

### Gewijzigd
- Wedstrijdblad opnieuw vormgegeven naar de rustige DSV Full Speed-huisstijl met logo, licht informatiepaneel, groene selectiebalk en subtiele watermark.
- Wedstrijdselectie gebruikt de kolommen Naam en Opmerking; blessure-/afwezigheidsstatus, doorgeschoven spelers, wedstrijddagopmerkingen en praktische gegevens blijven gekoppeld aan de actuele wedstrijd.
- Lege categorieën tonen alleen schrijfruimte; geen voorbeeldspelers of fictieve wedstrijdgegevens toegevoegd. PDF en print blijven op één A4-pagina.

### Tests
- Regressietests controleren de nieuwe onderdelen, lege schrijfruimte, wedstrijdvelden en behoud van bestaande selectie-/statusgegevens.

## [2.10.1] — 2026-11-08 (herstelronde, branch `herstel/2.10.1`, nog niet gemerged)

Vier onafhankelijk toepasbare patches op 2.10.0 (`release/patches/2.10.1-herstel/`), plus deze samenvoegcommit.

### Privacy en beveiliging
- **P1 Startdata anonimiseren:** de 34 echte spelers, 101 trainingen en 5 wedstrijden in `app.js` zijn vervangen door fictieve voorbeelddata (`tools/maak-fictieve-startdata.js`). Bestaande installaties houden hun eigen gegevens; geen reset bij een update.
- **P2 Supabase-verificatie:** `verify-production.sql` controleert alleen-lezend RLS, tabelrechten en policies in `public` en `storage.objects`, beide buckets apart, de oude tabel `coach_data`, met een samenvatting OK/RISICO. Sleutelcontrole: alleen een publishable key in de clientcode. Nieuwe bevindingen S17 (ongezouten hash van de Secret key als mapnaam) en S18 (oude tabel).
- **P3 Sync-veiligheidsrem:** alle gegevenscategorieën, vergeleken op id (ook aanwezigheid, opstellingen, notities, sjablonen, spelprincipes, kennisbankkoppelingen); ophalen noemt vooraf wat lokaal verdwijnt.
- **P4 AI-privacy:** tekstvelden met gezondheids-/blessuretermen worden weggelaten, een vraag met zulke termen wordt niet verstuurd, een laatste controle blokkeert bij twijfel, en de trainer ziet vooraf exact wat er naar het lokale model gaat.

### Overig
- Stappenplan `docs/GIT_GESCHIEDENIS_OPSCHONEN.md` + `tools/historie-inventaris.js` (lokaal gerepeteerd, niet uitgevoerd op GitHub).
- `npm test` = `node --test` (alle `*.test.js`). Versie 2.10.1 (service-workercache vernieuwd).
- Browsertest uitgebreid met de AI-preview.

### Tests
120 → 161 Node-tests; lokale SQL-scenario's voor het verify-script; 7 browserstappen. Mutatietests per patch: beveiliging verwijderen laat tests falen.

## [2.10.0] — 2026-11-08 (branch `verbetering/2.10.0`, nog niet gemerged)

Basis: `main@9b74826` (2.9.1 + CI PR #9).

### Toegevoegd
- **Back-up inclusief Kennis & Ontwikkeling** (`backupMeta`, `knowledgeModule`). Herstel toont vooraf aantallen; teamgegevens worden vervangen met herstelpunt; kennis wordt alleen aangevuld (dubbelen overgeslagen), nooit overschreven of verwijderd; `knowledgeFiles`-koppelingen blijven behouden (nieuwste wint). Groottegrens 25 MB, duidelijke melding bij een Kennis-export.
- **Sync-basisversie** (`footballCoachSyncBaseV1`): stille autosync uploadt lokale wijzigingen als de cloud sindsdien niet is gewijzigd. Daarvoor gaf elke lokale wijziging na een sync een conflict.
- **Veiligheidsrem sync**: geen stille upload bij opvallend minder spelers/trainingen/wedstrijden/oefeningen dan in de cloud; na herstel, reset of seizoensarchief eerst handmatig bevestigen.
- **Lokale AI (Ollama)** in de coachassistent: modelveld in Instellingen, `/api/chat`-formaat, bronlabel, time-out, terugval op regelgebaseerd.

### Gewijzigd
- Coachassistent stuurt alleen naar lokale adressen (localhost/eigen netwerk); extern opgeslagen endpoints blijven bewaard maar worden niet gebruikt; instellingen weigeren een extern adres.
- Meldingen (toast) blijven langer zichtbaar bij langere tekst; een nieuwe melding verkort de vorige niet meer.
- Navigatie: `aria-current`, `aria-label` op icoonknoppen, `aria-live` op meldingen; zichtbare toetsenbordfocus; `prefers-reduced-motion`.
- Service worker `football-coach-v2.10.0`; `kennis.js` nu network-first zoals `app.js`.

### Beveiliging
- R9 opgelost: geen namen, spelers-id's, geboortedata, contactgegevens, blessuredetails of vertrouwelijke notities naar een AI-endpoint; bevestiging per verzending; `credentials:'omit'`.
- R2 interim: pdf.js `isEvalSupported:false`.
- Waarschuwing bij de getoonde `coach-knowledge`-SQL (anon kan overschrijven).
- Supabase: referentieschema `coach_data_auth`, voorstel `coach-knowledge` alleen-eigenaar (met rollback), alleen-lezen verificatiescript — **niets uitgevoerd op productie**.

### Tests
- 81 → 120 Node-tests (`backup`, `sync`, `ai`, `rekenregels`, `static`), inclusief gouden vergelijking van alle rekenuitkomsten met 2.9.1.
- Lokale PostgreSQL-tests (RLS en Storage) en optionele Chromium-tests (desktop, iPhone/iPad-emulatie, XSS, back-up, offline).

### Documentatie
- Nieuw: `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/` (architectuur, datamodel, Supabase, API-register, beveiliging, back-up, testen, release, installatie, huisstijlvoorstel), `release/` (testverslag, uploadmanifest, patches), `.env.example`.

### Niet gedaan (bewust, besluit nodig)
- `coach-knowledge` naar Auth-RLS (PR-10), pdf.js 4.x (PR-4), SheetJS (PR-5), SRI.
- Startdata met echte spelersnamen in de publieke repo.
- Huisstijl rood-wit; externe voetbal-API's; OAuth 2.1; WebLLM.
