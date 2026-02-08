import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/theme';

interface Props {
  children: React.ReactNode;
}

export function GradientBackground({ children }: Props) {
  return (
    <LinearGradient
      colors={[colors.gradient.from, colors.gradient.via, colors.gradient.to]}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
});
