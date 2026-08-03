import { Construction, FitmentWarning, ServiceType, TireSize } from './types';
import { isKnownSpeedRating } from './ratings';

const MM_PER_IN = 25.4;

/**
 * Metric sizes: 275/40R20, P225/45R17 91V, LT275/70R18, 275/40ZR20.
 * The Z, when present, sits before the construction letter and stands in for
 * the speed rating.
 */
const METRIC =
  /^(P|LT|ST|T)?\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*(Z)?\s*([RDB])\s*(\d{1,2}(?:\.\d)?)\s*(?:(\d{2,3})\s*([A-Z]{1,2}))?$/;

/**
 * Flotation sizes: 33x12.50R17, 35X12.50R20LT 121Q. Here the first number is
 * overall diameter in inches, so aspect ratio is derived rather than given.
 */
const FLOTATION =
  /^(\d{2}(?:\.\d{1,2})?)\s*X\s*(\d{1,2}(?:\.\d{1,2})?)\s*([RDB])?\s*(\d{1,2}(?:\.\d)?)\s*(LT|P|ST)?\s*(?:(\d{2,3})\s*([A-Z]{1,2}))?$/;

function normalize(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * Parse a tire size. Returns null only when the input cannot be read at all —
 * anything parseable comes back as a size, and judgments about whether it is a
 * sensible size are left to validateTireSize. A user entering a deliberately
 * aggressive setup must be able to see it rendered, not be blocked by a form.
 */
export function parseTireSize(input: string): TireSize | null {
  const raw = input.trim();
  const s = normalize(input);
  if (!s) return null;

  const metric = METRIC.exec(s);
  if (metric) {
    const [, service, width, aspect, z, construction, rim, load, speed] = metric;
    return {
      kind: 'metric',
      raw,
      serviceType: (service ?? '') as ServiceType,
      sectionWidthMm: Number(width),
      aspectRatio: Number(aspect),
      rimDiameterIn: Number(rim),
      construction: construction as Construction,
      zRated: z === 'Z',
      loadIndex: load ? Number(load) : null,
      speedRating: speed ?? (z === 'Z' ? 'ZR' : null),
    };
  }

  const flotation = FLOTATION.exec(s);
  if (flotation) {
    const [, diameter, width, construction, rim, service, load, speed] = flotation;
    const overallDiameterIn = Number(diameter);
    const sectionWidthIn = Number(width);
    const rimDiameterIn = Number(rim);
    // Flotation sizes state overall diameter instead of aspect ratio, so the
    // ratio has to be recovered before the shared geometry math can apply.
    const sidewallIn = (overallDiameterIn - rimDiameterIn) / 2;
    const aspectRatio = sectionWidthIn > 0 ? (sidewallIn / sectionWidthIn) * 100 : 0;
    return {
      kind: 'flotation',
      raw,
      serviceType: (service ?? '') as ServiceType,
      sectionWidthMm: sectionWidthIn * MM_PER_IN,
      aspectRatio,
      rimDiameterIn,
      construction: (construction ?? 'R') as Construction,
      zRated: false,
      loadIndex: load ? Number(load) : null,
      speedRating: speed ?? null,
    };
  }

  return null;
}

/** Canonical string for a parsed size, for display and round-tripping. */
export function formatTireSize(size: TireSize): string {
  if (size.kind === 'flotation') {
    const diameter = round1((size.rimDiameterIn * MM_PER_IN + 2 * sidewallMmOf(size)) / MM_PER_IN);
    const width = round2(size.sectionWidthMm / MM_PER_IN);
    const suffix = size.serviceType ? size.serviceType : '';
    const rating = ratingSuffix(size);
    return `${diameter}x${width.toFixed(2)}${size.construction}${size.rimDiameterIn}${suffix}${rating}`;
  }
  const z = size.zRated ? 'Z' : '';
  const rating = ratingSuffix(size);
  return `${size.serviceType}${size.sectionWidthMm}/${size.aspectRatio}${z}${size.construction}${size.rimDiameterIn}${rating}`;
}

function ratingSuffix(size: TireSize): string {
  if (size.loadIndex == null) return '';
  const speed = size.speedRating && size.speedRating !== 'ZR' ? size.speedRating : '';
  return ` ${size.loadIndex}${speed}`;
}

function sidewallMmOf(size: TireSize): number {
  return size.sectionWidthMm * (size.aspectRatio / 100);
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Plausibility checks on a parsed size. These never block — they explain why a
 * size looks unusual so the user can decide, which is the difference between a
 * tool for enthusiasts and a form that only accepts factory fitments.
 */
export function validateTireSize(size: TireSize): FitmentWarning[] {
  const warnings: FitmentWarning[] = [];

  if (size.sectionWidthMm < 105 || size.sectionWidthMm > 405) {
    warnings.push({
      code: 'unusual-section-width',
      level: 'caution',
      message: `${Math.round(size.sectionWidthMm)}mm is outside the usual 105–405mm range for road tires.`,
    });
  }

  if (size.aspectRatio < 25 || size.aspectRatio > 85) {
    warnings.push({
      code: 'unusual-aspect-ratio',
      level: 'caution',
      message: `An aspect ratio of ${round1(size.aspectRatio)} is outside the usual 25–85 range.`,
    });
  }

  if (size.rimDiameterIn < 10 || size.rimDiameterIn > 30) {
    warnings.push({
      code: 'unusual-rim-diameter',
      level: 'caution',
      message: `${size.rimDiameterIn}" is outside the usual 10–30" wheel range.`,
    });
  }

  if (size.aspectRatio <= 0) {
    warnings.push({
      code: 'impossible-sidewall',
      level: 'critical',
      message: 'This size works out to zero or negative sidewall height — check the numbers.',
    });
  }

  if (size.construction !== 'R') {
    warnings.push({
      code: 'non-radial',
      level: 'info',
      message: 'Non-radial construction. Fitment data and load ratings assume radials.',
    });
  }

  if (size.speedRating && size.speedRating !== 'ZR' && !isKnownSpeedRating(size.speedRating)) {
    warnings.push({
      code: 'unknown-speed-rating',
      level: 'info',
      message: `Speed rating "${size.speedRating}" isn't one we recognise.`,
    });
  }

  return warnings;
}

/**
 * Recommended rim width range for a tire, in inches.
 *
 * A heuristic, not a specification: approved widths span roughly two inches,
 * topping out near the section width and bottoming out about two inches below
 * it. The tire manufacturer's published range is authoritative — this exists
 * to flag obviously stretched or bulged setups before rendering them.
 */
export function recommendedRimWidthIn(size: TireSize): { min: number; max: number } {
  const sectionIn = size.sectionWidthMm / MM_PER_IN;
  return { min: round1(sectionIn - 2), max: round1(sectionIn) };
}
