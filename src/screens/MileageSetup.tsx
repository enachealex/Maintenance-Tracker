import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SCHEDULE } from '../data/schedule';
import { Button, Card, Field } from '../components/ui';
import { colors, spacing } from '../theme';
import { ScheduleItem, Vehicle } from '../types';

export type HistoryChoice = 'recent' | 'while-ago' | 'unknown';

export interface HistoryAnswer {
  choice: HistoryChoice;
  /** User's guesstimate of how many miles ago the service was done (optional). */
  milesAgo: number | null;
}

export interface MileageSetupResult {
  mileage: number;
  answers: Record<string, HistoryAnswer>;
}

/**
 * Second onboarding step: current odometer reading, then a quick
 * questionnaire about when each service was last performed so the
 * initial checklist reflects reality instead of assuming nothing
 * was ever done.
 */
export default function MileageSetup({
  vehicle,
  onDone,
}: {
  vehicle: Vehicle;
  onDone: (result: MileageSetupResult) => void;
}) {
  const [mileageText, setMileageText] = useState('');
  const [step, setStep] = useState<'mileage' | 'history'>('mileage');
  const [choices, setChoices] = useState<Record<string, HistoryChoice>>({});
  const [milesAgoText, setMilesAgoText] = useState<Record<string, string>>({});

  const mileage = parseInt(mileageText.replace(/[^0-9]/g, ''), 10) || 0;

  // Only ask about services the car is old enough to have needed at least once.
  const relevant = useMemo(
    () => SCHEDULE.filter((item) => mileage >= item.intervalMiles),
    [mileage, step],
  );

  const allAnswered = relevant.every((item) => choices[item.id]);

  const buildAnswers = (): Record<string, HistoryAnswer> => {
    const answers: Record<string, HistoryAnswer> = {};
    for (const item of relevant) {
      const choice = choices[item.id];
      if (!choice) continue;
      const parsed = parseInt((milesAgoText[item.id] ?? '').replace(/[^0-9]/g, ''), 10);
      const milesAgo = choice !== 'unknown' && parsed > 0 ? Math.min(parsed, mileage) : null;
      answers[item.id] = { choice, milesAgo };
    }
    return answers;
  };

  if (step === 'mileage') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.h1}>🧭 Current mileage</Text>
        <Text style={styles.sub}>
          {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim} · {vehicle.engine}
        </Text>
        <Card>
          <Field
            label="Odometer reading (miles)"
            value={mileageText}
            onChangeText={setMileageText}
            placeholder="e.g. 62500"
            keyboardType="numeric"
          />
        </Card>
        <Button
          title="Continue"
          disabled={mileage <= 0}
          onPress={() => {
            if (SCHEDULE.some((i) => mileage >= i.intervalMiles)) setStep('history');
            else onDone({ mileage, answers: {} });
          }}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>🗒️ Service history</Text>
      <Text style={styles.sub}>
        At {mileage.toLocaleString()} miles these services were already due at least once.
        When was each last done?
      </Text>

      {relevant.map((item) => (
        <HistoryQuestion
          key={item.id}
          item={item}
          choice={choices[item.id]}
          milesAgo={milesAgoText[item.id] ?? ''}
          onChoice={(c) => setChoices((prev) => ({ ...prev, [item.id]: c }))}
          onMilesAgo={(t) => setMilesAgoText((prev) => ({ ...prev, [item.id]: t }))}
        />
      ))}

      <Button
        title="Build my checklist"
        disabled={!allAnswered}
        onPress={() => onDone({ mileage, answers: buildAnswers() })}
      />
      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

function HistoryQuestion({
  item,
  choice,
  milesAgo,
  onChoice,
  onMilesAgo,
}: {
  item: ScheduleItem;
  choice: HistoryChoice | undefined;
  milesAgo: string;
  onChoice: (c: HistoryChoice) => void;
  onMilesAgo: (text: string) => void;
}) {
  const options: { key: HistoryChoice; label: string }[] = [
    { key: 'recent', label: 'Recently' },
    { key: 'while-ago', label: 'A while ago' },
    { key: 'unknown', label: 'Never / not sure' },
  ];
  return (
    <Card>
      <Text style={styles.itemName}>
        {item.icon} {item.name}
      </Text>
      <Text style={styles.itemMeta}>every {item.intervalMiles.toLocaleString()} mi</Text>
      <View style={styles.chipRow}>
        {options.map((o) => (
          <Pressable
            key={o.key}
            onPress={() => onChoice(o.key)}
            style={[styles.chip, choice === o.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, choice === o.key && styles.chipTextActive]}>
              {o.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {(choice === 'recent' || choice === 'while-ago') && (
        <View style={styles.milesAgoRow}>
          <Field
            label="About how many miles ago? (optional)"
            value={milesAgo}
            onChangeText={onMilesAgo}
            placeholder="e.g. 1500"
            keyboardType="numeric"
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingTop: 64 },
  h1: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: spacing.xs },
  sub: { color: colors.textDim, fontSize: 15, marginBottom: spacing.lg },
  itemName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  itemMeta: { color: colors.textDim, fontSize: 13, marginTop: 2, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipText: { color: colors.textDim, fontSize: 14 },
  chipTextActive: { color: colors.text, fontWeight: '600' },
  milesAgoRow: { marginTop: spacing.md, marginBottom: -spacing.md },
});
