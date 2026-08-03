import { FitmentComparison, FitmentWarning, TireSize, WheelSpec } from './types';
import { geometryOf, speedometerErrorPercent, stanceDelta } from './geometry';
import { recommendedRimWidthIn, validateTireSize } from './size';
import { loadIndexToKg, speedRatingToKph } from './ratings';

/**
 * Thresholds at which a change stops being cosmetic. Gathered here rather than
 * scattered through the checks so they can be tuned in one place, and so the
 * reasoning behind each is written down next to the number.
 */
export const THRESHOLDS = {
  /** Beyond this, speedometer and odometer error becomes the headline issue. */
  diameterPercentCaution: 3,
  /** Beyond this, ABS and stability-control calibration is affected too. */
  diameterPercentCritical: 5,
  /** Outboard movement likely to reach the fender lip. */
  pokeMmCaution: 10,
  /** Outboard movement that will sit proud of the arch on most cars. */
  pokeMmCritical: 25,
  /** Inboard movement that starts crowding strut and control arm. */
  innerMmCaution: 5,
  innerMmCritical: 15,
};

export interface CompareInput {
  oeTire: TireSize;
  proposedTire: TireSize;
  /** Wheels are optional: tire-only comparisons skip the stance checks. */
  oeWheel?: WheelSpec;
  proposedWheel?: WheelSpec;
}

/**
 * Compare a proposed setup against the factory one.
 *
 * Nothing here blocks a setup. Every finding is a warning with a level, and it
 * is the caller's job to present them — an aggressive fitment is a valid thing
 * to want to look at.
 */
export function compareFitment(input: CompareInput): FitmentComparison {
  const { oeTire, proposedTire, oeWheel, proposedWheel } = input;
  const oe = geometryOf(oeTire);
  const proposed = geometryOf(proposedTire);

  const diameterDeltaMm = proposed.overallDiameterMm - oe.overallDiameterMm;
  const diameterDeltaPercent = speedometerErrorPercent(oe, proposed);
  const stance = oeWheel && proposedWheel ? stanceDelta(oeWheel, proposedWheel) : null;

  const warnings: FitmentWarning[] = [
    ...validateTireSize(proposedTire),
    ...diameterWarnings(diameterDeltaPercent),
    ...ratingWarnings(oeTire, proposedTire),
  ];

  if (stance) warnings.push(...stanceWarnings(stance));
  if (proposedWheel) warnings.push(...rimWidthWarnings(proposedTire, proposedWheel));
  if (proposedWheel) warnings.push(...wheelDiameterWarnings(proposedTire, proposedWheel));

  return {
    oe,
    proposed,
    diameterDeltaMm,
    diameterDeltaPercent,
    sectionWidthDeltaMm: proposedTire.sectionWidthMm - oeTire.sectionWidthMm,
    sidewallDeltaMm: proposed.sidewallMm - oe.sidewallMm,
    revsPerMileDelta: proposed.revsPerMile - oe.revsPerMile,
    speedometerErrorPercent: diameterDeltaPercent,
    stance,
    warnings,
  };
}

function diameterWarnings(percent: number): FitmentWarning[] {
  const magnitude = Math.abs(percent);
  if (magnitude < THRESHOLDS.diameterPercentCaution) return [];
  const direction = percent > 0 ? 'under-read' : 'over-read';
  const level = magnitude >= THRESHOLDS.diameterPercentCritical ? 'critical' : 'caution';
  const extra =
    level === 'critical'
      ? ' At this much difference, ABS and stability control are working from bad wheel-speed data too.'
      : '';
  return [
    {
      code: 'diameter-change',
      level,
      message: `Overall diameter changes ${percent > 0 ? '+' : ''}${percent.toFixed(1)}%, so the speedometer will ${direction} by about that much.${extra}`,
    },
  ];
}

