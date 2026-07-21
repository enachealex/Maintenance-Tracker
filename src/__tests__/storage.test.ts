import { newVehicleRecord, parseBackup } from '../storage';
import { Vehicle } from '../types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const vehicle: Vehicle = {
  year: 2020,
  make: 'Honda',
  model: 'Civic',
  trim: 'Sport',
  engine: '2.0L 4-cyl',
};

describe('newVehicleRecord', () => {
  it('fills defaults, including Synthetic Blend oil', () => {
    const rec = newVehicleRecord({ vehicle });
    expect(rec.oilType).toBe('synthetic-blend');
    expect(rec.mileageCadence).toBe('monthly');
    expect(rec.maintenanceCadence).toBe('weekly');
    expect(rec.customItems).toEqual([]);
    expect(rec.id).toBeTruthy();
  });
});

describe('parseBackup', () => {
  it('round-trips current-shape data', () => {
    const rec = newVehicleRecord({ vehicle, currentMileage: 30_000 });
    const raw = JSON.stringify({ vehicles: [rec], reminderHour: 9, schemaVersion: 2 });
    const parsed = parseBackup(raw)!;
    expect(parsed.vehicles).toHaveLength(1);
    expect(parsed.vehicles[0].vehicle.make).toBe('Honda');
    expect(parsed.vehicles[0].currentMileage).toBe(30_000);
  });

  it('fills new defaults into vehicles saved before those fields existed', () => {
    const old = { id: 'v1', vehicle, currentMileage: 10_000, tasks: {} };
    const parsed = parseBackup(JSON.stringify({ vehicles: [old], reminderHour: 9 }))!;
    expect(parsed.vehicles[0].oilType).toBe('synthetic-blend');
    expect(parsed.vehicles[0].maintenanceCadence).toBe('weekly');
    expect(parsed.vehicles[0].customItems).toEqual([]);
  });

  it('migrates the v1 single-vehicle shape', () => {
    const v1 = {
      onboarded: true,
      vehicle,
      currentMileage: 55_000,
      mileageUpdatedAt: '2026-01-01T00:00:00.000Z',
      tasks: {},
      reminderHour: 8,
    };
    const parsed = parseBackup(JSON.stringify(v1))!;
    expect(parsed.vehicles).toHaveLength(1);
    expect(parsed.vehicles[0].currentMileage).toBe(55_000);
    expect(parsed.reminderHour).toBe(8);
  });

  it('drops malformed vehicle entries instead of rejecting the file', () => {
    const good = newVehicleRecord({ vehicle });
    const raw = JSON.stringify({ vehicles: [good, null, { id: 42 }, { id: 'x' }], reminderHour: 9 });
    const parsed = parseBackup(raw)!;
    expect(parsed.vehicles).toHaveLength(1);
  });

  it('rejects non-backup JSON and non-JSON', () => {
    expect(parseBackup('{"totally":"unrelated"}')).toBeNull();
    expect(parseBackup('not json at all')).toBeNull();
    expect(parseBackup('[]')).toBeNull();
  });
});
