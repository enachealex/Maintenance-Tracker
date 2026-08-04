import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../theme';
import {
  geometryOf,
  layoutFor,
  parseTireSize,
  rimScaleFactor,
  scaleCalibration,
} from '../../core/fitment';
import { VehiclePhoto } from '../../core/types';

/**
 * Profile composite.
 *
 * No wheel catalog in v1, so a size change is shown by re-scaling the user's
 * own wheel — clipped out of their photo by a circular container — and drawing
 * a fresh sidewall around it at the new height (§4a). Their actual wheel, at
 * the proportions of the size they are considering.
 *
 * Square-on means a wheel is a circle, so this is all scale and position: no
 * perspective transform, and no native image manipulation. Clipping is a
 * rounded `overflow: hidden` container with the photo offset inside it, which
 * behaves identically on iOS, Android, and react-native-web.
 */
export default function WheelPreview({
  photo,
  proposedSize,
  width,
}: {
  photo: VehiclePhoto;
  /** Null renders the photo untouched, which is the "current" side of a comparison. */
  proposedSize: string | null;
  width: number;
}) {
  const fitted = parseTireSize(photo.fittedTireSize);
  const proposed = proposedSize ? parseTireSize(proposedSize) : null;

  const aspect =
    photo.calibration.imageHeight > 0
      ? photo.calibration.imageHeight / photo.calibration.imageWidth
      : 0.75;
  const height = width * aspect;

  if (!fitted) {
    return (
      <View style={[styles.frame, { width, height }]}>
        <Image source={{ uri: photo.uri }} style={{ width, height }} resizeMode="cover" />
      </View>
    );
  }

  const cal = scaleCalibration(photo.calibration, width);
  const fittedLayout = layoutFor(fitted, cal.pixelsPerInch, cal.centerX, cal.centerY);

  if (!proposed) {
    return (
      <View style={[styles.frame, { width, height }]}>
        <Image source={{ uri: photo.uri }} style={{ width, height }} resizeMode="cover" />
      </View>
    );
  }

  const layout = layoutFor(proposed, cal.pixelsPerInch, cal.centerX, cal.centerY);
  const rimScale = rimScaleFactor(fitted, proposed);

  // Cover whichever tire is larger, so a smaller proposed size cannot leave a
  // ring of the original showing through.
  const coverRadius = Math.max(fittedLayout.tireRadiusPx, layout.tireRadiusPx) + 1;

  return (
    <View style={[styles.frame, { width, height }]}>
      <Image source={{ uri: photo.uri }} style={{ width, height }} resizeMode="cover" />

      {/* Mask the original wheel and tire. The arch is dark anyway, so a plain
          disc reads as shadow rather than as a hole. */}
      <View
        style={[
          styles.circle,
          {
            left: cal.centerX - coverRadius,
            top: cal.centerY - coverRadius,
            width: coverRadius * 2,
            height: coverRadius * 2,
            borderRadius: coverRadius,
            backgroundColor: '#0B0D12',
          },
        ]}
      />

      {/* The new tire: a rubber annulus drawn as a thick border, so its
          thickness is literally the sidewall height at this scale. */}
      <View
        style={[
          styles.circle,
          {
            left: layout.centerX - layout.tireRadiusPx,
            top: layout.centerY - layout.tireRadiusPx,
            width: layout.tireRadiusPx * 2,
            height: layout.tireRadiusPx * 2,
            borderRadius: layout.tireRadiusPx,
            borderWidth: Math.max(1, layout.sidewallPx),
            borderColor: '#15181F',
            backgroundColor: 'transparent',
          },
        ]}
      />

      {/* The user's own wheel, clipped to a circle and rescaled to the new rim
          diameter. */}
      <View
        style={[
          styles.circle,
          {
            left: layout.centerX - layout.rimLipRadiusPx,
            top: layout.centerY - layout.rimLipRadiusPx,
            width: layout.rimLipRadiusPx * 2,
            height: layout.rimLipRadiusPx * 2,
            borderRadius: layout.rimLipRadiusPx,
            overflow: 'hidden',
          },
        ]}
      >
        <Image
          source={{ uri: photo.uri }}
          style={{
            width: width * rimScale,
            height: height * rimScale,
            marginLeft: -(cal.centerX * rimScale - layout.rimLipRadiusPx),
            marginTop: -(cal.centerY * rimScale - layout.rimLipRadiusPx),
          }}
          resizeMode="cover"
        />
      </View>
    </View>
  );
}

/** Caption stating plainly what this render is and is not. */
export function PreviewDisclaimer() {
  return (
    <Text style={styles.disclaimer}>
      Your own wheel, shown at the size you're considering. It's accurate for diameter and
      sidewall — it isn't a picture of a different wheel design.
    </Text>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.inputBg,
    alignSelf: 'center',
  },
  circle: { position: 'absolute' },
  disclaimer: {
    color: colors.textDim,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
