import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { computeTasks, fmtMiles, isCustomItem, vehicleName } from '../logic';
import { CADENCE_OPTIONS, daysSinceMileageUpdate, isMileageStale } from '../cadence';
import { Button, Card, Field, Screen, SelectField } from '../components/ui';
import { colors, spacing } from '../theme';
import { ComputedTask, MileageCadence, VehicleRecord } from '../types';

export default function Dashboard({
  rec,
  startEditingMileage,
  onCompleteTask,
  onUpdateMileage,
  onSetCadence,
  onSetMaintenanceCadence,
  onAddCustomItem,
  onRemoveCustomItem,
  onBack,
  onRemove,
}: {
  rec: VehicleRecord;
  startEditingMileage?: boolean;
  onCompleteTask: (itemId: string) => void;
  onUpdateMileage: (mileage: number) => void;
  onSetCadence: (cadence: MileageCadence, customDays: number) => void;
  onSetMaintenanceCadence: (cadence: MileageCadence, customDays: number) => void;
  onAddCustomItem: (fields: { name: string; intervalMiles: number; milesAgo: number | null }) => void;
  onRemoveCustomItem: (itemId: string) => void;
  onBack: () => void;
  onRemove: () => void;
}) {
  const tasks = useMemo(() => computeTasks(rec), [rec]);
  const overdue = tasks.filter((t) => t.status === 'overdue');
  const dueSoon = tasks.filter((t) => t.status === 'due-soon');
  const upcoming = tasks.filter((t) => t.status === 'ok');

  const [editingMileage, setEditingMileage] = useState(!!startEditingMileage);
  const [mileageText, setMileageText] = useState('');
  const [customDaysText, setCustomDaysText] = useState(String(rec.mileageCustomDays));
  const [maintDaysText, setMaintDaysText] = useState(String(rec.maintenanceCustomDays ?? 7));
  const [addingCustom, setAddingCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customInterval, setCustomInterval] = useState('');
  const [customLastAgo, setCustomLastAgo] = useState('');

  useEffect(() => {
    if (startEditingMileage) {
      setMileageText('');
      setEditingMileage(true);
    }
  }, [startEditingMileage]);

  const v = rec.vehicle;
  const stale = isMileageStale(rec);

  const confirm = (title: string, message: string, onYes: () => void, destructive = false) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) onYes();
    } else {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: destructive ? 'Remove' : 'Done ✓', style: destructive ? 'destructive' : 'default', onPress: onYes },
      ]);
    }
  };

  const confirmComplete = (task: ComputedTask) =>
    confirm(
      'Mark complete',
      `Mark "${task.item.name}" as done at ${fmtMiles(rec.currentMileage)}? Its reminder will stop.`,
      () => onCompleteTask(task.item.id),
    );

  const saveMileage = () => {
    const m = parseInt(mileageText.replace(/[^0-9]/g, ''), 10);
    if (m > 0) {
      onUpdateMileage(m);
      setEditingMileage(false);
    }
  };

  const keyForLabel = (label: string): MileageCadence =>
    CADENCE_OPTIONS.find((o) => o.label === label)!.key;

  const displayCadence = (cadence: MileageCadence, days: number) =>
    cadence === 'custom'
      ? `Custom (every ${Math.max(1, days)} day${days === 1 ? '' : 's'})`
      : CADENCE_OPTIONS.find((o) => o.key === cadence)!.label;

  const chooseCadence = (cadence: MileageCadence) => {
    const days = parseInt(customDaysText.replace(/[^0-9]/g, ''), 10) || rec.mileageCustomDays;
    onSetCadence(cadence, days);
  };

  const chooseMaintCadence = (cadence: MileageCadence) => {
    const days = parseInt(maintDaysText.replace(/[^0-9]/g, ''), 10) || rec.maintenanceCustomDays || 7;
    onSetMaintenanceCadence(cadence, days);
  };

  const saveCustomItem = () => {
    const name = customName.trim();
    const intervalMiles = parseInt(customInterval.replace(/[^0-9]/g, ''), 10);
    if (!name || !(intervalMiles > 0)) return;
    const agoDigits = customLastAgo.replace(/[^0-9]/g, '');
    const milesAgo = agoDigits === '' ? null : Math.min(parseInt(agoDigits, 10), rec.currentMileage);
    onAddCustomItem({ name, intervalMiles, milesAgo });
    setAddingCustom(false);
  };

  const confirmRemoveCustom = (task: ComputedTask) =>
    confirm(
      'Remove custom item',
      `Remove "${task.item.name}" and its history from this vehicle?`,
      () => onRemoveCustomItem(task.item.id),
      true,
    );

  return (
    <Screen topPadding={56}>
      <Pressable onPress={onBack} hitSlop={8} style={styles.backRow}>
        <Text style={styles.back}>‹ Garage</Text>
      </Pressable>

      <Text style={styles.h1}>{vehicleName(rec)}</Text>
      <Text style={styles.sub}>
        {v.trim} · {v.engine}
      </Text>

      <Card style={styles.mileageCard}>
        {editingMileage ? (
          <>
            <Field
              label="New odometer reading"
              value={mileageText}
              onChangeText={setMileageText}
              placeholder={String(rec.currentMileage)}
              keyboardType="numeric"
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button title="Cancel" variant="ghost" onPress={() => setEditingMileage(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Save" onPress={saveMileage} />
              </View>
            </View>
          </>
        ) : (
          <View style={styles.mileageRow}>
            <View>
              <Text style={styles.mileageValue}>{rec.currentMileage.toLocaleString()} mi</Text>
              <Text style={styles.sub}>
                current mileage
                {rec.mileageUpdatedAt
                  ? ` · updated ${daysSinceMileageUpdate(rec)}d ago`
                  : ''}
              </Text>
            </View>
            <Button
              title="Update"
              variant={stale ? 'primary' : 'ghost'}
              onPress={() => {
                setMileageText('');
                setEditingMileage(true);
              }}
            />
          </View>
        )}
      </Card>

      {stale && !editingMileage && (
        <Text style={styles.staleBanner}>
          🧭 It's been {daysSinceMileageUpdate(rec)} days since your last mileage update — refresh it
          so your reminders stay accurate.
        </Text>
      )}

      <Card>
        <Text style={styles.cadenceLabel}>🔔 Reminder frequency</Text>
        <SelectField
          label="Remind me to update mileage"
          value={displayCadence(rec.mileageCadence, rec.mileageCustomDays)}
          placeholder="Choose frequency"
          options={CADENCE_OPTIONS.map((o) => o.label)}
          onSelect={(label) => chooseCadence(keyForLabel(label))}
        />
        {rec.mileageCadence === 'custom' && (
          <Field
            label="Mileage reminder: every how many days?"
            value={customDaysText}
            onChangeText={(t) => {
              setCustomDaysText(t);
              const d = parseInt(t.replace(/[^0-9]/g, ''), 10);
              if (d > 0) onSetCadence('custom', d);
            }}
            placeholder="e.g. 10"
            keyboardType="numeric"
          />
        )}
        <SelectField
          label="Remind me about due maintenance"
          value={displayCadence(rec.maintenanceCadence ?? 'weekly', rec.maintenanceCustomDays ?? 7)}
          placeholder="Choose frequency"
          options={CADENCE_OPTIONS.map((o) => o.label)}
          onSelect={(label) => chooseMaintCadence(keyForLabel(label))}
        />
        {rec.maintenanceCadence === 'custom' && (
          <Field
            label="Maintenance reminder: every how many days?"
            value={maintDaysText}
            onChangeText={(t) => {
              setMaintDaysText(t);
              const d = parseInt(t.replace(/[^0-9]/g, ''), 10);
              if (d > 0) onSetMaintenanceCadence('custom', d);
            }}
            placeholder="e.g. 3"
            keyboardType="numeric"
          />
        )}
        <Text style={styles.cadenceHint}>
          You'll be reminded at most this often — mileage prompts when the reading goes stale,
          maintenance reminders while items are due. Tap a reminder to jump straight here.
        </Text>
      </Card>

      {overdue.length + dueSoon.length > 0 ? (
        <Text style={styles.notice}>
          🔔 You'll get a weekly reminder for each item below until you check it off.
        </Text>
      ) : (
        <Text style={styles.notice}>✅ All caught up — nothing due right now.</Text>
      )}

      <Section title={`Overdue (${overdue.length})`} empty="Nothing overdue. 🎉">
        {overdue.map((t) => (
          <TaskRow
            key={t.item.id}
            task={t}
            onComplete={() => confirmComplete(t)}
            onRemove={isCustomItem(t.item.id) ? () => confirmRemoveCustom(t) : undefined}
          />
        ))}
      </Section>

      <Section title={`Due soon (${dueSoon.length})`} empty="Nothing coming up in the next 500 miles.">
        {dueSoon.map((t) => (
          <TaskRow
            key={t.item.id}
            task={t}
            onComplete={() => confirmComplete(t)}
            onRemove={isCustomItem(t.item.id) ? () => confirmRemoveCustom(t) : undefined}
          />
        ))}
      </Section>

      <Section title="Upcoming" empty="">
        {upcoming.map((t) => (
          <TaskRow
            key={t.item.id}
            task={t}
            onComplete={() => confirmComplete(t)}
            onRemove={isCustomItem(t.item.id) ? () => confirmRemoveCustom(t) : undefined}
          />
        ))}
      </Section>

      {addingCustom ? (
        <Card>
          <Text style={styles.cadenceLabel}>🔧 New custom maintenance</Text>
          <Field
            label="Name"
            value={customName}
            onChangeText={setCustomName}
            placeholder="e.g. Timing belt, Fuel filter"
          />
          <Field
            label="Repeat every (miles)"
            value={customInterval}
            onChangeText={setCustomInterval}
            placeholder="e.g. 60000"
            keyboardType="numeric"
          />
          <Field
            label="Last done how many miles ago? (blank = never / not sure)"
            value={customLastAgo}
            onChangeText={setCustomLastAgo}
            placeholder="e.g. 12000"
            keyboardType="numeric"
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button title="Cancel" variant="ghost" onPress={() => setAddingCustom(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Add item" onPress={saveCustomItem} />
            </View>
          </View>
        </Card>
      ) : (
        <Button
          title="＋ Add custom maintenance"
          variant="ghost"
          onPress={() => {
            setCustomName('');
            setCustomInterval('');
            setCustomLastAgo('');
            setAddingCustom(true);
          }}
        />
      )}

      <Text style={styles.disclaimer}>
        Intervals are industry-standard averages — your owner's manual takes precedence.
      </Text>

      <Button
        title="Remove this vehicle"
        variant="danger"
        onPress={() =>
          confirm(
            'Remove vehicle',
            `Remove your ${vehicleName(rec)} and all its history? This can't be undone.`,
            onRemove,
            true,
          )
        }
      />
      <View style={{ height: spacing.xl }} />
    </Screen>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const isEmpty = React.Children.count(children) === 0;
  if (isEmpty && !empty) return null;
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {isEmpty ? <Text style={styles.emptyText}>{empty}</Text> : children}
    </View>
  );
}

function TaskRow({
  task,
  onComplete,
  onRemove,
}: {
  task: ComputedTask;
  onComplete: () => void;
  onRemove?: () => void;
}) {
  const { item, status, nextDueMileage, milesOverdue, state } = task;
  const badge =
    status === 'overdue'
      ? { text: `${fmtMiles(milesOverdue)} overdue`, color: colors.danger, bg: colors.dangerSoft }
      : status === 'due-soon'
        ? { text: `due in ${fmtMiles(-milesOverdue)}`, color: colors.warn, bg: colors.warnSoft }
        : { text: `due at ${fmtMiles(nextDueMileage)}`, color: colors.ok, bg: colors.okSoft };

  return (
    <Card style={{ marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.taskName}>
            {item.icon} {item.name}
          </Text>
          <Text style={styles.taskMeta}>
            every {item.intervalMiles.toLocaleString()} mi
            {state.lastDoneMileage != null
              ? ` · last done at ${fmtMiles(state.lastDoneMileage)}`
              : ' · no record yet'}
          </Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={{ color: badge.color, fontSize: 12, fontWeight: '700' }}>
              {badge.text}
            </Text>
          </View>
        </View>
        {onRemove && (
          <Pressable style={styles.removeButton} onPress={onRemove} hitSlop={8}>
            <Text style={{ color: colors.textDim, fontSize: 16 }}>✕</Text>
          </Pressable>
        )}
        {status !== 'ok' && (
          <Pressable style={styles.checkButton} onPress={onComplete} hitSlop={8}>
            <Text style={{ color: colors.ok, fontSize: 22 }}>✓</Text>
          </Pressable>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  backRow: { marginBottom: spacing.sm },
  back: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  h1: { color: colors.text, fontSize: 24, fontWeight: '800' },
  sub: { color: colors.textDim, fontSize: 14, marginTop: 2 },
  mileageCard: { marginTop: spacing.md, marginBottom: spacing.md },
  mileageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mileageValue: { color: colors.text, fontSize: 26, fontWeight: '800' },
  staleBanner: {
    color: colors.warn,
    backgroundColor: colors.warnSoft,
    fontSize: 13,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cadenceLabel: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: spacing.sm },
  cadenceHint: { color: colors.textDim, fontSize: 12 },
  notice: { color: colors.textDim, fontSize: 13, marginBottom: spacing.md, textAlign: 'center' },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  emptyText: { color: colors.textDim, fontSize: 14 },
  taskName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  taskMeta: { color: colors.textDim, fontSize: 13, marginTop: 2, marginBottom: 6 },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  checkButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.ok,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  disclaimer: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
});
