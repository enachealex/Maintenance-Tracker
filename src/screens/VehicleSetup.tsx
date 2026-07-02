import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { getMakes, getModels, getTrims, getYears, MakeInfo, TrimInfo } from '../api/vehicles';
import { Button, Card, Field, SelectField } from '../components/ui';
import { colors, spacing } from '../theme';
import { Vehicle } from '../types';

export default function VehicleSetup({ onDone }: { onDone: (v: Vehicle) => void }) {
  const years = useMemo(() => getYears().map(String), []);
  const [year, setYear] = useState<string | null>(null);
  const [make, setMake] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [trimChoice, setTrimChoice] = useState<TrimInfo | null>(null);

  const [makes, setMakes] = useState<MakeInfo[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [trims, setTrims] = useState<TrimInfo[]>([]);
  const [loading, setLoading] = useState<'makes' | 'models' | 'trims' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // When the trim list is empty (very new cars, rare imports), fall back to typing it.
  const [manualTrim, setManualTrim] = useState(false);
  const [trimText, setTrimText] = useState('');
  const [engineText, setEngineText] = useState('');

  useEffect(() => {
    if (!year) return;
    setMake(null);
    setModel(null);
    setTrimChoice(null);
    setError(null);
    setLoading('makes');
    getMakes(Number(year))
      .then(setMakes)
      .catch(() => setError('Could not load vehicle makes. Check your connection.'))
      .finally(() => setLoading(null));
  }, [year]);

  useEffect(() => {
    if (!year || !make) return;
    const makeId = makes.find((m) => m.name === make)?.id;
    if (!makeId) return;
    setModel(null);
    setTrimChoice(null);
    setError(null);
    setLoading('models');
    getModels(Number(year), makeId)
      .then((m) => {
        setModels(m);
        if (m.length === 0) setError(`No ${year} models found for ${make}.`);
      })
      .catch(() => setError('Could not load models. Check your connection.'))
      .finally(() => setLoading(null));
  }, [year, make]);

  useEffect(() => {
    if (!year || !make || !model) return;
    setTrimChoice(null);
    setManualTrim(false);
    setLoading('trims');
    getTrims(Number(year), make, model)
      .then((t) => {
        setTrims(t);
        if (t.length === 0) setManualTrim(true); // no data → manual entry
      })
      .finally(() => setLoading(null));
  }, [year, make, model]);

  const trimLabels = useMemo(
    () => trims.map((t) => `${t.trim} — ${t.engine}`),
    [trims],
  );

  const complete =
    year && make && model && (manualTrim ? engineText.trim().length > 0 : !!trimChoice);

  const submit = () => {
    if (!complete) return;
    onDone({
      year: Number(year),
      make: make!,
      model: model!,
      trim: manualTrim ? trimText.trim() || 'Base' : trimChoice!.trim,
      engine: manualTrim ? engineText.trim() : trimChoice!.engine,
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.md, paddingTop: 64 }}>
      <Text style={styles.h1}>🚗 Your vehicle</Text>
      <Text style={styles.sub}>
        Pick your exact car — we use it to build your maintenance schedule.
      </Text>

      <Card>
        <SelectField
          label="Year"
          value={year}
          placeholder="Select year"
          options={years}
          onSelect={setYear}
        />
        <SelectField
          label="Make"
          value={make}
          placeholder="Select make"
          options={makes.map((m) => m.name)}
          loading={loading === 'makes'}
          disabled={!year}
          onSelect={setMake}
        />
        <SelectField
          label="Model"
          value={model}
          placeholder="Select model"
          options={models}
          loading={loading === 'models'}
          disabled={!make}
          onSelect={setModel}
        />

        {!manualTrim && (
          <SelectField
            label="Sub-model & engine"
            value={trimChoice ? `${trimChoice.trim} — ${trimChoice.engine}` : null}
            placeholder="Select trim / engine"
            options={trimLabels}
            loading={loading === 'trims'}
            disabled={!model}
            onSelect={(label) => setTrimChoice(trims[trimLabels.indexOf(label)])}
          />
        )}

        {model && loading !== 'trims' && (
          <View style={styles.switchRow}>
            <Text style={{ color: colors.textDim, flex: 1 }}>
              Enter sub-model / engine manually
            </Text>
            <Switch
              value={manualTrim}
              onValueChange={setManualTrim}
              trackColor={{ true: colors.accent, false: colors.cardBorder }}
            />
          </View>
        )}

        {manualTrim && (
          <>
            <Field
              label="Sub-model / trim"
              value={trimText}
              onChangeText={setTrimText}
              placeholder="e.g. GT Premium, XLT, Touring"
            />
            <Field
              label="Engine"
              value={engineText}
              onChangeText={setEngineText}
              placeholder="e.g. 5.0L V8 (Gas)"
            />
          </>
        )}
      </Card>

      {error && <Text style={styles.error}>{error}</Text>}

      <Button title="Continue" onPress={submit} disabled={!complete} />
      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  h1: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: spacing.xs },
  sub: { color: colors.textDim, fontSize: 15, marginBottom: spacing.lg },
  error: { color: colors.danger, marginBottom: spacing.md, textAlign: 'center' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
});
