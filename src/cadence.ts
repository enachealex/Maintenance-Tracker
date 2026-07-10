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

/** Days between reminders for any cadence value. */
export function daysForCadence(cadence: MileageCadence, customDays: number): number {
  if (cadence === 'custom') return Math.max(1, customDays || 30);
  return FIXED_DAYS[cadence];
}

export function labelForCadence(cadence: MileageCadence, customDays: number): string {
  if (cadence === 'custom') {
    const d = daysForCadence(cadence, customDays);
    return d === 1 ? 'every day' : `every ${d} days`;
  }
  return CADENCE_OPTIONS.find((o) => o.key === cadence)!.label.toLowerCase();
}

/** Days between mileage-update prompts for a vehicle. */
export function cadenceDays(rec: VehicleRecord): number {
  return daysForCadence(rec.mileageCadence, rec.mileageCustomDays);
}

/** Days between "maintenance due" reminders for a vehicle. */
export function maintenanceCadenceDays(rec: VehicleRecord): number {
  return daysForCadence(rec.maintenanceCadence ?? 'weekly', rec.maintenanceCustomDays ?? 7);
}

export function cadenceLabel(rec: VehicleRecord): string {
  return labelForCadence(rec.mileageCadence, rec.mileageCustomDays);
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
