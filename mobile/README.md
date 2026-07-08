# JSE Hauler — mobile (Expo)

iOS + Android companion to the Jobsite Exchange web mockup. Built with Expo
(managed), TypeScript, Expo Router, AsyncStorage. No backend.

## Run

```
cd mobile
npm install        # or: yarn / pnpm install
npx expo start     # then press i for iOS, a for Android, w for web
```

iOS / Android need either an Expo Go install on a device (scan the QR code) or
a local simulator (`xcrun simctl` / `adb`).

> `npm install` was NOT run by the scaffolding agent (sandboxed environment).
> Run it locally before `expo start`.

## Scope of this first pass

Wired end-to-end:

- **Role picker** → Driver vs Hauler
- **Driver picker** → per-driver home with truck cards, status badges, today's loads
- **Truck Detail** → live ticker, clock in / out / pause / resume, today's loads
- **Log a Load** → material chip picker, CY input, **device camera** photo, submit
- **Hauler picker** → fleet KPI tiles + project list (stubbed depth)

Persists across launches via `@react-native-async-storage/async-storage` under
the key `jse-hauler:db:v1`.

## Stubbed / TODO

- Hauler approval flow for pending loads
- Incoming haul-request Accept / Pass
- Editable inline load editing
- Real-time cross-device sync (web mockup uses `storage` events; mobile needs a
  backend — see `src/db/context.tsx` TODO)
- Auth / sign-in
- Push notifications

## Layout

```
mobile/
  app/                          Expo Router screens
    _layout.tsx                 Root Stack + DbProvider
    index.tsx                   Role picker
    driver/
      index.tsx                 Driver picker
      [driverId]/
        index.tsx               Driver home (trucks list + KPIs)
        truck/[truckId].tsx     Truck detail (clock + loads)
        log/[truckId].tsx       Log a load (camera + CY + material)
    hauler/
      index.tsx                 Hauler picker
      [haulerId]/index.tsx      Hauler home (KPI tiles + projects)
  src/
    data/                       Types + constants + seed (already present)
    db/                         DbProvider, AsyncStorage, action helpers
    ui/                         Small primitives (Card, Button, Tile, Badge)
```

## Conventions

- TypeScript strict.
- Plain React Native + StyleSheet. No nativewind / paper / styled-components.
- Field names mirror the web mockup's `db` shape so future shared code is
  trivial. See `src/data/types.ts`.
- Mobile uses real `Date.now()` everywhere. The web mockup is frozen to
  `TODAY_ISO`; mobile is not.
