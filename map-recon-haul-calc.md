# jobsiteexchange.com haul-calc map recon — 2026-05-21

Source: `assets/index-MM5RCERw.js` (791 KB) + `assets/index-_YPe7hwo.css` (93 KB) on the live SPA. Robert's authed admin session forces all URLs to `/dispatch`, but the JS+CSS bundles include the haul-calc surfaces verbatim.

## Library
- **Leaflet** (raster tiles). Same as previous recon.

## Tile source — confirmed unchanged
- `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`
- CartoCDN `dark_all` raster, retina-aware. 2 occurrences in JS bundle.

## OSRM — present after all
Earlier recon said "no OSRM" because I grep'd for the exact URL `router.project-osrm.org` and it wasn't in there as a literal. The substring `osrm` IS in the bundle (`OSRM (project-osrm.org)` appears as a string literal, likely an attribution credit). So the real site does use OSRM — likely via the `leaflet-routing-machine` or similar package, not a direct fetch. Either way, demo's OSRM approach matches.

## Pin styles — `divIcon` with halo + dot

**Container (both origin and destination):**
```css
.jx-haul-pin { position: relative; width: 28px; height: 28px; }
.jx-haul-pin .jx-haul-pin-halo {
  position: absolute; inset: 0; border-radius: 50%; opacity: 0.45; pointer-events: none;
}
.jx-haul-pin .jx-haul-pin-dot {
  position: absolute; top: 50%; left: 50%; width: 16px; height: 16px;
  margin: -8px 0 0 -8px; border-radius: 50%;
  border: 3px solid var(--jx-map-black);
  box-shadow: 0 1px 4px #0000008c;
}
```

**Origin (pickup — where material LEAVES from):**
- Color: **RED `#ef5b5b`**
- Halo: `radial-gradient(circle, #f35f5f8c, #f35f5f2e 55%, #f35f5f00 75%)`
- Dot: `background: #ef5b5b` (with the standard 3px dark border)

**Destination (dump — where material ARRIVES):**
- Color: **GREEN `#b6df4a`** (the JSE brand green, CSS var `--jse-green`)
- Halo: `radial-gradient(circle, #b6df4a59, #b6df4a1f 55%, #b6df4a00 75%)`
- Dot: `background: var(--jx-pin-fill)` with `border: 3px solid var(--jse-green)`

**Key reversal vs. our current demo:** the real site uses RED for pickup/origin and GREEN for dump/destination. Demo currently has it inverted (green circle for pickup, orange triangle for dump). To match, swap colors and use circle-with-halo for both endpoint types instead of triangle for dump.

## Cluster style — for marker clustering when zoomed out
```css
.jx-cluster {
  width: 100%; height: 100%; border-radius: 50%;
  display: grid; place-items: center;
  background: #18191df0;
  border: 2px solid var(--jse-green, #b6df4a);
  box-shadow: 0 1px 6px #00000080;
  color: #fff; font-weight: 800;
  cursor: pointer; transition: transform .12s ease-out;
}
.jx-cluster:hover { transform: scale(1.06); }
.jx-cluster-sm .jx-cluster-count { font-size: .85rem; }
.jx-cluster-md .jx-cluster-count { font-size: .95rem; }
.jx-cluster-lg .jx-cluster-count { font-size: 1.05rem; }
```

Demo doesn't currently cluster (only 3 routes, no need), but the pattern is here if we ever want it.

## Polyline (route) styles

Three patterns found in the bundle:
1. **`{ stroke: true, color: '#3388ff', weight: 3, opacity: 1, lineCap: 'round', lineJoin: 'round' }`** — Leaflet default, probably unused.
2. **`{ color: '#222', weight: 1.5, opacity: 0.5 }`** — dark casing/underline (rendered below the main route).
3. **`{ color: '#b6df4a', weight: 4, opacity: 0.85 }`** — the main route line. JSE brand green, slightly thicker than the casing.

So: dark thin underglow + bright green route on top. Single color (no status-based palette in the real site). All routes look the same.

## CSS variables
- `--jse-green: #b6df4a` — brand green. Close to but not identical to our demo's `C.accent #B3E635`.
- `--jx-map-black` — pin border color, dark.
- `--jx-pin-fill` — used for destination dot background.

## Decisions for the demo

1. **Match the pin style:** swap to halo+dot pattern for both endpoints. Pickup RED (`#ef5b5b`), dump GREEN (use demo's `C.accent #B3E635` so it's consistent with the rest of the dashboard — visually indistinguishable from `#b6df4a` to a human eye). 28px outer, 16px dot, 3px dark border, radial-gradient halo with 0.45 opacity.

2. **Match the route casing:** add a dark underglow line beneath the colored route line. Casing dark/thick, main route green/thinner.

3. **Keep status colors on routes:** demo's status-driven palette (active=accent, upcoming=info, delayed=warn, completed=dim) is more useful than the real site's single-green-for-everything since the demo has more states to communicate. The recon notes this is a deliberate divergence.

4. **Skip clustering:** only 3 routes in the demo seed; clustering would add complexity for zero visible benefit.

5. **Skip OSRM library shim:** demo already fetches OSRM directly and feeds GeoJSON LineStrings to MapLibre — same end result as the real site's `leaflet-routing-machine` (which also calls OSRM and renders polylines), but simpler.
