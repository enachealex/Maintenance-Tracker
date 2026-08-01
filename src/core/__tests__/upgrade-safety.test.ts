import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadData, saveData } from '../storage';
import { AppData, VehicleRecord } from '../types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/**
 * Upgrade safety: an existing user must not lose data when the app updates.
 *
 * These tests exist to fail loudly if a future change breaks that. The storage
 * key is written as a literal on purpose — if someone renames the constant in
 * storage.ts, every existing install silently starts from an empty garage, and
 * this suite is what catches it.
 */
const STORAGE_KEY = 'maintenance-tracker/v1';

/** A record with every field populated, including history and custom items. */
function fullRecord(): VehicleRecord {
  return {
    id: 'veh-1',
    vehicle: {
      year: 2019,
      make: 'Ford',
      model: 'Mustang',
      trim: 'GT Premium',
      engine: '5.0L 8-cyl',
    },
    currentMileage: 48_250,
    mileageUpdatedAt: '2026-07-01T12:00:00.000Z',
    tasks: {
      'oil-change': {
        lastDoneMileage: 45_000,
        lastDoneDate: '2026-05-02T00:00:00.000Z',
        history: [
          { mileage: 40_000, date: '2026-01-10T00:00:00.000Z' },
          { mileage: 45_000, date: '2026-05-02T00:00:00.000Z' },
        ],
      },
      'custom-brakes': {
        lastDoneMileage: 30_000,
        lastDoneDate: '2025-09-09T00:00:00.000Z',
        history: [{ mileage: 30_000, date: '2025-09-09T00:00:00.000Z' }],
      },
    },
    mileageCadence: 'biweekly',
    mileageCustomDays: 14,
    maintenanceCadence: 'custom',
    maintenanceCustomDays: 21,
    customItems: [
      {
        id: 'custom-brakes',
        name: 'Brake fluid',
        description: 'Flush and replace',
        intervalMiles: 30_000,
        intervalMonths: 24,
        icon: '🛑',
      },
    ],
    oilType: 'full-synthetic',
    createdAt: '2025-01-01T00:00:00.000Z',
  };
}

const fullData: AppData = {
  vehicles: [fullRecord()],
  reminderHour: 7,
  schemaVersion: 2,
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('storage key', () => {
  it('reads data written under the documented key', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fullData));
    const loaded = await loadData();
    expect(loaded.vehicles).toHaveLength(1);
    expect(loaded.vehicles[0].id).toBe('veh-1');
  });

  it('writes back to that same key', async () => {
    await saveData(fullData);
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).vehicles[0].id).toBe('veh-1');
  });
});

describe('existing data survives an app update', () => {
  it('preserves a fully populated record field for field', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fullData));
    const loaded = await loadData();
    expect(loaded).toEqual(fullData);
  });

  it('keeps task history, custom items, and cadences intact', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fullData));
    const rec = (await loadData()).vehicles[0];
    expect(rec.tasks['oil-change'].history).toHaveLength(2);
    expect(rec.tasks['custom-brakes'].lastDoneMileage).toBe(30_000);
    expect(rec.customItems).toHaveLength(1);
    expect(rec.customItems[0].name).toBe('Brake fluid');
    expect(rec.maintenanceCadence).toBe('custom');
    expect(rec.maintenanceCustomDays).toBe(21);
    expect(rec.oilType).toBe('full-synthetic');
    expect(rec.createdAt).toBe('2025-01-01T00:00:00.000Z');
  });

  /**
   * App.tsx persists immediately after loading, to lock in any migration. That
   * makes a lossy migrate() destructive on the very first launch of an update:
   * whatever it drops is gone for good. This is the guarantee that matters most.
   */
  it('is not destructive when the app saves straight back after loading', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fullData));
    const first = await loadData();
    await saveData(first);
    const second = await loadData();
    expect(second).toEqual(fullData);
  });

  it('stays stable across repeated update cycles', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fullData));
    let data = await loadData();
    for (let i = 0; i < 3; i++) {
      await saveData(data);
      data = await loadData();
    }
    expect(data).toEqual(fullData);
  });

  it('does not drop fields written by a newer version of the app', async () => {
    const fromFuture = {
      ...fullData,
      someFutureTopLevelField: 'keep me',
      vehicles: [{ ...fullRecord(), someFutureVehicleField: 'keep me too' }],
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fromFuture));
    const loaded: any = await loadData();
    expect(loaded.someFutureTopLevelField).toBe('keep me');
    expect(loaded.vehicles[0].someFutureVehicleField).toBe('keep me too');
  });
});

describe('older installs still upgrade', () => {
  it('migrates the v1 single-vehicle shape without losing the car', async () => {
    const v1 = {
      onboarded: true,
      vehicle: fullRecord().vehicle,
      currentMileage: 55_000,
      mileageUpdatedAt: '2026-01-01T00:00:00.000Z',
      tasks: { 'oil-change': { lastDoneMileage: 50_000, lastDoneDate: null, history: [] } },
      reminderHour: 8,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(v1));
    const loaded = await loadData();
    expect(loaded.vehicles).toHaveLength(1);
    expect(loaded.vehicles[0].currentMileage).toBe(55_000);
    expect(loaded.vehicles[0].tasks['oil-change'].lastDoneMileage).toBe(50_000);
    expect(loaded.reminderHour).toBe(8);
    expect(loaded.schemaVersion).toBe(2);
  });

  it('backfills fields added after a vehicle was first saved', async () => {
    const beforeNewFields = {
      vehicles: [
        {
          id: 'old-1',
          vehicle: fullRecord().vehicle,
          currentMileage: 10_000,
          mileageUpdatedAt: null,
          tasks: {},
          mileageCadence: 'monthly',
          mileageCustomDays: 30,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      reminderHour: 9,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(beforeNewFields));
    const rec = (await loadData()).vehicles[0];
    expect(rec.oilType).toBe('synthetic-blend');
    expect(rec.maintenanceCadence).toBe('weekly');
    expect(rec.maintenanceCustomDays).toBe(7);
    expect(rec.customItems).toEqual([]);
    // Values the user already had must win over the backfilled defaults.
    expect(rec.currentMileage).toBe(10_000);
    expect(rec.mileageCadence).toBe('monthly');
    expect(rec.createdAt).toBe('2024-01-01T00:00:00.000Z');
  });

  it('returns an empty garage rather than throwing on corrupt data', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, '{ not valid json');
    const loaded = await loadData();
    expect(loaded.vehicles).toEqual([]);
    expect(loaded.schemaVersion).toBe(2);
  });

  it('starts empty on a fresh install', async () => {
    const loaded = await loadData();
    expect(loaded.vehicles).toEqual([]);
    expect(loaded.reminderHour).toBe(9);
  });
});

describe('the Phase 1 shell did not change the persisted shape', () => {
  it('writes only the three known top-level keys', async () => {
    await saveData(fullData);
    const raw = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY))!);
    expect(Object.keys(raw).sort()).toEqual(['reminderHour', 'schemaVersion', 'vehicles']);
  });

  it('still declares schema version 2 — the tabs added no new persisted state', async () => {
    await saveData(fullData);
    const raw = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY))!);
    expect(raw.schemaVersion).toBe(2);
  });
});
