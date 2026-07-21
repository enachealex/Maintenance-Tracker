import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AppData, VehicleRecord } from './types';
import { dueDescription, dueTasks, vehicleName } from './logic';
import { cadenceDays, cadenceLabel, maintenanceCadenceDays } from './cadence';

const supported = Platform.OS !== 'web';

export type NotificationKind = 'maintenance' | 'mileage';

export interface NotificationTap {
  vehicleId: string;
  kind: NotificationKind;
}

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
      name: 'Maintenance & mileage reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

const androidChannel =
  Platform.OS === 'android' ? { channelId: 'maintenance-reminders' } : {};

/**
 * Reschedule every notification across all vehicles to match current state:
 *  - one weekly reminder per due maintenance task (until it's checked off), and
 *  - one recurring mileage-update prompt per vehicle on its chosen cadence.
 * Tapping any notification carries a { vehicleId, kind } payload so the app can
 * jump straight to the right car.
 */
export async function syncAllReminders(data: AppData): Promise<void> {
  if (!supported) return;
  const granted = await requestNotificationPermission();
  if (!granted) return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  const weekday = new Date().getDay() + 1; // expo: 1 = Sunday … 7 = Saturday

  for (const rec of data.vehicles) {
    const label = vehicleName(rec);

    // Maintenance reminders repeat at the vehicle's chosen frequency.
    // Daily/weekly use calendar triggers (fixed clock time, no drift);
    // longer frequencies use an interval, which restarts when reminders
    // re-sync — best effort on native, exact on the web/PWA path.
    const maintDays = maintenanceCadenceDays(rec);
    const maintTrigger: Notifications.NotificationTriggerInput =
      maintDays === 1
        ? {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: data.reminderHour,
            minute: 0,
          }
        : maintDays === 7
          ? {
              type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
              weekday,
              hour: data.reminderHour,
              minute: 0,
            }
          : {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: maintDays * 86_400,
              repeats: true,
            };

    for (const task of dueTasks(rec)) {
      const overdueText = dueDescription(task);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🔧 Maintenance due: ${task.item.name}`,
          body: `${task.item.name} is ${overdueText} on your ${label}. Open the app and check it off once it's done.`,
          data: { vehicleId: rec.id, kind: 'maintenance' } satisfies NotificationTap,
          ...androidChannel,
        },
        trigger: maintTrigger,
      });
    }

    // Fire when the reading actually goes stale (measured from the last
    // odometer update, not from now — a repeating interval would restart on
    // every app change and could postpone the prompt forever). One-shot:
    // every sync re-arms it, and tapping it opens the app, which re-syncs.
    const elapsedS = rec.mileageUpdatedAt
      ? Math.max(0, (Date.now() - Date.parse(rec.mileageUpdatedAt)) / 1000)
      : 0;
    const remainingS = cadenceDays(rec) * 86_400 - elapsedS;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🧭 Update your mileage`,
        body: `Time to refresh the odometer on your ${label} (${cadenceLabel(rec)}). Tap to update it.`,
        data: { vehicleId: rec.id, kind: 'mileage' } satisfies NotificationTap,
        ...androidChannel,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(Math.round(remainingS), 3600), // if already stale, nudge in an hour
        repeats: false,
      },
    });
  }
}

/** Subscribe to notification taps. Returns an unsubscribe function. */
export function addNotificationResponseListener(
  handler: (tap: NotificationTap) => void,
): () => void {
  if (!supported) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Partial<NotificationTap>;
    if (data?.vehicleId && data?.kind) {
      handler({ vehicleId: data.vehicleId, kind: data.kind });
    }
  });
  return () => sub.remove();
}
