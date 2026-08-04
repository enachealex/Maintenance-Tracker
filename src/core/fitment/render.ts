import { geometryOf } from './geometry';
import { TireGeometry, TireSize } from './types';

/**
 * Profile-view render layout.
 *
 * Pure geometry: given a calibrated photo and a tire size, this says where to
 * draw the rim and the tire and how big each is, in image pixels. No React, no
 * canvas — the compositor consumes these numbers so the maths can be tested
 * without rendering anything.
 *
 * Square-on only (decision 10). A wheel photographed from the side projects as
 * a circle, so this is scale and position, never perspective.
 */

/** What the user traced during calibration. */
export type CalibrationReference = 'tire-outer-edge' | 'rim-lip';

/**
 * Outer diameter of the visible metal lip, relative to the nominal rim size.
 *
 * Nominal rim diameter is the *bead seat* — where the tire sits — not the edge
 * you can see. A standard J-flange stands about 17.3mm proud on each side, so
 * the visible lip measures roughly 1.36" more than the number in the tire size.
 * Ignoring this would overstate scale by ~8% on a 17" wheel.
 *
 * Flange height varies with rim width code, so this is an approximation. It is
 * why `tire-outer-edge` is the preferred reference: that diameter is exact.
 */
export const RIM_FLANGE_ALLOWANCE_IN = (2 * 17.3) / 25.4;

export interface WheelLayout {
  centerX: number;
  centerY: number;
  /** Nominal rim radius — the bead seat, where the sidewall begins. */
  rimRadiusPx: number;
  /** Visible metal edge, a little proud of the bead seat. */
  rimLipRadiusPx: number;
  /** Outer edge of the tire. */
  tireRadiusPx: number;
  /** Thickness of the rubber band between lip and tread. */
  sidewallPx: number;
}

/**
 * Pixels per inch from a traced circle.
 *
 * `tire-outer-edge` is preferred: overall diameter follows exactly from the
 * fitted size, so the scale carries no modelling error. `rim-lip` is easier to
 * trace — crisp metal against rubber — but leans on the flange approximation
 * above.
 */
export function pixelsPerInch(
  tracedDiameterPx: number,
  fitted: TireGeometry,
  reference: CalibrationReference = 'tire-outer-edge',
): number {
  const knownIn =
    reference === 'tire-outer-edge'
      ? fitted.overallDiameterIn
      : fitted.size.rimDiameterIn + RIM_FLANGE_ALLOWANCE_IN;
  if (knownIn <= 0 || tracedDiameterPx <= 0) return 0;
  return tracedDiameterPx / knownIn;
}

/** Where to draw a given size, at a given scale and centre. */
export function layoutFor(
  size: TireSize,
  scalePxPerIn: number,
  centerX: number,
  centerY: number,
): WheelLayout {
  const g = geometryOf(size);
  const rimRadiusPx = (size.rimDiameterIn / 2) * scalePxPerIn;
  const rimLipRadiusPx = ((size.rimDiameterIn + RIM_FLANGE_ALLOWANCE_IN) / 2) * scalePxPerIn;
  const tireRadiusPx = (g.overallDiameterIn / 2) * scalePxPerIn;
  return {
    centerX,
    centerY,
    rimRadiusPx,
    rimLipRadiusPx,
    tireRadiusPx,
    sidewallPx: tireRadiusPx - rimLipRadiusPx,
  };
}

/**
 * How much to scale the wheel cropped out of the user's photo.
 *
 * v1 has no wheel catalog, so a size change is shown by re-scaling the user's
 * own wheel to the new rim diameter and regenerating the sidewall around it
 * (§4a). This is that scale factor — it shows size and proportion faithfully,
 * though not a different wheel design.
 */
export function rimScaleFactor(fitted: TireSize, proposed: TireSize): number {
  if (fitted.rimDiameterIn <= 0) return 1;
  return proposed.rimDiameterIn / fitted.rimDiameterIn;
}

/**
 * Does the proposed tire cover every pixel the fitted one occupied?
 *
 * When it does, the compositor can simply draw over the original and no fill is
 * needed — which is the common case, because plus sizing holds overall diameter
 * roughly constant by design. When it does not, the uncovered ring has to be
 * filled, and that is the case worth testing on real photos.
 */
export function occludesOriginal(fitted: TireSize, proposed: TireSize): boolean {
  return geometryOf(proposed).overallDiameterIn >= geometryOf(fitted).overallDiameterIn;
}

/** Ring left exposed when the proposed tire is smaller. Zero when it is not. */
export function exposedRingPx(
  fitted: TireSize,
  proposed: TireSize,
  scalePxPerIn: number,
): number {
  const fittedR = (geometryOf(fitted).overallDiameterIn / 2) * scalePxPerIn;
  const proposedR = (geometryOf(proposed).overallDiameterIn / 2) * scalePxPerIn;
  return Math.max(0, fittedR - proposedR);
}

/**
 * Re-scale a calibration measured on one image size to another.
 *
 * Calibration is captured against full-resolution image pixels but rendered
 * into a layout-sized view, so every number has to move together. Keeping this
 * in one place stops the display layer from inventing its own conversion.
 */
export function scaleCalibration(
  calibration: { pixelsPerInch: number; centerX: number; centerY: number; imageWidth: number },
  displayWidth: number,
): { pixelsPerInch: number; centerX: number; centerY: number } {
  if (calibration.imageWidth <= 0) {
    return {
      pixelsPerInch: calibration.pixelsPerInch,
      centerX: calibration.centerX,
      centerY: calibration.centerY,
    };
  }
  const k = displayWidth / calibration.imageWidth;
  return {
    pixelsPerInch: calibration.pixelsPerInch * k,
    centerX: calibration.centerX * k,
    centerY: calibration.centerY * k,
  };
}
