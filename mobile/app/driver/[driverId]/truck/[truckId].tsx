// Truck Detail. The core driver screen: clock in / out / pause / resume,
// live-running ticker, today's loads list, "Log a load" CTA.
//
// The ticker re-renders every 1s while a shift is open and not paused. We
// don't re-render the entire context — just this local `now` state.

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';

import { materialLabel, truckTypeLabel } from '@/data/constants';
import {
  clockIn,
  clockOut,
  driverById,
  elapsedMs,
  findOpenHours,
  formatElapsed,
  pauseHours,
  projectById,
  resumeHours,
  todaysLoadsForTruck,
  truckById,
} from '@/db/actions';
import { useDb } from '@/db/context';
import {
  Badge,
  Body,
  Button,
  C,
  Card,
  H1,
  H2,
  Muted,
  Row,
  S,
  Screen,
  Spacer,
} from '@/ui';

export default function TruckDetail() {
  const { driverId, truckId } = useLocalSearchParams<{
    driverId: string;
    truckId: string;
  }>();
  const router = useRouter();
  const { db, setDb } = useDb();

  const driver = driverById(db, driverId);
  const truck = truckById(db, truckId);

  const open = driver && truck ? findOpenHours(db, driver.id, truck.id) : undefined;
  const paused = !!open?.pausedAt;

  // Live ticker. Only ticks when a shift is open and not paused.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open || paused) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open, paused]);

  if (!driver || !truck) {
    return (
      <Screen>
        <H2>Truck not found</H2>
        <Muted>Driver: {driverId} · Truck: {truckId}</Muted>
      </Screen>
    );
  }

  const proj = projectById(db, truck.projectId);
  const loadsToday = todaysLoadsForTruck(db, truck.id);
  const cyToday = loadsToday.reduce((a, l) => a + (l.cy || 0), 0);
  const runningMs = open ? elapsedMs(open, now) : 0;

  const handleClockIn = () => {
    if (!truck.projectId) {
      Alert.alert(
        'No project assigned',
        'This truck has no project. Ask your hauler to assign one.',
      );
      return;
    }
    setDb((prev) =>
      clockIn(prev, {
        driverId: driver.id,
        truckId: truck.id,
        projectId: truck.projectId as string,
      }),
    );
  };

  const handleClockOut = () => {
    Alert.alert('Clock out?', 'End the shift for this truck.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clock out',
        style: 'destructive',
        onPress: () => setDb((prev) => clockOut(prev, { driverId: driver.id, truckId: truck.id })),
      },
    ]);
  };

  const handlePauseToggle = () => {
    setDb((prev) =>
      paused
        ? resumeHours(prev, { driverId: driver.id, truckId: truck.id })
        : pauseHours(prev, { driverId: driver.id, truckId: truck.id }),
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: `Truck #${truck.plate}` }} />
      <Screen scroll={false}>
        <H1>Truck #{truck.plate}</H1>
        <Muted>
          {truckTypeLabel(truck.type)} · {truck.hauler ?? 'Hauler unknown'}
        </Muted>
        {proj ? (
          <Muted>
            {proj.code} — {proj.name}
          </Muted>
        ) : (
          <Muted>No project assigned</Muted>
        )}

        <Spacer size={S.md} />

        {/* Clock card */}
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <H2>Shift</H2>
            <Badge
              label={open ? (paused ? 'Paused' : 'On shift') : 'Idle'}
              tone={open ? (paused ? 'amber' : 'lime') : 'neutral'}
            />
          </Row>
          <Text
            style={{
              color: C.text,
              fontSize: 48,
              fontWeight: '700',
              fontVariant: ['tabular-nums'],
            }}
          >
            {formatElapsed(runningMs)}
          </Text>
          <Muted>
            {open
              ? paused
                ? 'Paused — resume to keep counting.'
                : 'Running. Tap Pause for breaks.'
              : 'Tap Clock In to start your shift.'}
          </Muted>
          <Spacer size={S.sm} />
          {open ? (
            <Row gap={S.md}>
              <Button
                label={paused ? 'Resume' : 'Pause'}
                variant="secondary"
                size="lg"
                style={{ flex: 1 }}
                onPress={handlePauseToggle}
              />
              <Button
                label="Clock Out"
                variant="danger"
                size="lg"
                style={{ flex: 1 }}
                onPress={handleClockOut}
              />
            </Row>
          ) : (
            <Button label="Clock In" size="lg" onPress={handleClockIn} />
          )}
        </Card>

        <Spacer size={S.md} />

        {/* Loads today */}
        <Row style={{ justifyContent: 'space-between' }}>
          <H2>Loads today</H2>
          <Muted>
            {loadsToday.length} · {cyToday} CY
          </Muted>
        </Row>

        <FlatList
          data={loadsToday}
          keyExtractor={(l) => l.id}
          style={{ marginTop: S.sm, flexGrow: 0 }}
          contentContainerStyle={{ gap: S.sm, paddingBottom: S.md }}
          ListEmptyComponent={
            <Card>
              <Muted>No loads logged yet today.</Muted>
            </Card>
          }
          renderItem={({ item }) => (
            <Card>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flexShrink: 1 }}>
                  <Body style={{ fontWeight: '600' }}>
                    {item.cy} CY · {materialLabel(String(item.material))}
                  </Body>
                  <Muted>
                    {item.time} · {item.photo ? 'Photo attached' : 'No photo'}
                  </Muted>
                </View>
                <Badge
                  label={item.status}
                  tone={item.status === 'approved' ? 'green' : 'amber'}
                />
              </Row>
            </Card>
          )}
        />

        <Spacer size={S.md} />

        <Button
          label="+ Log a Load"
          size="lg"
          onPress={() => router.push(`/driver/${driver.id}/log/${truck.id}`)}
          disabled={!truck.projectId}
        />
        {!truck.projectId ? (
          <Muted>Assign a project before logging loads.</Muted>
        ) : null}
        <Spacer size={S.lg} />
      </Screen>
    </>
  );
}
