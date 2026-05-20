---
name: jse-charts
description: Hand-rolled inline-SVG charts — Sparkline + BarChart + Donut + DateRangePicker. ISO date helpers. No chart libraries.
---

# JSE Charts

All charts are hand-rolled inline SVG. No chart libraries, no canvas, no D3. The rule: if you can't ship it with React + a `<svg>`, don't ship it.

## `Sparkline` component (Block 1)

A 60×20-ish tiny chart: line + area-fill polygon. Used under three Reports KPI cards (On Shift Now, Loads, Hours).

```jsx
function Sparkline({ data, width = 120, height = 32, color = C.accent }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);  // guard /0
  const stepX = width / Math.max(data.length - 1, 1);
  const points = data.map((v, i) => `${i * stepX},${height - (v / max) * height}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
      <polygon points={`0,${height} ${points} ${width},${height}`} fill={color} opacity="0.15" />
    </svg>
  );
}
```

**Why:** decorative trend cue under a KPI number — readable at-a-glance, doesn't compete with the value.

Reports uses: On Shift = `C.info`, Loads = `C.accent`, Hours = `C.ok`. Active Projects card has no sparkline (project count doesn't vary daily — a flat line is noise).

## `BarChart` component (Block 1)

Full-width SVG with `viewBox="0 0 560 180"` and `width: 100%` for responsive scaling. Used as the "Loads per day, last 7 days" card in Reports.

Features:
- One `<rect class="jse-bar">` per data point.
- Today's bar highlighted: `fill={d.iso === TODAY_ISO ? C.accent : color}` with higher opacity. Others use `C.accentSoft` / 0.7 opacity.
- Per-bar `aria-label={`${count} loads on ${isoToShortDate(iso)}`}` for screen-reader nav.
- Hover/focus tooltip — `tabIndex={0}` on each bar, React state tracks hovered index. Tooltip absolute-positioned in the chart card.
- 3 y-axis gridlines + labels at 0, max/2, max (nice rounded max).
- X-axis weekday short names via `isoToWeekdayShort(iso)`.

**Empty state:** chart returns null if `data.length === 0`. Caller renders an EmptyState card instead.

## `Donut` component (Block 1)

A compact completion ring with a percentage label in the middle. Used on `AdminHaulRequestDetail` per-truck assignment cards to show CY delivered against the request's `volumeCY`.

```jsx
<Donut pct={truckPct} size={72} stroke={8} label="optional caption" />
```

- `pct` is 0–100. Clamped internally.
- Background ring is `C.surfaceHi`, filled arc is `C.accent`, `strokeLinecap="round"`.
- Renders `{Math.round(clamped*100)}%` in `T.body` weight 700 in the center; optional `label` in `T.micro` `C.inkDim` underneath.
- `flexShrink: 0` on the wrapper — safe to drop into a flex header without collapsing.

Use it anywhere you'd otherwise reach for a progress bar AND need to read at a glance (KPI cards, item-detail rails). Don't use it for trend data (Sparkline) or comparisons over time (BarChart).

## `DateRangePicker` (Block 1, used by `AdminReports`)

5 presets, each maps to `{startIso, endIso}`:

| Preset | startIso | endIso |
|---|---|---|
| Today | `TODAY_ISO` | `TODAY_ISO` |
| Yesterday | `YESTERDAY_ISO` | `YESTERDAY_ISO` |
| Last 7 days | `isoDaysAgo(6)` | `TODAY_ISO` |
| Last 30 days | `isoDaysAgo(29)` | `TODAY_ISO` |
| Custom | user-picked `<input type="date">` × 2 | (constrained `min/max`) |

Default: Today.

**Desktop (>700px):** row of 5 pill buttons.
**Mobile (≤700px):** swaps to a `<select>` dropdown via media query (`.jse-rangepicker-pills` hidden, `.jse-rangepicker-select` shown). Custom preset's date inputs appear in a row below when selected.

Stored in `AdminReports` local state as `{ preset, startIso, endIso }`. All KPIs / project table / hauler productivity / truck utilization filter by `isInRange(item.date, startIso, endIso)`.

## Delta math

For non-Today presets, the delta compares to the prior window of equal length (e.g., "Last 7 days vs prior 7 days"). For Today preset, keeps today-vs-yesterday delta to preserve the conventional reading.

```js
const rangeDays = (new Date(endIso) - new Date(startIso)) / 86400000 + 1;
const priorEnd = isoDaysAgo(rangeDays);
const priorStart = isoDaysAgo(rangeDays * 2 - 1);
const priorCount = loads.filter(l => isInRange(l.date, priorStart, priorEnd)).length;
```

## Date helpers (Block 1, above seeds)

All in `index.html` next to `TODAY_ISO`:

- `TODAY_ISO = '2026-05-19'` — frozen anchor.
- `YESTERDAY_ISO = isoDaysAgo(1)`.
- `isoDaysAgo(n)` — uses `Date.UTC` to avoid timezone drift, returns `YYYY-MM-DD`.
- `isToday(iso)` / `isYesterday(iso)` — strict equality against the anchors.
- `isInRange(iso, startIso, endIso)` — inclusive lexical string compare (ISO 8601 sorts correctly as strings).
- `isoToWeekdayShort(iso)` — `'Mon'`, `'Tue'`, etc. for bar chart x-axis.
- `isoToShortDate(iso)` — `'May 19'` for tooltips and detail-page headers.

## How to apply

When adding a new dated metric:
- Stamp ISO dates on new records (`date: TODAY_ISO` at creation time).
- Use `isInRange` for any window filter — never raw string equality unless you specifically mean "today only".
- For chart components, render inline SVG with `viewBox` for responsive scaling. Use `C.accent` / `C.info` / `C.ok` tokens, not raw hex.

## Mobile reflow

- Bar chart scales via `viewBox` + `width: 100%`.
- Sparklines stay the same size (small icons don't need to scale).
- Date picker pills → `<select>` at ≤700px.

## No chart libs

Even if a library would save 10 lines, don't add one. The mockup's single-file-no-build constraint is load-bearing for distribution. Hand-roll SVG and tokenize colors.

## Cross-refs

[[jse-data-model]] § ISO date convention · [[jse-design-system]] · [[jse-ship-a-feature]]
