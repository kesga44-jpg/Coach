# Privacy-audit Git-geschiedenis (alleen refs, bestanden en categorieën)

Uitgevoerd read-only op een volledige kloon (71 commits, 16 refs, alle branches/tags). Er zijn geen persoonsgegevens in dit document opgenomen.

## Bevindingen
| Categorie | Resultaat | Referenties |
|---|---|---|
| Echte spelersgegevens in startdata (`window.STARTER_DATA` in `app.js` zonder `"fictional":true`) | **Aanwezig** in 49 van de 70 commits met app.js in alle refs; fictieve data pas vanaf `b956f63` (2.10.1) | `app.js` in alle commits vóór `b956f63`; ook `starter-data.js` / `starter-data.json` (3 commits, o.a. `081c00d`, `27ba10b`) |
| Aanwezigheid/blessure-/ziekteredenen (bijzondere persoonsgegevens, indicatie) | Volgens `docs/SECURITY.md` S8 aanwezig in dezelfde startdata; niet opnieuw geïnspecteerd | idem |
| Secrets (service_role-/`sb_secret_`-waarden, JWT, privésleutel, AWS/GitHub-tokens) | **Geen waarden gevonden**; alleen de *namen* in docs en secret-scan-tests | `sleutels.test.js`, `static.test.js`, `.env.example`, `docs/SUPABASE.md`, `docs/patches/P2-*`, `release/patches/**` |
| Publishable key `sb_publishable_…` | Aanwezig in `app.js`; bedoeld als publiek (RLS beschermt) | `app.js` |
| E-mailadressen in oude `app.js` | Geen aangetroffen | — |
| Config/`.env`-bestanden | Alleen `.env.example` (placeholders) | `.env.example` |

Beperking: er is geen namenlijst gebruikt, dus detectie is heuristisch (structuur van startdata). Aantal spelers per commit niet opnieuw geteld; zie `tools/historie-inventaris.js` met een lokale namenlijst.

## Voorstel veilig herstel (niet uitgevoerd)
1. Besluit eerst of herstel nodig is (repo is publiek; data staat in forks/clones/caches mogelijk al buiten bereik). Beoordeel AVG-meldplicht en informeer betrokkenen/club indien van toepassing.
2. Maak een volledige back-up (`git clone --mirror`) buiten GitHub.
3. Herschrijf op een mirror met `git filter-repo --path app.js --path starter-data.js --path starter-data.json --invert-paths` is **te grof**; gebruik in plaats daarvan `--blob-callback`/`--replace-text` om alleen het startdata-blok te vervangen door de fictieve variant uit `tools/maak-fictieve-startdata.js`. Controleer met `tools/historie-inventaris.js`.
4. Plan een korte schrijfstop, force-push alle branches/tags, sluit/herschrijf open PR's (PR-refs `refs/pull/*` blijven bestaan: vraag GitHub Support om gc en cache-/PR-views te verwijderen).
5. Laat alle collaborators opnieuw klonen; verifieer daarna met de inventaris-tool op de verse kloon en op de publieke site.
6. Alternatief bij twijfel: repository op privé zetten, nieuwe repo met schone historie starten en de oude verwijderen.

Zie ook `docs/GIT_GESCHIEDENIS_OPSCHONEN.md`.

## PDF.js
Blijft op 3.11.174 (exact gepind, jsDelivr). Upgrade naar ≥ 4.2.67 vereist ESM-lading (`import()`, `.mjs`-worker) en cross-origin-workerhandling; dat is vanuit deze omgeving niet te verifiëren (CDN-toegang geblokkeerd) en is daarom een apart vervolg. SRI ontbreekt nog.
