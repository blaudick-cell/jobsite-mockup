// Log a Load. Pick material, enter CY, take a photo (camera primary; library
// fallback), submit. Stores the photo as a file:// URI — we deliberately do
// NOT base64 on mobile (the web mockup does that for localStorage; here we
// keep the image on disk).

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { MATERIALS, materialLabel, truckTypeLabel } from '@/data/constants';
import {
  addLoad,
  driverById,
  projectById,
  truckById,
} from '@/db/actions';
import { useDb } from '@/db/context';
import {
  Body,
  Button,
  C,
  Card,
  F,
  H1,
  H2,
  Muted,
  R,
  Row,
  S,
  Screen,
  Spacer,
} from '@/ui';

export default function LogLoad() {
  const { driverId, truckId } = useLocalSearchParams<{
    driverId: string;
    truckId: string;
  }>();
  const router = useRouter();
  const { db, setDb } = useDb();

  const driver = driverById(db, driverId);
  const truck = truckById(db, truckId);
  const proj = projectById(db, truck?.projectId);

  // Default material: project's first material if known, otherwise CF.
  const defaultMaterial = useMemo(() => {
    if (proj?.material?.[0]) return String(proj.material[0]);
    return 'CF';
  }, [proj]);

  const [material, setMaterial] = useState<string>(defaultMaterial);
  const [cyText, setCyText] = useState<string>('');
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  if (!driver || !truck) {
    return (
      <Screen>
        <H2>Truck not found</H2>
        <Muted>Driver: {driverId} · Truck: {truckId}</Muted>
      </Screen>
    );
  }

  if (!truck.projectId) {
    return (
      <Screen>
        <H2>No project assigned</H2>
        <Muted>Loads must be tied to a project. Ask your hauler to assign one.</Muted>
        <Spacer size={S.md} />
        <Button label="Back" onPress={() => router.back()} variant="secondary" />
      </Screen>
    );
  }

  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Camera permission needed',
          'Grant camera access to photograph the ticket. You can also pick from your library.',
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
        allowsEditing: false,
        exif: false,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('Camera error', String((e as Error)?.message ?? e));
    }
  };

  const pickFromLibrary = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Photo library permission needed');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        quality: 0.7,
        allowsEditing: false,
        // expo-image-picker v17 prefers the array form; falls back gracefully
        // on older SDKs that accept MediaTypeOptions.
        mediaTypes: ['images'],
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('Library error', String((e as Error)?.message ?? e));
    }
  };

  const handleSubmit = () => {
    const cy = Number(cyText);
    if (!Number.isFinite(cy) || cy <= 0) {
      Alert.alert('Enter CY', 'Enter a positive number of cubic yards.');
      return;
    }
    if (!material) {
      Alert.alert('Pick a material');
      return;
    }
    setSubmitting(true);
    setDb((prev) =>
      addLoad(prev, {
        driverId: driver.id,
        truckId: truck.id,
        projectId: truck.projectId as string,
        material,
        cy,
        photo: photoUri,
      }),
    );
    // Pop back to truck detail.
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: `Log a Load · #${truck.plate}` }} />
      <Screen>
        <H1>Log a Load</H1>
        <Muted>
          Truck #{truck.plate} · {truckTypeLabel(truck.type)}
        </Muted>
        {proj ? (
          <Muted>
            {proj.code} — {proj.name}
          </Muted>
        ) : null}

        <Spacer size={S.md} />

        {/* Material picker — simple chip grid */}
        <Card title="Material">
          <View style={s.chipWrap}>
            {MATERIALS.map((m) => {
              const active = m.code === material;
              return (
                <Pressable
                  key={m.code}
                  onPress={() => setMaterial(m.code)}
                  style={[s.chip, active && s.chipActive]}
                >
                  <Body
                    style={{
                      color: active ? '#0A0A0A' : C.text,
                      fontWeight: active ? '700' : '500',
                      fontSize: F.sm,
                    }}
                  >
                    {m.label}
                  </Body>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Spacer size={S.md} />

        {/* CY input */}
        <Card title="Cubic yards (CY)">
          <TextInput
            value={cyText}
            onChangeText={setCyText}
            keyboardType="number-pad"
            placeholder="e.g. 14"
            placeholderTextColor={C.textMuted}
            style={s.cyInput}
            returnKeyType="done"
          />
        </Card>

        <Spacer size={S.md} />

        {/* Photo */}
        <Card title="Ticket photo">
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={{ width: '100%', height: 200, borderRadius: R.md }}
              resizeMode="cover"
            />
          ) : (
            <Muted>No photo yet — take one or pick from library.</Muted>
          )}
          <Row gap={S.md} style={{ marginTop: S.sm }}>
            <Button
              label={photoUri ? 'Retake' : 'Take photo'}
              onPress={takePhoto}
              style={{ flex: 1 }}
            />
            <Button
              label="From library"
              variant="secondary"
              onPress={pickFromLibrary}
              style={{ flex: 1 }}
            />
          </Row>
        </Card>

        <Spacer size={S.lg} />

        <Button
          label={submitting ? 'Submitting…' : `Submit ${cyText || '—'} CY ${materialLabel(material)}`}
          size="lg"
          disabled={submitting}
          onPress={handleSubmit}
        />
        <Spacer size={S.sm} />
        <Button
          label="Cancel"
          variant="ghost"
          onPress={() => router.back()}
        />
        <Spacer size={S.xl} />
      </Screen>
    </>
  );
}

const s = StyleSheet.create({
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  chip: {
    paddingHorizontal: S.md,
    paddingVertical: S.sm,
    backgroundColor: C.cardElev,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: { backgroundColor: C.lime, borderColor: C.lime },
  cyInput: {
    backgroundColor: C.bgElev,
    color: C.text,
    fontSize: F.xl,
    fontWeight: '700',
    paddingHorizontal: S.md,
    paddingVertical: S.md,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.borderStrong,
    minHeight: 56,
  },
});
