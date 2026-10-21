import React, { useEffect, useRef, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button, Card, Screen } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { VehicleRecord, VehiclePhoto } from '../../core/types';
import VehicleList, { VehicleCard } from '../../shell/VehicleList';
import { vehicleName } from '../maintenance/logic';
import { compareFitment, parseTireSize } from '../../core/fitment';
import { lookupOemTireSize } from '../../core/oemTires';
import { canVisualize, fittedSizeOf, suggestedSizes, wheelsOf } from './logic';
import SizePickers from './SizePickers';
import { shopLinksFor } from './shop';
import { shareBuild } from './shareBuild';
import TireSizeInput from './TireSizeInput';
import WheelPreview from './WheelPreview';
import CalibrateScreen from './CalibrateScreen';
import { deleteVehiclePhoto, persistVehiclePhoto } from '../../core/photoStore';

/**
 * Tires tab: pick a vehicle, calibrate one photo of it, then try tire sizes.
 *
 * v1 answers "what size should I shop for", so it renders size and proportion
 * on the user's own car. Offset is computed and reported numerically but not
 * drawn — a square-on view would be lying if it tried (§4a).
 */
export default function WheelsTab({
  vehicles,
  selectedId,
  onSelectVehicle,
  onBack,
  onAddVehicle,
  onSetPhoto,
  onSetPlacardSize,
  onSetFittedSize,
  onAddBuild,
  onRemoveBuild,
  onTrackBuild,
}: {
  vehicles: VehicleRecord[];
  selectedId?: string;
  onSelectVehicle: (id: string) => void;
  /** Back out of the selected vehicle to the Tires vehicle picker. */
  onBack: () => void;
  onAddVehicle: () => void;
  onSetPhoto: (vehicleId: string, photo: VehiclePhoto) => void;
  onSetPlacardSize: (vehicleId: string, size: string) => void;
  /** Edit the current size; recalibrates the render from the traced circle. */
  onSetFittedSize: (vehicleId: string, size: string) => void;
  onAddBuild: (vehicleId: string, tireSize: string) => void;
  onRemoveBuild: (vehicleId: string, buildId: string) => void;
  /** A purchased set becomes a tracked rotation item in the Maintenance tab. */
  onTrackBuild: (vehicleId: string, tireSize: string) => void;
}) {
  const { width: winWidth } = useWindowDimensions();
  const wide = winWidth >= 768;
  const selected = selectedId ? vehicles.find((v) => v.id === selectedId) : undefined;

  const [calibrating, setCalibrating] = useState(false);
  const [proposed, setProposed] = useState('');
  const [switching, setSwitching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const previewRef = useRef<View>(null);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  };

  // The working size belongs to a vehicle, not to the tab. Without this, the
  // size being tried on one car silently carries over when switching to
  // another — and the pickers then start from the wrong base.
  useEffect(() => {
    setProposed('');
    setCalibrating(false);
    setSwitching(false);
    setNotice(null);
  }, [selectedId]);

  // First open for a vehicle with no recorded factory size: pre-fill it from
  // the curated fitment table. A suggestion to edit, never a lock — the
  // field stays editable and the hint points at the door placard.
  useEffect(() => {
    if (!selected || wheelsOf(selected).placardTireSize) return;
    const oem = lookupOemTireSize(selected.vehicle);
    if (oem) onSetPlacardSize(selected.id, oem);
    // Re-running on data changes would fight the user clearing the field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  if (!selected) {
    return (
      <Screen>
        <Text style={[styles.h1, wide && styles.centered]}>🛞 Tires</Text>
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
        onDone={async (photo) => {
          // The picker's URI is session-only (blob: on web, cache dir on
          // native). Move the bytes somewhere durable and persist that
          // reference instead — photo bytes never enter AppData.
          const previous = wheelsOf(selected).photo?.uri;
          try {
            const stored = await persistVehiclePhoto(selected.id, photo.uri);
            onSetPhoto(selected.id, { ...photo, uri: stored });
            if (previous && previous !== stored) deleteVehiclePhoto(previous);
          } catch {
            // Keep the calibration rather than losing the user's work; the
            // session URI still renders until the app closes.
            onSetPhoto(selected.id, photo);
          }
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

  // The factory size is the comparison baseline when we have one — that's
  // what "is this bigger than stock" means. Without it, deltas are relative
  // to whatever is on the car now.
  const factoryRaw = wheels.placardTireSize?.trim() || null;
  const factorySize = factoryRaw ? parseTireSize(factoryRaw) : null;
  const baselineSize = factorySize ?? fittedSize;
  const baselineName = factorySize ? `factory ${factoryRaw}` : `current ${fitted}`;
  // With nothing being tried, current-vs-factory is still worth a card when
  // the two differ — that's the "what am I already running" answer.
  const currentDiffers =
    !!factorySize && !!fittedSize && !!fitted && factoryRaw !== fitted.trim();
  const compareTarget = proposedSize ?? (currentDiffers ? fittedSize : null);
  const compareTitle = proposedSize
    ? `${proposed.trim()} vs ${baselineName}`
    : `current ${fitted} vs factory ${factoryRaw}`;
  const comparison =
    baselineSize && compareTarget
      ? compareFitment({ oeTire: baselineSize, proposedTire: compareTarget })
      : null;

  const others = vehicles.filter((v) => v.id !== selected.id);

  return (
    <Screen topPadding={56}>
      <Pressable
        onPress={onBack}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Back to vehicle list"
        style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backText}>Vehicles</Text>
      </Pressable>

      <Text style={[styles.h1, wide && styles.centered]}>🛞 Tires</Text>
      <Text style={[styles.sub, wide && styles.centered]}>
        Trying sizes on your {vehicleName(selected)}.
      </Text>

      <VehicleCard rec={selected} showDue={false} />
      <View style={wide && styles.centerRow}>
        <Button title="Change vehicle" variant="ghost" onPress={() => setSwitching(true)} />
      </View>

      {/* Vehicle switcher: a sheet over the current screen, so changing cars
          never bounces the user back out to the picker menu. */}
      <Modal
        visible={switching}
        transparent
        animationType="fade"
        onRequestClose={() => setSwitching(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSwitching(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>Change vehicle</Text>
            <ScrollView style={styles.modalList}>
              {others.length === 0 ? (
                <Text style={styles.modalEmpty}>
                  No other vehicles in your garage yet.
                </Text>
              ) : (
                others.map((v) => (
                  <Pressable
                    key={v.id}
                    onPress={() => {
                      setSwitching(false);
                      onSelectVehicle(v.id);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Switch to ${vehicleName(v)}`}
                    style={({ pressed }) => [styles.modalRow, pressed && { opacity: 0.6 }]}
                  >
                    <Text style={styles.modalRowName}>{vehicleName(v)}</Text>
                    <Text style={styles.modalRowMeta}>
                      {v.vehicle.trim} · {v.vehicle.engine}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
            <Button title="Cancel" variant="ghost" onPress={() => setSwitching(false)} />
          </Pressable>
        </Pressable>
      </Modal>

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
          <Text style={styles.sectionTitle}>Test tire sizes</Text>
          <View style={styles.previewBlock}>
            <View ref={previewRef} collapsable={false} style={styles.centerRow}>
              <WheelPreview
                photo={wheels.photo!}
                proposedSize={proposedSize ? proposed : null}
                width={previewWidth}
              />
            </View>
          </View>

          <TireSizeInput
            label="Factory tire size"
            value={wheels.placardTireSize ?? ''}
            onChangeText={(t) => onSetPlacardSize(selected.id, t)}
            hint="Typical factory fitment for this model — verify on the driver's door-jamb sticker."
          />
          <TireSizeInput
            label="Current tire size"
            value={fitted ?? ''}
            onChangeText={(t) => onSetFittedSize(selected.id, t)}
            hint="Read it off the tire sidewall — sidewall photo auto-read is coming."
          />

          {fittedSize?.kind === 'metric' ? (
            <SizePickers
              value={proposed}
              base={fitted ?? ''}
              onChange={setProposed}
            />
          ) : (
            <TireSizeInput
              label="Try a size"
              value={proposed}
              onChangeText={setProposed}
              hint="Type any size — including one nobody sells."
            />
          )}
          {fitted && suggestedSizes(fitted).length > 0 && (
            <View style={styles.chipRow}>
              {suggestedSizes(fitted).map((sz) => (
                <Pressable
                  key={sz}
                  onPress={() => setProposed(sz)}
                  accessibilityRole="button"
                  accessibilityLabel={`Try size ${sz}`}
                  style={({ pressed }) => [styles.chip, pressed && { opacity: 0.6 }]}
                >
                  <Text style={styles.chipText}>{sz}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {comparison && (
            <Card style={styles.numbers}>
              <Text style={styles.compareTitle}>{compareTitle}</Text>
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

          {proposedSize && (
            <View style={styles.actionRow}>
              <View style={styles.action}>
                <Button
                  title="💾 Save build"
                  variant="ghost"
                  onPress={() => {
                    onAddBuild(selected.id, proposed);
                    flash('Saved to your builds.');
                  }}
                />
              </View>
              <View style={styles.action}>
                <Button
                  title="📤 Share"
                  variant="ghost"
                  onPress={async () => {
                    const result = await shareBuild(wheels.photo!, proposed, previewRef);
                    if (result === 'downloaded') flash('Image saved — check your downloads.');
                    else if (result === 'failed') flash("Couldn't share the image.");
                  }}
                />
              </View>
            </View>
          )}

          {notice && <Text style={styles.notice}>{notice}</Text>}

          {proposedSize && shopLinksFor(proposed).length > 0 && (
            <View style={styles.shopBlock}>
              <Text style={styles.sectionTitle}>Shop this size</Text>
              <View style={styles.actionRow}>
                {shopLinksFor(proposed).map((link) => (
                  <View key={link.retailer} style={styles.action}>
                    <Button
                      title={link.retailer}
                      variant="ghost"
                      onPress={() => Linking.openURL(link.url).catch(() => {})}
                    />
                  </View>
                ))}
              </View>
              <Text style={styles.shopHint}>
                Opens the retailer's search for {proposed}. Nothing about you is sent — the
                link only carries the size.
              </Text>
            </View>
          )}

          {wheels.builds.length > 0 && (
            <View style={styles.buildsBlock}>
              <Text style={styles.sectionTitle}>Saved builds</Text>
              {wheels.builds.map((b) => (
                <Card key={b.id} style={styles.buildCard}>
                  <Pressable
                    onPress={() => setProposed(b.tireSize)}
                    accessibilityRole="button"
                    accessibilityLabel={`Preview saved build ${b.name}`}
                    style={({ pressed }) => [styles.buildMain, pressed && { opacity: 0.6 }]}
                  >
                    <Text style={styles.buildName}>{b.name}</Text>
                    <Text style={styles.buildMeta}>Tap to preview {b.tireSize}</Text>
                  </Pressable>
                  <View style={styles.actionRow}>
                    <View style={styles.action}>
                      <Button
                        title="Track rotations"
                        variant="ghost"
                        onPress={() => {
                          onTrackBuild(selected.id, b.tireSize);
                          flash('Added to Maintenance — rotations every 5,000 mi.');
                        }}
                      />
                    </View>
                    <View style={styles.action}>
                      <Button
                        title="Remove"
                        variant="ghost"
                        onPress={() => onRemoveBuild(selected.id, b.id)}
                      />
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          )}

          <Text style={styles.fittedNote}>
            Calibrated against {wheels.photo!.fittedTireSize}, the size fitted in your photo.
          </Text>
          <Text style={styles.disclaimer}>
            Size guidance here is advisory, not a guarantee of fitment or safety. Before
            buying, confirm load rating, clearance, and fit for your exact vehicle with a
            professional installer.
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
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: spacing.md,
  },
  backArrow: { color: colors.accent, fontSize: 22, fontWeight: '800', lineHeight: 22 },
  backText: { color: colors.accent, fontSize: 16, fontWeight: '700' },
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
    maxHeight: '70%',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: spacing.sm },
  modalList: { flexGrow: 0, marginBottom: spacing.sm },
  modalEmpty: { color: colors.textDim, fontSize: 14, paddingVertical: spacing.md },
  modalRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  modalRowName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  modalRowMeta: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  h1: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: spacing.xs },
  sub: { color: colors.textDim, fontSize: 15, marginBottom: spacing.lg },
  centered: { textAlign: 'center' },
  centerRow: { alignItems: 'center' },
  setupCard: { marginTop: spacing.md, gap: spacing.sm },
  setupTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  setupBody: { color: colors.textDim, fontSize: 14, lineHeight: 20, marginBottom: spacing.sm },
  placard: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: spacing.md },
  previewBlock: { marginTop: spacing.md, marginBottom: spacing.lg },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.accentSoft,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  numbers: { gap: spacing.xs, marginBottom: spacing.md },
  compareTitle: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  rowLabel: { color: colors.textDim, fontSize: 13 },
  rowValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
  warning: { color: colors.warn, fontSize: 13, lineHeight: 18, marginTop: spacing.xs },
  clean: { color: colors.ok, fontSize: 13, marginTop: spacing.xs },
  fittedNote: { color: colors.textDim, fontSize: 12, textAlign: 'center', marginBottom: spacing.sm },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
  notice: { color: colors.ok, fontSize: 13, textAlign: 'center', marginTop: spacing.xs },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: spacing.sm },
  shopBlock: { marginTop: spacing.lg },
  shopHint: { color: colors.textDim, fontSize: 12, marginTop: spacing.xs, lineHeight: 17 },
  buildsBlock: { marginTop: spacing.lg, marginBottom: spacing.sm },
  buildCard: { gap: spacing.sm },
  buildMain: {},
  buildName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  buildMeta: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  disclaimer: {
    color: colors.textDim,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: spacing.sm,
    opacity: 0.85,
  },
});
