import React, { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  Image,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button, Card, Screen } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { geometryOf, parseTireSize, pixelsPerInch } from '../../core/fitment';
import { VehiclePhoto, WheelCalibration } from '../../core/types';
import TireSizeInput from './TireSizeInput';

interface PickedPhoto {
  uri: string;
  width: number;
  height: number;
}

type Point = { x: number; y: number };

/**
 * Photo capture and calibration.
 *
 * Calibration is two taps — centre of the wheel, then the outer edge of the
 * tire — rather than a drag. Taps need no gesture library, behave identically
 * on native and react-native-web, and are more precise than dragging a handle
 * on a phone-sized image.
 *
 * The size asked for is the one **fitted right now**, not the factory size.
 * Scale is measured against the wheel actually in the photo, so on a modified
 * car the factory number would silently miscalibrate every render.
 */
export default function CalibrateScreen({
  initialFittedSize,
  onDone,
  onCancel,
}: {
  initialFittedSize: string;
  onDone: (photo: VehiclePhoto) => void;
  onCancel: () => void;
}) {
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [fittedSize, setFittedSize] = useState(initialFittedSize);
  const [center, setCenter] = useState<Point | null>(null);
  const [edge, setEdge] = useState<Point | null>(null);
  const [displayWidth, setDisplayWidth] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const size = parseTireSize(fittedSize);

  const pick = async (fromCamera: boolean) => {
    setError(null);
    try {
      const permission = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(
          fromCamera
            ? 'Camera access is needed to take the photo.'
            : 'Photo access is needed to pick an image.',
        );
        return;
      }
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.9 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.9 });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setPhoto({ uri: asset.uri, width: asset.width ?? 0, height: asset.height ?? 0 });
      setCenter(null);
      setEdge(null);
    } catch {
      setError("Couldn't open the picker. Try again.");
    }
  };

  const onTap = (e: { nativeEvent: { locationX: number; locationY: number } }) => {
    const p = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
    if (!center || edge) {
      setCenter(p);
      setEdge(null);
    } else {
      setEdge(p);
    }
  };

  const onFrameLayout = (e: LayoutChangeEvent) => setDisplayWidth(e.nativeEvent.layout.width);

  const radiusPx =
    center && edge ? Math.hypot(edge.x - center.x, edge.y - center.y) : 0;

  const save = () => {
    if (!photo || !center || !size || radiusPx <= 0 || displayWidth <= 0) return;
    // Measurements are taken in display pixels; store them against the real
    // image so the render can re-scale to whatever width it is given.
    const toImage = photo.width > 0 ? photo.width / displayWidth : 1;
    const scale = pixelsPerInch(radiusPx * 2 * toImage, geometryOf(size));
    if (scale <= 0) return;
    const calibration: WheelCalibration = {
      pixelsPerInch: scale,
      centerX: center.x * toImage,
      centerY: center.y * toImage,
      imageWidth: photo.width || displayWidth,
      imageHeight: photo.height || displayWidth * 0.75,
    };
    onDone({
      uri: photo.uri,
      calibration,
      fittedTireSize: fittedSize.trim(),
      createdAt: new Date().toISOString(),
    });
  };

  const ready = !!photo && !!center && !!edge && !!size && radiusPx > 0;
  const displayHeight =
    photo && photo.width > 0 ? (displayWidth * photo.height) / photo.width : displayWidth * 0.75;

  return (
    <Screen>
      <Text style={styles.h1}>Set up your photo</Text>
      <Text style={styles.sub}>
        Take or pick a photo from the side of your car, square-on rather than at an angle.
      </Text>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Button title="📷 Take photo" onPress={() => pick(true)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="🖼️ Choose photo" variant="ghost" onPress={() => pick(false)} />
        </View>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {photo && (
        <>
          <Card style={styles.stepCard}>
            <Text style={styles.stepTitle}>
              {!center || edge ? 'Step 1 — tap the centre of a wheel' : 'Step 2 — tap the outer edge of the tire'}
            </Text>
            <Text style={styles.stepBody}>
              {!center || edge
                ? 'Pick one wheel and tap its middle, on the hub.'
                : 'Tap where the tread meets the road or the fender — the outside of the rubber, not the metal.'}
            </Text>
          </Card>

          <Pressable onPress={onTap} onLayout={onFrameLayout} style={styles.frame}>
            <Image
              source={{ uri: photo.uri }}
              style={{ width: '100%', height: displayHeight }}
              resizeMode="cover"
            />
            {center && (
              <View style={[styles.crosshair, { left: center.x - 6, top: center.y - 6 }]} />
            )}
            {center && edge && (
              <View
                style={[
                  styles.ring,
                  {
                    left: center.x - radiusPx,
                    top: center.y - radiusPx,
                    width: radiusPx * 2,
                    height: radiusPx * 2,
                    borderRadius: radiusPx,
                  },
                ]}
              />
            )}
          </Pressable>

          <TireSizeInput
            label="Tire size fitted right now"
            value={fittedSize}
            onChangeText={setFittedSize}
            hint="Read it off the tire sidewall. If the car is on aftermarket wheels this won't match the door sticker — the fitted size is the one that matters here."
          />

          {center && edge && (
            <Button title="Redo the circle" variant="ghost" onPress={() => { setCenter(null); setEdge(null); }} />
          )}
        </>
      )}

      <View style={styles.actions}>
        <Button title="Save photo" onPress={save} disabled={!ready} />
        <Button title="Cancel" variant="ghost" onPress={onCancel} />
      </View>
      <View style={{ height: spacing.xl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { color: colors.text, fontSize: 26, fontWeight: '800', marginBottom: spacing.xs },
  sub: { color: colors.textDim, fontSize: 15, marginBottom: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  error: { color: colors.danger, fontSize: 13, marginBottom: spacing.md },
  stepCard: { marginBottom: spacing.md, gap: spacing.xs },
  stepTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  stepBody: { color: colors.textDim, fontSize: 13, lineHeight: 18 },
  frame: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.inputBg,
    marginBottom: spacing.md,
  },
  crosshair: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: 'rgba(76,141,255,0.35)',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: 'rgba(76,141,255,0.12)',
  },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