function ratingWarnings(oe: TireSize, proposed: TireSize): FitmentWarning[] {
  const warnings: FitmentWarning[] = [];

  const oeLoad = loadIndexToKg(oe.loadIndex);
  const newLoad = loadIndexToKg(proposed.loadIndex);
  if (oeLoad != null && newLoad != null && newLoad < oeLoad) {
    warnings.push({
      code: 'load-index-below-oe',
      level: 'critical',
      message: `Load rating drops from ${oeLoad}kg to ${newLoad}kg per tire, below what this vehicle was built for.`,
    });
  } else if (oe.loadIndex != null && proposed.loadIndex == null) {
    warnings.push({
      code: 'load-index-unknown',
      level: 'caution',
      message: 'No load index on the proposed size — check it meets or beats the factory rating.',
    });
  }

  const oeSpeed = speedRatingToKph(oe.speedRating);
  const newSpeed = speedRatingToKph(proposed.speedRating);
  if (oeSpeed != null && newSpeed != null && newSpeed < oeSpeed) {
    warnings.push({
      code: 'speed-rating-below-oe',
      level: 'caution',
      message: `Speed rating drops from ${oe.speedRating} (${oeSpeed}km/h) to ${proposed.speedRating} (${newSpeed}km/h).`,
    });
  }

  return warnings;
}

function stanceWarnings(stance: {
  pokeDeltaMm: number;
  innerClearanceDeltaMm: number;
}): FitmentWarning[] {
  const warnings: FitmentWarning[] = [];

  if (stance.pokeDeltaMm >= THRESHOLDS.pokeMmCritical) {
    warnings.push({
      code: 'poke-severe',
      level: 'critical',
      message: `Sits ${Math.round(stance.pokeDeltaMm)}mm further out than factory — expect it to stand proud of the fender, and check local rules on tyre coverage.`,
    });
  } else if (stance.pokeDeltaMm >= THRESHOLDS.pokeMmCaution) {
    warnings.push({
      code: 'poke',
      level: 'caution',
      message: `Sits ${Math.round(stance.pokeDeltaMm)}mm further out than factory — likely to reach the fender lip on bumps or full lock.`,
    });
  }

  if (stance.innerClearanceDeltaMm >= THRESHOLDS.innerMmCritical) {
    warnings.push({
      code: 'inner-clearance-severe',
      level: 'critical',
      message: `Inner edge moves ${Math.round(stance.innerClearanceDeltaMm)}mm toward the strut and control arm. Check clearance before driving it.`,
    });
  } else if (stance.innerClearanceDeltaMm >= THRESHOLDS.innerMmCaution) {
    warnings.push({
      code: 'inner-clearance',
      level: 'caution',
      message: `Inner edge moves ${Math.round(stance.innerClearanceDeltaMm)}mm inboard — worth checking strut clearance.`,
    });
  }

  return warnings;
}

function rimWidthWarnings(tire: TireSize, wheel: WheelSpec): FitmentWarning[] {
  const { min, max } = recommendedRimWidthIn(tire);
  if (wheel.widthIn > max) {
    return [
      {
        code: 'tire-stretched',
        level: 'caution',
        message: `A ${wheel.widthIn}" rim is wider than the ~${max}" this tire is rated for — that's a stretched fit.`,
      },
    ];
  }
  if (wheel.widthIn < min) {
    return [
      {
        code: 'tire-bulged',
        level: 'caution',
        message: `A ${wheel.widthIn}" rim is narrower than the ~${min}" this tire is rated for, so the sidewall will bulge.`,
      },
    ];
  }
  return [];
}

function wheelDiameterWarnings(tire: TireSize, wheel: WheelSpec): FitmentWarning[] {
  if (wheel.diameterIn === tire.rimDiameterIn) return [];
  return [
    {
      code: 'wheel-tire-diameter-mismatch',
      level: 'critical',
      message: `This tire is built for a ${tire.rimDiameterIn}" wheel but the wheel is ${wheel.diameterIn}". They will not mount together.`,
    },
  ];
}

/** Highest severity present, or null when a setup is clean. */
export function worstLevel(warnings: FitmentWarning[]): 'critical' | 'caution' | 'info' | null {
  if (warnings.some((w) => w.level === 'critical')) return 'critical';
  if (warnings.some((w) => w.level === 'caution')) return 'caution';
  if (warnings.some((w) => w.level === 'info')) return 'info';
  return null;
}
