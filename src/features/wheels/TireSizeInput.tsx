import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Field } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { FitmentWarning, geometryOf, parseTireSize, validateTireSize } from '../../core/fitment';

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
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  suggestions?: string[];
  hint?: string;
}) {
  const size = parseTireSize(value);
  const warnings: FitmentWarning[] = size ? validateTireSize(size) : [];
  const geometry = size ? geometryOf(size) : null;
  const unreadable = value.trim().length > 0 && !size;

  return (
    <View>
      <Field
        label={label}
        value={value}
        onChangeText={onChangeText}
        placeholder="e.g. 225/45R17"
      />

      {hint && !value.trim() && <Text style={styles.hint}>{hint}</Text>}

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

const styles = StyleSheet.create({
  hint: { color: colors.textDim, fontSize: 12, marginTop: -spacing.sm, marginBottom: spacing.sm },
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
