// Hauler picker. Lists haulers from the seed.

import { useRouter } from 'expo-router';
import { FlatList } from 'react-native';

import { useDb } from '@/db/context';
import { Card, H2, Muted, Screen } from '@/ui';

export default function HaulerPicker() {
  const router = useRouter();
  const { db } = useDb();
  return (
    <Screen scroll={false}>
      <H2>Pick a hauler</H2>
      <Muted>Hauler view is a lightweight fleet dashboard for this pass.</Muted>
      <FlatList
        data={db.haulers}
        keyExtractor={(h) => h.id}
        style={{ marginTop: 12 }}
        contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Card
            onPress={() => router.push(`/hauler/${item.id}`)}
            title={item.name}
            subtitle={`${item.code ?? ''} · ${item.phone}`}
          >
            <Muted>
              {db.trucks.filter((t) => t.haulerId === item.id).length} truck(s) ·{' '}
              {item.projectIds.length} project(s)
            </Muted>
          </Card>
        )}
      />
    </Screen>
  );
}
