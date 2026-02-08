import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
} from 'react-native';
import type { DailySummary } from '@nova/types';
import { colors } from '@/theme';

interface Props {
  summary: DailySummary;
  visible: boolean;
  onClose: () => void;
}

export function DailySummarySheet({ summary, visible, onClose }: Props) {
  const consumed = summary.intake ?? 0;
  const burned = summary.burn ?? 0;
  const tdee = summary.tdee ?? 2000;
  const deficit = summary.deficit ?? 0;
  const remaining = Math.max(0, tdee - consumed);
  const progress = tdee > 0 ? Math.min((consumed / tdee) * 100, 100) : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Resumen del Día</Text>

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
            {summary.currentWeight && (
              <View style={styles.weightSection}>
                <Text style={styles.weightLabel}>Peso actual</Text>
                <Text style={styles.weightValue}>{summary.currentWeight} kg</Text>
              </View>
            )}
          </ScrollView>

          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Cerrar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.gradient.from,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 20,
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
    marginBottom: 24,
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
  closeButton: {
    backgroundColor: colors.glass.bg,
    borderWidth: 1,
    borderColor: colors.glass.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '500',
  },
});
