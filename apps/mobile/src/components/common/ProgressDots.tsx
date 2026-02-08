import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '@/theme';

interface Props {
  total: number;
  current: number;
}

export function ProgressDots({ total, current }: Props) {
  return (
    <View style={styles.container}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === current && styles.active,
            i < current && styles.completed,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  active: {
    width: 32,
    backgroundColor: colors.primary,
  },
  completed: {
    backgroundColor: 'rgba(147,51,234,0.7)',
  },
});
