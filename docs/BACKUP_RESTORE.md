# Back-up en herstel — Coach 2.10.0

## Wat zit erin?

| Onderdeel | In de back-up (“Back-up downloaden”) | Toelichting |
|---|---|---|
| Teams, spelers, trainingen, aanwezigheid, gastspelers, groepen | ✅ | |
| Wedstrijden, selecties, opstellingen, beschikbaarheid, rugnummers, evaluaties | ✅ | |
| Oefeningen, sjablonen, spelmodel, seizoen, notities, staf, reflecties | ✅ | |
| Koppelingen kennisbankoriginelen (`knowledgeFiles`) | ✅ | Alleen metadata; het versleutelde bestand blijft in Storage |
| Kennis & Ontwikkeling (artikelen + updates) | ✅ **nieuw** | Als `knowledgeModule` (zelfde formaat als “Kennis exporteren”) |
| VC2-tekstindex | – | Afgeleid; opnieuw op te bouwen met “Vernieuwen & indexeren” |
| Seizoensarchieven | – | Worden bij archiveren als eigen JSON gedownload |
| Secret key, inlogsessie | – **bewust** | Nooit in een back-upbestand |
| Originele PDF/DOCX van de kennisbank | – | Bewaar zelf een kopie (zie SECURITY S1) |

## Herstellen (Instellingen → Back-up importeren)

1. Kies het JSON-bestand. De app controleert eerst (geldige JSON, max. 25 MB, structuur, dubbele id's).
2. Een bevestigingsvenster toont: datum en appversie van de back-up, aantallen teams/spelers/trainingen/wedstrijden/oefeningen, en hoeveel kennisartikelen nieuw zijn en hoeveel al aanwezig.
3. Na bevestiging:
   - **Teamgegevens worden vervangen** door die uit de back-up (zoals voorheen). De huidige versie wordt eerst bewaard als herstelpunt (“Herstelkopie downloaden”).
   - **Kennisbankkoppelingen blijven behouden**: koppelingen die lokaal bestaan maar niet in de back-up staan, blijven staan; bij dezelfde bron wint de nieuwste uploaddatum.
   - **Kennis & Ontwikkeling wordt alleen aangevuld**: nieuwe artikelen worden toegevoegd, dubbelen (zelfde DOI/URL of titel+bron, of dezelfde update) overgeslagen. Er wordt nooit iets overschreven of verwijderd. De vorige kennisopslag blijft als laatste-versie-kopie bewaard.
   - De sync-basis wordt gewist: de herstelde gegevens gaan pas naar de cloud na een handmatige “Upload nu”.

### Gedrag bij fouten en gedeeltelijk herstel

| Situatie | Gedrag |
|---|---|
| Geen geldige JSON, verkeerde structuur, te groot | Niets gewijzigd; melding |
| Bestand is een Kennis-export | Niets gewijzigd; verwijzing naar Kennis & Ontwikkeling → Importeren |
| Annuleren in het bevestigingsvenster | Niets gewijzigd |
| Opslaan van teamgegevens mislukt (bijv. opslag vol) | Oude gegevens blijven; kennis wordt ook niet aangevuld |
| Kennisonderdeel ongeldig | Teamgegevens wel hersteld, kennis ongewijzigd; waarschuwing vooraf |
| Lokale kennisopslag onleesbaar | Teamgegevens wel hersteld; kennisopslag wordt **niet** aangeraakt |
| Oude back-up (vóór 2.10, zonder kennis) | Volledig bruikbaar; kennis blijft ongewijzigd |
| Zeer oude back-up (V1, ontbrekende velden) | `normalize()` vult aan (o.a. voor-/achternaam, teams, gastspelers) |

## Aanbevolen werkwijze

- Download een back-up vóór elke grotere actie (seizoen archiveren, herstel, nieuwe appversie) en ten minste maandelijks.
- Bewaar back-ups veilig: ze bevatten persoonsgegevens van spelers (onversleuteld JSON). Ecosysteembeleid: Coach-back-ups maximaal 6 maanden bewaren (ADR 0010/0014).
- Cloud-sync is geen back-up: één rij per account, de laatste versie wint na bevestiging.

## Tests

`backup.test.js` (12 tests): inhoud, round-trip met kennis-unie, idempotentie, oude/minimale back-ups, knowledgeFiles-samenvoeging, ongeldige invoer, ongeldig kennisonderdeel, onleesbare kennisopslag, mislukte opslag, bevestigingstekst, startdata identiek, geen geheimen. Plus de Chromium-test die een echte download controleert.
