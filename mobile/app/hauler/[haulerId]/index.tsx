// Hauler Home — KPI tiles + a project list. Stubbed for this first pass: no
// approval flow, no truck assignment editing, no haul-request acceptance.
//
// TODO(hauler-approvals): tapping a pending load should open an approve/reject
// sheet. TODO(hauler-fleet): truck list with on-shift / paused / idle status.

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList } from 'react-native';

import {
  haulerById,
  projectById,
  todaysLoadsForTruck,
} from '@/db/actions';
import { useDb } from '@/db/context';
import {
  Card,
  H1,
  H2,
  Muted,
  Row,
  S,
  Screen,
  Spacer,
  Tile,
} from '@/ui';

export default function HaulerHome() {
  const { haulerId } = useLocalSearchParams<{ haulerId: string }>();
  const router = useRouter();
  const { db } = useDb();

  const hauler = haulerById(db, haulerId);
  if (!hauler) {
    return (
      <Screen>
        <H2>Hauler not found</H2>
        <Muted>ID: {haulerId}</Muted>
      </Screen>
    );
  }

  const myTrucks = db.trucks.filter((t) => t.haulerId === hauler.id);
  const myDriverIds = new Set(myTrucks.map((t) => t.driverId).filter(Boolean));
  const myProjectIds = new Set(myTrucks.map((t) => t.projectId).filter(Boolean));

  const openShifts = db.hours.filter(
    (h) =>
      h.status === 'open' &&
      myTrucks.some((t) => t.id === h.truckId),
  ).length;

  const loadsToday = myTrucks.flatMap((t) => todaysLoadsForTruck(db, t.id));
  const cyToday = loadsToday.reduce((a, l) => a + (l.cy || 0), 0);
  const pendingLoads = loadsToday.filter((l) => l.status === 'pending').length;

  return (
    <>
      <Stack.Screen options={{ title: hauler.name }} />
      <Screen scroll={false}>
        <H1>{hauler.name}</H1>
        <Muted>
          {hauler.code ?? ''} · {hauler.phone}
        </Muted>
        <Spacer size={S.md} />
        <Row gap={S.md}>
          <Tile label="Trucks" value={myTrucks.length} />
          <Tile label="Drivers" value={myDriverIds.size} />
        </Row>
        <Row gap={S.md} style={{ marginTop: S.md }}>
          <Tile label="Open shifts" value={openShifts} />
          <Tile label="Loads today" value={loadsToday.length} caption={`${cyToday} CY`} />
        </Row>
        <Row gap={S.md} style={{ marginTop: S.md }}>
          <Tile
            label="Pending approval"
            value={pendingLoads}
            caption={pendingLoads ? 'Review needed' : 'All clear'}
          />
          <Tile label="Projects" value={myProjectIds.size} />
        </Row>

        <Spacer size={S.lg} />
        <H2>Projects</H2>
        <FlatList
          data={hauler.projectIds
            .map((id) => projectById(db, id))
            .filter((p): p is NonNullable<typeof p> => !!p)}
          keyExtractor={(p) => p.id}
          style={{ marginTop: S.sm }}
          contentContainerStyle={{ gap: S.md, paddingBottom: S.xl }}
          ListEmptyComponent={
            <Card>
              <Muted>No projects yet.</Muted>
            </Card>
          }
          renderItem={({ item }) => (
            <Card title={`${item.code} — ${item.name}`} subtitle={item.gc}>
              <Muted>{item.address}</Muted>
              <Muted>Status: {item.status}</Muted>
              {/* TODO(hauler-project-detail): drill into per-project trucks,
                  drivers, today's loads, weekly CY, billing. */}
            </Card>
          )}
        />
      </Screen>
    </>
  );
}
