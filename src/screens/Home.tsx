import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card } from '../components/ui';
import { colors, spacing } from '../theme';
import { dueCount, fmtMiles, vehicleName } from '../logic';
import { cadenceLabel, isMileageStale } from '../cadence';
import { VehicleRecord } from '../types';

export default function Home({
  vehicles,
  onOpenVehicle,
  onAddVehicle,
}: {
  vehicles: VehicleRecord[];
  onOpenVehicle: (id: string) => void;
  onAddVehicle: () => void;
}) {
  const totalDue = vehicles.reduce((sum, v) => sum + dueCount(v), 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>🚗 My Garage</Text>
      <Text style={styles.sub}>
        {vehicles.length === 0
          ? 'Add your first vehicle to start tracking maintenance.'
          : `${vehicles.length} vehicle${vehicles.length > 1 ? 's' : ''} · ${
              totalDue === 0 ? 'all caught up' : `${totalDue} item${totalDue > 1 ? 's' : ''} needing attention`
            }`}
      </Text>

      {vehicles.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>🅿️</Text>
          <Text style={styles.emptyText}>Your garage is empty.</Text>
        </Card>
      ) : (
        vehicles.map((rec) => (
          <VehicleCard key={rec.id} rec={rec} onPress={() => onOpenVehicle(rec.id)} />
        ))
      )}

      <Button title="＋ Add vehicle" onPress={onAddVehicle} />
      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

function VehicleCard({ rec, onPress }: { rec: VehicleRecord; onPress: () => void }) {
  const due = dueCount(rec);
  const stale = isMileageStale(rec);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.7 }}>
      <Card>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.vehicleName}>{vehicleName(rec)}</Text>
            <Text style={styles.vehicleMeta}>
              {rec.vehicle.trim} · {rec.vehicle.engine}
            </Text>
          </View>
          {due > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{due}</Text>
            </View>
          ) : (
            <Text style={styles.okCheck}>✓</Text>
          )}
        </View>

        <View style={styles.cardBottom}>
          <Text style={styles.mileage}>{fmtMiles(rec.currentMileage)}</Text>
          <Text style={styles.dueLine}>
            {due > 0 ? `${due} item${due > 1 ? 's' : ''} due` : 'All caught up'}
          </Text>
        </View>

        {stale && (
          <Text style={styles.staleHint}>
            🧭 Mileage update due ({cadenceLabel(rec)})
          </Text>
        )}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingTop: 64 },
  h1: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: spacing.xs },
  sub: { color: colors.textDim, fontSize: 15, marginBottom: spacing.lg },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyEmoji: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: { color: colors.textDim, fontSize: 15 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  vehicleName: { color: colors.text, fontSize: 19, fontWeight: '800' },
  vehicleMeta: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  badge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  badgeText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  okCheck: { color: colors.ok, fontSize: 22, fontWeight: '800' },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: spacing.md,
  },
  mileage: { color: colors.text, fontSize: 22, fontWeight: '800' },
  dueLine: { color: colors.textDim, fontSize: 13 },
  staleHint: {
    color: colors.warn,
    fontSize: 12,
    marginTop: spacing.sm,
    fontWeight: '600',
  },
});
