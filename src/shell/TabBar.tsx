import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import { TABS, TabKey } from './nav';

/**
 * Bottom tab bar, shown only on tab roots. It sits in normal flow below the
 * screen rather than floating over it, so scrolling content never hides
 * underneath and no content inset is needed.
 */
export default function TabBar({
  active,
  onSelect,
}: {
  active: TabKey;
  onSelect: (tab: TabKey) => void;
}) {
  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const selected = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onSelect(tab.key)}
            style={({ pressed }) => [styles.tab, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
          >
            <Text style={[styles.icon, !selected && styles.dim]}>{tab.icon}</Text>
            <Text style={[styles.label, selected ? styles.labelOn : styles.dim]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    backgroundColor: colors.card,
    paddingTop: spacing.sm,
    // Clears the home indicator on gesture-nav iPhones without pulling in a
    // safe-area dependency; web handles insets in webViewport.
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.sm,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  icon: { fontSize: 20 },
  label: { fontSize: 11, fontWeight: '700' },
  labelOn: { color: colors.accent },
  dim: { opacity: 0.55, color: colors.textDim },
});
