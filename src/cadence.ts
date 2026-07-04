import { MileageCadence, VehicleRecord } from './types';

export const CADENCE_OPTIONS: { key: MileageCadence; label: string }[] = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'biweekly', label: 'Bi-weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'custom', label: 'Custom' },
];

const FIXED_DAYS: Record<Exclude<MileageCadence, 'custom'>, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

/** Number of days between mileage-update prompts for a vehicle. */
export function cadenceDays(rec: VehicleRecord): number {
  if (rec.mileageCadence === 'custom') return Math.max(1, rec.mileageCustomDays || 30);
  return FIXED_DAYS[rec.mileageCadence];
}

export function cadenceLabel(rec: VehicleRecord): string {
  if (rec.mileageCadence === 'custom') {
    const d = cadenceDays(rec);
    return d === 1 ? 'every day' : `every ${d} days`;
  }
  return CADENCE_OPTIONS.find((o) => o.key === rec.mileageCadence)!.label.toLowerCase();
}

export function daysSinceMileageUpdate(rec: VehicleRecord, now = Date.now()): number {
  if (!rec.mileageUpdatedAt) return 0;
  return Math.floor((now - new Date(rec.mileageUpdatedAt).getTime()) / 86_400_000);
}

/** True when the odometer reading is older than the vehicle's chosen cadence. */
export function isMileageStale(rec: VehicleRecord, now = Date.now()): boolean {
  if (!rec.mileageUpdatedAt) return false;
  return daysSinceMileageUpdate(rec, now) >= cadenceDays(rec);
}
