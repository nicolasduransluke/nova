import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import type { HistoryDay, WeightEntry } from '@nova/types';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';
import { WeightChart } from '@/components/history/WeightChart';
import { DayCard } from '@/components/history/DayCard';
import { colors } from '@/theme';

const RANGE_OPTIONS = [7, 14, 30] as const;

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { user, isGuest, logout } = useAuthStore();
  const userId = user?.id;

  const isFocused = useIsFocused();
  const [days, setDays] = useState<number>(14);
  const [history, setHistory] = useState<HistoryDay[]>([]);
  const [weight, setWeight] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    if (!userId) return;
    setLoading(true);

    Promise.all([
      api.get<HistoryDay[]>(`/api/history/daily?userId=${userId}&days=${days}`),
      api.get<WeightEntry[]>(`/api/history/weight?userId=${userId}&days=${days}`),
    ])
      .then(([dailyRes, weightRes]) => {
        setHistory(dailyRes.data ?? []);
        setWeight(weightRes.data ?? []);
      })
      .catch((err) => console.error('Error fetching history:', err))
      .finally(() => setLoading(false));
  }, [days, userId]);

  useEffect(() => {
    if (isFocused) {
      fetchData();
    }
  }, [fetchData, isFocused]);

  const renderHeader = () => (
    <View>
      {/* Range selector */}
      <View style={styles.rangeRow}>
        {RANGE_OPTIONS.map((opt) => (
          <Pressable
            key={opt}
            onPress={() => setDays(opt)}
            style={[styles.rangeButton, days === opt && styles.rangeActive]}
          >
            <Text style={[styles.rangeText, days === opt && styles.rangeTextActive]}>
              {opt} días
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Weight chart */}
      {weight.length >= 2 && <WeightChart data={weight} />}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        No hay registros en los últimos {days} días
      </Text>
    </View>
  );

  if (isGuest) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.screenTitle}>Historial</Text>
        <View style={styles.guestContainer}>
          <Text style={styles.guestTitle}>Modo Invitado</Text>
          <Text style={styles.guestMessage}>
            Crea una cuenta para guardar tu historial de comidas y ver tu progreso.
          </Text>
          <Pressable onPress={logout} style={styles.guestButton}>
            <Text style={styles.guestButtonText}>Crear cuenta</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.screenTitle}>Historial</Text>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.date}
          renderItem={({ item }) => (
            <DayCard day={item} onEntryDeleted={fetchData} />
          )}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gradient.from,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    paddingVertical: 12,
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  rangeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  rangeActive: {
    backgroundColor: colors.secondary,
  },
  rangeText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '500',
  },
  rangeTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: 14,
  },
  guestContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  guestTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 12,
  },
  guestMessage: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  guestButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  guestButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
