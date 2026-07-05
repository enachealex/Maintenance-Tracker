import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './ui';
import { colors, spacing } from '../theme';
import {
  getPermission,
  PermState,
  requestPermission,
  WEB_NOTIFICATIONS_SUPPORTED,
} from '../webNotifications';

/**
 * Shown on the garage screen when running as a web/PWA and notifications
 * aren't enabled yet. Tapping "Enable" triggers the browser permission
 * prompt (which must come from a user gesture). Renders nothing on native
 * or once permission is granted.
 */
export default function NotificationPrompt({
  onEnabled,
  onSendTest,
}: {
  onEnabled: () => void;
  onSendTest: () => void;
}) {
  const [perm, setPerm] = useState<PermState>(getPermission());
  const [tested, setTested] = useState(false);

  if (!WEB_NOTIFICATIONS_SUPPORTED) return null;

  const ask = async () => {
    const result = await requestPermission();
    setPerm(result);
    if (result === 'granted') onEnabled();
  };

  // Reminders enabled: show a slim confirmation + a way to verify on-device.
  if (perm === 'granted') {
    return (
      <View style={styles.grantedCard}>
        <Text style={styles.grantedText}>🔔 Reminders are on for this device.</Text>
        <Button
          title={tested ? 'Test sent ✓' : 'Send a test reminder'}
          variant="ghost"
          onPress={() => {
            onSendTest();
            setTested(true);
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>🔔 Turn on maintenance reminders</Text>
      {perm === 'denied' ? (
        <Text style={styles.body}>
          Notifications are blocked for this app. Enable them in your browser's site settings
          (tap the address/lock icon → Notifications → Allow), then reopen the app.
        </Text>
      ) : (
        <>
          <Text style={styles.body}>
            Get reminded when your vehicles are due for maintenance — even when the app is closed.
            Everything stays on your device.
          </Text>
          <Button title="Enable reminders" onPress={ask} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.accentSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  grantedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.okSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ok,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  grantedText: { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  title: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: spacing.xs },
  body: { color: colors.textDim, fontSize: 14, marginBottom: spacing.md, lineHeight: 20 },
});
