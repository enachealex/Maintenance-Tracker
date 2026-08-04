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
