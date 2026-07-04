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

/** How often the user wants to be prompted to refresh their odometer reading. */
export type MileageCadence = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';

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
}
