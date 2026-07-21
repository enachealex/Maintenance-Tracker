import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppData, MileageCadence, Vehicle, VehicleRecord } from './src/types';
import { DEFAULT_DATA, loadData, newVehicleRecord, parseBackup, saveData } from './src/storage';
import {
  addCustomItem,
  completeTask,
  editLastDoneMileage,
  removeCustomItem,
  scheduleFor,
  setLastDone,
} from './src/logic';
import { addNotificationResponseListener, syncAllReminders } from './src/notifications';
import { BACKUP_IMPORT_SUPPORTED, exportBackup, pickBackupFile } from './src/backup';
import {
  addWebNotificationTapListener,
  getInitialWebNav,
  registerServiceWorker,
  requestPersistentStorage,
  sendTestReminder,
  syncWebReminders,
} from './src/webNotifications';
import { setupWebViewport } from './src/webViewport';
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

/** The screen a back action (button or hardware) returns to. */
const parentOf = (n: Nav): Nav =>
  n.screen === 'add-mileage' ? { screen: 'add-vehicle' } : { screen: 'home' };

/**
 * Web/PWA: keep exactly one history entry above the base while off the home
 * screen, so the phone's back button/gesture pops it (handled in App's
 * popstate listener) and navigates in-app instead of closing the app.
 */
