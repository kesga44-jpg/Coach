# API- en integratieregister — Coach

Peildatum: 2026-11-08. Regel: geen fictieve endpoints; alleen wat in de code staat of in (officiële) documentatie is gezien. “Niet geverifieerd” betekent: niet bij de bron gecontroleerd.

## 1. Daadwerkelijk geïntegreerd (bestaand)

| Dienst | Doel | Gegevens die de app verstuurt | Status 2.10 |
|---|---|---|---|
| Supabase Auth (project B) | Inloggen voor sync | e-mail, wachtwoord (alleen bij inloggen/registreren), tokens | Ongewijzigd |
| Supabase REST `coach_data_auth` | Versleutelde sync | versleutelde payload, `user_id`, `updated_at` | Logica verbeterd (basisversie) |
| Supabase Storage `coach-knowledge` | Versleutelde kennisbankoriginelen | versleuteld bestand | Ongewijzigd; waarschuwing + voorstel |
| Supabase Storage `vc2` | VC2-documenten lezen/indexeren | geen (alleen lezen) | Ongewijzigd |
| jsDelivr CDN | Bibliotheken, pas bij gebruik geladen | IP/User-Agent naar CDN | Ongewijzigd (zie §4) |

## 2. Alleen voorbereid / optioneel door de gebruiker in te stellen

| Integratie | Wat is gebouwd | Wat is niet gebouwd |
|---|---|---|
| Lokale AI via Ollama (`POST http://localhost:11434/api/chat`, `stream:false`, antwoord in `message.content`) — bron: [Ollama API-documentatie](https://github.com/ollama/ollama/blob/main/docs/api.md) | Endpointcontrole (alleen localhost/eigen netwerk), gepseudonimiseerde context, bevestiging per verzending, bronlabel, time-out, terugval op regelgebaseerd | Niet getest met een echt model. Ollama staat standaard alleen browserverzoeken vanaf localhost-origins toe; voor gebruik vanaf de gehoste app moet de eigenaar `OLLAMA_ORIGINS` op de app-origin zetten ([toelichting](https://webhookrelay.com/localhost/11434/), niet-officieel). Of de browser vanaf een https-pagina een lokaal http-adres toestaat (Private/Local Network Access) is **niet geverifieerd**. |
| Generiek lokaal JSON-endpoint (`{prompt,context}` → `{answer}`) | Zelfde privacymaatregelen | – |
| WebLLM | Niets (ADR 0008: fase F6, licentie- en CSP-controle eerst) | Volledig |

## 3. Voetbaldata-API's — onderzoek (niets gebouwd)

Vraag: voegt een externe API concrete waarde toe voor een amateurteam (Full Speed O23) zonder de architectuur of privacy te schaden?

| API | Wat het biedt | Kosten / limieten | Bruikbaar voor Coach? | Bron / verificatie |
|---|---|---|---|---|
| **Sportlink Club.Dataservice** (KNVB-ledenadministratie) | Club, teams, competities per team, programma, uitslagen, standen | Toegang via een Club.Dataservice-**client-ID van de club** | **Meest relevant** (amateurcompetitie, eigen wedstrijdprogramma). Spelersgegevens worden in de bekeken bron niet genoemd. | Afgeleid uit open-source wrappers (PendoNL/php-club-dataservice, [laravel-sportlink-clubdataservice](https://root.packagist.org/packages/noaber/laravel-sportlink-clubdataservice)). Officiële documentatie, voorwaarden, base-URL, limieten en CORS **niet geverifieerd**; KNVB verwijst voor Sportlink-vragen naar de Sportlink Servicedesk ([knvb.nl](https://www.knvb.nl/node/60433)). |
| football-data.org | Profcompetities (o.a. Eredivisie), wedstrijden, standen | Free: 10 verzoeken/min, 12 competities, geen spelers/statistieken, vertraagde scores | Nee: geen amateurcompetities | [Vergelijking door concurrent](https://www.thestatsapi.com/blog/thestatsapi-vs-football-data-org); bij football-data.org zelf **niet geverifieerd** |
| API-Football (api-sports) | Profvoetbal: wedstrijden, opstellingen, spelers, statistieken | Free: 100 verzoeken/dag; voorwaarden via “Terms of use” | Nee voor teambeheer; amateurdekking niet vermeld; betaalde plannen uitgesloten | [api-football.com/pricing](https://www.api-football.com/pricing) |
| Trainings-/prestatiedata (GPS-vesten, wearables) | – | – | Geen open, gratis API gevonden die bij een amateurteam past; gezondheids-/lichaamsdata horen niet naar externe diensten | Niet onderzocht in detail |

**Conclusie:** geen integratie gebouwd. Een Sportlink-koppeling (programma en uitslagen ophalen) is de enige met concrete waarde, maar vereist: (1) een client-ID van de club, (2) bevestiging van voorwaarden en of het via de browser mag (anders een server/Edge Function), (3) een architectuurbesluit omdat het een externe dienst met clubgegevens is, (4) een afzonderlijk voorstel en PR (ADR 0011). Privacyrisico: beperkt zolang alleen programma/uitslagen worden opgehaald; geen spelersgegevens importeren zonder grondslag.

## 4. Externe scripts (CDN, bestaand)

| Bibliotheek | Versie | Gebruik | Opmerking |
|---|---|---|---|
| pdf.js (`pdfjs-dist`) | 3.11.174 | Tekst uit PDF's (VC2-index, Bronnen) | CVE-2024-4367 (opgelost in 4.2.67). **2.10: `isEvalSupported:false` (interim-maatregel uit ecosysteem-SECURITY R2).** Upgrade = PR-4. |
| SheetJS (`xlsx`) | 0.18.5 (npm) | Excel-import (Bronnen) | Ecosysteem-R3: verouderd; upgrade via cdn.sheetjs.com = PR-5 |
| jsPDF | 2.5.2 | Wedstrijdblad/rapporten als PDF | – |
| html2canvas | 1.4.1 | Wedstrijdblad als afbeelding/PDF | – |
| mammoth | 1.12.2 | DOCX-tekst (Bronnen) | – |

Alle versies zijn exact gepind (gecontroleerd door `static.test.js`). **SRI ontbreekt nog** (R5): de CDN was vanuit de ontwikkelomgeving niet bereikbaar, dus hashes konden niet tegen de echte CDN-bestanden worden gecontroleerd. Een verkeerde hash zou de PDF-export breken; daarom niet blind toegevoegd.

## 5. Strava en Garmin

Besluit ADR 0009: geen directe koppeling, geen OAuth. Niets gebouwd. Een interoperabel importformaat (GPX/FIT/TCX) hoort bij de Sportapp. Voor Coach is er nu geen toepassing: Coach registreert teamtrainingen en aanwezigheid, geen individuele activiteiten. Mocht teambelasting ooit uit individuele bestanden moeten komen, dan alleen als **samenvatting** (duur/afstand) via een expliciet gebruikersbestand en na een nieuw besluit — en nooit gezondheidsdata naar externe diensten.

## 6. Koppelingen met andere ecosysteem-apps

Geen (INTEGRATIONS.md). De Hub mag alleen een deeplink naar Coach tonen (I-1) en `GET /auth/v1/health` van project B doen (I-2).
