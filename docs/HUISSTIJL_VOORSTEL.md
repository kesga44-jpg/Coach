# Voorstel: huisstijl rood-wit (NIET uitgevoerd)

Status: **voorstel, wacht op apart akkoord.** In 2.10.0 is de vormgeving niet gewijzigd (alleen een zichtbare focusrand in de bestaande groene kleur en `prefers-reduced-motion`).

## Huidige vormgeving

- Kleuren als CSS-variabelen in `:root` (`style.css`): `--green:#0b5d3b`, `--green-2:#117749`, `--green-3:#e6f3eb`, `--text:#173128`, achtergrond `#f3f6f4`; zijbalk `#0c2f22`, mobiele onderbalk `#103126`.
- `theme_color`/`background_color` in `manifest.json` en `<meta name="theme-color">` in `index.html`: groen.
- Veel componenten gebruiken daarnaast vaste kleurwaarden (rgba/hex) buiten de variabelen; een kleurwissel raakt dus meer dan `:root`.
- Wedstrijdblad (PDF/PNG) heeft een eigen Full Speed-ontwerp met logo (`FULL_SPEED_LOGO_DATA`).

## Voorstel (aparte PR)

1. Nieuwe tokens naast de bestaande (`--brand`, `--brand-2`, `--brand-soft`, `--nav-bg`) en alle vaste groentinten daarnaar laten verwijzen — eerst zonder zichtbare wijziging (refactor-PR, screenshotvergelijking).
2. Daarna één PR die alleen de tokenwaarden naar rood-wit zet, bijvoorbeeld `--brand:#b3141c` (wit erop: contrast ≈ 6,9:1, voldoet aan WCAG AA), `--brand-soft:#fdecec`, navigatie donkerrood `#5a0a0e`.
3. Statuskleuren (aanwezig = groen, afwezig = rood) behouden of herzien: met een rode merkkleur kan “afwezig” verwarrend worden → afwezig bijvoorbeeld donkeroranje.
4. `manifest.json` en `theme-color` aanpassen; wedstrijdblad apart beoordelen.
5. Contrastcontrole en screenshots op 375/768/1280 px vóór akkoord.

Inschatting: twee kleine PR's; risico laag (alleen CSS/manifest), maar zichtbaar voor alle gebruikers.
