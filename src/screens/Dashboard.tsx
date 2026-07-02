import React, { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { computeTasks, fmtMiles } from '../logic';
import { Button, Card, Field } from '../components/ui';
import { colors, spacing } from '../theme';
import { AppData, ComputedTask } from '../types';

export default function Dashboard({
  data,
  onCompleteTask,
  onUpdateMileage,
  onChangeVehicle,
}: {
  data: AppData;
  onCompleteTask: (itemId: string) => void;
  onUpdateMileage: (mileage: number) => void;
  onChangeVehicle: () => void;
}) {
  const tasks = useMemo(() => computeTasks(data), [data]);
  const overdue = tasks.filter((t) => t.status === 'overdue');
  const dueSoon = tasks.filter((t) => t.status === 'due-soon');
  const upcoming = tasks.filter((t) => t.status === 'ok');

  const [editingMileage, setEditingMileage] = useState(false);
  const [mileageText, setMileageText] = useState('');

  const v = data.vehicle!;

  const confirmComplete = (task: ComputedTask) => {
    const doIt = () => onCompleteTask(task.item.id);
    if (Platform.OS === 'web') {
      // Alert with buttons isn't supported on web
      if (window.confirm(`Mark "${task.item.name}" as done at ${fmtMiles(data.currentMileage)}?`)) doIt();
    } else {
      Alert.alert(
        'Mark complete',
        `Mark "${task.item.name}" as done at ${fmtMiles(data.currentMileage)}? Its weekly reminder will stop.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Done ✓', onPress: doIt },
        ],
      );
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>
            {v.year} {v.make} {v.model}
          </Text>
          <Text style={styles.sub}>
            {v.trim} · {v.engine}
          </Text>
        </View>
        <Pressable onPress={onChangeVehicle} hitSlop={8}>
          <Text style={{ color: colors.accent, fontSize: 13 }}>Change</Text>
        </Pressable>
      </View>

      <Card style={styles.mileageCard}>
        {editingMileage ? (
          <>
            <Field
              label="New odometer reading"
              value={mileageText}
              onChangeText={setMileageText}
              placeholder={String(data.currentMileage)}
              keyboardType="numeric"
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button title="Cancel" variant="ghost" onPress={() => setEditingMileage(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Save"
                  onPress={() => {
                    const m = parseInt(mileageText.replace(/[^0-9]/g, ''), 10);
                    if (m > 0) {
                      onUpdateMileage(m);
                      setEditingMileage(false);
                    }
                  }}
                />
              </View>
            </View>
          </>
        ) : (
          <View style={styles.mileageRow}>
            <View>
              <Text style={styles.mileageValue}>{data.currentMileage.toLocaleString()} mi</Text>
              <Text style={styles.sub}>current mileage</Text>
            </View>
            <Button
              title="Update"
              variant="ghost"
              onPress={() => {
                setMileageText('');
                setEditingMileage(true);
              }}
            />
          </View>
        )}
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
          <TaskRow key={t.item.id} task={t} onComplete={() => confirmComplete(t)} />
        ))}
      </Section>

      <Section title={`Due soon (${dueSoon.length})`} empty="Nothing coming up in the next 500 miles.">
        {dueSoon.map((t) => (
          <TaskRow key={t.item.id} task={t} onComplete={() => confirmComplete(t)} />
        ))}
      </Section>

      <Section title="Upcoming" empty="">
        {upcoming.map((t) => (
          <TaskRow key={t.item.id} task={t} onComplete={() => confirmComplete(t)} />
        ))}
      </Section>

      <Text style={styles.disclaimer}>
        Intervals are industry-standard averages — your owner's manual takes precedence.
      </Text>
      <View style={{ height: spacing.xl }} />
    </ScrollView>
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

function TaskRow({ task, onComplete }: { task: ComputedTask; onComplete: () => void }) {
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
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingTop: 64 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  h1: { color: colors.text, fontSize: 24, fontWeight: '800' },
  sub: { color: colors.textDim, fontSize: 14, marginTop: 2 },
  mileageCard: { marginBottom: spacing.md },
  mileageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mileageValue: { color: colors.text, fontSize: 26, fontWeight: '800' },
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
  disclaimer: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
