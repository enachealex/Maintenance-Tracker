export interface Vehicle {
  year: number;
  make: string;
  model: string;
  trim: string; // sub-model, e.g. "GT Premium"
  engine: string; // e.g. "5.0L V8 (Gas)"
}

export interface ScheduleItem {
  id: string;
  name: string;
  description: string;
  intervalMiles: number;
  intervalMonths?: number; // informational
  icon: string; // emoji
}

export interface TaskState {
  /** Odometer reading when this task was last performed. null = unknown/never */
  lastDoneMileage: number | null;
  lastDoneDate: string | null; // ISO date
  history: { mileage: number; date: string }[];
}

/** Reminder frequency (used for both mileage prompts and maintenance reminders). */
export type MileageCadence = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';

/** Engine oil type — determines the oil-change interval. */
export type OilType = 'synthetic-blend' | 'full-synthetic';

/** One saved vehicle plus everything tracked about it. */
export interface VehicleRecord {
  id: string;
  vehicle: Vehicle;
  currentMileage: number;
  mileageUpdatedAt: string | null;
  tasks: Record<string, TaskState>;
  mileageCadence: MileageCadence;
  /** Days between mileage prompts when cadence === 'custom'. */
  mileageCustomDays: number;
  /** How often to re-remind about maintenance that's due. */
  maintenanceCadence: MileageCadence;
  maintenanceCustomDays: number;
  /** User-defined maintenance items, tracked alongside the standard schedule. */
  customItems: ScheduleItem[];
  /** Oil type; optional because it was added after launch (default synthetic-blend). */
  oilType?: OilType;
  createdAt: string;
}

export interface AppData {
  vehicles: VehicleRecord[];
  reminderHour: number; // hour of day for scheduled reminders (default 9)
  schemaVersion: number;
}

export type TaskStatus = 'overdue' | 'due-soon' | 'ok';

export interface ComputedTask {
  item: ScheduleItem;
  state: TaskState;
  status: TaskStatus;
  /** Mileage at which this task is next due */
  nextDueMileage: number;
  /** Miles past due (positive = overdue) */
  milesOverdue: number;
  /**
   * Days past the time-based interval (positive = overdue). null when the
   * item has no month interval or the last-done date is unknown.
   */
  daysOverdue: number | null;
}
