# Supabase — Coach (project B `ckodnfshelblddfypmmv`)

> Status productie: **niet geverifieerd**. Vanuit de ontwikkelomgeving is `ckodnfshelblddfypmmv.supabase.co` niet bereikbaar (geweigerd door de netwerkproxy, 2026-11-08; eerder curl-exit 6). Er is in deze oplevering **niets** gewijzigd aan productie: geen SQL, geen policies, geen buckets.

## Configuratie in de app

| Instelling | Waarde / plaats |
|---|---|
| Project-URL | `SYNC_PROJECT_URL` bovenin `app.js` (ongewijzigd) |
| Sleutel | `SYNC_PUBLIC_KEY` = **publishable** key (bedoeld voor browsercode; geen geheim). Nooit een `service_role`/secret key in de frontend. |
| Auth | E-mail/wachtwoord via REST (`/auth/v1/token`, `/signup`, `/user`, `/logout`); sessie in `footballCoachAuthV1`, automatisch ververst en per sessie geverifieerd tegen `/auth/v1/user`. |
| Tabel | `public.coach_data_auth`, rij-id `football-coach-v2`, sleutel `(user_id,id)`. De oude tabel `coach_data` wordt niet gebruikt en niet gewijzigd. |
| Versleuteling | AES-GCM 256, PBKDF2-SHA-256 160.000 iteraties; de “Secret key” verlaat het apparaat nooit. |
| Storage | `coach-knowledge` (versleutelde kennisbankoriginelen) en `vc2` (map `VC2`, alleen lezen). |

> Let op: de centrale ecosysteemdocumentatie (`APP_REGISTRY.md`, `SECURITY.md` R8) noemt alleen bucket `vc2`. De code gebruikt daarnaast `coach-knowledge`. Voorstel: dit in `personal-ecosystem` aanvullen (aparte PR daar).

## Synchronisatie en conflictbehandeling

1. Upload: payload lokaal versleuteld; `POST` (nieuwe rij) of `PATCH … &updated_at=eq.<oude waarde>` (optimistische controle). Geen treffer of 409 = conflict: de cloudversie wordt lokaal bewaard (`footballCoachCloudConflictV1`), niets overschreven.
2. Eerste upload naar een account zonder rij vraagt altijd bevestiging.
3. **Nieuw in 2.10 — basisversie:** het apparaat onthoudt de laatst gesynchroniseerde `updated_at` (`footballCoachSyncBaseV1`). Is de cloud sindsdien niet gewijzigd, dan uploadt de stille autosync de lokale wijziging (“fast-forward”). Tot 2.9.1 gaf elke lokale wijziging na een sync bij autosync een conflict, waardoor automatische sync in de praktijk niet uploadde.
4. **Veiligheidsrem (patch 3):** geen stille upload als in **enig** onderdeel van de gegevens ≥ 10, of ≥ 3 én ≥ 20 % van de records verdwijnt (op id vergeleken; ook aanwezigheid, opstellingen, notities, sjablonen, spelprincipes, kennisbankkoppelingen enz.), als een team verdwijnt of als een onderdeel leeg raakt. Ophalen noemt vooraf wat lokaal verdwijnt. Zie `docs/patches/P3-sync-veiligheidsrem.md`. Na herstel van een back-up, “Terug naar startdata” of seizoen archiveren wordt de basis gewist: eerst handmatig bevestigen.
5. Download vervangt lokaal pas na bevestiging; de vorige lokale versie wordt herstelpunt.

Getest met een gesimuleerde PostgREST-server (`sync.test.js`), niet tegen echte Supabase.

## RLS, policies en tabelrechten

Verwachte configuratie (LEESMIJ.md) en referentie-SQL: [`supabase/reference/0001_coach_data_auth.sql`](../supabase/reference/0001_coach_data_auth.sql)

- RLS aan; drie policies voor `authenticated` (SELECT/INSERT/UPDATE) met `user_id = auth.uid()`; geen DELETE; niets voor `anon`.
- Aanvullend voorstel (deel B in hetzelfde bestand, **niet uitgevoerd**): trigger die `user_id`/`id` onveranderlijk maakt en een groottegrens van 10 MB op `payload`.
- Lokaal aangetoond (PostgreSQL 16, Supabase-nabootsing): eigenaar mag lezen/schrijven, ander account ziet en wijzigt niets, anon niets, geen delete, verouderde update raakt 0 rijen, script is idempotent, rollback werkt. Een mutatietest (extra `delete`-recht en `using (true)`) wordt door de tests afgekeurd.

### Productieverificatie (door de eigenaar, alleen lezen)

Voer [`supabase/verify/verify-production.sql`](../supabase/verify/verify-production.sql) uit in de SQL Editor van project B. Het script leest alleen catalogusgegevens en aantallen (geen inhoud). Leg de uitkomst vast in onderstaande tabel.

| Controle | Verwacht | Productie |
|---|---|---|
| RLS op `coach_data_auth` | aan | niet geverifieerd |
| Policies | 3× authenticated, `user_id = auth.uid()` | niet geverifieerd |
| Rechten anon | geen | niet geverifieerd |
| Bucket `coach-knowledge` | `public = false` | niet geverifieerd |
| Storage-policies `coach-knowledge` | zie hieronder | niet geverifieerd |
| Bucket `vc2` | privé, alleen lezen | niet geverifieerd |

Patch 2: de laatste query van het verify-script geeft deze tabel automatisch als `controle / status / toelichting` (OK, RISICO, AANDACHT, INFO), inclusief `storage.objects`-RLS en -rechten, policies zonder bucketfilter, beide buckets apart, de oude tabel `coach_data` en tabellen zonder RLS. Zie `docs/patches/P2-supabase-verificatie.md`.

