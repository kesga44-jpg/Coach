# Patch 4 — AI-privacy: gezondheidsinformatie, exacte preview, bij twijfel niet verzenden

## Probleem
2.10.0 verving namen door S1…Sn en liet het blessureveld en vertrouwelijke notities weg, maar **vrije tekst** (ontwikkeldoelen, wedstrijdevaluaties, wedstrijdplannen, coachnotities, trainingsdoelen) kon nog blessure- of medische informatie bevatten (“viel uit met hamstring”). De bevestiging was een `confirm()` zonder inzicht in de inhoud.

## Wijziging (`app.js`, nieuw blok “Patch 4 · AI-privacy”)
1. **Herkenning** (`aiHealthHit`): woordenlijst met blessure-, medische en gezondheidstermen, inclusief samenstellingen (kuitblessure, liesklacht, hersenschudding, fysio, huisarts, ziek, koorts, pijn, astma, burn-out, psycholoog, zwanger, herstellend …), Nederlands en Engels.
2. **Filteren** (`aiFilterHealth`): elk tekstveld in de context met zo’n term wordt **in zijn geheel** vervangen door `[weggelaten: mogelijk gezondheidsinformatie]` — ook in kennisbankpassages. Namen worden zoals in 2.10 vervangen.
3. **Vraag**: bevat de vraag zelf zo’n term, dan wordt niets verstuurd (regelgebaseerd antwoord met uitleg).
4. **Laatste controle** (`aiFinalCheck`) op de complete verzendtekst: spelers- of stafnamen, spelers-id's, e-mail, 06-nummers, geboortedata en gezondheidstermen. **Eén treffer = niets verstuurd.** Wordt ook vlak vóór het daadwerkelijke versturen opnieuw uitgevoerd.
5. **Preview**: een venster toont doel (host, model), aantal spelers, welke velden zijn weggelaten en waarom, en **exact** de tekst die verstuurd wordt (inclusief aantal tekens). Alleen de knop “Versturen naar …” verstuurt; sluiten of annuleren verstuurt niets. Verzonden wordt precies de getoonde tekst.

## Tests
- `ai-privacy.test.js` (6): herkenning (19 positieve, 7 negatieve voorbeelden) · gezondheidsvelden weggelaten, overige inhoud blijft · vraag met gezondheidsterm geblokkeerd · preview = verzonden tekst (byte-voor-byte) · naam/e-mail/id die door de filters glipt blokkeert alles · laatste controle.
- `ai.test.js` aangepast aan de preview (3 tests): zonder klik niets verstuurd; geen namen/id's/geboortedata/e-mail/blessure in verzending; terugval.
- Mutatietests: laatste controle uit → 2 tests falen; filter uit → 1 test faalt.

## Beperkingen (eerlijk)
- Een woordenlijst herkent niet alles (omschrijvingen zoals “liep mank”, spelfouten, andere talen). Daarom: velden worden in hun geheel weggelaten, de trainer ziet de exacte tekst vooraf, en het lokale model draait op eigen apparaat/netwerk.
- Conservatief: woorden als “pijn” of “klacht” in een niet-medische betekenis leiden ook tot weglaten.
- Niet getest met een echt Ollama-model.

## Risico's
Laag; raakt alleen de optionele lokale AI. Zonder ingesteld endpoint verandert er niets (regelgebaseerd).

## Implementatie
`git am -3` op een branch vanaf 2.10.0 → `npm test` → PR → merge door eigenaar.
