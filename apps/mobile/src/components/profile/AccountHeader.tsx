import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GlassCard } from '@/components/common/GlassCard';
import { colors } from '@/theme';

const AVATAR_COLORS = [
  '#9333ea', // purple-600
  '#6366f1', // indigo-500
  '#8b5cf6', // violet-500
  '#4f46e5', // indigo-600
  '#a855f7', // purple-500
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash += name.charCodeAt(i);
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

interface AccountHeaderProps {
  name: string;
  email: string;
  provider: 'local' | 'google' | 'apple';
}

export function AccountHeader({ name, email, provider }: AccountHeaderProps) {
  const initial = (name?.charAt(0) || '?').toUpperCase();
  const avatarColor = getAvatarColor(name || 'U');

  return (
    <GlassCard style={styles.container}>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.initial}>{initial}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.email} numberOfLines={1}>{email}</Text>
          {provider !== 'local' && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {provider === 'google' ? 'Google' : 'Apple'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  info: {
    flex: 1,
    marginLeft: 16,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  email: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    color: colors.text.muted,
  },
});
