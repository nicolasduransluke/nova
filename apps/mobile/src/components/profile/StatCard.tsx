import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme';

interface Props {
  label: string;
  value: string | number;
  unit?: string;
}

export function StatCard({ label, value, unit }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.value}>
        {value}
        {unit && <Text style={styles.unit}> {unit}</Text>}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.glass.bg,
    borderWidth: 1,
    borderColor: colors.glass.border,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  unit: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.text.muted,
  },
  label: {
    fontSize: 12,
    color: colors.text.secondary,
  },
});
