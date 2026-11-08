# Stappenplan: echte spelersgegevens uit de Git-geschiedenis verwijderen

**Handmatig uit te voeren door de eigenaar. Niet automatiseren.** Claude heeft dit niet op GitHub uitgevoerd en niets geforceerd gepusht. Het plan is wel lokaal gerepeteerd op een kopie (zie § Proefuitvoering).

Gebaseerd op de GitHub-handleiding [Removing sensitive data from a repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository) (geraadpleegd 2026-11-08).

## Wat staat er in de geschiedenis?

Inventaris van `main@9b74826` (36 commits):

| Bestand | Commits met echte spelersgegevens |
|---|---|
| `app.js` (regel 2, `STARTER_DATA`) | 35 |
| `starter-data.json` (alleen vroege commits) | 3 |
| `starter-data.js` (alleen vroege commits) | 2 |
| **Totaal** | **36 van 36 commits** (34 unieke spelers, eerste commit `081c00d`, 2026-09-04) |

De screenshots in `docs/screenshots/` bevatten alleen fictieve testnamen en hoeven niet te worden aangepast.

## Belangrijke gevolgen vooraf

- **Alle commit-hashes veranderen** vanaf de eerste commit. Links naar commits en de diffweergave van oude PR's (#1–#9) werken daarna niet meer goed.
- Open PR's eerst mergen of sluiten (GitHub-advies). Volgorde: patches 2.10.0 en herstelronde 2.10.1 eerst mergen, **daarna** de geschiedenis herschrijven. Anders moeten alle PR's opnieuw.
- Kopieën die anderen al hebben (forks, clones, caches van derden) kun je niet terughalen. Controleer forks via GitHub → *Insights → Forks*.
- Je eigen oude clones (laptop) bevatten nog de oude geschiedenis: na afloop verwijderen en opnieuw klonen. **Nooit** een oude clone pushen of mergen: dat zet de gegevens terug.
- De repository blijft openbaar; GitHub Pages blijft gratis.

## Vereisten

- Git ≥ 2.36, Python 3, Node.js 22.
- `git-filter-repo` **≥ 2.47** (voor `--sensitive-data-removal`): `pip install git-filter-repo` en daarna `git filter-repo --version`.
- Het hulpscript `tools/historie-inventaris.js` (in deze repository; bevat zelf geen namen).
- Een map **buiten** de repository voor het vervangbestand (bijv. `~/coach-opschonen/`).

## Stap 1 — Volledige back-up van de repository

```bash
mkdir -p ~/coach-opschonen && cd ~/coach-opschonen
git clone --mirror https://github.com/kesga44-jpg/Coach.git coach-backup.git
tar czf coach-backup-$(date +%Y%m%d).tgz coach-backup.git
```

Bewaar het archief versleuteld en privé (het bevat de spelersgegevens). Verwijder het na een vooraf gekozen termijn (ecosysteembeleid: Coach-gegevens maximaal 6 maanden). Maak ook in de app op elk apparaat een back-up.

## Stap 2 — Alle commits controleren

```bash
cd ~/coach-opschonen
git clone --no-local --mirror coach-backup.git werk.git      # verse kopie van de back-up
git clone --no-local werk.git schoon && cd schoon
git fetch --all
git rev-list --all | wc -l                                   # aantal commits (36 + latere merges)
node /pad/naar/Coach/tools/historie-inventaris.js inventaris
```

Verwacht: `Commits met spelersgegevens` = alle commits tot en met de merge van patch 1. Namen worden niet getoond (alleen met `--toon`).

> Tip: `filter-repo` wil een verse clone. Werk je direct vanaf GitHub, gebruik dan `git clone https://github.com/kesga44-jpg/Coach.git schoon`.

## Stap 3 — Inventaris van alle bestanden met spelersgegevens

De uitvoer van stap 2 toont per bestand in hoeveel commits namen voorkomen (`app.js`, `starter-data.json`, `starter-data.js`). Komt er een **ander** bestand bij: stop en beoordeel dat bestand eerst (opnemen in stap 4 met `--path`).

## Stap 4 — Geschiedenis herschrijven met `git filter-repo`

```bash
node /pad/naar/Coach/tools/historie-inventaris.js vervangbestand --uit ../vervangingen.txt
git filter-repo --sensitive-data-removal \
  --invert-paths --path starter-data.json --path starter-data.js \
  --replace-text ../vervangingen.txt
```

