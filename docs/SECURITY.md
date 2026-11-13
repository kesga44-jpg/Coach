# Beveiliging en privacy — Coach 2.10.0

Classificatie van bewijs: **LA** = lokaal aangetoond (test in de ontwikkelomgeving) · **CI** = GitHub CI aangetoond · **PV** = productiegeverifieerd · **VR** = vermoedelijk risico · **OB** = onbekend.

In deze oplevering is CI **niet** gedraaid (er is niet gepusht) en is **niets** in productie geverifieerd. Een lokale PostgreSQL-test bewijst niet dat productie veilig is.

## Bevindingen

| # | Onderwerp | Bevinding | Bewijs | Ernst | Maatregel 2.10 | Open |
|---|---|---|---|---|---|---|
| S1 | `coach-knowledge` | Door de app voorgeschreven policies geven `anon` lezen, toevoegen en **overschrijven** op de hele bucket. Inhoud versleuteld, maar integriteit/beschikbaarheid niet beschermd. | LA (risico aangetoond met de voorgeschreven SQL); productie OB | Middel | Waarschuwing in de app; voorstel 0002 + lokale tests | Goedkeuring + PR-10 + productiecontrole |
| S2 | `vc2` | App leest met publishable key → `anon` heeft vermoedelijk leesrecht; PDF's dan leesbaar voor iedereen met de sleutel | VR | Laag–middel | Gedocumenteerd | Beoordelen bij PR-10 |
| S3 | `coach_data_auth` RLS | Verwachte policies correct; productie onbekend | LA (referentie-SQL), productie OB | Middel tot verificatie | Referentie-SQL, verify-script, RLS-tests | Eigenaar draait verify-script |
| S4 | AI-endpoint (R9) | Tot 2.9.1 werden namen, notities, ontwikkeldoelen en volledige trainings-/wedstrijdobjecten naar een vrij in te vullen URL gestuurd | LA (code) | Middel | **Opgelost:** alleen lokale adressen, pseudonimisering, minimale context, bevestiging, `credentials:'omit'`. **Patch 4:** tekstvelden met gezondheidstermen weggelaten, vraag met zulke termen niet verstuurd, laatste controle blokkeert bij twijfel, exacte preview | Woordenlijst is niet volledig (zie P4) |
| S5 | pdf.js 3.11.174 (R2) | CVE-2024-4367 | Bekend (ecosysteem-analyse) | Hoog | **Interim:** `isEvalSupported:false` + `enableXfa:false` in beide parsers via `pdfjsOpen()` (test `pdf.test.js`) | Upgrade 4.x (PR-4) |
| S6 | SheetJS 0.18.5 (R3) | Verouderd | Bekend | Middel | – | PR-5 |
| S7 | Geen SRI op CDN-scripts (R5) | Supply-chainrisico | LA (code) | Middel | Versies exact gepind (test) | SRI na online hashcontrole |
| S8 | Startdata in publieke repo | `app.js` bevat startdata met **34 echte spelersnamen en 101 trainingen met aanwezigheid** (bron “Aanwezigheid spelers O23 – 26-27”). De repo is publiek (anoniem te klonen). Ook in de git-historie. | LA | Middel (AVG, gegevens van derden) | **Patch 1:** startdata vervangen door fictieve data (generator + tests) | Git-historie opschonen (handmatig stappenplan) |
| S9 | XSS | Rendering via template-strings met `esc()`; modaltitel via `textContent`; bestandsnamen in PDF-script gesaneerd; kennislinks alleen `https:` | LA: Chromium-test met `<img onerror>` in namen, teksten, kennis — 0 uitvoeringen op alle pagina's | Laag | Test toegevoegd | – |
| S10 | Publishable key in code | Bedoeld voor browsercode; geen geheim. Geen secret/service-role key gevonden | LA (`static.test.js` scant) | – | Test | – |
| S11 | Offline opslag | Gegevens, Secret key en sessietokens staan onversleuteld in `localStorage` van het apparaat | LA (code) | Laag–middel (gedeeld apparaat) | Gedocumenteerd | Advies: apparaatvergrendeling; uitloggen op gedeelde apparaten |
| S12 | Back-upbestanden | JSON onversleuteld, bevat persoonsgegevens van spelers; bevat **geen** Secret key of tokens | LA (test) | Middel | Gedocumenteerd | Advies: veilig bewaren, max. 6 maanden (ADR 0014) |
| S13 | Uploadbeveiliging | Kennis-JSON max. 5 MB; back-up max. 25 MB (nieuw); JSON-validatie; kennisbankbestanden worden versleuteld opgeslagen, niet uitgevoerd | LA | Laag | Groottegrens back-up | – |
| S14 | Gezondheidsgegevens | `availabilityStatus/Note` en aanwezigheidsstatus “blessure/ziek” zijn gezondheidsgegevens | LA (code) | Middel (AVG) | Niet meer naar AI-endpoint | Dataminimalisatie (ecosysteem DATA_OWNERSHIP §5) |
| S15 | Dependencies | Geen npm-runtime-dependencies; tests gebruiken alleen Node-ingebouwd. Playwright optioneel voor e2e | LA | – | – | – |
| S16 | Secrets in ZIP | Gescand (`static.test.js` + handmatige grep): geen secret keys, tokens of wachtwoorden | LA | – | – | – |
| S17 | Mapnaam kennisbank | `coach-knowledge/<sha256('football-coach-v2:'+Secret key)>/…`: ongezouten snelle hash van de versleutelingssleutel; bij anon-oplijsten kan een zwakke sleutel offline worden geraden | LA (`sleutels.test.js`), productie OB | Middel | Gedocumenteerd; advies sterke Secret key | PR-10 (map = auth.uid())
| S18 | Oude tabel `coach_data` | Kan in productie nog bestaan met anon-toegang | OB | Middel | Verify-script controleert dit | Besluit na verificatie |

## Privacy van spelersgegevens (AVG — geen juridisch advies)

Coach verwerkt naam, geboortedatum, (eventueel) e-mail, aanwezigheid en blessurestatus van spelers: persoonsgegevens van derden, deels gezondheidsgegevens. Aanbevelingen uit het ecosysteem (DATA_OWNERSHIP §5) blijven open en vragen een besluit: dataminimalisatie (geboortejaar i.p.v. -datum), spelers informeren, blessurestatus zonder medische details, back-ups beperkt bewaren. S4 (AI) is in 2.10 opgelost; S8 (startdata in publieke repo) vraagt het snelste besluit.

## Verificatie in productie (niet uitgevoerd)

1. `supabase/verify/verify-production.sql` in de SQL Editor (alleen lezen).
2. Met de publishable key, zonder login, proberen `POST /storage/v1/object/list/coach-knowledge` → verwacht na hardening: leeg of 4xx.
3. Supabase Security Advisor in het dashboard bekijken.