## Storage `coach-knowledge` — bevinding en voorstel

**Bron:** de app toont onder Kennisbank → “Eenmalige Supabase-opslag instellen” SQL (`knowledgeStorageSql()`) die `anon` SELECT, INSERT en UPDATE geeft op alle objecten in de bucket. De app uploadt met `x-upsert: true` en de publishable key.

| Aspect | Beoordeling |
|---|---|
| Publieke leesbaarheid (bucket `public`) | Bucket wordt privé aangemaakt (`public=false`): geen openbare URL. **Maar** de SELECT-policy voor `anon` maakt lezen/oplijsten via de API mogelijk voor iedereen met de publishable key. |
| Leesbaarheid inhoud | Bestanden zijn client-side versleuteld; zonder Secret key onleesbaar. Bestandsnamen (bron-id's) en mapnaam (SHA-256 van de sleutel) zijn wel zichtbaar. |
| Schrijven/overschrijven | `anon` INSERT + UPDATE: iedereen met de publishable key kan bestanden toevoegen en bestaande bestanden **overschrijven of onbruikbaar maken**. Lokaal aangetoond (`supabase/tests/20_storage_current.test.sql`). |
| Verwijderen | Geen DELETE-policy in de voorgestelde SQL → verwijderen via API niet mogelijk (overschrijven wel). |
| Productie | **Onbekend** of de bucket zo is ingericht. Classificatie: **vermoedelijk risico (middel)**. |

**Voorstel** (niet uitgevoerd, goedkeuring nodig): [`supabase/proposals/0002_coach_knowledge_owner_only.sql`](../supabase/proposals/0002_coach_knowledge_owner_only.sql) met rollback. Alleen `authenticated`, alleen de eigen map `<auth.uid()>/…`, geen delete. Lokaal aangetoond: anon niets, ander account niets, eigenaar alleen eigen map.

Afhankelijkheden (DEVELOPMENT_ROADMAP PR-10): eerst PR-9 (backend geverifieerd) en PR-3 (opslagback-up), daarna een app-wijziging die met het access token naar `<uid>/<id>.fckb` uploadt en bestaande bestanden kopieert (oude map pas na controle opruimen). Zonder die app-wijziging breekt het voorstel het koppelen/openen van originelen. Daarom is in 2.10 alleen een duidelijke waarschuwing bij de getoonde SQL toegevoegd.

Tot dan: bewaar altijd een eigen kopie van de originele documenten (de kennisbank-samenvattingen staan in de app zelf en zijn niet afhankelijk van Storage).

## Storage `vc2`

De app leest `vc2/VC2` met de publishable key (list + download). Dat werkt alleen als `anon` daar mag lezen; policies zijn **niet geverifieerd**. PDF's in `vc2` zijn dan leesbaar voor iedereen met de publishable key (vermoedelijk opleidingsmateriaal; .fckb-bestanden zijn versleuteld). Beoordeel of dat acceptabel is (auteursrecht/vertrouwelijkheid); onderdeel van PR-10.

## API-limieten (Supabase Free, ecosysteem `API_LIMITS.md`, gecontroleerd 2026-11-07)

Relevant voor Coach: 500 MB database, 1 GB storage (max. 50 MB per bestand), 5 GB egress, **pauzeren na 7 dagen weinig activiteit** (winterstop!), geen automatische back-ups, Auth-mail 2 per uur. Coach zelf: één rij per account; de payload is de volledige versleutelde state (startdata: ca. 130 kB JSON, versleuteld en base64 ca. 1,4× zo groot; groeit met het seizoen).

## Back-up en herstel van Supabase-gegevens

Supabase Free maakt geen back-ups. De cloudrij is versleuteld en alleen met de Secret key te lezen; de JSON-back-up in de app is daarom de primaire back-up (zie `docs/BACKUP_RESTORE.md`). Server-side back-up volgt het ecosysteemplan (ADR 0010/0014, PR-3) en wacht op goedkeuring. Storage-back-up van project B wacht op PR-10.

## Migraties

| Bestand | Soort | Status |
|---|---|---|
| `supabase/reference/0001_coach_data_auth.sql` (+ rollback) | Referentie bestaande tabel + aanvulling | Lokaal getest, **niet** uitgevoerd |
| `supabase/proposals/0002_coach_knowledge_owner_only.sql` (+ rollback) | Beveiligingsvoorstel Storage | Lokaal getest, **goedkeuring nodig**, vereist PR-10 |
| `supabase/verify/verify-production.sql` | Alleen lezen | Klaar voor gebruik door eigenaar |

## OAuth 2.1 en ecosysteem-authenticatie

- ADR 0007: één gedeelde Auth in project A voor Samen Thuis, Hub, Sportapp en SIDEQUEST; **Coach houdt eigen accounts in project B** (gegevens van derden, andere gebruikersgroep).
- ADR 0017: OAuth 2.1 Server van Supabase alleen als spike (H-PR17) tegen lokale Supabase; niets activeren in project A of B; **“Samen Thuis en Coach doen niet mee.”**
- Gevolg: in Coach is niets gebouwd. Mogelijke latere stap (alleen na nieuw architectuurbesluit): Coach als OAuth-client van project A voor *inloggen*, terwijl gegevens in project B blijven — vereist cross-project tokenvalidatie en is daarom nu uitgesloten. Coach blijft zonder account volledig bruikbaar (alleen lokaal).
