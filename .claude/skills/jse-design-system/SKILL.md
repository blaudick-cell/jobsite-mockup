---
name: jse-design-system
description: Visual + component conventions for the Jobsite Exchange single-file React mockup. Reference when adding any UI to index.html — covers color/type tokens, the shared component library, the SVG icon set, responsive breakpoints, and the status color story.
---

# JSE Design System

This is what's in place. Match it. Don't invent parallel systems.

## Tokens (defined near `index.html:267-297`)

- **`C`** — colors. `bg`, `bgDeep`, `surface`, `surfaceHi`, `surfaceMax`, `ink`, `inkDim`, `inkFaint`, `rule`, `ruleHi`, `accent`, `accentSoft`, `accentMuted`, `warn`, `warnSoft`, `ok`, `okSoft`, `info`, `infoSoft`. No `danger` — use `warn`.
- **`F`** — font families. `display` (Inter Tight), `body` (Inter), `mono` (JetBrains Mono).
- **`R`** — radii. `sm: 8, md: 12, lg: 16, pill: 999`.
- **`S`** — spacing scale (1-indexed). `1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64`. Don't use raw px outside this scale.
- **`T`** — typography (opt-in for new code only). `h1` (44/700/1.1), `h2` (28/700/1.2), `h3` (20/600/1.3), `body` (14/1.5), `bodyLg` (16/1.5), `caption` (12/1.4 with `C.inkDim`), `mono` (12/1.4). Existing inline `fontSize:` call sites are NOT being refactored — only use `T` in new components.

**How to apply:** Inline styles + tokens. No className-driven styling beyond a handful of CSS hooks (`.topbar`, `.phone-frame-outer`, `.invoice-print`). No Tailwind. No CSS-in-JS library.

## Shared components

- **`Btn`** — variants: `primary | secondary | ghost | danger | ok`. Sizes: `lg | md | sm | xs`. Props: `onClick`, `disabled`, `fullWidth`, `style`. Mobile rule auto-bumps `sm`/`xs` to 44px min-height at ≤700px.
- **`Card`** — bordered surface. Pass `padding` prop, defaults to `S[5]`.
- **`Topbar`** — `{ navigate, role, current, right }`. Brand + role pill + breadcrumb + optional right slot + always-on "Switch role". Position `sticky`. AdminShell wraps `Reports` + `Reset demo data` Btns in the right slot; OperatorShell/DriverShell don't.
- **`Pill` / `StatusPill`** — see status colors below.
- **`Stat`** — `{ label, value, sub, align }`. The canonical KPI card content.
- **`Crumbs`** — `[{label, to?}]`. Last item is the current page (no `to`).
- **`Label`** — uppercase mono 10px caption (eyebrow).
- **`EmptyState`** — `{ icon, title, body, action }`. `icon` accepts string OR React element. Use this anywhere a list could be empty. Prefer it over bare "No items" rows.
- **`Tr` / `Th` / `Td`** — bare HTML tags, just styled. Rows auto-convert to card stacks on mobile via global tag selectors. `Tr` accepts `onClick` and adds a 120ms background transition.
- **`EditableText` / `EditableSelect`** — inline-edit primitives. Use for single-field mutations on detail pages.

**Note:** `Th` doesn't accept `onClick` or `style`. If you need sortable headers, render a bare `<th>` or wrap your label in a clickable span (see `SortTh` in `AdminReports`).

## SVG icon set

Inline components above `Landing`: `AdminIcon`, `OperatorIcon`, `DriverIcon`, `TruckIcon`, `ProjectIcon`, `HexLogo`. All use `currentColor` stroke at 1.5 weight, sized via prop or default 28-32px. Inherit color from parent (`color: C.accent` on wrapper). Use these in empty states and any new UI rather than unicode glyphs.

## Status color story (canonical)

`StatusPill` maps `status` strings to a `{color, soft, label}` triple. Pass real statuses, not pre-mapped values:

| status | color | use |
|---|---|---|
| `active` / `open` | `C.accent` (green) | active projects, open shifts |
| `upcoming` | `C.info` (blue) | future projects |
| `completed` / `closed` | `C.inkDim` (gray) | done |
| `pending` | `C.warn` (orange) | pending loads, hours awaiting approval |
| `approved` | `C.ok` (green-cyan) | approved loads |
| `inservice` | `C.ok` (green) | truck in service |
| `idle` | `C.inkDim` (gray) | idle truck |

**Why:** earlier code mapped `upcoming → pending` and `completed → closed` lossily. The canonical mapping above is now in `StatusPill` directly.

**How to apply:** `<StatusPill status={p.status} />`. Don't remap statuses at the call site.

## Responsive layer

Existing `<style>` block at `index.html:12-240` covers everything. Breakpoints: 900px / 700px / 600px / 500px. Extend it; don't add new ones unless absolutely needed. See [[jse-ship-a-feature]] for the full rule list.

Key facts:
- 4-col grids collapse via `[style*="repeat(4, 1fr)"]` — use that exact inline string.
- Tables auto-stack via global tag selectors on `<table>/<tr>/<td>` — use bare tags or the `Tr`/`Th`/`Td` components.
- 44px tap-target floor on inputs/selects/textareas at ≤700px.
- Topbar breadcrumb hides at ≤500px.
- `html, body { overflow-x: clip }` at ≤600px (NOT `hidden` — `clip` preserves sticky Topbar).
- DriverShell `Phone` frame goes full-bleed at ≤600px.

**Why `T` exists but the codebase doesn't use it everywhere:** task #4 introduced `T` as opt-in for new code. Refactoring 240+ inline `fontSize:` sites was out of scope. Live with the inconsistency — don't refactor unless you're rewriting a section anyway.
