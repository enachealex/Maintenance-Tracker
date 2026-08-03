import { StanceDelta, TireGeometry, TireSize, WheelSpec } from './types';

const MM_PER_IN = 25.4;
const INCHES_PER_MILE = 63360;

/** Everything derivable from a tire size alone. */
export function geometryOf(size: TireSize): TireGeometry {
  const sidewallMm = size.sectionWidthMm * (size.aspectRatio / 100);
  const overallDiameterMm = size.rimDiameterIn * MM_PER_IN + 2 * sidewallMm;
  const overallDiameterIn = overallDiameterMm / MM_PER_IN;
  const circumferenceIn = Math.PI * overallDiameterIn;
  return {
    size,
    sidewallMm,
    overallDiameterMm,
    overallDiameterIn,
    circumferenceIn,
    // Unloaded. A loaded tire deflects and turns a few percent faster, so
    // published figures run higher; this is used for comparing sizes, where
    // that offset cancels out.
    revsPerMile: circumferenceIn > 0 ? INCHES_PER_MILE / circumferenceIn : 0,
  };
}

/**
 * Backspacing: mounting face to the inboard rim flange, in inches.
 *
 * Wheels are advertised by bead-seat width, but backspacing is measured to the
 * flange, so the half inch of flange on each side has to be added back.
 */
export function offsetToBackspacing(widthIn: number, offsetMm: number): number {
  const overallWidthIn = widthIn + 1;
  return overallWidthIn / 2 + offsetMm / MM_PER_IN;
}

/** Inverse of offsetToBackspacing. */
export function backspacingToOffset(widthIn: number, backspacingIn: number): number {
  const overallWidthIn = widthIn + 1;
  return (backspacingIn - overallWidthIn / 2) * MM_PER_IN;
}

/**
 * How far the outer rim edge sits outboard of the hub mounting face, in mm.
 *
 * The mounting face is fixed by the hub, and offset places the wheel's
 * centerline relative to it, so the outer edge lands at half-width minus
 * offset. Larger offset tucks the wheel in; smaller offset pokes it out.
 */
export function outerEdgeFromHubMm(wheel: WheelSpec): number {
  return (wheel.widthIn * MM_PER_IN) / 2 - wheel.offsetMm;
}

/**
 * How far the inner rim edge sits inboard of the hub mounting face, in mm.
 * This is the dimension that runs out of room against struts and control arms.
 */
export function innerEdgeFromHubMm(wheel: WheelSpec): number {
  return (wheel.widthIn * MM_PER_IN) / 2 + wheel.offsetMm;
}

/**
 * Change in where the wheel sits laterally, versus the factory setup.
 *
 * This is the whole reason the visualizer uses a corner camera angle rather
 * than a profile view: offset is a lateral dimension and simply does not read
 * in a straight side-on shot.
 */
export function stanceDelta(oe: WheelSpec, proposed: WheelSpec): StanceDelta {
  return {
    pokeDeltaMm: outerEdgeFromHubMm(proposed) - outerEdgeFromHubMm(oe),
    innerClearanceDeltaMm: innerEdgeFromHubMm(proposed) - innerEdgeFromHubMm(oe),
  };
}

/**
 * True speed when the speedometer reads `indicated`, after a diameter change.
 * The speedometer still counts revolutions as though the factory tire were
 * fitted, so a taller tire covers more ground per revolution than it thinks.
 */
export function trueSpeed(
  indicated: number,
  oe: TireGeometry,
  proposed: TireGeometry,
): number {
  if (oe.overallDiameterMm <= 0) return indicated;
  return indicated * (proposed.overallDiameterMm / oe.overallDiameterMm);
}

/** Positive means the speedometer under-reads — you are going faster than it says. */
export function speedometerErrorPercent(oe: TireGeometry, proposed: TireGeometry): number {
  if (oe.overallDiameterMm <= 0) return 0;
  return ((proposed.overallDiameterMm - oe.overallDiameterMm) / oe.overallDiameterMm) * 100;
}
