import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Screen } from '../components/ui';
import { colors, spacing } from '../theme';

/**
 * Feature-level error boundary. The Wheels tab is new code sharing an app
 * with maintenance data people rely on — if it throws, the failure must stay
 * inside the tab, not white-screen the whole app. Nothing is reported
 * anywhere (decision 9): the user sees an honest message and a reset button.
 */
export default class FeatureBoundary extends React.Component<
  { name: string; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Screen>
        <Card style={styles.card}>
          <Text style={styles.title}>Something went wrong in {this.props.name}</Text>
          <Text style={styles.body}>
            Your data is safe — this screen hit an error, nothing was changed or lost. The
            rest of the app keeps working.
          </Text>
          <Button title="Try again" onPress={() => this.setState({ failed: false })} />
        </Card>
      </Screen>
    );
  }
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.xl, gap: spacing.md },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  body: { color: colors.textDim, fontSize: 14, lineHeight: 20 },
});
