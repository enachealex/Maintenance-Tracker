import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppData, Vehicle } from './src/types';
import { DEFAULT_DATA, loadData, saveData } from './src/storage';
import { completeTask, dueTasks, setLastDone } from './src/logic';
import { syncReminders } from './src/notifications';
import { SCHEDULE } from './src/data/schedule';
import { colors } from './src/theme';
import VehicleSetup from './src/screens/VehicleSetup';
import MileageSetup, { MileageSetupResult } from './src/screens/MileageSetup';
import Dashboard from './src/screens/Dashboard';

export default function App() {
  const [data, setData] = useState<AppData | null>(null);

  useEffect(() => {
    loadData().then(setData);
  }, []);

  /** Persist + reschedule weekly reminders every time state changes. */
  const commit = useCallback((next: AppData) => {
    setData(next);
    saveData(next);
    if (next.onboarded) syncReminders(next, dueTasks(next));
  }, []);

  // Re-sync reminders once on launch so they survive reinstalls/reboots.
  useEffect(() => {
    if (data?.onboarded) syncReminders(data, dueTasks(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.onboarded]);

  if (!data) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const handleVehicle = (vehicle: Vehicle) => {
    commit({ ...data, vehicle });
  };

  const handleMileageSetup = ({ mileage, answers }: MileageSetupResult) => {
    let next: AppData = { ...data, currentMileage: mileage, mileageUpdatedAt: new Date().toISOString() };
    // Translate questionnaire answers into "last done" mileages. A user
    // guesstimate of "miles ago" wins; otherwise fall back per choice:
    //   recently   → done at roughly current mileage (not due for a full interval)
    //   a while ago→ done ~3/4 of an interval ago (due again fairly soon)
    //   unknown    → no record (shows as due now)
    for (const item of SCHEDULE) {
      const answer = answers[item.id];
      if (!answer) continue;
      if (answer.choice === 'unknown') next = setLastDone(next, item.id, null);
      else if (answer.milesAgo != null)
        next = setLastDone(next, item.id, Math.max(0, mileage - answer.milesAgo));
      else if (answer.choice === 'recent') next = setLastDone(next, item.id, mileage);
      else
        next = setLastDone(next, item.id, Math.max(0, mileage - Math.round(item.intervalMiles * 0.75)));
    }
    commit({ ...next, onboarded: true });
  };

  const handleComplete = (itemId: string) => {
    commit(completeTask(data, itemId, data.currentMileage));
  };

  const handleMileageUpdate = (mileage: number) => {
    commit({ ...data, currentMileage: mileage, mileageUpdatedAt: new Date().toISOString() });
  };

  const handleChangeVehicle = () => {
    // Keep service history; just re-run vehicle selection.
    commit({ ...data, vehicle: null, onboarded: false });
  };

  let screen: React.ReactNode;
  if (!data.vehicle) {
    screen = <VehicleSetup onDone={handleVehicle} />;
  } else if (!data.onboarded) {
    screen = <MileageSetup vehicle={data.vehicle} onDone={handleMileageSetup} />;
  } else {
    screen = (
      <Dashboard
        data={data}
        onCompleteTask={handleComplete}
        onUpdateMileage={handleMileageUpdate}
        onChangeVehicle={handleChangeVehicle}
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
