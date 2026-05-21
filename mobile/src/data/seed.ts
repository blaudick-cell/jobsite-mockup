import type { Db } from './types';
import { RATES_INIT } from './constants';

// Seed data. A small, representative slice of the web mockup so the mobile app
// has something to render on first boot. Drivers and trucks are picked so that
// `dr-001` has two trucks (exercises the multi-truck home view) and several
// other drivers have a single truck each.
//
// IDs match the web seed where possible. Real ISO dates are computed at module
// load time so the mobile app is NOT frozen to the web's TODAY_ISO.

const todayIso = (): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const TODAY = todayIso();

export const SEED: Db = {
  projects: [
    {
      id: 'RR',
      code: 'RR-03',
      name: '5800 Federal',
      gc: 'Cowgirl Demo',
      address: '5800 Federal Blvd, Denver, CO',
      status: 'active',
      material: ['EX'],
    },
    {
      id: 'WP',
      code: 'WP-24',
      name: 'Winter Park',
      gc: 'Lake Trail Homes',
      address: '4421 Birch Rd, Winter Park, CO',
      status: 'active',
      material: ['CF', 'TS'],
    },
    {
      id: 'CH',
      code: 'CH-18',
      name: 'Capitol Hill Mixed-Use',
      gc: 'Pinnacle Construction',
      address: '1240 E 13th Ave, Denver, CO',
      status: 'active',
      material: ['CF', 'EX', 'CR'],
    },
    {
      id: 'GW',
      code: 'GW-12',
      name: 'GW Apartments',
      gc: 'Avere Construction',
      address: '88 Greenway Blvd, Boulder, CO',
      status: 'completed',
      material: ['CR', 'EX'],
    },
    {
      id: 'AS',
      code: 'AS-09',
      name: 'Aurora Square',
      gc: 'Heritage Builders',
      address: '7700 E Iliff Ave, Aurora, CO',
      status: 'upcoming',
      material: ['CF', 'CR'],
    },
  ],

  haulers: [
    { id: 'op-001', code: 'LH', name: 'Lake Trail Homes', phone: '(303) 555-0142', email: 'marcus@lakehomes.co', projectIds: ['WP'] },
    { id: 'op-002', code: 'AV', name: 'Avere Construction', phone: '(303) 555-0188', email: 'priya@avere.co', projectIds: ['GW', 'RR', 'CH'] },
    { id: 'op-005', code: 'OZ', name: 'Oz Trucking', phone: '(303) 555-0210', email: 'dispatch@oztrucking.co', projectIds: ['WP', 'GW', 'RR', 'AS', 'CH'] },
    { id: 'op-006', code: '5A', name: '5 Angels Transport, LLC', phone: '(720) 555-0211', email: 'ops@5angels.co', projectIds: ['WP', 'GW', 'RR', 'AS', 'CH'] },
    { id: 'op-007', code: 'DM', name: 'Dominguez', phone: '(303) 555-0212', email: 'jorge@dominguezhauling.com', projectIds: ['WP', 'GW', 'RR', 'AS'] },
  ],

  trucks: [
    { id: 'tk-447', plate: '447', type: 'SD', hauler: 'RB Trucking', projectId: 'WP', haulerId: 'op-001', driverId: 'dr-001' },
    { id: 'tk-220', plate: '220', type: 'SD', hauler: 'Z&Z Hauling', projectId: 'GW', haulerId: 'op-005', driverId: 'dr-001' },
    { id: 'tk-212', plate: '212', type: 'SD', hauler: 'Oz Trucking', projectId: 'WP', haulerId: 'op-005', driverId: 'dr-002' },
    { id: 'tk-088', plate: '88', type: 'ED', hauler: '5 Angels Transport', projectId: 'WP', haulerId: 'op-006', driverId: 'dr-003' },
    { id: 'tk-092', plate: '92', type: 'BD', hauler: 'Dominguez', projectId: 'WP', haulerId: 'op-007', driverId: 'dr-004' },
    { id: 'tk-301', plate: '301', type: 'TAN', hauler: 'Mountain Aggregate', projectId: 'GW', haulerId: 'op-002', driverId: 'dr-005' },
    { id: 'tk-155', plate: '155', type: 'TAN', hauler: 'Greenline', projectId: 'RR', haulerId: 'op-002', driverId: 'dr-008' },
    { id: 'tk-611', plate: '611', type: 'ED', hauler: 'Cordillera Hauling', projectId: 'CH', haulerId: 'op-007', driverId: 'dr-013' },
  ],

  drivers: [
    { id: 'dr-001', name: 'M. Ortega', phone: '(303) 555-2101' },
    { id: 'dr-002', name: 'J. Bui', phone: '(303) 555-2102' },
    { id: 'dr-003', name: 'D. Kowalski', phone: '(303) 555-2103' },
    { id: 'dr-004', name: 'R. Singh', phone: '(303) 555-2104' },
    { id: 'dr-005', name: 'A. Reyes', phone: '(303) 555-2105' },
    { id: 'dr-008', name: 'S. Park', phone: '(303) 555-2108' },
    { id: 'dr-013', name: 'P. Larsen', phone: '(303) 555-2113' },
  ],

  // Empty on first boot — drivers will create their own loads/hours by tapping
  // the in-app buttons. Keeps the demo clean.
  loads: [],
  hours: [],
  haulRequests: [],

  rates: RATES_INIT,
  activity: [],
};

export const TODAY_ISO_RUNTIME = TODAY;
