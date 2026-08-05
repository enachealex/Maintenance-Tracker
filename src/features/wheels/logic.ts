import { genId } from '../../core/storage';
import { VehicleRecord, WheelBuild, WheelSetup, VehiclePhoto } from '../../core/types';
import { parseTireSize } from '../../core/fitment';

/**
 * Wheels-tab state transitions.
 *
 * Pure functions over VehicleRecord, matching how features/maintenance/logic.ts
 * works. `wheels` stays undefined until the user actually uses the feature, so
 * a record that has never seen the Wheels tab is byte-identical to one saved
 * before it existed — see the upgrade-safety suite.
 */

const EMPTY: WheelSetup = { builds: [] };

export function wheelsOf(rec: VehicleRecord): WheelSetup {
  return rec.wheels ?? EMPTY;
}

/** The size the compositor calibrates against: what is fitted right now. */
export function fittedSizeOf(rec: VehicleRecord): string | null {
  const w = wheelsOf(rec);
  return w.photo?.fittedTireSize ?? w.placardTireSize ?? null;
}

export function setPlacardSize(rec: VehicleRecord, size: string): VehicleRecord {
  return { ...rec, wheels: { ...wheelsOf(rec), placardTireSize: size.trim() } };
}

export function setPhoto(rec: VehicleRecord, photo: VehiclePhoto): VehicleRecord {
  return { ...rec, wheels: { ...wheelsOf(rec), photo } };
}

export function clearPhoto(rec: VehicleRecord): VehicleRecord {
  const { photo, ...rest } = wheelsOf(rec);
  return { ...rec, wheels: { ...rest, builds: rest.builds ?? [] } };
}

export function addBuild(rec: VehicleRecord, tireSize: string, name?: string): VehicleRecord {
  const w = wheelsOf(rec);
  const trimmed = tireSize.trim();
  const build: WheelBuild = {
    id: genId(),
    name: name?.trim() || trimmed,
    tireSize: trimmed,
    createdAt: new Date().toISOString(),
  };
  return { ...rec, wheels: { ...w, builds: [...w.builds, build] } };
}

export function removeBuild(rec: VehicleRecord, buildId: string): VehicleRecord {
  const w = wheelsOf(rec);
  return { ...rec, wheels: { ...w, builds: w.builds.filter((b) => b.id !== buildId) } };
}

/** True when there is enough to render: a calibrated photo and a fitted size. */
export function canVisualize(rec: VehicleRecord): boolean {
  const photo = wheelsOf(rec).photo;
  return !!photo && photo.calibration.pixelsPerInch > 0 && !!parseTireSize(photo.fittedTireSize);
}

/**
 * Sizes worth suggesting alongside a fitted size: the same tire a wheel size up
 * and down, keeping overall diameter as close as possible. This is the "what
 * should I shop for" shortcut — plus-one and minus-one are what people actually
 * consider.
 */
export function suggestedSizes(fitted: string): string[] {
  const size = parseTireSize(fitted);
  if (!size || size.kind !== 'metric') return [];
  const out: string[] = [];
  for (const step of [-1, 1]) {
    const rim = size.rimDiameterIn + step;
    if (rim < 10 || rim > 30) continue;
    // Each inch of rim adds 25.4mm of diameter, which must come out of two
    // sidewalls — so the aspect ratio moves by 25.4 / 2 / sectionWidth.
    const aspectShift = (25.4 / 2 / size.sectionWidthMm) * 100;
    const aspect = Math.round((size.aspectRatio - step * aspectShift) / 5) * 5;
    if (aspect < 25 || aspect > 85) continue;
    out.push(`${size.sectionWidthMm}/${aspect}R${rim}`);
  }
  return out;
}

/** The dimension a stepper adjusts. */
export type SizeField = 'width' | 'aspect' | 'rim';

/**
 * Step one dimension of a metric size by the increment the industry actually
 * sells: widths in 10mm, aspect ratios in 5, wheels in whole inches. Clamped to
 * the plausible range rather than allowed to run off into nonsense.
 *
 * When `current` is unreadable (or empty), stepping starts from `fallback` —
 * so the first tap on a stepper turns the fitted size into the working size
 * instead of doing nothing.
 *
 * Returns null when there is nothing to step: no readable base, a flotation
 * size (whose dimensions do not move in these increments), or a step that
 * would leave the plausible range.
 */
export function stepTireSize(
  current: string,
  field: SizeField,
  direction: 1 | -1,
  fallback?: string,
): string | null {
  const base = parseTireSize(current) ?? (fallback ? parseTireSize(fallback) : null);
  if (!base || base.kind !== 'metric') return null;

  let { sectionWidthMm, aspectRatio, rimDiameterIn } = base;
  if (field === 'width') sectionWidthMm += 10 * direction;
  if (field === 'aspect') aspectRatio += 5 * direction;
  if (field === 'rim') rimDiameterIn += 1 * direction;

  if (sectionWidthMm < 105 || sectionWidthMm > 405) return null;
  if (aspectRatio < 20 || aspectRatio > 85) return null;
  if (rimDiameterIn < 10 || rimDiameterIn > 30) return null;

  // Plain string rather than formatTireSize: steppers describe a size being
  // browsed, so carrying over the base size's load/speed markings would claim
  // ratings the new size was never checked against.
  return `${sectionWidthMm}/${aspectRatio}R${rimDiameterIn}`;
}
