import type { MaterialCode, TruckTypeCode } from './types';

// Mirrors index.html lines 479-485. Keep codes IDENTICAL to the web side.
export const TRUCK_TYPES: ReadonlyArray<{
  code: TruckTypeCode;
  label: string;
  axles: string;
  cap: string;
  rate: number;
}> = [
  { code: 'TAN', label: 'Tandem', axles: '2-axle', cap: '10-12 yd', rate: 85 },
  { code: 'SD', label: 'Side Dump', axles: 'Semi', cap: '20-24 yd', rate: 125 },
  { code: 'ED', label: 'End Dump', axles: 'Semi', cap: '20-24 yd', rate: 125 },
  { code: 'BD', label: 'Belly Dump', axles: 'Semi', cap: '22-26 yd', rate: 125 },
  { code: 'HS', label: 'High Side (Scrap/Trash)', axles: 'Semi', cap: '24-28 yd', rate: 140 },
];

// Mirrors index.html lines 488-499.
export const MATERIALS: ReadonlyArray<{ code: MaterialCode; label: string }> = [
  { code: 'CF', label: 'Clean Fill' },
  { code: 'TS', label: 'Topsoil' },
  { code: 'CR', label: 'Class 5 Road Base' },
  { code: 'EX', label: 'Export / Spoils' },
  { code: 'SD', label: 'Sand' },
  { code: 'GR', label: 'Gravel' },
  { code: 'CO', label: 'Concrete' },
  { code: 'AC', label: 'Asphalt Millings' },
  { code: 'RR', label: 'Rip Rap' },
  { code: 'MU', label: 'Mulch' },
];

export const RATES_INIT: Record<TruckTypeCode, number> = TRUCK_TYPES.reduce(
  (acc, t) => {
    acc[t.code] = t.rate;
    return acc;
  },
  {} as Record<TruckTypeCode, number>,
);

export const materialLabel = (code: string): string =>
  MATERIALS.find((m) => m.code === code)?.label ?? code;

export const truckTypeLabel = (code: string): string =>
  TRUCK_TYPES.find((t) => t.code === code)?.label ?? code;
