# jobsiteexchange.com map recon — 2026-05-20

## Library
**Leaflet** (raster tiles). Confirmed via `window.L` global on every page; `L.tileLayer` available.

## Tile source — EXACT match
Pulled from the SPA bundle `assets/index-MM5RCERw.js`:

```
https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png
```

- `{s}` — CartoCDN subdomain rotation (a-d).
- `{r}` — retina suffix (`@2x` for high-DPI screens, else empty).
- Style: **CartoCDN dark_all** (dark theme WITH labels, vs `dark_nolabels`).
- No API key required. Standard `© OpenStreetMap contributors © CARTO` attribution.

Two literal occurrences in the bundle — used both at homepage preview map and the full-screen `/map` page.

## Geocoder
**Nominatim** — three references in the bundle. URL pattern not extracted but standard form is:
```
https://nominatim.openstreetmap.org/search?q={address}&format=json&limit=1
```

## Routes
**No OSRM** — zero matches for `router.project-osrm.org` in the bundle. The real site does not fetch real driving routes. Likely just draws polylines between geocoded pickup/dropoff points (or just shows individual markers without lines).

## Page structure / access
- The real `/map` page exists but is auth-gated. Robert's session auto-redirects every URL (`/`, `/map`, `/board`) to `/dispatch` (the admin live-haul-requests inbox).
- `/dispatch` does NOT have a map. It's a "Live haul requests · 0 total" view with no embedded map widget.
- The Leaflet `window.L` global is loaded site-wide regardless of page (bundled into the single index JS).
- Could not capture live tile network requests or marker/route DOM inspection because no map ever mounted during this recon session.

## Visual brand notes (from public homepage screenshot context)
- Body bg: deep near-black
- Accent: bright lime/yellow-green (matches the mockup's `C.accent #B3E635`)
- Logo: hexagonal lime mark + `Jobsite` (white) `Exchange` (lime) wordmark
- Admin chrome: dark header bar, "Dispatch / My trucks / Manage contractors" tabs, ADMIN pill, Sign out button

## Recommended Phase B path
1. Use **raster tiles** (not vector) to EXACT-match the real site's look.
2. Tile URL template: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` (or `{r}` resolved to empty/`@2x` based on `devicePixelRatio`).
3. MapLibre GL JS supports raster sources via `{ type: 'raster', tiles: [...] }` — drop in the CartoCDN URL with `{s}` expanded to the subdomain list.
4. Skip OSRM (real site doesn't use it). Draw simple bezier curves between pickup/dropoff coords.
5. Nominatim geocoding cached in `db.geocode` (schema bump). Matches real-site behavior.
6. Center on Front Range (`[-105.0, 39.95]`, zoom 8.5) for the demo's Denver-area projects.
