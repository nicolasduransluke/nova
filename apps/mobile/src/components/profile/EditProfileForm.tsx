import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
} from 'react-native';
import type { Profile, ActivityLevel } from '@nova/types';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { colors } from '@/theme';

const ACTIVITY_LEVELS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentario' },
  { value: 'light', label: 'Ligero' },
  { value: 'moderate', label: 'Moderado' },
  { value: 'active', label: 'Activo' },
  { value: 'very_active', label: 'Muy activo' },
];

const WEEKLY_OPTIONS = [
  { value: 0.25, label: '0.25 kg' },
  { value: 0.5, label: '0.5 kg' },
  { value: 0.75, label: '0.75 kg' },
  { value: 1.0, label: '1.0 kg' },
];

interface Props {
  profile: Profile;
  onSave: (updates: Partial<Profile>) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export function EditProfileForm({ profile, onSave, onCancel, isLoading }: Props) {
  const [form, setForm] = useState({
    weight: String(profile.weight),
    height: String(profile.height),
    age: String(profile.age),
    goalWeight: String(profile.goalWeight ?? ''),
    weeklyGoal: profile.weeklyGoal ?? 0.5,
    activityLevel: profile.activityLevel ?? 'moderate' as ActivityLevel,
  });

  const handleSave = async () => {
    const updates: Partial<Profile> = {};
    const w = parseFloat(form.weight);
    const h = parseFloat(form.height);
    const a = parseInt(form.age, 10);
    const gw = parseFloat(form.goalWeight);

    if (w && w !== profile.weight) updates.weight = w;
    if (h && h !== profile.height) updates.height = h;
    if (a && a !== profile.age) updates.age = a;
    if (gw && gw !== profile.goalWeight) updates.goalWeight = gw;
    if (form.weeklyGoal !== profile.weeklyGoal) updates.weeklyGoal = form.weeklyGoal;
    if (form.activityLevel !== profile.activityLevel) updates.activityLevel = form.activityLevel;

    if (Object.keys(updates).length > 0) {
      await onSave(updates);
    } else {
      onCancel();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Datos básicos</Text>

      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.label}>Peso (kg)</Text>
          <TextInput
            style={styles.input}
            value={form.weight}
            onChangeText={(t) => setForm({ ...form, weight: t })}
            keyboardType="decimal-pad"
            placeholderTextColor={colors.text.placeholder}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Altura (cm)</Text>
          <TextInput
            style={styles.input}
            value={form.height}
            onChangeText={(t) => setForm({ ...form, height: t })}
            keyboardType="numeric"
            placeholderTextColor={colors.text.placeholder}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.label}>Edad</Text>
          <TextInput
            style={styles.input}
            value={form.age}
            onChangeText={(t) => setForm({ ...form, age: t })}
            keyboardType="numeric"
            placeholderTextColor={colors.text.placeholder}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Peso meta (kg)</Text>
          <TextInput
            style={styles.input}
            value={form.goalWeight}
            onChangeText={(t) => setForm({ ...form, goalWeight: t })}
            keyboardType="decimal-pad"
            placeholderTextColor={colors.text.placeholder}
          />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Meta semanal</Text>
      <View style={styles.optionsRow}>
        {WEEKLY_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => setForm({ ...form, weeklyGoal: opt.value })}
            style={[
              styles.optionChip,
              form.weeklyGoal === opt.value && styles.optionActive,
            ]}
          >
            <Text style={[
              styles.optionText,
              form.weeklyGoal === opt.value && styles.optionTextActive,
            ]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Nivel de actividad</Text>
      <View style={styles.optionsRow}>
        {ACTIVITY_LEVELS.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => setForm({ ...form, activityLevel: opt.value })}
            style={[
              styles.optionChip,
              form.activityLevel === opt.value && styles.optionActive,
            ]}
          >
            <Text style={[
              styles.optionText,
              form.activityLevel === opt.value && styles.optionTextActive,
            ]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.buttonsRow}>
        <Pressable onPress={onCancel} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </Pressable>
        <PrimaryButton
          title={isLoading ? 'Guardando...' : 'Guardar'}
          onPress={handleSave}
          loading={isLoading}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  field: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.glass.bgLight,
    borderWidth: 1,
    borderColor: colors.glass.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text.primary,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.glass.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  optionActive: {
    backgroundColor: 'rgba(147,51,234,0.2)',
    borderColor: colors.primary,
  },
  optionText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  optionTextActive: {
    color: colors.text.primary,
    fontWeight: '500',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.glass.border,
    justifyContent: 'center',
  },
  cancelText: {
    color: colors.text.muted,
    fontSize: 14,
  },
});
