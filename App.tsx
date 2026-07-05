import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppData, MileageCadence, Vehicle, VehicleRecord } from './src/types';
import { DEFAULT_DATA, loadData, newVehicleRecord, saveData } from './src/storage';
import { completeTask, setLastDone } from './src/logic';
import { addNotificationResponseListener, syncAllReminders } from './src/notifications';
import { registerServiceWorker, sendTestReminder, syncWebReminders } from './src/webNotifications';
import { SCHEDULE } from './src/data/schedule';
import { colors } from './src/theme';
import Home from './src/screens/Home';
import VehicleSetup from './src/screens/VehicleSetup';
import MileageSetup, { MileageSetupResult } from './src/screens/MileageSetup';
import Dashboard from './src/screens/Dashboard';

type Nav =
  | { screen: 'home' }
  | { screen: 'add-vehicle' }
  | { screen: 'add-mileage'; vehicle: Vehicle }
  | { screen: 'vehicle'; id: string; editMileage?: boolean };

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [nav, setNav] = useState<Nav>({ screen: 'home' });
  const dataRef = useRef<AppData | null>(null);
  dataRef.current = data;

  useEffect(() => {
    registerServiceWorker(); // web/PWA: enables offline background reminders + push
    loadData().then((d) => {
      setData(d);
      saveData(d); // persist any schema migration so old-shape data is upgraded
      syncAllReminders(d); // native scheduled reminders
      syncWebReminders(d); // web: refresh background snapshot (no-op if not granted)
    });
  }, []);

  // Tapping a notification jumps to that vehicle (and, for mileage prompts,
  // straight into the odometer editor).
  useEffect(() => {
    return addNotificationResponseListener(({ vehicleId, kind }) => {
      const exists = dataRef.current?.vehicles.some((v) => v.id === vehicleId);
      if (exists) setNav({ screen: 'vehicle', id: vehicleId, editMileage: kind === 'mileage' });
    });
  }, []);

  /** Persist + reschedule all reminders on every change. */
  const commit = useCallback((next: AppData) => {
    setData(next);
    saveData(next);
    syncAllReminders(next);
    syncWebReminders(next);
  }, []);

  const handleNotificationsEnabled = useCallback(() => {
    if (dataRef.current) syncWebReminders(dataRef.current, { confirm: true });
  }, []);

  const handleSendTestReminder = useCallback(() => {
    if (dataRef.current) sendTestReminder(dataRef.current);
  }, []);

  const updateVehicle = useCallback(
    (id: string, fn: (rec: VehicleRecord) => VehicleRecord) => {
      const cur = dataRef.current;
      if (!cur) return;
      commit({ ...cur, vehicles: cur.vehicles.map((v) => (v.id === id ? fn(v) : v)) });
    },
    [commit],
  );

  if (!data) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const handleMileageSetup = (vehicle: Vehicle, { mileage, answers }: MileageSetupResult) => {
    let rec = newVehicleRecord({
      vehicle,
      currentMileage: mileage,
      mileageUpdatedAt: new Date().toISOString(),
    });
    // Translate questionnaire answers into "last done" mileages. A user
    // guesstimate of "miles ago" wins; otherwise fall back per choice:
    //   recently   → done at roughly current mileage (not due for a full interval)
    //   a while ago→ done ~3/4 of an interval ago (due again fairly soon)
    //   unknown    → no record (shows as due now)
    for (const item of SCHEDULE) {
      const answer = answers[item.id];
      if (!answer) continue;
      if (answer.choice === 'unknown') rec = setLastDone(rec, item.id, null);
      else if (answer.milesAgo != null)
        rec = setLastDone(rec, item.id, Math.max(0, mileage - answer.milesAgo));
      else if (answer.choice === 'recent') rec = setLastDone(rec, item.id, mileage);
      else rec = setLastDone(rec, item.id, Math.max(0, mileage - Math.round(item.intervalMiles * 0.75)));
    }
    commit({ ...data, vehicles: [...data.vehicles, rec] });
    setNav({ screen: 'vehicle', id: rec.id });
  };

  const removeVehicle = (id: string) => {
    commit({ ...data, vehicles: data.vehicles.filter((v) => v.id !== id) });
    setNav({ screen: 'home' });
  };

  let screen: React.ReactNode;
  switch (nav.screen) {
    case 'add-vehicle':
      screen = (
        <VehicleSetup
          onDone={(vehicle) => setNav({ screen: 'add-mileage', vehicle })}
          onCancel={data.vehicles.length > 0 ? () => setNav({ screen: 'home' }) : undefined}
        />
      );
      break;
    case 'add-mileage':
      screen = (
        <MileageSetup
          vehicle={nav.vehicle}
          onDone={(result) => handleMileageSetup(nav.vehicle, result)}
        />
      );
      break;
    case 'vehicle': {
      const rec = data.vehicles.find((v) => v.id === nav.id);
      if (!rec) {
        screen = (
          <Home
            vehicles={data.vehicles}
            onOpenVehicle={(id) => setNav({ screen: 'vehicle', id })}
            onAddVehicle={() => setNav({ screen: 'add-vehicle' })}
            onNotificationsEnabled={handleNotificationsEnabled}
            onSendTestReminder={handleSendTestReminder}
          />
        );
        break;
      }
      screen = (
        <Dashboard
          rec={rec}
          startEditingMileage={nav.editMileage}
          onCompleteTask={(itemId) =>
            updateVehicle(rec.id, (r) => completeTask(r, itemId, r.currentMileage))
          }
          onUpdateMileage={(mileage) =>
            updateVehicle(rec.id, (r) => ({
              ...r,
              currentMileage: mileage,
              mileageUpdatedAt: new Date().toISOString(),
            }))
          }
          onSetCadence={(cadence: MileageCadence, customDays: number) =>
            updateVehicle(rec.id, (r) => ({ ...r, mileageCadence: cadence, mileageCustomDays: customDays }))
          }
          onBack={() => setNav({ screen: 'home' })}
          onRemove={() => removeVehicle(rec.id)}
        />
      );
      break;
    }
    default:
      screen = (
        <Home
          vehicles={data.vehicles}
          onOpenVehicle={(id) => setNav({ screen: 'vehicle', id })}
          onAddVehicle={() => setNav({ screen: 'add-vehicle' })}
          onNotificationsEnabled={handleNotificationsEnabled}
          onSendTestReminder={handleSendTestReminder}
        />
      );
  }

  return (
    <View style={styles.container}>
      {screen}
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
});
