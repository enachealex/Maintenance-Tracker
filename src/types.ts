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

export interface AppData {
  vehicle: Vehicle | null;
  currentMileage: number;
  mileageUpdatedAt: string | null;
  tasks: Record<string, TaskState>;
  /** Whether the initial "what was done already" questionnaire is complete */
  onboarded: boolean;
  reminderHour: number; // hour of day for weekly reminders (default 9)
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
