import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AppData, ComputedTask } from './types';
import { fmtMiles } from './logic';

const supported = Platform.OS !== 'web';

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!supported) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('maintenance-reminders', {
      name: 'Maintenance reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/**
 * Reschedule all reminders to match the currently-due task list.
 * Each due task gets its own weekly repeating notification, firing on
 * today's weekday at `reminderHour` — i.e. roughly once a week from now —
 * until the task is completed (at which point rescheduling drops it).
 */
export async function syncReminders(data: AppData, due: ComputedTask[]): Promise<void> {
  if (!supported) return;
  const granted = await requestNotificationPermission();
  if (!granted) return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  const weekday = new Date().getDay() + 1; // expo: 1 = Sunday … 7 = Saturday
  for (const task of due) {
    const overdueText =
      task.milesOverdue >= 0
        ? `${fmtMiles(task.milesOverdue)} overdue`
        : `due in ${fmtMiles(-task.milesOverdue)}`;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🔧 Maintenance due: ${task.item.name}`,
        body: `${task.item.name} is ${overdueText} on your ${vehicleLabel(data)}. Open the app and check it off once it's done.`,
        ...(Platform.OS === 'android' ? { channelId: 'maintenance-reminders' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday,
        hour: data.reminderHour,
        minute: 0,
      },
    });
  }
}

function vehicleLabel(data: AppData): string {
  const v = data.vehicle;
  return v ? `${v.year} ${v.make} ${v.model}` : 'vehicle';
}