Wat er gebeurt:
- `starter-data.json` en `starter-data.js` verdwijnen uit alle (oude) commits;
- in elke oude versie van `app.js` wordt de echte `STARTER_DATA`-regel vervangen door een lege, fictieve regel. Fictieve startdata (vanaf patch 1, met `"fictional":true`) blijft ongemoeid;
- elke volledige naam → `Verwijderde speler NN`, elk spelers-id → `p-verwijderd-NN` (vangnet voor andere plekken).

`vervangingen.txt` bevat de echte namen: alleen buiten de repository bewaren en na afloop verwijderen (`shred -u ../vervangingen.txt` of veilig wissen).

## Stap 5 — Nieuwe geschiedenis controleren (vóór het pushen)

```bash
node /pad/naar/Coach/tools/historie-inventaris.js controle --namen ../vervangingen.txt   # moet "SCHOON" geven
git log --all --format= --name-only | grep -c starter-data                              # moet 0 zijn
npm test                                                                                 # huidige app werkt nog
grep -c '^refs/pull/.*/head$' .git/filter-repo/changed-refs                              # aantal geraakte PR's
cat .git/filter-repo/first-changed-commits                                               # nodig voor GitHub Support
git diff <oude-main-hash> HEAD --stat                                                    # verwacht: geen verschil in de huidige bestanden
```

Klopt iets niet: deze map weggooien en opnieuw beginnen bij stap 2. Tot en met stap 5 is er niets op GitHub veranderd.

## Stap 6 — Geforceerd pushen met controle van het doel

```bash
git remote -v                         # moet exact https://github.com/kesga44-jpg/Coach.git zijn
# zo nodig: git remote add origin https://github.com/kesga44-jpg/Coach.git
git ls-remote origin                  # welke branches/refs staan er nu?
git push --force --mirror --dry-run origin    # controleer: alleen kesga44-jpg/Coach, verwachte branches
git push --force --mirror origin
```

- Fouten voor `refs/pull/*` zijn **normaal** (alleen-lezen bij GitHub; dat lost Support op).
- Faalt een gewone branch: branch protection tijdelijk uitzetten (Settings → Branches), opnieuw pushen, protection weer aanzetten.
- Push niet naar een andere repository of remote.

## Stap 7 — GitHub-cacheverwijdering aanvragen

Pas als alle gewone branches schoon zijn en er geen forks met de gegevens zijn: [GitHub Support](https://support.github.com/contact) → verzoek om gevoelige gegevens te verwijderen. Vermeld:
- eigenaar en repository: `kesga44-jpg/Coach`;
- het aantal geraakte PR's (stap 5);
- de *First Changed Commit(s)* (stap 5);
- dat het om persoonsgegevens van derden gaat (namen en afwezigheid, waaronder gezondheidsredenen).

Support verwijdert de PR-verwijzingen, voert garbage collection uit en wist gecachte weergaven. Forks moet de eigenaar van de fork zelf opschonen.

## Stap 8 — GitHub Pages controleren

1. Settings → Pages: bron is nog steeds de juiste branch (`main`) en map.
2. Actions → `pages-build-deployment`: laatste run geslaagd (wacht een paar minuten).
3. Site openen in een privévenster; controleren dat de app laadt.
4. Automatisch controleren dat de gepubliceerde `app.js` fictieve startdata heeft en geen namen bevat:
   ```bash
   node /pad/naar/Coach/tools/historie-inventaris.js site --url https://<gebruiker>.github.io/Coach/ --namen ../vervangingen.txt
   ```
5. Op je eigen apparaten: de app één keer volledig sluiten en openen (de service worker haalt de nieuwe versie op). Je eigen gegevens blijven staan.
6. Daarna: `vervangingen.txt` veilig verwijderen en oude lokale clones verwijderen en opnieuw klonen.

## Proefuitvoering (lokaal, 2026-11-08)

Op een lokale kopie (bare repository als “origin”, met 2.10.0 en 2.10.1 als gemerged gesimuleerd: 50 commits):
- inventaris: 34 spelers, 46 commits met gegevens (`app.js` 45, `starter-data.json` 3, `starter-data.js` 2);
- `git filter-repo 2.47.0 --sensitive-data-removal --invert-paths … --replace-text …`: geslaagd;
- controle: **SCHOON**, 0 commits met namen of spelers-id's; `starter-data.*` 0 keer in de historie; de huidige `app.js` byte-voor-byte gelijk; `npm test` 158/158;
- `push --force --mirror` naar de lokale origin en controle in een nieuwe clone: SCHOON.
- Niet gerepeteerd: GitHub-specifieke onderdelen (`refs/pull/*`, branch protection, Support, Pages).
