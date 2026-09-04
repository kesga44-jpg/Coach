# Full Speed O23 Coach – GitHub Pages app

Deze map is een complete statische web-app. Er is geen Flutter, buildserver of betaalde hosting nodig.

## Wat zit al in versie 1

- 34 spelers uit `Aanwezigheid spelers O23 -- 26-27 v1.xlsm`.
- Trainingsplanning van dinsdag/donderdag uit het Excelbestand (28-07-2026 t/m 13-07-2027).
- Historische trainingsaanwezigheid t/m 03-09-2026.
- Historische wedstrijdaanwezigheid voor de speeldagen t/m 29-08-2026.
- Spelers + selectiestatus, aanwezigheid, trainingen, lokale trainingsgenerator, oefeningenbibliotheek, wedstrijden, tactieken en seizoenskalender.
- Lokale opslag in de browser.
- JSON export/import als back-up.
- PWA: op iPhone/iPad/Android als app aan beginscherm toe te voegen.
- Optionele AES-GCM versleutelde Supabase-sync tussen apparaten.

## Op GitHub zetten

1. Maak op GitHub een nieuwe repository, bijvoorbeeld `football-coach-app`.
2. Upload **alle bestanden uit deze map** naar de hoofdmap van de repository.
3. Open in GitHub: **Settings → Pages**.
4. Kies bij **Build and deployment**: `Deploy from a branch`.
5. Kies branch `main`, map `/ (root)` en klik **Save**.
6. Na publicatie staat de app op je GitHub Pages-adres.

## Als app op iPhone/iPad

Open de GitHub Pages-link in Safari → Deel-knop → **Zet op beginscherm**.

## Synchronisatie tussen laptop, iPad en iPhone

Maak gratis een Supabase-project. Open **SQL Editor** en voer dit één keer uit:

```sql
create table public.coach_data (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.coach_data enable row level security;

create policy "encrypted coach read" on public.coach_data
  for select to anon using (true);
create policy "encrypted coach insert" on public.coach_data
  for insert to anon with check (true);
create policy "encrypted coach update" on public.coach_data
  for update to anon using (true) with check (true);
```

Daarna in de app bij **Instellingen → Versleutelde Supabase-sync**:

1. Vul de Project URL in.
2. Vul de Supabase `anon` key in.
3. Genereer een Sync-ID.
4. Kies een sterk Sync-wachtwoord.
5. Klik **Bewaar sync** en daarna op het eerste apparaat **Uploaden**.
6. Vul op ieder ander apparaat exact dezelfde vier waarden in en klik **Ophalen**.

De volledige coachdata wordt vóór verzending in de browser versleuteld. Zet nooit een Supabase service-role key in deze app; gebruik uitsluitend de anon key.

## Bestanden

- `index.html` – app-shell.
- `style.css` – responsive ontwerp voor mobiel, tablet en laptop.
- `app.js` – alle appfunctionaliteit.
- `starter-data.js` – geïmporteerde Excel-startdata.
- `manifest.json` + `sw.js` – PWA/offline basis.
- `icon-192.png`, `icon-512.png` – appiconen.

## Volgende logische uitbreidingen

- Visuele opstellingen op een voetbalveld met drag & drop.
- Spelerontwikkelingskaarten en individuele doelen.
- Trainingsbelasting / periodisering per week.
- Veilige AI-trainingsgenerator via een serverless functie, zodat een API-key nooit in GitHub komt.
- Directe Excel import/export in de browser.
