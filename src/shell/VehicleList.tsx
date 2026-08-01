import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/ui';
import { colors, spacing } from '../theme';
import { dueCount, fmtMiles, vehicleName } from '../features/maintenance/logic';
import { cadenceLabel, isMileageStale } from '../features/maintenance/cadence';
import { VehicleRecord } from '../core/types';

/**
 * The garage vehicle card, shared by every tab. `actions` lets a tab append
 * its own controls (Home offers both features; the feature tabs go straight
 * in), so the card looks the same wherever it appears.
 */
export function VehicleCard({
  rec,
  onPress,
  showDue = true,
  actions,
}: {
  rec: VehicleRecord;
  onPress?: () => void;
  /** Maintenance badge + due line. Off for tabs where it isn't the subject. */
  showDue?: boolean;
  actions?: React.ReactNode;
}) {
  const due = dueCount(rec);
  const stale = isMileageStale(rec);

  const body = (
    <Card>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.vehicleName}>{vehicleName(rec)}</Text>
          <Text style={styles.vehicleMeta}>
            {rec.vehicle.trim} · {rec.vehicle.engine}
          </Text>
        </View>
        {showDue &&
          (due > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{due}</Text>
            </View>
          ) : (
            <Text style={styles.okCheck}>✓</Text>
          ))}
      </View>

      <View style={styles.cardBottom}>
        <Text style={styles.mileage}>{fmtMiles(rec.currentMileage)}</Text>
        {showDue && (
          <Text style={styles.dueLine}>
            {due > 0 ? `${due} item${due > 1 ? 's' : ''} due` : 'All caught up'}
          </Text>
        )}
      </View>

      {showDue && stale && (
        <Text style={styles.staleHint}>🧭 Mileage update due ({cadenceLabel(rec)})</Text>
      )}

      {actions && <View style={styles.actions}>{actions}</View>}
    </Card>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.7 }}>
      {body}
    </Pressable>
  );
}

/** Empty-garage placeholder, shared so every tab says the same thing. */
export function EmptyGarage({ text }: { text: string }) {
  return (
    <Card style={styles.emptyCard}>
      <Text style={styles.emptyEmoji}>🅿️</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </Card>
  );
}

export default function VehicleList({
  vehicles,
  onOpenVehicle,
  emptyText,
  showDue = true,
  renderActions,
}: {
  vehicles: VehicleRecord[];
  onOpenVehicle?: (id: string) => void;
  emptyText: string;
  showDue?: boolean;
  renderActions?: (rec: VehicleRecord) => React.ReactNode;
}) {
  if (vehicles.length === 0) return <EmptyGarage text={emptyText} />;
  return (
    <>
      {vehicles.map((rec) => (
        <VehicleCard
          key={rec.id}
          rec={rec}
          showDue={showDue}
          onPress={onOpenVehicle ? () => onOpenVehicle(rec.id) : undefined}
          actions={renderActions?.(rec)}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyEmoji: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: { color: colors.textDim, fontSize: 15, textAlign: 'center' },
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
  staleHint: { color: colors.warn, fontSize: 12, marginTop: spacing.sm, fontWeight: '600' },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingTop: spacing.md,
  },
});
