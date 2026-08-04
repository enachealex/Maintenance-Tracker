/**
 * Fitment engine — pure tire and wheel geometry.
 *
 * No network, no storage, no React. Everything the visualizer needs to be
 * *correct* lives here and is testable without a device or an API key; the
 * rendering layer consumes these numbers rather than deriving its own.
 */
export * from './types';
export { parseTireSize, formatTireSize, validateTireSize, recommendedRimWidthIn } from './size';
export { loadIndexToKg, speedRatingToKph, isKnownSpeedRating } from './ratings';
export {
  geometryOf,
  offsetToBackspacing,
  backspacingToOffset,
  outerEdgeFromHubMm,
  innerEdgeFromHubMm,
  stanceDelta,
  trueSpeed,
  speedometerErrorPercent,
} from './geometry';
export {
  pixelsPerInch,
  layoutFor,
  rimScaleFactor,
  occludesOriginal,
  exposedRingPx,
  scaleCalibration,
  RIM_FLANGE_ALLOWANCE_IN,
} from './render';
export type { WheelLayout, CalibrationReference } from './render';
export { compareFitment, worstLevel, THRESHOLDS } from './compare';
export type { CompareInput } from './compare';
