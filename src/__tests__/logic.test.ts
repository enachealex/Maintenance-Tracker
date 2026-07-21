import {
  addCustomItem,
  completeTask,
  computeTasks,
  dueCount,
  dueDescription,
  editLastDoneMileage,
  removeCustomItem,
  scheduleFor,
  setLastDone,
} from '../logic';
import { newVehicleRecord } from '../storage';
import { Vehicle, VehicleRecord } from '../types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const DAY_MS = 86_400_000;
const MONTH_MS = 30.44 * DAY_MS;
const NOW = Date.parse('2026-07-20T12:00:00Z');

const vehicle: Vehicle = {
  year: 2021,
  make: 'Toyota',
  model: 'Camry',
  trim: 'LE',
  engine: '2.5L 4-cyl',
};

const makeRec = (fields: Partial<VehicleRecord> = {}): VehicleRecord =>
  newVehicleRecord({ vehicle, currentMileage: 42_000, ...fields });

const taskFor = (rec: VehicleRecord, itemId: string) =>
  computeTasks(rec, NOW).find((t) => t.item.id === itemId)!;

describe('scheduleFor', () => {
  it('uses 5,000 mi for Synthetic Blend and 10,000 mi for Full Synthetic', () => {
    const blendOil = scheduleFor('synthetic-blend').find((i) => i.id === 'oil-change')!;
    const fullOil = scheduleFor('full-synthetic').find((i) => i.id === 'oil-change')!;
    expect(blendOil.intervalMiles).toBe(5000);
    expect(blendOil.name).toContain('Synthetic Blend');
    expect(fullOil.intervalMiles).toBe(10_000);
    expect(fullOil.name).toContain('Full Synthetic');
  });

  it('leaves every other item untouched', () => {
    const tire = scheduleFor('full-synthetic').find((i) => i.id === 'tire-rotation')!;
    expect(tire.intervalMiles).toBe(5000);
  });
});

describe('computeTasks — mileage dimension', () => {
  it('treats never-recorded tasks as last done at mile 0', () => {
    const t = taskFor(makeRec(), 'oil-change');
    expect(t.status).toBe('overdue');
    expect(t.milesOverdue).toBe(42_000 - 5000);
  });

  it('is ok after a recent service and due-soon within 500 mi of the due point', () => {
    let rec = makeRec();
    rec = setLastDone(rec, 'oil-change', 41_800); // due at 46,800
    expect(taskFor(rec, 'oil-change').status).toBe('ok');

    rec = setLastDone(rec, 'oil-change', 37_400); // due at 42,400 → 400 mi away
    expect(taskFor(rec, 'oil-change').status).toBe('due-soon');
  });

  it('respects the vehicle oil type when computing the oil due point', () => {
    let rec = makeRec({ oilType: 'full-synthetic' });
    rec = setLastDone(rec, 'oil-change', 36_000); // +10k → due at 46,000
    const t = taskFor(rec, 'oil-change');
    expect(t.status).toBe('ok');
    expect(t.nextDueMileage).toBe(46_000);
  });

  it('sorts overdue tasks ahead of ok tasks', () => {
    let rec = makeRec();
    rec = setLastDone(rec, 'oil-change', 42_000);
    const tasks = computeTasks(rec, NOW);
    const firstOk = tasks.findIndex((t) => t.status === 'ok');
    const lastOverdue = tasks.map((t) => t.status).lastIndexOf('overdue');
    expect(lastOverdue).toBeLessThan(firstOk);
  });
});

describe('computeTasks — time dimension', () => {
  it('marks a task overdue by time even when fine by miles', () => {
    let rec = makeRec();
    rec = completeTask(rec, 'oil-change', 40_000); // 2,000 mi ago — fine by miles
    rec.tasks['oil-change'].lastDoneDate = new Date(NOW - 8 * MONTH_MS).toISOString(); // 6-mo interval
    const t = taskFor(rec, 'oil-change');
    expect(t.status).toBe('overdue');
    expect(t.milesOverdue).toBeLessThan(0);
    expect(t.daysOverdue).toBe(Math.floor(2 * 30.44));
  });

  it('goes due-soon within 14 days of the time due point', () => {
    let rec = makeRec();
    rec = completeTask(rec, 'oil-change', 41_900);
    rec.tasks['oil-change'].lastDoneDate = new Date(NOW - 6 * MONTH_MS + 10 * DAY_MS).toISOString();
    expect(taskFor(rec, 'oil-change').status).toBe('due-soon');
  });

  it('stays miles-only when the last-done date is unknown (questionnaire seeds)', () => {
    let rec = makeRec();
    rec = setLastDone(rec, 'oil-change', 40_000); // sets no date
    const t = taskFor(rec, 'oil-change');
    expect(t.daysOverdue).toBeNull();
    expect(t.status).toBe('ok');
  });
});

