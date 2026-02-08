import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import type { CalorieEntryItem } from '@nova/types';
import { colors } from '@/theme';

interface Props {
  item: CalorieEntryItem;
}

export function FoodItemCard({ item }: Props) {
  const [imageError, setImageError] = useState(false);
  const hasImage = !!item.imageUrl && !imageError;

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
        <Text style={styles.calories}>~{item.calories} kcal</Text>
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
  calories: {
    color: colors.text.muted,
    fontSize: 12,
    marginTop: 2,
  },
});
