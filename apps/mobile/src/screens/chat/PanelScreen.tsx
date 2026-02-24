import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { useChatStore } from '@/store/chat.store';
import { colors } from '@/theme';

export default function PanelScreen() {
  const insets = useSafeAreaInsets();
  const { dailySummary, refreshDailySummary } = useChatStore();
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      refreshDailySummary();
    }
  }, [isFocused, refreshDailySummary]);

  if (!dailySummary) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.headerTitle}>Panel</Text>
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.emptyText}>Cargando resumen...</Text>
        </View>
      </View>
    );
  }

  const consumed = dailySummary.intake ?? 0;
  const burned = dailySummary.burn ?? 0;
  const tdee = dailySummary.tdee ?? 2000;
  const deficit = dailySummary.deficit ?? 0;
  const remaining = Math.max(0, tdee - consumed);
  const progress = tdee > 0 ? Math.min((consumed / tdee) * 100, 100) : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.headerTitle}>Panel</Text>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>Consumidas</Text>
            <Text style={styles.progressValue}>{consumed} / {tdee} kcal</Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress}%` },
                progress > 100 && styles.progressOver,
              ]}
            />
          </View>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>{'🍽️'}</Text>
            <Text style={styles.statValue}>{consumed}</Text>
            <Text style={styles.statLabel}>Consumidas</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>{'🔥'}</Text>
            <Text style={styles.statValue}>{burned}</Text>
            <Text style={styles.statLabel}>Quemadas</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>{'📉'}</Text>
            <Text style={[styles.statValue, deficit > 0 ? styles.positive : styles.negative]}>
              {deficit > 0 ? '+' : ''}{deficit}
            </Text>
            <Text style={styles.statLabel}>Déficit</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>{'🎯'}</Text>
            <Text style={styles.statValue}>{remaining}</Text>
            <Text style={styles.statLabel}>Restantes</Text>
          </View>
        </View>

        {/* Weight */}
        {dailySummary.currentWeight && (
          <View style={styles.weightSection}>
            <Text style={styles.weightLabel}>Peso actual</Text>
            <Text style={styles.weightValue}>{dailySummary.currentWeight} kg</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gradient.from,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    paddingVertical: 12,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: 14,
  },
  progressSection: {
    marginBottom: 24,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  progressValue: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '600',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  progressOver: {
    backgroundColor: colors.error,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 4,
  },
  positive: {
    color: colors.success,
  },
  negative: {
    color: colors.error,
  },
  weightSection: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  weightLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  weightValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
  },
});
