import { SCHEDULE } from './data/schedule';
import { AppData, ComputedTask, TaskState, TaskStatus } from './types';

/** A task counts as "due soon" within this many miles of its due point. */
const DUE_SOON_MILES = 500;

const emptyState = (): TaskState => ({
  lastDoneMileage: null,
  lastDoneDate: null,
  history: [],
});

export function getTaskState(data: AppData, itemId: string): TaskState {
  return data.tasks[itemId] ?? emptyState();
}

/**
 * Compute the status of every schedule item for the current mileage.
 * If a task has never been recorded, it is treated as if last done at
 * mileage 0 — i.e. everything that should have happened by now shows as due.
 */
export function computeTasks(data: AppData): ComputedTask[] {
  const mileage = data.currentMileage;
  return SCHEDULE.map((item) => {
    const state = getTaskState(data, item.id);
    const lastDone = state.lastDoneMileage ?? 0;
    const nextDueMileage = lastDone + item.intervalMiles;
    const milesOverdue = mileage - nextDueMileage;
    let status: TaskStatus = 'ok';
    if (milesOverdue >= 0) status = 'overdue';
    else if (milesOverdue >= -DUE_SOON_MILES) status = 'due-soon';
    return { item, state, status, nextDueMileage, milesOverdue };
  }).sort((a, b) => b.milesOverdue - a.milesOverdue);
}

export function dueTasks(data: AppData): ComputedTask[] {
  return computeTasks(data).filter((t) => t.status !== 'ok');
}

/** Record a completed service at the given mileage. */
export function completeTask(data: AppData, itemId: string, mileage: number): AppData {
  const prev = getTaskState(data, itemId);
  const entry = { mileage, date: new Date().toISOString() };
  return {
    ...data,
    tasks: {
      ...data.tasks,
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
  data: AppData,
  itemId: string,
  lastDoneMileage: number | null,
): AppData {
  const prev = getTaskState(data, itemId);
  return {
    ...data,
    tasks: {
      ...data.tasks,
      [itemId]: { ...prev, lastDoneMileage, lastDoneDate: null },
    },
  };
}

export const fmtMiles = (n: number) => `${Math.round(n).toLocaleString()} mi`;
