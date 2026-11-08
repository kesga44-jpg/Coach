# Datamodel — Coach 2.10.0

## Lokale opslag (`localStorage`)

| Sleutel | Inhoud | Mee in back-up | Mee in cloud-sync |
|---|---|---|---|
| `footballCoachDataV2` | Hoofdstate (zie hieronder) | ✅ | ✅ (versleuteld) |
| `footballCoachDataV1` | Oude opslag; wordt gelezen en naar V2 gekopieerd, nooit verwijderd | – | – |
| `footballCoachKnowledgeV1` | Kennis & Ontwikkeling (`{version,updates[],items[]}`) | ✅ sinds 2.10 (`knowledgeModule`) | – |
| `footballCoachKnowledgeBackupV1` | Vorige versie van de kennisopslag (bij elke wijziging) | – | – |
| `footballCoachRecoveryBackupV1` | Herstelpunt vóór herstel/clouddownload/reset | – (wel downloadbaar) | – |
| `footballCoachAutoBackupV1` | Dagelijkse automatische lokale kopie | – | – |
| `footballCoachSeasonArchivesV1` | Laatste 3 seizoensarchieven | – (bij archiveren als JSON gedownload) | – |
| `footballCoachCloudConflictV1` | Bewaarde cloudversie bij conflict | – | – |
| `footballCoachSyncV1` | Versleutelingssleutel (“Secret key”) | – **bewust** | – |
| `footballCoachAuthV1` | Supabase-sessie (access/refresh token) | – **bewust** | – |
| `footballCoachSyncAccountV1` | Goedgekeurd sync-account (eerste upload) | – | – |
| `footballCoachSyncBaseV1` | **Nieuw 2.10**: laatst gesynchroniseerde cloudversie `{userId,updatedAt}` | – | – |
| `footballCoachVc2IndexV1` | Tekstindex van VC2-documenten (afgeleid, opnieuw op te bouwen) | – | – |

## Hoofdstate (`footballCoachDataV2`)

Top-level (alle optioneel bij inlezen; `normalize()` vult aan):

`version`, `meta`, `team`, `club`, `teams[]`, `players[]`, `trainings[]`, `matches[]`, `exercises[]`, `tactics[]`, `seasonItems[]`, `coachNotes[]`, `documents[]`, `knowledgeFiles{}`, `settings`, `ai{endpoint,modelLabel,model}`, `gameModel{principles[],teamModels{}}`, `periodization`, `templates{trainings[],matches[]}`, `staff[]`, `coachReflections[]`, `teamDiagnostics[]`.

### Belangrijkste objecten

- **Speler**: `id`, `firstName`, `lastName`, `name` (afgeleid), `primaryTeamId`, `teamIds[]`, `position`, `number`, `selection`, `startDate` (“Aangemeld sinds”), `birthDate`, `active`, `availabilityStatus/Until/Note`, `scores{}`, `idp{goals[]}`, `developmentHistory[]`, `valueHistory[]`, `conversations[]`.
- **Training**: `id`, `teamId`, `date`, `startTime`, `templateKey`, `focus`, `trainingObjective`, `planItems[{exerciseId,duration,coachPoints}]`, `attendance{spelerId|guest:<id> → status}`, `squadPlayerIds|null`, `guestPlayers[]`, `groups[]`, `groupAssign{}`, `cancelled`, `intensity`, `load`, `trainingEvaluation{}`, `quickReflection{}`.
- **Wedstrijd**: `id`, `teamId`, `date`, `opponent`, `formation` (`4-3-3`, `5-3-2`, `4-2-3-1`, `4-4-2`), `lineup{positie → spelerId}`, `benchIds[]`, `promotedFirstIds[]`, `promotedO232Ids[]`, `availability{spelerId → {status,reason}}`, `playerNumbers{}` (tijdelijk rugnummer), `playerStats{}`, `attendance{}`, `plan{}`, `evaluation{}`, `checklist{}`, `sheetRemarks{}`, `cancelled`.
- **knowledgeFiles**: `{bronId → {name,type,size,uploadedAt}}` — alleen metadata; het versleutelde bestand staat in Storage.

### Rekenregels (ongewijzigd sinds 2.9.1)

- Aanwezig = status begint met “Aanwezig”. Trainingspercentage = aanwezig / relevante trainingen (niet ingevuld telt als niet aanwezig).
- Relevant: training van het huidige primaire team, niet geannuleerd, niet in de toekomst, op of na `startDate` (leeg = volledige historie), speler in de trainingsselectie (of geregistreerd), niet als meetrainer.
- Meetrainers (`guestPlayers`, `guest:<id>`) tellen mee in de trainingstelling, niet in hun eigen teampercentage.
- Basis/bank weigeren niet-beschikbare spelers; dubbele rugnummers worden gesignaleerd; een tijdelijk wedstrijdnummer wijzigt het profielnummer niet.

`rekenregels.test.js` bewijst met een gouden vergelijking dat deze uitkomsten op de startdata identiek zijn aan v2.9.1.

## Back-upformaat (2.10)

De bestaande state-JSON blijft de basis; twee optionele velden zijn toegevoegd:

```json
{
  "version": 2, "players": [], "trainings": [], "matches": [], "...": "...",
  "backupMeta": {"format": "football_coach_backup", "version": 2, "appVersion": "2.10.0", "exportedAt": "…", "contains": ["…"]},
  "knowledgeModule": {"format": "football_coach_knowledge_export_v1", "version": 1, "updates": [{"root": {}, "items": [{"category": "…", "raw": {}}]}]}
}
```

- Oudere back-ups (zonder deze velden) blijven volledig bruikbaar.
- Oudere app-versies kunnen een 2.10-back-up lezen; zij negeren het kennisonderdeel (het blijft als extra veld in hun state staan).

## Cloudrij (`public.coach_data_auth`)

`(user_id uuid, id text = 'football-coach-v2', payload jsonb = {v,salt,iv,data} AES-GCM/PBKDF2-160k, updated_at timestamptz)`; sleutel `(user_id,id)`. Zie `docs/SUPABASE.md`.

## Storage

- `coach-knowledge/<sha256('football-coach-v2:'+secret)>/<bronId>.fckb` — versleutelde originelen (`FCKB1`-header + AES-GCM).
- `vc2/VC2/*.pdf|*.fckb` — VC2-documenten, alleen gelezen en lokaal geïndexeerd.
