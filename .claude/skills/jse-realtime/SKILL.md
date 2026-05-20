---
name: jse-realtime
description: Cross-tab real-time sync via the localStorage `storage` event. RemoteUpdateContext, hydrateDb composition, echo guard, jse-pulse visual cue.
---

# JSE Real-time (cross-tab sync)

The mockup has no backend, but it feels alive because tabs share state through the localStorage `storage` event. Open two tabs of the demo site — a mutation in one tab causes the other to re-render within a beat and flash the affected KPIs.

**Why:** demonstrates the "everyone sees what everyone else does" pattern that an API+websocket would normally provide, with zero infrastructure.

## Architecture

Three pieces, all in `index.html`:

### 1. `RemoteUpdateContext` (Block 7)

```js
const RemoteUpdateContext = React.createContext(0);
```

A monotonic nonce counter. Provider sits at the top of `App`'s render tree. Default value `0` so initial mount is guarded from spurious flashes. Consumers (`AdminReports`) bump-pulse on every nonce change.

### 2. `storage` event listener (App, Block 7)

```js
useEffect(() => {
  const onStorage = (e) => {
    if (e.key !== DB_STORAGE_KEY) return;
    const next = hydrateDb(e.newValue);          // null = peer Reset → reseed
    lastSerializedRef.current = JSON.stringify(next);  // pre-arm echo guard
    setDb(next);
    setRemoteUpdateNonce(n => n + 1);
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}, []);
```

**Key facts:**
- `storage` events don't fire in the originating tab — only peers. No self-echo loop.
- `e.newValue === null` means another tab called `removeItem` (Reset). `hydrateDb(null)` returns fresh seed.
- Reuses the same `hydrateDb` migration cascade as initial load — peer-tab v3 payloads migrate forward through v4→v5→v6→v7 the same way ([[jse-data-model]] § Schema version log).

### 3. Echo guard in the persist effect (App, Block 7)

```js
useEffect(() => {
  const serialized = JSON.stringify(db);
  if (lastSerializedRef.current === serialized) return;  // already in storage, skip
  lastSerializedRef.current = serialized;
  try { localStorage.setItem(DB_STORAGE_KEY, serialized); } catch (e) {}
}, [db]);
```

**Why the ref?** When peer tab A writes blob_A, tab B's listener parses it and calls `setDb(parsed)`. B's persist `useEffect` then runs and would re-write `JSON.stringify(parsed)` back to storage — fine for storage, but it fires the storage event AGAIN in tab A, ping-pong style. The pre-armed `lastSerializedRef` in the listener tells the next persist run "this value is already what's in storage, skip the write."

## Visual cue — `.jse-pulse`

CSS keyframe + class (Block 1 of the `<style>` element):

```css
@keyframes jsePulse {
  0%   { box-shadow: 0 0 0 0 rgba(179, 230, 53, 0.55); }
  60%  { box-shadow: 0 0 0 12px rgba(179, 230, 53, 0); }
  100% { box-shadow: 0 0 0 0 rgba(179, 230, 53, 0); }
}
.jse-pulse { animation: jsePulse 1.2s ease-out; border-radius: 16px; }
@media (prefers-reduced-motion: reduce) { .jse-pulse { animation: none; } }
```

`AdminReports` consumes the context:

```js
const remoteNonce = useContext(RemoteUpdateContext);
const [flashing, setFlashing] = useState(false);
useEffect(() => {
  if (remoteNonce === 0) return;  // skip initial mount
  setFlashing(true);
  const t = setTimeout(() => setFlashing(false), 1200);
  return () => clearTimeout(t);
}, [remoteNonce]);
// ...
<div className={flashing ? 'jse-pulse' : undefined}>...</div>
```

Apply to the KPI row container — a single pulse on the whole row reads better than four separate flashes.

## How to apply

When adding a new view that should react to peer-tab updates: subscribe to `RemoteUpdateContext` and trigger your own flash effect on nonce change. Wrap your impacted element in a conditional `className={flashing ? 'jse-pulse' : undefined}`.

## Demo callout copy

Landing's `#demo` section sub-paragraph: *"Try opening this in two browser tabs — clock in as a driver in one, watch the Admin Reports KPIs update in the other."* Surfaces the feature so visitors know to try it.

## Gotchas

- `Date.now()` in activity events differs across tabs by a few ms — fine, events are unique per random `id`.
- Reset path (peer tab calls `localStorage.removeItem`) → receiving tab gets `newValue: null` → `hydrateDb(null)` reseeds → persist effect writes seed back to storage. Self-healing: a third late-arriving tab finds valid data, not a missing key.
- The persist effect's `lastSerializedRef` only skips byte-identical re-writes. Future-version payloads in storage trigger a full reseed via `hydrateDb`, NOT a setDb-loop.

## Cross-refs

[[jse-ship-a-feature]] · [[jse-data-model]] · [[jse-activity-feed]] · [[jse-design-system]]
