import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button, Screen } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { VehicleRecord } from '../../core/types';
import VehicleList from '../../shell/VehicleList';
import { dueCount } from './logic';

/** Maintenance tab root: pick a vehicle to open its schedule. */
export default function MaintenanceTab({
  vehicles,
  onOpenVehicle,
  onAddVehicle,
}: {
  vehicles: VehicleRecord[];
  onOpenVehicle: (id: string) => void;
  onAddVehicle: () => void;
}) {
  const totalDue = vehicles.reduce((sum, v) => sum + dueCount(v), 0);
  const wide = useWindowDimensions().width >= 768;

  return (
    <Screen>
      <Text style={[styles.h1, wide && styles.centered]}>🔧 Maintenance</Text>
      <Text style={[styles.sub, wide && styles.centered]}>
        {vehicles.length === 0
          ? 'Add a vehicle to start tracking maintenance.'
          : totalDue === 0
            ? 'Everything is up to date.'
            : `${totalDue} item${totalDue > 1 ? 's' : ''} needing attention.`}
      </Text>

      <VehicleList
        vehicles={vehicles}
        emptyText="Your garage is empty."
        onOpenVehicle={onOpenVehicle}
      />

      <View style={wide && styles.centerRow}>
        <Button title="＋ Add vehicle" onPress={onAddVehicle} />
      </View>
      <View style={{ height: spacing.xl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: spacing.xs },
  sub: { color: colors.textDim, fontSize: 15, marginBottom: spacing.lg },
  centered: { textAlign: 'center' },
  centerRow: { alignItems: 'center' },
});
