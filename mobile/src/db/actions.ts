// Pure-ish helpers that compose new Db states. Each helper takes the previous
// db and returns the next one — call them from inside `setDb(prev => ...)`.
//
// Activity log: every mutation that's user-visible appends an ActivityEntry,
// matching the web mockup's append-only pattern.

import type {
  ActivityEntry,
  ActivityType,
  Db,
  HoursRow,
  Load,
} from '@/data/types';

// ---- ID + time helpers ----------------------------------------------------

let _idCounter = 0;
export function makeId(prefix: string): string {
  _idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${_idCounter.toString(36)}`;
}

export function todayIso(d = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function hhmm(d = new Date()): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// ---- Activity log ---------------------------------------------------------

export function appendActivity(
  db: Db,
  entry: {
    type: ActivityType;
    message: string;
    projectId?: string;
    driverId?: string;
    truckId?: string;
    loadId?: string;
  },
): Db {
  const next: ActivityEntry = {
    id: makeId('act'),
    ts: Date.now(),
    ...entry,
  };
  return { ...db, activity: [next, ...db.activity] };
}

// ---- Hours / clocking ----------------------------------------------------

/** Find the currently open hours row for a driver+truck (status open). */
export function findOpenHours(
  db: Db,
  driverId: string,
  truckId: string,
): HoursRow | undefined {
  return db.hours.find(
    (h) => h.driverId === driverId && h.truckId === truckId && h.status === 'open',
  );
}

export function clockIn(
  db: Db,
  args: { driverId: string; truckId: string; projectId: string },
): Db {
  // Guard: if there's already an open shift for this driver+truck, no-op.
  if (findOpenHours(db, args.driverId, args.truckId)) {
    return db;
  }
  const row: HoursRow = {
    id: makeId('hr'),
    driverId: args.driverId,
    truckId: args.truckId,
    projectId: args.projectId,
    clockedInAt: Date.now(),
    pausedMs: 0,
    status: 'open',
    date: todayIso(),
  };
  const next: Db = { ...db, hours: [row, ...db.hours] };
  return appendActivity(next, {
    type: 'clock_in',
    message: 'Clocked in',
    driverId: args.driverId,
    truckId: args.truckId,
    projectId: args.projectId,
  });
}

export function clockOut(
  db: Db,
  args: { driverId: string; truckId: string },
): Db {
  const open = findOpenHours(db, args.driverId, args.truckId);
  if (!open) return db;
  // If currently paused, flush the paused duration into pausedMs first.
  const now = Date.now();
  const addedPause = open.pausedAt ? now - open.pausedAt : 0;
  const updated: HoursRow = {
    ...open,
    pausedAt: undefined,
    pausedMs: open.pausedMs + addedPause,
    clockedOutAt: now,
    status: 'closed',
  };
  const next: Db = {
    ...db,
    hours: db.hours.map((h) => (h.id === open.id ? updated : h)),
  };
  return appendActivity(next, {
    type: 'clock_out',
    message: 'Clocked out',
    driverId: args.driverId,
    truckId: args.truckId,
    projectId: open.projectId,
  });
}

export function pauseHours(
  db: Db,
  args: { driverId: string; truckId: string },
): Db {
  const open = findOpenHours(db, args.driverId, args.truckId);
  if (!open || open.pausedAt) return db;
  const updated: HoursRow = { ...open, pausedAt: Date.now() };
  const next: Db = {
    ...db,
    hours: db.hours.map((h) => (h.id === open.id ? updated : h)),
  };
  return appendActivity(next, {
    type: 'pause',
    message: 'Paused',
    driverId: args.driverId,
    truckId: args.truckId,
    projectId: open.projectId,
  });
}

export function resumeHours(
  db: Db,
  args: { driverId: string; truckId: string },
): Db {
  const open = findOpenHours(db, args.driverId, args.truckId);
  if (!open || !open.pausedAt) return db;
  const addedPause = Date.now() - open.pausedAt;
  const updated: HoursRow = {
    ...open,
    pausedAt: undefined,
    pausedMs: open.pausedMs + addedPause,
  };
  const next: Db = {
    ...db,
    hours: db.hours.map((h) => (h.id === open.id ? updated : h)),
  };
  return appendActivity(next, {
    type: 'resume',
    message: 'Resumed',
    driverId: args.driverId,
    truckId: args.truckId,
    projectId: open.projectId,
  });
}

/** Compute elapsed running ms for an hours row, factoring out paused time. */
export function elapsedMs(row: HoursRow, now = Date.now()): number {
  if (!row.clockedInAt) return 0;
  const end = row.clockedOutAt ?? now;
  const total = end - row.clockedInAt;
  // If currently paused, add the in-progress pause window into paused total.
  const inProgressPause = row.pausedAt ? now - row.pausedAt : 0;
  return Math.max(0, total - row.pausedMs - inProgressPause);
}

export function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// ---- Loads ----------------------------------------------------------------

export function addLoad(
  db: Db,
  args: {
    driverId: string;
    truckId: string;
    projectId: string;
    material: string;
    cy: number;
    photo?: string;
  },
): Db {
  const load: Load = {
    id: makeId('ld'),
    driverId: args.driverId,
    truckId: args.truckId,
    projectId: args.projectId,
    material: args.material,
    cy: args.cy,
    photo: args.photo,
    time: hhmm(),
    date: todayIso(),
    status: 'pending',
  };
  const next: Db = { ...db, loads: [load, ...db.loads] };
  return appendActivity(next, {
    type: 'load_logged',
    message: `Logged ${args.cy} CY of ${args.material}`,
    driverId: args.driverId,
    truckId: args.truckId,
    projectId: args.projectId,
    loadId: load.id,
  });
}

// ---- Selectors ------------------------------------------------------------
// All `id` params accept the loose shape that Expo Router's
// `useLocalSearchParams` hands back (`string | string[] | undefined`). We
// short-circuit on anything non-string so callers don't need to coerce.

type LooseId = string | string[] | null | undefined;
const asId = (v: LooseId): string | undefined =>
  typeof v === 'string' ? v : undefined;

export function trucksForDriver(db: Db, driverId: LooseId) {
  const id = asId(driverId);
  if (!id) return [];
  return db.trucks.filter((t) => t.driverId === id);
}

export function todaysLoadsForTruck(db: Db, truckId: LooseId) {
  const id = asId(truckId);
  if (!id) return [];
  const t = todayIso();
  return db.loads.filter((l) => l.truckId === id && l.date === t);
}

export function todaysLoadsForDriver(db: Db, driverId: LooseId) {
  const id = asId(driverId);
  if (!id) return [];
  const t = todayIso();
  return db.loads.filter((l) => l.driverId === id && l.date === t);
}

export function projectById(db: Db, id: LooseId) {
  const v = asId(id);
  if (!v) return undefined;
  return db.projects.find((p) => p.id === v);
}

export function truckById(db: Db, id: LooseId) {
  const v = asId(id);
  if (!v) return undefined;
  return db.trucks.find((t) => t.id === v);
}

export function driverById(db: Db, id: LooseId) {
  const v = asId(id);
  if (!v) return undefined;
  return db.drivers.find((d) => d.id === v);
}

export function haulerById(db: Db, id: LooseId) {
  const v = asId(id);
  if (!v) return undefined;
  return db.haulers.find((h) => h.id === v);
}
