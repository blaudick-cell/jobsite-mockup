// Driver picker. Lists all drivers in the seed; tapping one routes into the
// per-driver home screen.

import { useRouter } from 'expo-router';
import { FlatList } from 'react-native';

import { useDb } from '@/db/context';
import { Card, H2, Muted, Screen } from '@/ui';

export default function DriverPicker() {
  const router = useRouter();
  const { db } = useDb();

  return (
    <Screen scroll={false}>
      <H2>Pick a driver</H2>
      <Muted>Tap to enter their driver view.</Muted>
      <FlatList
        data={db.drivers}
        keyExtractor={(d) => d.id}
        style={{ marginTop: 12 }}
        contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Card
            onPress={() => router.push(`/driver/${item.id}`)}
            title={item.name}
            subtitle={item.phone}
          >
            <Muted>{db.trucks.filter((t) => t.driverId === item.id).length} truck(s) assigned</Muted>
          </Card>
        )}
      />
    </Screen>
  );
}
