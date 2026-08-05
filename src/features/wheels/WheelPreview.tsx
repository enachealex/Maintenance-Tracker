import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../theme';
import { compositeLayersFor, parseTireSize, scaleCalibration } from '../../core/fitment';
import { VehiclePhoto } from '../../core/types';
import { usePhotoUri } from './usePhotoUri';

/**
 * Profile composite, built entirely from the user's own photo.
 *
 * Both the wheel AND the tire are clipped out of the photo and rescaled —
 * their actual rim, their actual rubber, sidewall sheen and tread shoulder
 * included. A size change is not a uniform scale of a tire (plus-one keeps
 * the outside, grows the hole), so the two are scaled independently and the
 * wheel draws over the tire's middle: a thinner sidewall emerges from the
 * bigger wheel covering more rubber, which is what plus-sizing physically
 * does. The layer recipe — scales, clip radii, and the dark patch band for
 * the taller-sidewall case — comes from core/fitment/render.ts, where it is
 * unit-tested.
 *
 * Square-on means every layer is scale + circular clip (`overflow: hidden` on
 * a rounded container): no perspective transform, no native image processing,
 * identical on iOS, Android, and react-native-web.
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
  const uri = usePhotoUri(photo.uri);
  const fitted = parseTireSize(photo.fittedTireSize);
  const proposed = proposedSize ? parseTireSize(proposedSize) : null;

  const aspect =
    photo.calibration.imageHeight > 0
      ? photo.calibration.imageHeight / photo.calibration.imageWidth
      : 0.75;
  const height = width * aspect;

  if (!uri) {
    return (
      <View style={[styles.frame, styles.placeholder, { width, height }]}>
        <Text style={styles.placeholderText}>Loading photo…</Text>
      </View>
    );
  }

  if (!fitted || !proposed) {
    return (
      <View style={[styles.frame, { width, height }]}>
        <Image source={{ uri }} style={{ width, height }} resizeMode="cover" />
      </View>
    );
  }

  const cal = scaleCalibration(photo.calibration, width);
  const layers = compositeLayersFor(fitted, proposed, cal.pixelsPerInch);
  const { centerX, centerY } = cal;

  /** The photo scaled by `k` about the wheel centre, clipped to a disc. */
  const clippedPhoto = (k: number, clipRadiusPx: number) => (
    <View
      style={[
        styles.circle,
        {
          left: centerX - clipRadiusPx,
          top: centerY - clipRadiusPx,
          width: clipRadiusPx * 2,
          height: clipRadiusPx * 2,
          borderRadius: clipRadiusPx,
          overflow: 'hidden',
        },
      ]}
    >
      <Image
        source={{ uri }}
        style={{
          width: width * k,
          height: height * k,
          marginLeft: -(centerX * k - clipRadiusPx),
          marginTop: -(centerY * k - clipRadiusPx),
        }}
        resizeMode="cover"
      />
    </View>
  );

  return (
    <View style={[styles.frame, { width, height }]}>
      <Image source={{ uri }} style={{ width, height }} resizeMode="cover" />

      {/* Hide the original wherever the new setup is smaller. The arch is dark
          anyway, so a flat disc reads as shadow rather than as a hole. */}
      <View
        style={[
          styles.circle,
          {
            left: centerX - layers.coverRadiusPx,
            top: centerY - layers.coverRadiusPx,
            width: layers.coverRadiusPx * 2,
            height: layers.coverRadiusPx * 2,
            borderRadius: layers.coverRadiusPx,
            backgroundColor: '#0B0D12',
          },
        ]}
      />

      {/* Their actual tire, rescaled so its outer edge lands at the new OD. */}
      {clippedPhoto(layers.tire.scale, layers.tire.clipRadiusPx)}

      {/* Taller-sidewall case only: cover the scaled photo's rim-lip ghost with
          flat rubber tone, right at the rim where real sidewalls are darkest. */}
      {layers.innerPatch && (
        <View
          style={[
            styles.circle,
            {
              left: centerX - layers.innerPatch.outerRadiusPx,
              top: centerY - layers.innerPatch.outerRadiusPx,
              width: layers.innerPatch.outerRadiusPx * 2,
              height: layers.innerPatch.outerRadiusPx * 2,
              borderRadius: layers.innerPatch.outerRadiusPx,
              borderWidth: Math.max(
                1,
                layers.innerPatch.outerRadiusPx - layers.innerPatch.innerRadiusPx,
              ),
              borderColor: '#15181F',
              backgroundColor: 'transparent',
            },
          ]}
        />
      )}

      {/* Their actual wheel, rescaled to the new rim diameter, over the top. */}
      {clippedPhoto(layers.wheel.scale, layers.wheel.clipRadiusPx)}
    </View>
  );
}

/** Caption stating plainly what this render is and is not. */
export function PreviewDisclaimer() {
  return (
    <Text style={styles.disclaimer}>
      Your own wheel and tire, resized to the size you're considering — accurate for diameter
      and sidewall. Choosing a different wheel design comes later.
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
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: colors.textDim, fontSize: 13 },
  disclaimer: {
    color: colors.textDim,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
