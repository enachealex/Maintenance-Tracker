import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppData, VehicleRecord } from './types';

const KEY = 'maintenance-tracker/v1';
const SCHEMA_VERSION = 2;

export const DEFAULT_DATA: AppData = {
  vehicles: [],
  reminderHour: 9,
  schemaVersion: SCHEMA_VERSION,
};

export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function newVehicleRecord(fields: Partial<VehicleRecord> & Pick<VehicleRecord, 'vehicle'>): VehicleRecord {
  return {
    id: genId(),
    currentMileage: 0,
    mileageUpdatedAt: null,
    tasks: {},
    mileageCadence: 'monthly',
    mileageCustomDays: 30,
    customItems: [],
    createdAt: new Date().toISOString(),
    ...fields,
  };
}

/**
 * Read + migrate persisted data. The v1 shape held a single vehicle at the
 * top level; v2 holds a `vehicles` array. Existing users are migrated so
 * they don't lose the car they set up.
 */
function migrate(parsed: any): AppData {
  if (Array.isArray(parsed?.vehicles)) {
    return {
      ...DEFAULT_DATA,
      ...parsed,
      // vehicles saved before customItems existed need the default filled in
      vehicles: parsed.vehicles.map((v: any) => ({ customItems: [], ...v })),
      schemaVersion: SCHEMA_VERSION,
    };
  }
  const vehicles: VehicleRecord[] = [];
  if (parsed?.vehicle && parsed?.onboarded) {
    vehicles.push(
      newVehicleRecord({
        vehicle: parsed.vehicle,
        currentMileage: parsed.currentMileage ?? 0,
        mileageUpdatedAt: parsed.mileageUpdatedAt ?? null,
        tasks: parsed.tasks ?? {},
      }),
    );
  }
  return { vehicles, reminderHour: parsed?.reminderHour ?? 9, schemaVersion: SCHEMA_VERSION };
}

export async function loadData(): Promise<AppData> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_DATA };
    return migrate(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_DATA };
  }
}

export async function saveData(data: AppData): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}

export async function resetData(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
