---
name: jse-design-system
description: Visual + component conventions for the Jobsite Exchange single-file React mockup. Tokens (C/T/F/R/S), component catalog, icon catalog, responsive breakpoints, status color story, tap-target floor.
---

# JSE Design System

Single source of truth for visual decisions. Use these — don't invent parallels. See [[jse-ship-a-feature]] for where new code lives.

## Tokens (defined in Block 1 of `index.html`)

- **`C`** — colors. `bg`, `bgDeep`, `surface`, `surfaceHi`, `surfaceMax`, `ink`, `inkDim`, `inkFaint`, `rule`, `ruleHi`, `accent`, `accentSoft`, `accentMuted`, `warn`/`warnSoft`, `ok`/`okSoft`, `info`/`infoSoft`. No `C.danger` — use `C.warn` for destructive.
- **`F`** — font families. `display` (Inter Tight), `body` (Inter), `mono` (JetBrains Mono).
- **`R`** — radii. `xs: 4, sm: 8, md: 12, lg: 16, pill: 999`.
- **`S`** — spacing scale (1-indexed). `1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64`. Don't use raw px outside this scale.
- **`T`** — typography. `h1` (44/700/1.1/-1), `h2Lg` (36/700/1.15/-1), `h2` (28/700/1.2/-0.5), `statValue` (22/700/1.1), `h3` (20/600/1.3), `h4` (18/600/1.3), `bodyLg` (16/1.5), `body` (14/1.5), `bodySm` (13/1.5), `caption` (12/1.4 with `C.inkDim`), `micro` (11/1.35), `mono` (12/1.4), `monoSm` (11/1.4). Spread directly: `style={{ ...T.body, color: C.inkDim }}`.

## Shared components

- **`Btn`** — variants: `primary | secondary | ghost | danger | ok`. Sizes: `lg | md | sm | xs`. `sm`/`xs` auto-bump to 44px min-height at ≤700px.
- **`Card`** — bordered surface. `padding` defaults to `S[5]`.
- **`Topbar`** — `{ navigate, role, current, right }`. Position sticky. Right slot holds shell-specific actions (Admin has hamburger + Reports + Reset).
- **`Pill`** / **`StatusPill`** — see status color story below.
- **`Stat`** — `{ label, value, sub, align }`. KPI card content.
- **`EmptyState`** — `{ icon, title, body, action }`. `icon` accepts string OR React element.
- **`WizardShell`** — see [[jse-wizards]].
- **`Sparkline`** / **`BarChart`** — see [[jse-charts]].
- **`AdminSidebar`** — 240px sticky desktop, drawer at ≤900px. See [[jse-routing]].
- **`Tr`/`Th`/`Td`** — bare table tags, auto-stack to cards at ≤700px via global selectors.
- **`EditableText`/`EditableSelect`** — inline-edit primitives.
- **`Crumbs`** — `[{label, to?}]`. Last item is current (no `to`).
- **`Label`** — uppercase mono 10px eyebrow.

## Icon catalog (inline SVG, 28×28 viewBox, stroke 1.5, currentColor)

`AdminIcon`, `HaulerIcon`, `DriverIcon`, `TruckIcon`, `ProjectIcon`, `HaulRequestIcon`, `ActivityIcon`, `MenuIcon`, `EyeIcon`, `FlowIcon`, `PhoneIcon`, `BoltIcon`, `GitHubIcon`, plus `HexLogo` (filled brand mark). All inherit color via `color:` on parent wrapper. Add new icons in Block 1; match the existing weight (stroke 1.5, round caps/joins).

## Status color story (canonical)

`StatusPill` maps status strings to `{color, soft, label}` — pass real statuses, no pre-mapping:

| status | color | use |
|---|---|---|
| `active`/`open` | `C.accent` | active projects, open shifts |
| `upcoming` | `C.info` | future projects |
| `completed`/`closed` | `C.inkDim` | done |
| `pending` | `C.warn` | pending loads/hours, unmatched requests |
| `approved` | `C.ok` | approved loads |
| `matched` | `C.ok` | request matched to hauler+truck |
| `accepted` | `C.info` | request accepted by driver (distinct blue) |
| `inservice` | `C.ok` | truck in service |
| `idle` | `C.inkDim` | idle truck |

## Responsive breakpoints

| Width | What changes |
|---|---|
| ≤500px | Topbar breadcrumb hides |
| ≤600px | `html, body { overflow-x: clip }` (NOT `hidden` — preserves sticky Topbar); DriverShell phone bezel full-bleed; grids collapse to 1-col via `[style*="display: grid"]` |
| ≤700px | Tables stack to cards; **44px mobile tap-target floor** on inputs/selects/textareas/Btn-sm/xs |
| ≤900px | 4-col grids collapse to 2-col; AdminSidebar hides, hamburger drawer activates; hero uses `auto-fit minmax(360px, 1fr)` |
| ≥1024px | DriverShell "phone view" caption visible above bezel |
| 1280/1440 | Standard desktop |

## "Reset demo data" button

Lives in AdminShell's Topbar `right` slot. Don't duplicate it elsewhere. Clears `jse_db_v1` localStorage and reloads.

## Conventions

- Inline styles + tokens. Only CSS hooks are `.topbar`, `.phone-frame-outer`, `.invoice-print`, `.admin-sidebar`, `.admin-drawer`, `.jse-pulse`, `.jse-bar`.
- Smooth scroll + `scroll-margin-top: 24px`, wrapped in `@media (prefers-reduced-motion: no-preference)`.
- No deps, no Tailwind, no chart libs.

## Cross-refs

[[jse-routing]] · [[jse-data-model]] · [[jse-wizards]] · [[jse-charts]] · [[jse-realtime]] · [[jse-activity-feed]] · [[jse-ship-a-feature]]
