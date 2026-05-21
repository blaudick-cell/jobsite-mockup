// Role picker — first screen. Two big tap targets: Driver vs Hauler.

import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, H1, Muted, S, Screen, Spacer } from '@/ui';

export default function RolePicker() {
  const router = useRouter();
  return (
    <Screen>
      <Spacer size={S.xl} />
      <H1>JSE Hauler</H1>
      <Muted>Pick a role to start the mockup.</Muted>
      <Spacer size={S.xl} />
      <View style={{ gap: S.lg }}>
        <Button
          label="I am a Driver"
          size="lg"
          onPress={() => router.push('/driver')}
        />
        <Button
          label="I am a Hauler"
          size="lg"
          variant="secondary"
          onPress={() => router.push('/hauler')}
        />
      </View>
      <Spacer size={S.xl} />
      <Muted>
        Demo data persists locally on this device. No backend, no sync.
      </Muted>
    </Screen>
  );
}
