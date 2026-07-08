// Root layout. Wraps the entire app in DbProvider + SafeAreaProvider so every
// screen has access to the in-memory db. Uses Expo Router's Stack navigator.

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DbProvider } from '@/db/context';
import { C } from '@/ui';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DbProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: C.bg },
            headerTintColor: C.text,
            headerTitleStyle: { color: C.text },
            contentStyle: { backgroundColor: C.bg },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="index" options={{ title: 'JSE Hauler' }} />
          <Stack.Screen name="driver/index" options={{ title: 'Drivers' }} />
          <Stack.Screen
            name="driver/[driverId]/index"
            options={{ title: 'Driver' }}
          />
          <Stack.Screen
            name="driver/[driverId]/truck/[truckId]"
            options={{ title: 'Truck' }}
          />
          <Stack.Screen
            name="driver/[driverId]/log/[truckId]"
            options={{ title: 'Log a Load' }}
          />
          <Stack.Screen name="hauler/index" options={{ title: 'Haulers' }} />
          <Stack.Screen
            name="hauler/[haulerId]/index"
            options={{ title: 'Hauler' }}
          />
        </Stack>
      </DbProvider>
    </SafeAreaProvider>
  );
}
