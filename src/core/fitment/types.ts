/**
 * Fitment domain types.
 *
 * This module is deliberately pure: no network, no React, no storage. Every
 * correctness-critical behavior in the wheel visualizer lives here so it can be
 * tested without a device, an API key, or a rendered pixel.
 */

/** Service-type prefix on a tire size. Unmarked sizes are Euro-metric. */
export type ServiceType = '' | 'P' | 'LT' | 'ST' | 'T';

/** Radial, diagonal (bias), or bias-belted construction. */
export type Construction = 'R' | 'D' | 'B';

export interface TireSize {
  /** Metric (275/40R20) or flotation (33x12.50R17). */
  kind: 'metric' | 'flotation';
  /** The input string, preserved so the UI can echo what the user typed. */
  raw: string;
  serviceType: ServiceType;
  sectionWidthMm: number;
  /** Sidewall height as a percentage of section width. */
  aspectRatio: number;
  rimDiameterIn: number;
  construction: Construction;
  /** Z-speed marking that appears before the R, as in 275/40ZR20. */
  zRated: boolean;
  loadIndex: number | null;
  speedRating: string | null;
}

export interface WheelSpec {
  diameterIn: number;
  /** Bead-seat width, which is what wheels are advertised as. */
  widthIn: number;
  /** ET: centerline to mounting face, positive when the face sits outboard. */
  offsetMm: number;
}

/** Everything derivable from a tire size alone. */
export interface TireGeometry {
  size: TireSize;
  sidewallMm: number;
  overallDiameterMm: number;
  overallDiameterIn: number;
  circumferenceIn: number;
  /**
   * Unloaded revolutions per mile. A tire under load deflects and turns
   * slightly faster than this, so published figures typically run a few
   * percent higher. Good enough for comparing two sizes, which is all this is
   * used for.
   */
  revsPerMile: number;
}

export type WarningLevel = 'info' | 'caution' | 'critical';

export interface FitmentWarning {
  code: string;
  level: WarningLevel;
  message: string;
}

export interface StanceDelta {
  /** Positive: the new setup sits further outboard (more poke, less tuck). */
  pokeDeltaMm: number;
  /** Positive: the inner rim edge sits deeper in, toward strut and control arm. */
  innerClearanceDeltaMm: number;
}

export interface FitmentComparison {
  oe: TireGeometry;
  proposed: TireGeometry;
  diameterDeltaMm: number;
  diameterDeltaPercent: number;
  sectionWidthDeltaMm: number;
  sidewallDeltaMm: number;
  revsPerMileDelta: number;
  /**
   * Positive means the speedometer under-reads: a larger tire covers more
   * ground per revolution, so true speed exceeds indicated speed.
   */
  speedometerErrorPercent: number;
  stance: StanceDelta | null;
  warnings: FitmentWarning[];
}
