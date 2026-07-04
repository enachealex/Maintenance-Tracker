import { SCHEDULE } from './data/schedule';
import { ComputedTask, TaskState, TaskStatus, VehicleRecord } from './types';

/** A task counts as "due soon" within this many miles of its due point. */
const DUE_SOON_MILES = 500;

const emptyState = (): TaskState => ({
  lastDoneMileage: null,
  lastDoneDate: null,
  history: [],
});

export function getTaskState(rec: VehicleRecord, itemId: string): TaskState {
  return rec.tasks[itemId] ?? emptyState();
}

/**
 * Compute the status of every schedule item for the vehicle's current mileage.
 * If a task has never been recorded, it is treated as if last done at
 * mileage 0 — i.e. everything that should have happened by now shows as due.
 */
export function computeTasks(rec: VehicleRecord): ComputedTask[] {
  const mileage = rec.currentMileage;
  return SCHEDULE.map((item) => {
    const state = getTaskState(rec, item.id);
    const lastDone = state.lastDoneMileage ?? 0;
    const nextDueMileage = lastDone + item.intervalMiles;
    const milesOverdue = mileage - nextDueMileage;
    let status: TaskStatus = 'ok';
    if (milesOverdue >= 0) status = 'overdue';
    else if (milesOverdue >= -DUE_SOON_MILES) status = 'due-soon';
    return { item, state, status, nextDueMileage, milesOverdue };
  }).sort((a, b) => b.milesOverdue - a.milesOverdue);
}

export function dueTasks(rec: VehicleRecord): ComputedTask[] {
  return computeTasks(rec).filter((t) => t.status !== 'ok');
}

/** Count of maintenance items that need attention — drives the home badge. */
export function dueCount(rec: VehicleRecord): number {
  return dueTasks(rec).length;
}

/** Record a completed service at the given mileage. */
export function completeTask(rec: VehicleRecord, itemId: string, mileage: number): VehicleRecord {
  const prev = getTaskState(rec, itemId);
  const entry = { mileage, date: new Date().toISOString() };
  return {
    ...rec,
    tasks: {
      ...rec.tasks,
      [itemId]: {
        lastDoneMileage: mileage,
        lastDoneDate: entry.date,
        history: [...prev.history, entry],
      },
    },
  };
}

/** Set when a task was last done (used by the onboarding questionnaire). */
export function setLastDone(
  rec: VehicleRecord,
  itemId: string,
  lastDoneMileage: number | null,
): VehicleRecord {
  const prev = getTaskState(rec, itemId);
  return {
    ...rec,
    tasks: {
      ...rec.tasks,
      [itemId]: { ...prev, lastDoneMileage, lastDoneDate: null },
    },
  };
}

export const fmtMiles = (n: number) => `${Math.round(n).toLocaleString()} mi`;

export const vehicleName = (rec: VehicleRecord) =>
  `${rec.vehicle.year} ${rec.vehicle.make} ${rec.vehicle.model}`;
