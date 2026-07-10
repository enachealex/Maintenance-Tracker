import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { colors, spacing } from '../theme';

/**
 * Scrolling screen container. On wide (desktop web) viewports the content is
 * constrained to a centered column instead of stretching edge to edge.
 */
export function Screen({
  children,
  topPadding = 64,
}: {
  children: React.ReactNode;
  topPadding?: number;
}) {
  return (
    <ScrollView
      style={styles.screenBg}
      contentContainerStyle={[styles.screenContent, { paddingTop: topPadding }]}
    >
      <View style={styles.screenColumn}>{children}</View>
    </ScrollView>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && { backgroundColor: colors.accent },
        variant === 'ghost' && {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.cardBorder,
        },
        variant === 'danger' && { backgroundColor: colors.dangerSoft },
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'ghost' && { color: colors.textDim },
          variant === 'danger' && { color: colors.danger },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/**
 * A form field that opens a full-screen searchable picker.
 * Used for the cascading Year → Make → Model → Trim selection.
 */
export function SelectField({
  label,
  value,
  placeholder,
  options,
  loading,
  disabled,
  onSelect,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  options: string[];
  loading?: boolean;
  disabled?: boolean;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { width: winW, height: winH } = useWindowDimensions();
  // On wide (desktop) viewports the options open as a centered dialog card
  // instead of taking over the whole page; phones keep the full-screen picker.
  const wide = winW >= 768;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  }, [options, query]);

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={[styles.select, disabled && { opacity: 0.4 }]}
        disabled={disabled || loading}
        onPress={() => {
          setQuery('');
          setOpen(true);
        }}
      >
        {loading ? (
          <ActivityIndicator color={colors.accent} size="small" />
        ) : (
          <Text style={[styles.selectText, !value && { color: colors.textDim }]}>
            {value ?? placeholder}
          </Text>
        )}
        <Text style={{ color: colors.textDim }}>▾</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        // react-native-web fails to unmount slide-animated modals
        animationType={Platform.OS === 'web' ? 'none' : 'slide'}
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={[styles.backdrop, wide && styles.backdropWide]}
          onPress={() => setOpen(false)}
        >
          <Pressable
            style={[
              styles.sheet,
              wide
                ? { width: Math.min(520, winW - 48), maxHeight: Math.round(winH * 0.7) }
                : styles.sheetFull,
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              {wide && (
                <Pressable onPress={() => setOpen(false)} hitSlop={12}>
                  <Text style={{ color: colors.accent, fontSize: 16 }}>Close</Text>
                </Pressable>
              )}
            </View>
            <TextInput
              style={styles.search}
              placeholder="Search…"
              placeholderTextColor={colors.textDim}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            <FlatList
              data={filtered}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              style={wide ? styles.listWide : styles.listFull}
              // keep the last options tappable above the floating Close button
              contentContainerStyle={!wide && { paddingBottom: 96 }}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.option, pressed && { opacity: 0.6 }]}
                  onPress={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.optionText}>{item}</Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={{ color: colors.textDim, padding: spacing.lg, textAlign: 'center' }}>
                  No matches
                </Text>
              }
            />
            {!wide && (
              <Pressable
                style={({ pressed }) => [styles.closeFab, pressed && { opacity: 0.8 }]}
                onPress={() => setOpen(false)}
                hitSlop={8}
              >
                <Text style={styles.closeFabText}>Close</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textDim}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenBg: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: spacing.md },
  screenColumn: { width: '100%', maxWidth: 900, alignSelf: 'center' },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  label: { color: colors.textDim, marginBottom: 6, fontSize: 13, fontWeight: '600' },
  select: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectText: { color: colors.text, fontSize: 16 },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  backdropWide: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  sheet: {
    backgroundColor: colors.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    paddingTop: spacing.md,
  },
  sheetFull: { flex: 1, width: '100%', borderRadius: 0, borderWidth: 0, paddingTop: 56 },
  listWide: { flexGrow: 0, flexShrink: 1 },
  listFull: { flex: 1 },
  closeFab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 28,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  closeFabText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  search: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    margin: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
  },
  option: {
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  optionText: { color: colors.text, fontSize: 16 },
});
