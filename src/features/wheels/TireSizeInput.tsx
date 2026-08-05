import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Field } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { FitmentWarning, geometryOf, parseTireSize, validateTireSize } from '../../core/fitment';
import { SizeField, stepTireSize } from './logic';

/**
 * Tire size entry with live feedback.
 *
 * Never blocks. An unreadable string simply has nothing to show yet; a readable
 * but unusual one renders with its warnings attached. That is the Phase 3
 * contract carried into the UI — someone entering a deliberately aggressive
 * size is doing something legitimate.
 */
export default function TireSizeInput({
  label,
  value,
  onChangeText,
  suggestions,
  hint,
  stepperBase,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  suggestions?: string[];
  hint?: string;
  /**
   * Enables the width/sidewall/wheel steppers. When the field is empty, the
   * first step starts from this size — so one tap turns the fitted size into
   * the working size instead of doing nothing.
   */
  stepperBase?: string;
}) {
  const size = parseTireSize(value);
  const warnings: FitmentWarning[] = size ? validateTireSize(size) : [];
  const geometry = size ? geometryOf(size) : null;
  const unreadable = value.trim().length > 0 && !size;

  // What the stepper row displays: the working size, or the base it would
  // start from. Hidden entirely for flotation sizes, which don't step.
  const stepperShown = size ?? (stepperBase ? parseTireSize(stepperBase) : null);
  const step = (field: SizeField, direction: 1 | -1) => {
    const next = stepTireSize(value, field, direction, stepperBase);
    if (next) onChangeText(next);
  };

  return (
    <View>
      <Field
        label={label}
        value={value}
        onChangeText={onChangeText}
        placeholder="e.g. 225/45R17"
      />

      {hint && !value.trim() && <Text style={styles.hint}>{hint}</Text>}

      {stepperBase && stepperShown && stepperShown.kind === 'metric' && (
        <View style={styles.steppers}>
          <Stepper
            label="Width"
            display={`${Math.round(stepperShown.sectionWidthMm)}`}
            onStep={(d) => step('width', d)}
          />
          <Stepper
            label="Sidewall"
            display={`${Math.round(stepperShown.aspectRatio)}`}
            onStep={(d) => step('aspect', d)}
          />
          <Stepper
            label="Wheel"
            display={`${stepperShown.rimDiameterIn}"`}
            onStep={(d) => step('rim', d)}
          />
        </View>
      )}

      {suggestions && suggestions.length > 0 && (
        <View style={styles.chips}>
          {suggestions.map((s) => (
            <Pressable
              key={s}
              onPress={() => onChangeText(s)}
              style={({ pressed }) => [styles.chip, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.chipText}>{s}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {unreadable && (
        <Text style={styles.unreadable}>
          Can't read that as a tire size yet. It looks like 225/45R17 — width, aspect ratio,
          then wheel diameter.
        </Text>
      )}

      {geometry && (
        <Text style={styles.geometry}>
          {geometry.overallDiameterIn.toFixed(1)}" overall ·{' '}
          {Math.round(geometry.sidewallMm)}mm sidewall
        </Text>
      )}

      {warnings.map((w) => (
        <Text
          key={w.code}
          style={[
            styles.warning,
            w.level === 'critical' && { color: colors.danger },
            w.level === 'info' && { color: colors.textDim },
          ]}
        >
          {w.level === 'critical' ? '⚠️' : 'ℹ️'} {w.message}
        </Text>
      ))}
    </View>
  );
}

/** One −/value/+ control. The value is display-only; the buttons do the work. */
function Stepper({
  label,
  display,
  onStep,
}: {
  label: string;
  display: string;
  onStep: (direction: 1 | -1) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <Pressable
          onPress={() => onStep(-1)}
          accessibilityRole="button"
          accessibilityLabel={`${label} down`}
          style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.5 }]}
        >
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <Text style={styles.stepperValue}>{display}</Text>
        <Pressable
          onPress={() => onStep(1)}
          accessibilityRole="button"
          accessibilityLabel={`${label} up`}
          style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.5 }]}
        >
          <Text style={styles.stepBtnText}>＋</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.textDim, fontSize: 12, marginTop: -spacing.sm, marginBottom: spacing.sm },
  steppers: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  stepper: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: 4,
  },
  stepperLabel: { color: colors.textDim, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: colors.accent, fontSize: 17, fontWeight: '800' },
  stepperValue: { color: colors.text, fontSize: 15, fontWeight: '800', minWidth: 34, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.accentSoft,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  geometry: { color: colors.textDim, fontSize: 13, marginBottom: spacing.xs },
  unreadable: { color: colors.warn, fontSize: 13, marginBottom: spacing.xs },
  warning: { color: colors.warn, fontSize: 13, marginBottom: spacing.xs, lineHeight: 18 },
});
