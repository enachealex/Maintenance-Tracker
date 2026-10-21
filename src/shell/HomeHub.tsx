import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button, Screen } from '../components/ui';
import NotificationPrompt from '../components/NotificationPrompt';
import { colors, spacing } from '../theme';
import { dueCount, vehicleName } from '../features/maintenance/logic';
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
  // Tapping a vehicle asks which feature to open for it, rather than
  // silently picking one.
  const [choosingFor, setChoosingFor] = useState<VehicleRecord | null>(null);

  const choose = (open: (id: string) => void) => {
    const id = choosingFor!.id;
    setChoosingFor(null);
    open(id);
  };

  return (
    <Screen>
      <View style={styles.titleRow}>
        <Text style={styles.h1}>🚗 My Garage</Text>
        <Button title="＋ Add" size="compact" onPress={onAddVehicle} />
      </View>
      <Text style={[styles.sub, wide && styles.centered]}>
        {vehicles.length === 0
          ? 'Add your first vehicle to track maintenance and try new tires.'
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
        onOpenVehicle={(id) => setChoosingFor(vehicles.find((v) => v.id === id) ?? null)}
      />

      <Modal
        visible={choosingFor != null}
        transparent
        animationType="fade"
        onRequestClose={() => setChoosingFor(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setChoosingFor(null)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>{choosingFor ? vehicleName(choosingFor) : ''}</Text>
            <Pressable
              onPress={() => choose(onOpenMaintenance)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.featureRow, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.featureName}>🔧 Maintenance</Text>
              <Text style={styles.featureMeta}>Mileage, reminders & service history</Text>
            </Pressable>
            <Pressable
              onPress={() => choose(onOpenWheels)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.featureRow, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.featureName}>🛞 Tires</Text>
              <Text style={styles.featureMeta}>Preview tire sizes on your photo</Text>
            </Pressable>
            <Button title="Cancel" variant="ghost" onPress={() => setChoosingFor(null)} />
          </Pressable>
        </Pressable>
      </Modal>

      {(vehicles.length > 0 || onImportBackup) && (
        <View style={styles.backupBlock}>
          <View style={[styles.backupRow, wide && styles.centerRow]}>
            {vehicles.length > 0 && (
              <Button title="Export backup" variant="ghost" size="compact" onPress={onExportBackup} />
            )}
            {onImportBackup && (
              <Button title="Import backup" variant="ghost" size="compact" onPress={onImportBackup} />
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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  h1: { color: colors.text, fontSize: 28, fontWeight: '800' },
  sub: { color: colors.textDim, fontSize: 15, marginBottom: spacing.lg },
  centered: { textAlign: 'center' },
  centerRow: { alignItems: 'center' },
  backupBlock: { marginTop: spacing.lg },
  backupRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  backupHint: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: spacing.sm },
  featureRow: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  featureName: { color: colors.text, fontSize: 17, fontWeight: '800' },
  featureMeta: { color: colors.textDim, fontSize: 13, marginTop: 2 },
});
