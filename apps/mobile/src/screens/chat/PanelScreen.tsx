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
import { useTranslation } from 'react-i18next';
import { colors } from '@/theme';

export default function PanelScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { dailySummary, refreshDailySummary } = useChatStore();
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      refreshDailySummary();
    }
  }, [isFocused, refreshDailySummary]);

  const isLoading = dailySummary === null;
  const isEmpty = dailySummary && dailySummary.intake === 0 && dailySummary.burn === 0 && dailySummary.tdee === 0;

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.headerTitle}>{t('panel.title')}</Text>
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (isEmpty) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.headerTitle}>{t('panel.title')}</Text>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>{'🍽️'}</Text>
          <Text style={styles.emptyTitle}>{t('panel.emptyTitle')}</Text>
          <Text style={styles.emptyText}>{t('panel.emptyMessage')}</Text>
        </View>
      </View>
    );
  }

  const consumed = dailySummary.intake ?? 0;
  const burned = dailySummary.burn ?? 0;
  const tdee = dailySummary.tdee ?? 2000;
  const deficit = dailySummary.deficit ?? 0;
  const targetDeficit = dailySummary.targetDeficit ?? 550;
  const currentWeight = dailySummary.currentWeight;
  const goalWeight = dailySummary.goalWeight;

  // Use actual burn (Whoop) if available, otherwise TDEE as estimated burn
  const effectiveBurn = burned > 0 ? burned : tdee;

  // How much more can they eat and still hit their deficit target
  const disponible = Math.max(0, effectiveBurn - targetDeficit - consumed);

  // Deficit progress: how close to hitting the target deficit
  const deficitProgress = targetDeficit > 0 ? Math.min((deficit / targetDeficit) * 100, 150) : 0;
  const hitTarget = deficit >= targetDeficit;

  // Projected weight tomorrow: lose deficit/7700 kg per day
  const projectedWeight = currentWeight && deficit > 0
    ? Math.round((currentWeight - deficit / 7700) * 100) / 100
    : null;

  // Weekly weight target from backend (based on start-of-week weight, not current)
  const weeklyTarget = dailySummary.weeklyWeightTarget ?? null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.headerTitle}>Panel</Text>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Deficit progress bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>{t('panel.deficitGoal')}</Text>
            <Text style={[styles.progressValue, hitTarget && styles.progressValueHit]}>
              {deficit} / {targetDeficit} kcal
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(deficitProgress, 100)}%` },
                hitTarget && styles.progressHit,
              ]}
            />
          </View>
          {hitTarget && (
            <Text style={styles.progressHint}>{t('panel.goalMet')}</Text>
          )}
          {!hitTarget && deficitProgress > 0 && (
            <Text style={styles.progressHintNeutral}>
              {t('panel.deficitRemaining', { remaining: targetDeficit - deficit })}
            </Text>
          )}
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>{'🍽️'}</Text>
            <Text style={styles.statValue}>{consumed}</Text>
            <Text style={styles.statLabel}>{t('panel.consumed')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>{'🔥'}</Text>
            <Text style={styles.statValue}>{burned > 0 ? burned : tdee}</Text>
            <Text style={styles.statLabel}>
              {dailySummary.burnSource === 'whoop' ? t('panel.burned') : t('panel.tdeeEstimated')}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>{'📉'}</Text>
            <Text style={[styles.statValue, deficit > 0 ? styles.positive : styles.negative]}>
              {deficit > 0 ? '+' : ''}{deficit}
            </Text>
            <Text style={styles.statLabel}>{t('panel.deficit')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>{'🍴'}</Text>
            <Text style={[styles.statValue, disponible > 0 ? styles.disponible : styles.negative]}>
              {disponible}
            </Text>
            <Text style={styles.statLabel}>{t('panel.available')}</Text>
            <Text style={styles.statHint}>{t('panel.toEat')}</Text>
          </View>
        </View>

        {/* Weight projection */}
        {currentWeight && (
          <View style={styles.weightSection}>
            <Text style={styles.weightSectionTitle}>{t('panel.weight')}</Text>
            <View style={styles.weightRow}>
              <View style={styles.weightItem}>
                <Text style={styles.weightLabel}>{t('panel.current')}</Text>
                <Text style={styles.weightValue}>{currentWeight} kg</Text>
              </View>
              {projectedWeight && (
                <View style={styles.weightItem}>
                  <Text style={styles.weightLabel}>{t('panel.tomorrow')}</Text>
                  <Text style={[styles.weightValue, styles.projectedWeight]}>
                    {projectedWeight.toFixed(2)} kg
                  </Text>
                </View>
              )}
              {weeklyTarget && (
                <View style={styles.weightItem}>
                  <Text style={styles.weightLabel}>{t('panel.weeklyTarget')}</Text>
                  <Text style={[styles.weightValue, styles.goalWeightText]}>{weeklyTarget} kg</Text>
                </View>
              )}
            </View>
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
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
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
  progressValueHit: {
    color: '#86efac',
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  progressHit: {
    backgroundColor: '#22c55e',
  },
  progressHint: {
    color: '#86efac',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
  },
  progressHintNeutral: {
    color: colors.text.muted,
    fontSize: 12,
    marginTop: 6,
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
  statHint: {
    fontSize: 10,
    color: colors.text.dimmed,
    marginTop: 2,
  },
  positive: {
    color: colors.success,
  },
  negative: {
    color: colors.error,
  },
  disponible: {
    color: '#86efac',
  },
  weightSection: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
  },
  weightSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  weightRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  weightItem: {
    alignItems: 'center',
  },
  weightLabel: {
    fontSize: 11,
    color: colors.text.muted,
    marginBottom: 4,
  },
  weightValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  projectedWeight: {
    color: '#818cf8',
  },
  goalWeightText: {
    color: '#86efac',
  },
});