function ensureHistoryEntry(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (!window.history.state?.mtBack) window.history.pushState({ mtBack: true }, '');
}

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [nav, setNav] = useState<Nav>({ screen: 'home' });
  const dataRef = useRef<AppData | null>(null);
  dataRef.current = data;
  const navRef = useRef<Nav>(nav);
  navRef.current = nav;

  /** Navigate forward (also arms the back button/gesture on web). */
  const go = useCallback((next: Nav) => {
    if (next.screen !== 'home') ensureHistoryEntry();
    setNav(next);
  }, []);

  /** Navigate back one screen, keeping the browser history in sync on web. */
  const goBack = useCallback(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history.state?.mtBack) {
      window.history.back(); // the popstate listener moves nav to the parent
      return;
    }
    if (navRef.current.screen !== 'home') setNav(parentOf(navRef.current));
  }, []);

  // Web: the phone's back button/gesture (or browser Back) pops our history
  // entry — go back one screen, re-arming the entry while still off home.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onPop = () => {
      const cur = navRef.current;
      if (cur.screen === 'home') return;
      const parent = parentOf(cur);
      setNav(parent);
      if (parent.screen !== 'home') window.history.pushState({ mtBack: true }, '');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Native Android: hardware back goes back one screen; from home it exits.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navRef.current.screen === 'home') return false; // default: leave app
      setNav(parentOf(navRef.current));
      return true;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    setupWebViewport(); // web: fill the usable screen (dvh + safe-area support)
    registerServiceWorker(); // web/PWA: enables offline background reminders + push
    requestPersistentStorage(); // web: shield local data from storage eviction
    loadData().then((d) => {
      setData(d);
      saveData(d); // persist any schema migration so old-shape data is upgraded
      syncAllReminders(d); // native scheduled reminders
      syncWebReminders(d); // web: refresh background snapshot (no-op if not granted)
      // Cold start from a web notification tap (?vehicle=…&editMileage=1)
      const tap = getInitialWebNav();
      if (tap && d.vehicles.some((v) => v.id === tap.vehicleId)) {
        go({ screen: 'vehicle', id: tap.vehicleId, editMileage: tap.editMileage });
      }
    });
  }, []);

  // Tapping a notification jumps to that vehicle (and, for mileage prompts,
  // straight into the odometer editor).
  useEffect(() => {
    return addNotificationResponseListener(({ vehicleId, kind }) => {
      const exists = dataRef.current?.vehicles.some((v) => v.id === vehicleId);
      if (exists) go({ screen: 'vehicle', id: vehicleId, editMileage: kind === 'mileage' });
    });
  }, []);

  // Same, for web notification taps arriving while the app is already open.
  useEffect(() => {
    return addWebNotificationTapListener(({ vehicleId, editMileage }) => {
      const exists = dataRef.current?.vehicles.some((v) => v.id === vehicleId);
      if (exists) go({ screen: 'vehicle', id: vehicleId, editMileage });
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

  const handleExportBackup = useCallback(() => {
    if (dataRef.current) exportBackup(dataRef.current);
  }, []);

  // Web only (pickBackupFile resolves null elsewhere), so window.confirm/alert
  // — the same pattern Dashboard uses for its confirmations — are safe here.
  const handleImportBackup = useCallback(async () => {
    const raw = await pickBackupFile();
    if (raw == null) return;
    const imported = parseBackup(raw);
    if (!imported) {
      window.alert("That file doesn't look like a Maintenance Tracker backup.");
      return;
    }
    const current = dataRef.current;
    const n = imported.vehicles.length;
    const replaceNote =
      current && current.vehicles.length > 0
        ? ` This replaces the ${current.vehicles.length} vehicle${
            current.vehicles.length > 1 ? 's' : ''
          } currently in your garage.`
        : '';
    if (!window.confirm(`Restore ${n} vehicle${n === 1 ? '' : 's'} from this backup?${replaceNote}`))
      return;
    commit(imported);
    setNav({ screen: 'home' });
  }, [commit]);

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

  const handleMileageSetup = (vehicle: Vehicle, { mileage, oilType, answers }: MileageSetupResult) => {
    let rec = newVehicleRecord({
      vehicle,
      currentMileage: mileage,
      mileageUpdatedAt: new Date().toISOString(),
      oilType,
    });
    // Translate questionnaire answers into "last done" mileages. A user
    // guesstimate of "miles ago" wins; otherwise fall back per choice:
    //   recently   → done at roughly current mileage (not due for a full interval)
    //   a while ago→ done ~3/4 of an interval ago (due again fairly soon)
    //   unknown    → no record (shows as due now)
    // The oil-adjusted schedule keeps the oil-change math on the chosen interval.
    for (const item of scheduleFor(oilType)) {
      const answer = answers[item.id];
      if (!answer) continue;
      if (answer.choice === 'unknown') rec = setLastDone(rec, item.id, null);
      else if (answer.milesAgo != null)
        rec = setLastDone(rec, item.id, Math.max(0, mileage - answer.milesAgo));
      else if (answer.choice === 'recent') rec = setLastDone(rec, item.id, mileage);
      else rec = setLastDone(rec, item.id, Math.max(0, mileage - Math.round(item.intervalMiles * 0.75)));
    }
    commit({ ...data, vehicles: [...data.vehicles, rec] });
    go({ screen: 'vehicle', id: rec.id });
  };

  const removeVehicle = (id: string) => {
    commit({ ...data, vehicles: data.vehicles.filter((v) => v.id !== id) });
    goBack();
  };

  let screen: React.ReactNode;
  switch (nav.screen) {
    case 'add-vehicle':
      screen = (
        <VehicleSetup
          onDone={(vehicle) => go({ screen: 'add-mileage', vehicle })}
          onCancel={data.vehicles.length > 0 ? goBack : undefined}
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
            onOpenVehicle={(id) => go({ screen: 'vehicle', id })}
            onAddVehicle={() => go({ screen: 'add-vehicle' })}
            onNotificationsEnabled={handleNotificationsEnabled}
            onSendTestReminder={handleSendTestReminder}
            onExportBackup={handleExportBackup}
            onImportBackup={BACKUP_IMPORT_SUPPORTED ? handleImportBackup : undefined}
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
          onEditLastDone={(itemId, mileage) =>
            updateVehicle(rec.id, (r) => editLastDoneMileage(r, itemId, mileage))
          }
          onSetOilType={(oilType) => updateVehicle(rec.id, (r) => ({ ...r, oilType }))}
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
          onSetMaintenanceCadence={(cadence: MileageCadence, customDays: number) =>
            updateVehicle(rec.id, (r) => ({
              ...r,
              maintenanceCadence: cadence,
              maintenanceCustomDays: customDays,
            }))
          }
          onAddCustomItem={(fields) => updateVehicle(rec.id, (r) => addCustomItem(r, fields))}
          onRemoveCustomItem={(itemId) => updateVehicle(rec.id, (r) => removeCustomItem(r, itemId))}
          onBack={goBack}
          onRemove={() => removeVehicle(rec.id)}
        />
      );
      break;
    }
    default:
      screen = (
        <Home
          vehicles={data.vehicles}
          onOpenVehicle={(id) => go({ screen: 'vehicle', id })}
          onAddVehicle={() => go({ screen: 'add-vehicle' })}
          onNotificationsEnabled={handleNotificationsEnabled}
          onSendTestReminder={handleSendTestReminder}
          onExportBackup={handleExportBackup}
          onImportBackup={BACKUP_IMPORT_SUPPORTED ? handleImportBackup : undefined}
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
