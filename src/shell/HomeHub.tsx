import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button, Screen } from '../components/ui';
import NotificationPrompt from '../components/NotificationPrompt';
import { colors, spacing } from '../theme';
import { dueCount } from '../features/maintenance/logic';
import { VehicleRecord } from '../core/types';
import VehicleList from './VehicleList';

/**
 * The hub. Each vehicle is one entry point into either feature, so the garage
 * — not a feature — is the thing you land on. App-level chrome (reminders,
 * backup) lives here because it belongs to no single tab.
 */
export default function HomeHub({
  vehicles,
  onOpenMaintenance,
  onOpenWheels,
  onAddVehicle,
  onNotificationsEnabled,
  onSendTestReminder,
  onExportBackup,
  onImportBackup,
}: {
  vehicles: VehicleRecord[];
  onOpenMaintenance: (id: string) => void;
  onOpenWheels: (id: string) => void;
  onAddVehicle: () => void;
  onNotificationsEnabled: () => void;
  onSendTestReminder: () => void;
  onExportBackup: () => void;
  /** Absent on native, where there's no file picker. */
  onImportBackup?: () => void;
}) {
  const totalDue = vehicles.reduce((sum, v) => sum + dueCount(v), 0);
  const wide = useWindowDimensions().width >= 768;

  return (
    <Screen>
      <Text style={[styles.h1, wide && styles.centered]}>🚗 My Garage</Text>
      <Text style={[styles.sub, wide && styles.centered]}>
        {vehicles.length === 0
          ? 'Add your first vehicle to track maintenance and try new wheels.'
          : `${vehicles.length} vehicle${vehicles.length > 1 ? 's' : ''} · ${
              totalDue === 0
                ? 'all caught up'
                : `${totalDue} item${totalDue > 1 ? 's' : ''} needing attention`
            }`}
      </Text>

      {vehicles.length > 0 && (
        <NotificationPrompt onEnabled={onNotificationsEnabled} onSendTest={onSendTestReminder} />
      )}

      <VehicleList
        vehicles={vehicles}
        emptyText="Your garage is empty."
        onOpenVehicle={onOpenMaintenance}
        renderActions={(rec) => (
          <>
            <View style={styles.action}>
              <Button title="🔧 Maintenance" variant="ghost" onPress={() => onOpenMaintenance(rec.id)} />
            </View>
            <View style={styles.action}>
              <Button title="🛞 Wheels" variant="ghost" onPress={() => onOpenWheels(rec.id)} />
            </View>
          </>
        )}
      />

      <View style={wide && styles.centerRow}>
        <Button title="＋ Add vehicle" onPress={onAddVehicle} />
      </View>

      {(vehicles.length > 0 || onImportBackup) && (
        <View style={styles.backupBlock}>
          <View style={[styles.backupRow, wide && styles.centerRow]}>
            {vehicles.length > 0 && (
              <Button title="Export backup" variant="ghost" onPress={onExportBackup} />
            )}
            {onImportBackup && (
              <Button title="Import backup" variant="ghost" onPress={onImportBackup} />
            )}
          </View>
          <Text style={styles.backupHint}>
            Your data lives only on this device — export a backup to keep a copy or move to
            another device.
          </Text>
        </View>
      )}
      <View style={{ height: spacing.xl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: spacing.xs },
  sub: { color: colors.textDim, fontSize: 15, marginBottom: spacing.lg },
  centered: { textAlign: 'center' },
  centerRow: { alignItems: 'center' },
  action: { flex: 1 },
  backupBlock: { marginTop: spacing.lg },
  backupRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  backupHint: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
