// Driver Home — per driver. Shows each truck this driver is assigned to with a
// status badge, today's load count, and today's CY. Tapping a truck routes to
// the Truck Detail screen.

import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { FlatList, View } from 'react-native';

import { materialLabel, truckTypeLabel } from '@/data/constants';
import { useDb } from '@/db/context';
import {
  driverById,
  findOpenHours,
  projectById,
  todaysLoadsForDriver,
  todaysLoadsForTruck,
  trucksForDriver,
} from '@/db/actions';
import {
  Badge,
  Body,
  C,
  Card,
  H1,
  H2,
  Muted,
  Row,
  S,
  Screen,
  Spacer,
  Tile,
  type BadgeTone,
} from '@/ui';

export default function DriverHome() {
  const { driverId } = useLocalSearchParams<{ driverId: string }>();
  const router = useRouter();
  const { db } = useDb();

  const driver = driverById(db, driverId);
  if (!driver) {
    return (
      <Screen>
        <H2>Driver not found</H2>
        <Muted>ID: {driverId}</Muted>
      </Screen>
    );
  }

  const myTrucks = trucksForDriver(db, driver.id);
  const myLoadsToday = todaysLoadsForDriver(db, driver.id);
  const totalCy = myLoadsToday.reduce((a, l) => a + (l.cy || 0), 0);
  const openShifts = db.hours.filter(
    (h) => h.driverId === driver.id && h.status === 'open',
  ).length;

  return (
    <>
      <Stack.Screen options={{ title: driver.name }} />
      <Screen scroll={false}>
        <H1>{driver.name}</H1>
        <Muted>{driver.phone}</Muted>
        <Spacer size={S.md} />
        <Row gap={S.md}>
          <Tile label="Trucks" value={myTrucks.length} />
          <Tile label="Open shifts" value={openShifts} />
        </Row>
        <Row gap={S.md} style={{ marginTop: S.md }}>
          <Tile label="Loads today" value={myLoadsToday.length} />
          <Tile label="CY today" value={totalCy} />
        </Row>
        <Spacer size={S.lg} />
        <H2>My Trucks</H2>
        <FlatList
          data={myTrucks}
          keyExtractor={(t) => t.id}
          style={{ marginTop: S.sm }}
          contentContainerStyle={{ gap: S.md, paddingBottom: S.xl }}
          ListEmptyComponent={
            <Card>
              <Muted>No trucks assigned. Talk to your hauler.</Muted>
            </Card>
          }
          renderItem={({ item }) => {
            const open = findOpenHours(db, driver.id, item.id);
            const paused = !!open?.pausedAt;
            const tone: BadgeTone = open ? (paused ? 'amber' : 'lime') : 'neutral';
            const status = open ? (paused ? 'Paused' : 'On shift') : 'Idle';
            const proj = projectById(db, item.projectId);
            const loadsToday = todaysLoadsForTruck(db, item.id);
            const cyToday = loadsToday.reduce((a, l) => a + (l.cy || 0), 0);
            return (
              <Card
                onPress={() =>
                  router.push(`/driver/${driver.id}/truck/${item.id}`)
                }
              >
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flexShrink: 1 }}>
                    <Body style={{ fontWeight: '600' }}>
                      Truck #{item.plate}
                    </Body>
                    <Muted>{truckTypeLabel(item.type)}</Muted>
                  </View>
                  <Badge label={status} tone={tone} />
                </Row>
                {proj ? (
                  <Muted>
                    {proj.code} — {proj.name}
                    {proj.material[0] ? ` · ${materialLabel(proj.material[0])}` : ''}
                  </Muted>
                ) : (
                  <Muted>No project assigned</Muted>
                )}
                <Row gap={S.lg}>
                  <Body style={{ color: C.textDim }}>
                    {loadsToday.length} load{loadsToday.length === 1 ? '' : 's'} today
                  </Body>
                  <Body style={{ color: C.textDim }}>{cyToday} CY</Body>
                </Row>
              </Card>
            );
          }}
        />
      </Screen>
    </>
  );
}
