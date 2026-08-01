import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button, Card, Screen } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { VehicleRecord } from '../../core/types';
import VehicleList, { VehicleCard } from '../../shell/VehicleList';
import { vehicleName } from '../maintenance/logic';

/**
 * Wheels tab root — shell only. The visualizer itself lands in later phases;
 * this exists so the tab structure is complete and navigable, and states
 * plainly that the feature is not built rather than faking it.
 */
export default function WheelsTab({
  vehicles,
  selectedId,
  onSelectVehicle,
  onClearSelection,
  onAddVehicle,
}: {
  vehicles: VehicleRecord[];
  selectedId?: string;
  onSelectVehicle: (id: string) => void;
  onClearSelection: () => void;
  onAddVehicle: () => void;
}) {
  const wide = useWindowDimensions().width >= 768;
  const selected = selectedId ? vehicles.find((v) => v.id === selectedId) : undefined;

  return (
    <Screen>
      <Text style={[styles.h1, wide && styles.centered]}>🛞 Wheels</Text>
      <Text style={[styles.sub, wide && styles.centered]}>
        {selected
          ? `Trying wheels on your ${vehicleName(selected)}.`
          : 'Pick a vehicle to see how a set of wheels would look on it.'}
      </Text>

      {selected ? (
        <>
          <VehicleCard rec={selected} showDue={false} />
          <View style={wide && styles.centerRow}>
            <Button title="Choose another vehicle" variant="ghost" onPress={onClearSelection} />
          </View>
        </>
      ) : (
        <VehicleList
          vehicles={vehicles}
          emptyText="Add a vehicle first — the visualizer works from your garage."
          showDue={false}
          onOpenVehicle={onSelectVehicle}
        />
      )}

      <Card style={styles.soon}>
        <Text style={styles.soonTitle}>Not built yet</Text>
        <Text style={styles.soonBody}>
          The visualizer is still being built. When it lands you'll photograph your car,
          line up a circle over one wheel to calibrate it, then browse wheels and tires and
          see them composited onto your own photo at the correct diameter, sidewall, and
          offset.
        </Text>
        <Text style={styles.soonBody}>
          Everything stays on this device — no account, and photos are never uploaded.
        </Text>
      </Card>

      {vehicles.length === 0 && (
        <View style={wide && styles.centerRow}>
          <Button title="＋ Add vehicle" onPress={onAddVehicle} />
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
  soon: { marginTop: spacing.md, gap: spacing.sm },
  soonTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  soonBody: { color: colors.textDim, fontSize: 14, lineHeight: 20 },
});
