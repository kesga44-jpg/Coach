# Architectuur — Coach

## Plaats in het ecosysteem

Coach is een bestaande, zelfstandige app (ecosysteem `APP_REGISTRY.md`: id `coach`, project **B** `ckodnfshelblddfypmmv`). Besluiten die Coach raken:

| Besluit | Gevolg voor Coach |
|---|---|
| ADR 0001 / ARCHITECTURE | Project B is alleen voor Coach (gegevens van derden gescheiden van privédata). |
| ADR 0006 | Coach blijft in de eigen repository, niet in de monorepo. |
| ADR 0007, 0017 | Coach houdt eigen accounts; doet niet mee aan gedeelde login of OAuth 2.1-spike. |
| ADR 0008 | AI: regelgebaseerd eerst, lokale AI optioneel, geen betaalde API's. |
| ADR 0009 | Geen Strava/Garmin; bestandsimport hoort bij de Sportapp. |
| ADR 0010, 0014 | Back-ups van Coach (persoonsgegevens van derden) maximaal 6 maanden bewaren. |
| ADR 0011 | Wijzigingen als afzonderlijke PR's na goedkeuring; eigenaar merget. |
| INTEGRATIONS.md | Coach ↔ overige apps: geen datakoppeling (alleen Hub-deeplink I-1 en health-check I-2). |

## Opbouw

```
index.html      shell: zijbalk (desktop), onderbalk (mobiel ≤ 860 px), #app, modal, verborgen file-inputs
kennis.js       Kennis & Ontwikkeling: eigen opslagsleutel, import/controle/dubbelen, export (geladen vóór app.js)
app.js          startdata, rekenregels, rendering per pagina, router (setPage/renderPage), klikhandler,
                opslag/validatie/normalisatie, back-up/herstel, Supabase Auth + sync, kennisbank (Storage), VC2-index,
                wedstrijdblad (PDF/PNG), coachassistent
style.css       volledige vormgeving (CSS-variabelen in :root)
sw.js           service worker: kernbestanden in cache, network-first voor app.js/kennis.js/style.css/index.html
```

### Router en event-handlers

- `setPage(page)` zet `ui.page`, markeert de navigatie (`.active`, sinds 2.10 ook `aria-current`) en roept `renderPage()`.
- `renderPage()` kiest per `ui.page` een `renderX()`-functie en vult `#app` met een HTML-string; `bindPage()` koppelt invoervelden.
- Eén gedelegeerde klikhandler (`handleClick`) op `document`, gestuurd via `data-*`-attributen. Uitbreidingen omhullen de vorige handler (`handleClickLegacy`, `handleClickBase210`) en worden geregistreerd vóór `document.addEventListener('click',handleClick)`.

### Uitbreidingspatroon (bestaand, voortgezet in 2.10)

Functies worden niet herschreven maar omhuld: `const xBase=x; x=function(...a){ … xBase(...a) … }`. Dat houdt wijzigingen klein en per versie herkenbaar. Het 2.10-blok staat in `app.js` onder `Coach main 2.10.0 — uitbreidingen` en bevat: back-up incl. kennis, sync-basisversie, coachassistent-privacy, kennisbank-waarschuwing, `aria-current`, klikvalidatie.

## Gegevensstromen

```mermaid
flowchart LR
  UI[Coach UI] -->|save()| LS[(localStorage<br/>footballCoachDataV2)]
  UI --> KD[(localStorage<br/>footballCoachKnowledgeV1)]
  LS -->|AES-GCM, sleutel blijft lokaal| SYNC[Supabase REST<br/>coach_data_auth]
  UI -->|versleuteld .fckb| KB[(Storage<br/>coach-knowledge)]
  UI -->|alleen lezen| VC2[(Storage<br/>vc2/VC2)]
  UI -->|optioneel, bevestigd, gepseudonimiseerd| AI[Lokale AI<br/>localhost / eigen netwerk]
  UI -->|download/upload JSON| BK[Back-upbestand<br/>teamdata + kennis]
```

## Offline

De app werkt volledig offline na het eerste bezoek: alle kernbestanden staan in de cache van de service worker; gegevens staan lokaal. Sync wacht tot het apparaat online is (`online`-event → stille sync). Externe bibliotheken (pdf.js, jsPDF, html2canvas, mammoth, SheetJS) worden pas bij gebruik van de CDN geladen en zijn offline **niet** beschikbaar (PDF-export, PDF/DOCX/XLSX-import).

## AI-architectuur (ADR 0008)

1. **Regelgebaseerd** (`localAssistant`): altijd beschikbaar, geen netwerk.
2. **WebLLM**: niet gebouwd. Vereist WebGPU en het downloaden van modellen van externe hosts; volgens ADR 0008 pas in fase F6 na licentiecontrole en CSP-aanpassing. Geschikte toepassingen voor later: samenvatten van trainingsevaluaties, varianten van oefenvormen.
3. **Ollama/lokaal endpoint**: sinds 2.10 alleen lokale adressen; gepseudonimiseerde context; bevestiging per verzending; antwoord met bronlabel, niet automatisch opgeslagen.

Onderzochte toepassingen en hoe ze nu worden gedekt:

| Toepassing | Regelgebaseerd (bestaand) | Lokale AI (optioneel) |
|---|---|---|
| Trainingsanalyse / aanwezigheid | laagste opkomst, wedstrijdminuten | vrije vragen over gepseudonimiseerde statistieken |
| Trainingsvoorbereiding / oefenvormen | trainingsgenerator, sjablonen, VC2-passages | varianten bedenken bij oefeningen |
| Evaluatie trainingsdoelen | IDP-doelen, trainingsreflectie | samenvatting van evaluaties |
| Trainingsbelasting | handmatig veld `load`/`intensity`, periodisering | – (geen medische of fysieke advisering) |
| Wedstrijdvoorbereiding / -analyse | wedstrijdplan, evaluatie, “volgende training” | koppeling evaluatie → trainingsfocus |

## Niet in scope / bewust niet gedaan

- Geen gedeelde database of gegevensstructuur met andere apps.
- Geen centrale authenticatie; Coach blijft zelfstandig bruikbaar zonder account.
- Geen nieuwe externe API-koppelingen (zie `docs/API_INTEGRATIONS.md`).
