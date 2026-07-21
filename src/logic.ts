import { SCHEDULE } from './data/schedule';
import { genId } from './storage';
import { ComputedTask, OilType, ScheduleItem, TaskState, TaskStatus, VehicleRecord } from './types';

/** Oil-change interval by oil type. Synthetic Blend is the pre-oilType default. */
export const OIL_TYPES: Record<OilType, { label: string; intervalMiles: number }> = {
  'synthetic-blend': { label: 'Synthetic Blend', intervalMiles: 5000 },
  'full-synthetic': { label: 'Full Synthetic', intervalMiles: 10000 },
};

export const DEFAULT_OIL_TYPE: OilType = 'synthetic-blend';

export const oilTypeOf = (rec: VehicleRecord): OilType => rec.oilType ?? DEFAULT_OIL_TYPE;

/** A task counts as "due soon" within this many miles of its due point. */
const DUE_SOON_MILES = 500;
/** …or within this many days of its time-based due point. */
const DUE_SOON_DAYS = 14;
const DAY_MS = 86_400_000;
const MONTH_MS = 30.44 * DAY_MS; // average month

const emptyState = (): TaskState => ({
  lastDoneMileage: null,
  lastDoneDate: null,
  history: [],
});

export function getTaskState(rec: VehicleRecord, itemId: string): TaskState {
  return rec.tasks[itemId] ?? emptyState();
}

/** The standard schedule with the oil-change interval (and name) set by oil type. */
export function scheduleFor(oilType: OilType): ScheduleItem[] {
  return SCHEDULE.map((item) => {
    if (item.id !== 'oil-change') return item;
    const oil = OIL_TYPES[oilType];
    return { ...item, name: `${item.name} (${oil.label})`, intervalMiles: oil.intervalMiles };
  });
}

/** Standard schedule (adjusted for oil type) plus the vehicle's custom items. */
export function itemsFor(rec: VehicleRecord): ScheduleItem[] {
  return [...scheduleFor(oilTypeOf(rec)), ...(rec.customItems ?? [])];
}

/**
 * Compute the status of every schedule item for the vehicle's current mileage.
 * If a task has never been recorded, it is treated as if last done at
 * mileage 0 — i.e. everything that should have happened by now shows as due.
 *
 * Tasks come due by miles OR months, whichever hits first, so low-mileage
 * cars still get time-based reminders (oil ages even when the car sits).
 * The time dimension needs a real last-done date; questionnaire estimates
 * carry no date, so those stay miles-only until the first real check-off.
 */
export function computeTasks(rec: VehicleRecord, now = Date.now()): ComputedTask[] {
  const mileage = rec.currentMileage;
  const severity = (t: ComputedTask) => (t.status === 'overdue' ? 2 : t.status === 'due-soon' ? 1 : 0);
  return itemsFor(rec)
    .map((item) => {
      const state = getTaskState(rec, item.id);
      const lastDone = state.lastDoneMileage ?? 0;
      const nextDueMileage = lastDone + item.intervalMiles;
      const milesOverdue = mileage - nextDueMileage;

      let daysOverdue: number | null = null;
      if (item.intervalMonths && state.lastDoneDate) {
        const dueAt = Date.parse(state.lastDoneDate) + item.intervalMonths * MONTH_MS;
        daysOverdue = Math.floor((now - dueAt) / DAY_MS);
      }

      let status: TaskStatus = 'ok';
      if (milesOverdue >= 0 || (daysOverdue != null && daysOverdue >= 0)) status = 'overdue';
      else if (
        milesOverdue >= -DUE_SOON_MILES ||
        (daysOverdue != null && daysOverdue >= -DUE_SOON_DAYS)
      )
        status = 'due-soon';
      return { item, state, status, nextDueMileage, milesOverdue, daysOverdue };
    })
    .sort((a, b) => severity(b) - severity(a) || b.milesOverdue - a.milesOverdue);
}

const fmtDays = (d: number) =>
  d >= 60 ? `${Math.round(d / 30.44)} months` : `${d} day${d === 1 ? '' : 's'}`;

/**
 * Human description of a task's urgency, shared by the dashboard badge and
 * reminder notifications: "1,500 mi overdue", "3 months overdue",
 * "due in 300 mi", "due in 5 days", "due today", "due at 60,000 mi".
 */
export function dueDescription(t: ComputedTask): string {
  if (t.milesOverdue >= 0) return `${fmtMiles(t.milesOverdue)} overdue`;
  if (t.daysOverdue != null && t.daysOverdue >= 0) {
    return t.daysOverdue === 0 ? 'due today' : `${fmtDays(t.daysOverdue)} overdue`;
  }
  if (t.status === 'due-soon') {
    if (t.milesOverdue >= -DUE_SOON_MILES) return `due in ${fmtMiles(-t.milesOverdue)}`;
    return `due in ${fmtDays(-t.daysOverdue!)}`;
  }
  return `due at ${fmtMiles(t.nextDueMileage)}`;
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

/**
 * Correct a task's last-done mileage (null = mark as never done / no record).
 * When the latest history entry recorded the value being corrected, it is
 * fixed too, so a mistaken check-off doesn't leave a wrong entry behind.
 */
export function editLastDoneMileage(
  rec: VehicleRecord,
  itemId: string,
  mileage: number | null,
): VehicleRecord {
  const prev = getTaskState(rec, itemId);
  const history = [...prev.history];
  const last = history[history.length - 1];
  if (mileage != null && last && last.mileage === prev.lastDoneMileage) {
    history[history.length - 1] = { ...last, mileage };
  }
  return {
    ...rec,
    tasks: {
      ...rec.tasks,
      [itemId]: {
        ...prev,
        lastDoneMileage: mileage,
        lastDoneDate: mileage == null ? null : prev.lastDoneDate,
        history,
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

/**
 * Add a user-defined maintenance item. `milesAgo` seeds when it was last
 * done; null means never/unknown (due once the odometer passes the interval).
 */
export function addCustomItem(
  rec: VehicleRecord,
  fields: { name: string; intervalMiles: number; milesAgo: number | null },
): VehicleRecord {
  const item: ScheduleItem = {
    id: `custom-${genId()}`,
    name: fields.name,
    description: 'Custom maintenance item',
    intervalMiles: fields.intervalMiles,
    icon: '🔧',
  };
  const next = { ...rec, customItems: [...(rec.customItems ?? []), item] };
  if (fields.milesAgo == null) return next;
  return setLastDone(next, item.id, Math.max(0, rec.currentMileage - fields.milesAgo));
}

/** Remove a custom item along with its service history. */
export function removeCustomItem(rec: VehicleRecord, itemId: string): VehicleRecord {
  const { [itemId]: _dropped, ...tasks } = rec.tasks;
  return {
    ...rec,
    customItems: (rec.customItems ?? []).filter((i) => i.id !== itemId),
    tasks,
  };
}

export const isCustomItem = (itemId: string) => itemId.startsWith('custom-');

export const fmtMiles = (n: number) => `${Math.round(n).toLocaleString()} mi`;

export const vehicleName = (rec: VehicleRecord) =>
  `${rec.vehicle.year} ${rec.vehicle.make} ${rec.vehicle.model}`;
