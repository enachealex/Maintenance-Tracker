import React, { useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  GestureResponderEvent,
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
  /** Which point the loupe magnifies and the nudge arrows move. */
  const [active, setActive] = useState<'center' | 'edge'>('center');
  const [displayWidth, setDisplayWidth] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const frameRef = useRef<View>(null);

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

  /**
   * Tap position in frame coordinates, via pageX/pageY minus the frame's
   * window offset. locationX/locationY would be simpler, but react-native-web
   * leaves them undefined for mouse events, which silently turned every
   * calibration point into NaN on web. pageX/pageY exist on both platforms.
   */
  const onTap = (e: GestureResponderEvent) => {
    // Mouse events carry pageX directly; touch events carry it on the touch.
    const ne = e.nativeEvent as GestureResponderEvent['nativeEvent'] & {
      changedTouches?: Array<{ pageX: number; pageY: number }>;
    };
    const pageX = ne.pageX ?? ne.changedTouches?.[0]?.pageX;
    const pageY = ne.pageY ?? ne.changedTouches?.[0]?.pageY;
    if (pageX == null || pageY == null || !Number.isFinite(pageX + pageY)) return;
    frameRef.current?.measureInWindow((fx, fy) => {
      const p = { x: pageX - fx, y: pageY - fy };
      if (!center || edge) {
        setCenter(p);
        setEdge(null);
        setActive('center');
      } else {
        setEdge(p);
        setActive('edge');
      }
    });
  };

  /** Fine-tune the active point — a fingertip is ~3-4 image pixels wide. */
  const nudge = (dx: number, dy: number) => {
    const move = (p: Point | null) => (p ? { x: p.x + dx, y: p.y + dy } : p);
    if (active === 'edge' && edge) setEdge(move(edge));
    else if (center) setCenter(move(center));
  };

  const onFrameLayout = (e: LayoutChangeEvent) => setDisplayWidth(e.nativeEvent.layout.width);

  const radiusPx =
    center && edge ? Math.hypot(edge.x - center.x, edge.y - center.y) : 0;
  const activePoint = active === 'edge' ? edge : center;

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
              {!center
                ? 'Step 1 — tap the centre of a wheel'
                : !edge
                  ? 'Step 2 — tap the outer edge of the tire'
                  : 'Circle set — fine-tune below, or tap the photo to start over'}
            </Text>
            <Text style={styles.stepBody}>
              {!center
                ? 'Pick one wheel and tap its middle, on the hub.'
                : !edge
                  ? 'Tap where the tread meets the road or the fender — the outside of the rubber, not the metal.'
                  : 'The arrows move the selected point a couple of pixels at a time.'}
            </Text>
          </Card>

          <Pressable
            ref={frameRef}
            onPress={onTap}
            onLayout={onFrameLayout}
            style={styles.frame}
            testID="calibrate-frame"
            accessibilityLabel="Car photo. Tap the centre of a wheel, then the outer edge of its tire, to set the scale."
          >
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

          {activePoint && (
            <View style={styles.fineTune}>
              {/* Loupe: the photo at 3×, centred on the point being adjusted. */}
              <View style={styles.loupe}>
                <Image
                  source={{ uri: photo.uri }}
                  style={{
                    width: displayWidth * 3,
                    height: displayHeight * 3,
                    marginLeft: -(activePoint.x * 3 - LOUPE / 2),
                    marginTop: -(activePoint.y * 3 - LOUPE / 2),
                  }}
                  resizeMode="cover"
                />
                <View style={styles.loupeHairV} />
                <View style={styles.loupeHairH} />
              </View>

              <View style={styles.nudgeBlock}>
                <Text style={styles.nudgeTitle}>
                  Fine-tune the {active === 'edge' ? 'tire edge' : 'wheel centre'}
                </Text>
                <View style={styles.nudgeRow}>
                  <NudgeBtn label="◀" a11y="Nudge left" onPress={() => nudge(-2, 0)} />
                  <View style={styles.nudgeCol}>
                    <NudgeBtn label="▲" a11y="Nudge up" onPress={() => nudge(0, -2)} />
                    <NudgeBtn label="▼" a11y="Nudge down" onPress={() => nudge(0, 2)} />
                  </View>
                  <NudgeBtn label="▶" a11y="Nudge right" onPress={() => nudge(2, 0)} />
                </View>
                {center && edge && (
                  <Pressable onPress={() => setActive(active === 'edge' ? 'center' : 'edge')}>
                    <Text style={styles.swapPoint}>
                      Switch to {active === 'edge' ? 'wheel centre' : 'tire edge'}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          <TireSizeInput
            label="Tire size fitted right now"
            value={fittedSize}
            onChangeText={setFittedSize}
            hint="Read it off the tire sidewall. If the car is on aftermarket wheels this won't match the door sticker — the fitted size is the one that matters here."
          />

          {center && edge && (
            <Button title="Redo the circle" variant="ghost" onPress={() => { setCenter(null); setEdge(null); setActive('center'); }} />
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

const LOUPE = 120;

function NudgeBtn({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.nudgeBtn, pressed && { opacity: 0.5 }]}
    >
      <Text style={styles.nudgeBtnText}>{label}</Text>
    </Pressable>
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
  fineTune: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  loupe: {
    width: LOUPE,
    height: LOUPE,
    borderRadius: LOUPE / 2,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.inputBg,
  },
  loupeHairV: {
    position: 'absolute',
    left: LOUPE / 2 - 1,
    top: 0,
    width: 2,
    height: LOUPE,
    backgroundColor: 'rgba(76,141,255,0.55)',
  },
  loupeHairH: {
    position: 'absolute',
    top: LOUPE / 2 - 1,
    left: 0,
    height: 2,
    width: LOUPE,
    backgroundColor: 'rgba(76,141,255,0.55)',
  },
  nudgeBlock: { flex: 1, alignItems: 'center', gap: spacing.sm },
  nudgeTitle: { color: colors.textDim, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  nudgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nudgeCol: { gap: spacing.sm },
  nudgeBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudgeBtnText: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  swapPoint: { color: colors.accent, fontSize: 13, fontWeight: '700' },
});
