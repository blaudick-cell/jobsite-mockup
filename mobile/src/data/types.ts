// TypeScript shape of the in-memory db. Field names mirror the web mockup
// (index.html) so future shared code is trivial. Where the web mockup has
// drifted from the brief, we use the WEB's field names — that's the source
// of truth for cross-platform parity.

export type TruckTypeCode = 'TAN' | 'SD' | 'ED' | 'BD' | 'HS';

export type MaterialCode =
  | 'CF'
  | 'TS'
  | 'CR'
  | 'EX'
  | 'SD'
  | 'GR'
  | 'CO'
  | 'AC'
  | 'RR'
  | 'MU';

export type ProjectStatus = 'active' | 'upcoming' | 'completed';

export interface Project {
  id: string;
  code: string;
  name: string;
  gc: string;
  address: string;
  status: ProjectStatus;
  material: MaterialCode[];
  // startDate kept for cross-platform parity with the web seed.
  startDate?: string;
}

export interface Hauler {
  id: string;
  name: string;
  phone: string;
  email: string;
  projectIds: string[];
  // `code` is required per the brief; web side doesn't use it yet so make it
  // optional here to keep parity with the seed without breaking the contract.
  code?: string;
}

export interface Truck {
  id: string;
  plate: string;
  type: TruckTypeCode;
  haulerId: string | null;
  projectId: string | null;
  driverId: string | null;
  // Display label used by the web side; keep so we don't have to re-derive.
  hauler?: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
}

export type LoadStatus = 'pending' | 'approved';

export interface Load {
  id: string;
  driverId: string;
  truckId: string;
  projectId: string;
  material: MaterialCode | string;
  cy: number;
  // On mobile we store the local file URI (file://...) — NOT base64. The web
  // mockup base64s photos into localStorage; mobile keeps them on disk.
  photo?: string;
  time: string; // 'HH:MM' — local clock time when the load was logged
  date: string; // ISO YYYY-MM-DD
  status: LoadStatus;
  ticketNo?: string;
}

export type HoursStatus = 'open' | 'closed' | 'pending';

// Hours row — mobile uses millisecond timestamps for the live ticker. The web
// mockup uses 'HH:MM' strings against a frozen NOW_MIN; on mobile we want a
// real running clock, so the shape diverges slightly here.
export interface HoursRow {
  id: string;
  driverId: string;
  truckId: string;
  projectId: string;
  clockedInAt?: number; // Date.now() ms
  clockedOutAt?: number; // Date.now() ms
  pausedMs: number; // accumulated paused time in ms
  pausedAt?: number; // Date.now() ms when currently paused; undefined when running
  status: HoursStatus;
  date: string; // ISO YYYY-MM-DD when the shift started
}

export type HaulRequestStatus = 'pending' | 'accepted' | 'completed';

export interface HaulRequestAssignment {
  haulerId?: string;
  truckId?: string;
  driverId?: string;
  // Loosely typed — full shape stubbed for parity with web.
  [key: string]: unknown;
}

export interface HaulRequest {
  id: string;
  projectId: string;
  material: MaterialCode | string;
  cy: number;
  status: HaulRequestStatus;
  acceptedByDriver?: string | null;
  passedBy: string[];
  assignments: HaulRequestAssignment[];
}

export type RatesMap = Record<TruckTypeCode, number>;

export type ActivityType =
  | 'clock_in'
  | 'clock_out'
  | 'pause'
  | 'resume'
  | 'load_logged'
  | 'load_approved'
  | 'haul_request_accepted'
  | 'haul_request_passed';

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  message: string;
  ts: number; // Date.now() ms
  projectId?: string;
  driverId?: string;
  truckId?: string;
  loadId?: string;
}

export interface Db {
  projects: Project[];
  haulers: Hauler[];
  trucks: Truck[];
  drivers: Driver[];
  loads: Load[];
  hours: HoursRow[];
  haulRequests: HaulRequest[];
  rates: RatesMap;
  activity: ActivityEntry[];
}
