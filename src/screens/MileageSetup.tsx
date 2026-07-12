import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { OIL_TYPES, scheduleFor } from '../logic';
import { Button, Card, Field, Screen } from '../components/ui';
import { colors, spacing } from '../theme';
import { OilType, ScheduleItem, Vehicle } from '../types';

export type HistoryChoice = 'recent' | 'while-ago' | 'unknown';

export interface HistoryAnswer {
  choice: HistoryChoice;
  /** User's guesstimate of how many miles ago the service was done (optional). */
  milesAgo: number | null;
}

export interface MileageSetupResult {
  mileage: number;
  oilType: OilType;
  answers: Record<string, HistoryAnswer>;
}

const OIL_TYPE_KEYS: OilType[] = ['synthetic-blend', 'full-synthetic'];

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
  const [oilType, setOilType] = useState<OilType | null>(null);
  const [step, setStep] = useState<'mileage' | 'history'>('mileage');
  const [choices, setChoices] = useState<Record<string, HistoryChoice>>({});
  const [milesAgoText, setMilesAgoText] = useState<Record<string, string>>({});

  const mileage = parseInt(mileageText.replace(/[^0-9]/g, ''), 10) || 0;

  // The chosen oil type sets the oil-change interval everywhere below.
  const items = useMemo(() => scheduleFor(oilType ?? 'synthetic-blend'), [oilType]);

  // Only ask about services the car is old enough to have needed at least once.
  const relevant = useMemo(
    () => items.filter((item) => mileage >= item.intervalMiles),
    [items, mileage, step],
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
      <Screen>
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
        <Card>
          <Text style={styles.itemName}>🛢️ Which engine oil does it use?</Text>
          <Text style={styles.itemMeta}>This sets how often the oil change comes due.</Text>
          <View style={styles.chipRow}>
            {OIL_TYPE_KEYS.map((key) => (
              <Pressable
                key={key}
                onPress={() => setOilType(key)}
                style={[styles.chip, oilType === key && styles.chipActive]}
              >
                <Text style={[styles.chipText, oilType === key && styles.chipTextActive]}>
                  {OIL_TYPES[key].label} · every {OIL_TYPES[key].intervalMiles.toLocaleString()} mi
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.oilHint}>
            Not sure? Check your last oil-change sticker or receipt — if you still can't tell,
            Synthetic Blend is the safer guess.
          </Text>
        </Card>
        <Button
          title="Continue"
          disabled={mileage <= 0 || !oilType}
          onPress={() => {
            if (!oilType) return;
            if (items.some((i) => mileage >= i.intervalMiles)) setStep('history');
            else onDone({ mileage, oilType, answers: {} });
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
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
        disabled={!allAnswered || !oilType}
        onPress={() => oilType && onDone({ mileage, oilType, answers: buildAnswers() })}
      />
      <View style={{ height: spacing.xl }} />
    </Screen>
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
  oilHint: { color: colors.textDim, fontSize: 12, marginTop: spacing.sm },
});