describe('dueDescription', () => {
  it('prefers miles when overdue by miles', () => {
    const t = taskFor(makeRec(), 'oil-change');
    expect(dueDescription(t)).toBe('37,000 mi overdue');
  });

  it('describes time-based urgency in days or months', () => {
    let rec = makeRec();
    rec = completeTask(rec, 'oil-change', 40_000);
    rec.tasks['oil-change'].lastDoneDate = new Date(NOW - 8 * MONTH_MS).toISOString();
    expect(dueDescription(taskFor(rec, 'oil-change'))).toBe('2 months overdue');

    rec.tasks['oil-change'].lastDoneDate = new Date(NOW - 6 * MONTH_MS).toISOString();
    expect(dueDescription(taskFor(rec, 'oil-change'))).toBe('due today');

    rec.tasks['oil-change'].lastDoneDate = new Date(NOW - 6 * MONTH_MS + 5 * DAY_MS).toISOString();
    expect(dueDescription(taskFor(rec, 'oil-change'))).toBe('due in 5 days');
  });

  it('falls back to the mileage due point when nothing is close', () => {
    let rec = makeRec();
    rec = setLastDone(rec, 'oil-change', 42_000);
    expect(dueDescription(taskFor(rec, 'oil-change'))).toBe('due at 47,000 mi');
  });
});

describe('recording services', () => {
  it('completeTask stamps mileage, date, and history', () => {
    const rec = completeTask(makeRec(), 'oil-change', 42_000);
    const state = rec.tasks['oil-change'];
    expect(state.lastDoneMileage).toBe(42_000);
    expect(state.lastDoneDate).toBeTruthy();
    expect(state.history).toHaveLength(1);
    expect(state.history[0].mileage).toBe(42_000);
  });

  it('editLastDoneMileage corrects the value and the matching history entry', () => {
    let rec = completeTask(makeRec(), 'oil-change', 42_000);
    rec = editLastDoneMileage(rec, 'oil-change', 39_500);
    const state = rec.tasks['oil-change'];
    expect(state.lastDoneMileage).toBe(39_500);
    expect(state.history[state.history.length - 1].mileage).toBe(39_500);
    expect(state.lastDoneDate).toBeTruthy(); // date survives a correction
  });

  it('editLastDoneMileage with null clears the record', () => {
    let rec = completeTask(makeRec(), 'oil-change', 42_000);
    rec = editLastDoneMileage(rec, 'oil-change', null);
    expect(rec.tasks['oil-change'].lastDoneMileage).toBeNull();
    expect(rec.tasks['oil-change'].lastDoneDate).toBeNull();
  });
});

describe('custom items', () => {
  it('adds a custom item seeded from miles-ago and counts it as due when elapsed', () => {
    let rec = makeRec();
    rec = addCustomItem(rec, { name: 'Fuel filter', intervalMiles: 30_000, milesAgo: 35_000 });
    const item = rec.customItems[0];
    expect(rec.tasks[item.id].lastDoneMileage).toBe(7000); // clamped to ≥ 0 baseline
    expect(taskFor(rec, item.id).status).toBe('overdue');
  });

  it('removeCustomItem drops the item and its task state', () => {
    let rec = makeRec();
    rec = addCustomItem(rec, { name: 'Fuel filter', intervalMiles: 30_000, milesAgo: null });
    const id = rec.customItems[0].id;
    rec = removeCustomItem(rec, id);
    expect(rec.customItems).toHaveLength(0);
    expect(rec.tasks[id]).toBeUndefined();
  });
});

describe('dueCount', () => {
  it('counts overdue and due-soon items', () => {
    let rec = makeRec({ currentMileage: 1000 });
    expect(dueCount(rec)).toBe(0); // young car, nothing elapsed
    rec = { ...rec, currentMileage: 42_000 };
    expect(dueCount(rec)).toBeGreaterThan(0);
  });
});
