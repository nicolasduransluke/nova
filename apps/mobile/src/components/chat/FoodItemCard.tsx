import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import type { CalorieEntryItem } from '@nova/types';
import { colors } from '@/theme';

interface Props {
  item: CalorieEntryItem;
}

const sourceLabel: Record<string, { text: string; color: string }> = {
  usda: { text: 'USDA', color: '#4ade80' },
  gemini: { text: 'IA', color: '#a78bfa' },
  vision: { text: 'IA', color: '#a78bfa' },
  fallback: { text: 'est.', color: '#f87171' },
};

export function FoodItemCard({ item }: Props) {
  const [imageError, setImageError] = useState(false);
  const hasImage = !!item.imageUrl && !imageError;
  const badge = item.source ? sourceLabel[item.source] : undefined;

  return (
    <View style={styles.card}>
      {hasImage ? (
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.image}
          resizeMode="cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderEmoji}>{'\uD83C\uDF7D\uFE0F'}</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        <View style={styles.calRow}>
          <Text style={styles.calories}>~{item.calories} kcal</Text>
          {badge && (
            <Text style={[styles.sourceBadge, { color: badge.color }]}>{badge.text}</Text>
          )}
        </View>
        {item.portionSize != null && item.portionLabel && (
          <Text style={styles.portion}>
            {item.portionSize} {item.portionLabel}
          </Text>
        )}
        {(item.protein != null || item.carbs != null || item.fat != null) && (
          <Text style={styles.macros}>
            P: {item.protein ?? 0}g{'  '}C: {item.carbs ?? 0}g{'  '}G: {item.fat ?? 0}g
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 8,
    marginBottom: 6,
    gap: 10,
  },
  image: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  placeholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderEmoji: {
    fontSize: 20,
  },
  info: {
    flex: 1,
  },
  name: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  calRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  calories: {
    color: colors.text.muted,
    fontSize: 12,
  },
  sourceBadge: {
    fontSize: 9,
    fontWeight: '600',
    opacity: 0.7,
  },
  portion: {
    color: colors.text.dimmed,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 1,
  },
  macros: {
    color: colors.text.dimmed,
    fontSize: 11,
    marginTop: 1,
  },
});
