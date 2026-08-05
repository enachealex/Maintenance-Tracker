import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button, Card, Screen } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { VehicleRecord, VehiclePhoto } from '../../core/types';
import VehicleList, { VehicleCard } from '../../shell/VehicleList';
import { vehicleName } from '../maintenance/logic';
import { compareFitment, parseTireSize, worstLevel } from '../../core/fitment';
import { canVisualize, fittedSizeOf, suggestedSizes, wheelsOf } from './logic';
import TireSizeInput from './TireSizeInput';
import WheelPreview, { PreviewDisclaimer } from './WheelPreview';
import CalibrateScreen from './CalibrateScreen';

/**
 * Wheels tab: pick a vehicle, calibrate one photo of it, then try tire sizes.
 *
 * v1 answers "what size should I shop for", so it renders size and proportion
 * on the user's own car. Offset is computed and reported numerically but not
 * drawn — a square-on view would be lying if it tried (§4a).
 */
export default function WheelsTab({
  vehicles,
  selectedId,
  onSelectVehicle,
  onClearSelection,
  onAddVehicle,
  onSetPhoto,
  onSetPlacardSize,
}: {
  vehicles: VehicleRecord[];
  selectedId?: string;
  onSelectVehicle: (id: string) => void;
  onClearSelection: () => void;
  onAddVehicle: () => void;
  onSetPhoto: (vehicleId: string, photo: VehiclePhoto) => void;
  onSetPlacardSize: (vehicleId: string, size: string) => void;
}) {
  const { width: winWidth } = useWindowDimensions();
  const wide = winWidth >= 768;
  const selected = selectedId ? vehicles.find((v) => v.id === selectedId) : undefined;

  const [calibrating, setCalibrating] = useState(false);
  const [proposed, setProposed] = useState('');

  // The working size belongs to a vehicle, not to the tab. Without this, the
  // size being tried on one car silently carries over when switching to
  // another — and the steppers then step from the wrong base.
  useEffect(() => {
    setProposed('');
    setCalibrating(false);
  }, [selectedId]);

  if (!selected) {
    return (
      <Screen>
        <Text style={[styles.h1, wide && styles.centered]}>🛞 Wheels</Text>
        <Text style={[styles.sub, wide && styles.centered]}>
          Pick a vehicle to see how a different tire size would look on it.
        </Text>
        <VehicleList
          vehicles={vehicles}
          emptyText="Add a vehicle first — the visualizer works from your garage."
          showDue={false}
          onOpenVehicle={onSelectVehicle}
        />
        {vehicles.length === 0 && (
          <View style={wide && styles.centerRow}>
            <Button title="＋ Add vehicle" onPress={onAddVehicle} />
          </View>
        )}
        <View style={{ height: spacing.xl }} />
      </Screen>
    );
  }

  const wheels = wheelsOf(selected);
  const fitted = fittedSizeOf(selected);

  if (calibrating) {
    return (
      <CalibrateScreen
        initialFittedSize={fitted ?? ''}
        onDone={(photo) => {
          onSetPhoto(selected.id, photo);
          setCalibrating(false);
        }}
        onCancel={() => setCalibrating(false)}
      />
    );
  }

  const ready = canVisualize(selected);
  const previewWidth = Math.min(winWidth - spacing.md * 2, 520);
  const fittedSize = fitted ? parseTireSize(fitted) : null;
  const proposedSize = parseTireSize(proposed);
  const comparison =
    fittedSize && proposedSize
      ? compareFitment({ oeTire: fittedSize, proposedTire: proposedSize })
      : null;

  return (
    <Screen>
      <Text style={[styles.h1, wide && styles.centered]}>🛞 Wheels</Text>
      <Text style={[styles.sub, wide && styles.centered]}>
        Trying sizes on your {vehicleName(selected)}.
      </Text>

      <VehicleCard rec={selected} showDue={false} />
      <View style={wide && styles.centerRow}>
        <Button title="Choose another vehicle" variant="ghost" onPress={onClearSelection} />
      </View>

      {!ready ? (
        <Card style={styles.setupCard}>
          <Text style={styles.setupTitle}>Set up a photo first</Text>
          <Text style={styles.setupBody}>
            One square-on photo of your car, plus a tap on a wheel to set the scale. It's kept
            on this device and never uploaded.
          </Text>
          <Button title="📷 Add a photo" onPress={() => setCalibrating(true)} />

          <View style={styles.placard}>
            <TireSizeInput
              label="Factory tire size (optional)"
              value={wheels.placardTireSize ?? ''}
              onChangeText={(t) => onSetPlacardSize(selected.id, t)}
              hint="On the sticker inside the driver's door frame. Every car has one — it's a federal requirement."
            />
          </View>
        </Card>
      ) : (
        <>
          <View style={styles.previewBlock}>
            <WheelPreview
              photo={wheels.photo!}
              proposedSize={proposedSize ? proposed : null}
              width={previewWidth}
            />
            <PreviewDisclaimer />
          </View>

          <TireSizeInput
            label="Size you're considering"
            value={proposed}
            onChangeText={setProposed}
            suggestions={fitted ? suggestedSizes(fitted) : []}
            hint="Try a suggestion, or type any size — including one nobody sells."
            stepperBase={fitted ?? undefined}
          />

          {comparison && (
            <Card style={styles.numbers}>
              <Row
                label="Overall diameter"
                value={`${comparison.diameterDeltaMm >= 0 ? '+' : ''}${comparison.diameterDeltaMm.toFixed(0)}mm (${comparison.diameterDeltaPercent >= 0 ? '+' : ''}${comparison.diameterDeltaPercent.toFixed(1)}%)`}
              />
              <Row
                label="Sidewall"
                value={`${comparison.sidewallDeltaMm >= 0 ? '+' : ''}${comparison.sidewallDeltaMm.toFixed(0)}mm`}
              />
              <Row
                label="Speedometer"
                value={
                  Math.abs(comparison.speedometerErrorPercent) < 0.1
                    ? 'unchanged'
                    : `reads ${comparison.speedometerErrorPercent > 0 ? 'low' : 'high'} by ${Math.abs(comparison.speedometerErrorPercent).toFixed(1)}%`
                }
              />
              {comparison.warnings.map((w) => (
                <Text
                  key={w.code}
                  style={[styles.warning, w.level === 'critical' && { color: colors.danger }]}
                >
                  {w.level === 'critical' ? '⚠️' : 'ℹ️'} {w.message}
                </Text>
              ))}
              {comparison.warnings.length === 0 && (
                <Text style={styles.clean}>✓ Nothing concerning about this change.</Text>
              )}
            </Card>
          )}

          <Text style={styles.fittedNote}>
            Calibrated against {wheels.photo!.fittedTireSize}, the size fitted in your photo.
          </Text>
          <Button title="Redo photo or scale" variant="ghost" onPress={() => setCalibrating(true)} />
        </>
      )}
      <View style={{ height: spacing.xl }} />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: spacing.xs },
  sub: { color: colors.textDim, fontSize: 15, marginBottom: spacing.lg },
  centered: { textAlign: 'center' },
  centerRow: { alignItems: 'center' },
  setupCard: { marginTop: spacing.md, gap: spacing.sm },
  setupTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  setupBody: { color: colors.textDim, fontSize: 14, lineHeight: 20, marginBottom: spacing.sm },
  placard: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: spacing.md },
  previewBlock: { marginTop: spacing.md, marginBottom: spacing.lg },
  numbers: { gap: spacing.xs, marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  rowLabel: { color: colors.textDim, fontSize: 13 },
  rowValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
  warning: { color: colors.warn, fontSize: 13, lineHeight: 18, marginTop: spacing.xs },
  clean: { color: colors.ok, fontSize: 13, marginTop: spacing.xs },
  fittedNote: { color: colors.textDim, fontSize: 12, textAlign: 'center', marginBottom: spacing.sm },
});
