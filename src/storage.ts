import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppData } from './types';

const KEY = 'maintenance-tracker/v1';

export const DEFAULT_DATA: AppData = {
  vehicle: null,
  currentMileage: 0,
  mileageUpdatedAt: null,
  tasks: {},
  onboarded: false,
  reminderHour: 9,
};

export async function loadData(): Promise<AppData> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_DATA };
    return { ...DEFAULT_DATA, ...JSON.parse(raw) };
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
