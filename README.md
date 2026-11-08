# Football Coach (Coach)

Zelfstandige PWA voor teambeheer van Full Speed O23: spelers, aanwezigheid, trainingen, oefeningen, wedstrijden, opstellingen, wedstrijdblad, spelmodel, kennisbank en een coachassistent.

- Stack: vanilla JavaScript, HTML en CSS zonder buildstap (`index.html`, `app.js`, `kennis.js`, `style.css`, `sw.js`).
- Opslag: lokaal in de browser (`localStorage`), optioneel versleutelde sync via Supabase-project B (`ckodnfshelblddfypmmv`).
- Coach is volledig gescheiden van Samen Thuis, Hub, Sportapp en SIDEQUEST (ecosysteem-ADR 0001, 0006, 0007; `INTEGRATIONS.md` → “Coach ↔ overige: geen datakoppeling”).

Huidige versie: **2.10.1** (herstelronde op 2.10.0) (zie [CHANGELOG.md](CHANGELOG.md)). De uitgebreide historie per versie staat in [LEESMIJ.md](LEESMIJ.md).

## Snel starten

```bash
npm run check   # syntaxcontrole (app.js, kennis.js, sw.js)
npm test        # alle unit- en regressietests (Node.js 22, geen dependencies)
```

Lokaal openen: start een statische webserver in deze map (bijvoorbeeld `python3 -m http.server 8080`) en ga naar `http://localhost:8080/`. Zie [docs/INSTALLATIE.md](docs/INSTALLATIE.md).

Optioneel:

```bash
npm run test:db    # RLS-/Storage-tests tegen een tijdelijke lokale PostgreSQL (vereist PostgreSQL)
npm run test:e2e   # Chromium-browsertest (vereist: npm i -D playwright && npx playwright install chromium)
```

## Documentatie

| Onderwerp | Bestand |
|---|---|
| Installatie en lokaal draaien | [docs/INSTALLATIE.md](docs/INSTALLATIE.md) |
| Architectuur | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Datamodel en opslagsleutels | [docs/DATAMODEL.md](docs/DATAMODEL.md) |
| Supabase (auth, sync, RLS, Storage, OAuth 2.1-vooruitblik) | [docs/SUPABASE.md](docs/SUPABASE.md) |
| API- en integratieregister (incl. voetbal-API's, AI, Strava/Garmin) | [docs/API_INTEGRATIONS.md](docs/API_INTEGRATIONS.md) |
| Beveiliging en privacy | [docs/SECURITY.md](docs/SECURITY.md) |
| Back-up en herstel | [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md) |
| Testen | [docs/TESTING.md](docs/TESTING.md) |
| Release | [docs/RELEASE.md](docs/RELEASE.md) |
| Huisstijlvoorstel rood-wit (niet uitgevoerd) | [docs/HUISSTIJL_VOORSTEL.md](docs/HUISSTIJL_VOORSTEL.md) |
| Regels voor AI-assistenten | [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md) |
| Herstelpatches 2.10.1 (risico's en instructies) | [docs/patches/](docs/patches/) |
| Git-geschiedenis opschonen (handmatig) | [docs/GIT_GESCHIEDENIS_OPSCHONEN.md](docs/GIT_GESCHIEDENIS_OPSCHONEN.md) |
| Testverslag, vergelijkingsrapport, uploadmanifest | [release/TESTVERSLAG.md](release/TESTVERSLAG.md), [release/VERGELIJKINGSRAPPORT.md](release/VERGELIJKINGSRAPPORT.md), [release/UPLOADMANIFEST.md](release/UPLOADMANIFEST.md) |

## Status per onderdeel (2.10.1)

Legenda: **I** = geïmplementeerd · **L** = lokaal getest (Node/PostgreSQL/Chromium in de ontwikkelomgeving) · **CI** = draait in GitHub Actions · **P** = in productie geverifieerd · **–** = nee

| Onderdeel | I | L | CI | P | Opmerking |
|---|---|---|---|---|---|
| Spelers, teams, aanwezigheid, trainingen, wedstrijden, wedstrijdblad (bestaand) | ✅ | ✅ | ✅¹ | – | Rekenregels ongewijzigd; gouden vergelijking met 2.9.1 |
| Back-up inclusief Kennis & Ontwikkeling, additief herstel | ✅ | ✅ | ✅¹ | – | Nieuw in 2.10.0 |
| Sync zonder valse conflicten (basisversie) + veiligheidsrem | ✅ | ✅ (gemockte server) | ✅¹ | – | Niet tegen echte Supabase getest |
| Coachassistent: alleen lokale AI, pseudonimisering, preview | ✅ | ✅ | ✅¹ | – | Ollama-koppeling niet met een echt model getest |
| pdf.js zonder eval (interim R2) | ✅ | statisch | ✅¹ | – | Upgrade naar 4.x blijft PR-4 |
| Toegankelijkheid (aria, focus, minder beweging) | ✅ | ✅ Chromium | – | – | |
| Service worker 2.10.0 / offline start | ✅ | ✅ Node + Chromium | ✅¹ (Node-deel) | – | |
| `coach_data_auth` referentieschema + RLS-tests | SQL | ✅ PostgreSQL 16 | – | – | Niet uitgevoerd op productie |
| `coach-knowledge` alleen-eigenaar | voorstel | ✅ PostgreSQL 16 | – | – | **Goedkeuring nodig** + app-wijziging (PR-10) |
| OAuth 2.1 / gedeelde login | – | – | – | – | Coach doet niet mee (ADR 0017) |
| Externe voetbal-API's | – | – | – | – | Alleen onderzocht, niets gebouwd |
| P1 Fictieve startdata | ✅ | ✅ | ✅¹ | – | Git-historie nog niet opgeschoond (handmatig) |
| P2 Verify-script productie (alleen lezen) | ✅ | ✅ PostgreSQL 16 | – | – | Eigenaar moet het in Supabase draaien |
| P3 Veiligheidsrem sync, alle categorieën | ✅ | ✅ (gemockte server) | ✅¹ | – | |
| P4 AI-privacy: gezondheidsfilter + exacte preview | ✅ | ✅ Node + Chromium | ✅¹ | – | Woordenlijst is niet volledig |

¹ Na merge: de nieuwe testbestanden zitten in `npm test`, dat de bestaande workflow `.github/workflows/tests.yml` al draait. In deze oplevering is CI **niet** uitgevoerd (geen push).
