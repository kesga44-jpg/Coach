# Installatie en lokaal draaien

## Vereisten

- Een moderne browser (Chrome/Edge/Safari/Firefox).
- Voor ontwikkelen/testen: Node.js 22 (zelfde als CI). Optioneel PostgreSQL ≥ 14 en Playwright.

## Lokaal starten

```bash
unzip coach-2.10.0.zip -d coach && cd coach
python3 -m http.server 8080        # of: npx serve .
# open http://localhost:8080/
```

Open de app via `http://` (niet als `file://`): de service worker en installatie als app werken alleen via http(s) of localhost.

## Testen

```bash
npm run check
npm test
npm run test:db                     # optioneel, PostgreSQL nodig
npm i -D playwright && npx playwright install chromium && npm run test:e2e   # optioneel
```

`.env.example` beschrijft de enige (optionele) variabelen voor deze hulpscripts. De app zelf gebruikt geen omgevingsvariabelen.

## Installeren als app (PWA)

- iPhone/iPad: Safari → Deel → “Zet op beginscherm”.
- Android/desktop Chrome/Edge: menu → “App installeren”.

## Sync instellen (optioneel)

Instellingen → Sync: inloggen of registreren (Supabase-account in project B), daarna een Secret key kiezen (versleutelingssleutel, twee keer invoeren). Gebruik op elk apparaat dezelfde Secret key. Zie `docs/SUPABASE.md`.

## Lokale AI (optioneel)

1. Installeer Ollama op dit apparaat en een model naar keuze.
2. Sta de app-origin toe in Ollama (`OLLAMA_ORIGINS`), anders weigert Ollama browserverzoeken van een andere origin.
3. Instellingen → “Lokaal AI-endpoint”: `http://localhost:11434/api/chat`; “Lokaal model”: de modelnaam.
4. Coachassistent → vraag stellen → bevestigen. Zonder deze stappen werkt de assistent regelgebaseerd.

## Publiceren

Upload de inhoud van deze map (zonder `node_modules/`, `tests/e2e/output/`) naar de bestaande hosting via een PR naar `main`. Zie `docs/RELEASE.md`.
