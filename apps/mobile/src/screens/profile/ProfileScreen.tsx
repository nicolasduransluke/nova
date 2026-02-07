import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Profile, ActivityLevel } from '@nova/types';
import { useAuthStore } from '@/store/auth.store';
import { useProfileStore } from '@/store/profile.store';
import { StatCard } from '@/components/profile/StatCard';
import { EditProfileForm } from '@/components/profile/EditProfileForm';
import { GlassCard } from '@/components/common/GlassCard';
import { colors } from '@/theme';
import { connectWhoop, getWhoopStatus, disconnectWhoop } from '@/lib/whoop';

const activityLevelLabels: Record<ActivityLevel, string> = {
  sedentary: 'Sedentario',
  light: 'Ligero',
  moderate: 'Moderado',
  active: 'Activo',
  very_active: 'Muy activo',
};

function calculateTDEE(profile: Profile): number {
  let bmr: number;
  if (profile.sex === 'male') {
    bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
  } else {
    bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161;
  }

  const multipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };

  return Math.round(bmr * (multipliers[profile.activityLevel] || 1.55));
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();
  const { profile, isLoading, loadProfile, updateProfile } = useProfileStore();

  const [editing, setEditing] = useState(false);
  const [whoopConnected, setWhoopConnected] = useState(false);
  const [whoopConnectedAt, setWhoopConnectedAt] = useState<string | null>(null);
  const [whoopLoading, setWhoopLoading] = useState(false);

  const checkWhoopStatus = useCallback(async () => {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;
    const status = await getWhoopStatus(token);
    setWhoopConnected(status.connected);
    setWhoopConnectedAt(status.connectedAt ?? null);
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadProfile(user.id);
      checkWhoopStatus();
    }
  }, [user?.id, loadProfile, checkWhoopStatus]);

  const handleSave = async (updates: Partial<Profile>) => {
    if (user?.id) {
      await updateProfile(user.id, updates);
      setEditing(false);
    }
  };

  const handleConnectWhoop = async () => {
    setWhoopLoading(true);
    const result = await connectWhoop();
    setWhoopLoading(false);
    if (result.success) {
      await checkWhoopStatus();
    } else {
      Alert.alert('Error', result.error || 'No se pudo conectar con Whoop');
    }
  };

  const handleDisconnectWhoop = () => {
    Alert.alert('Desconectar Whoop', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desconectar',
        style: 'destructive',
        onPress: async () => {
          const token = useAuthStore.getState().accessToken;
          if (!token) return;
          setWhoopLoading(true);
          const ok = await disconnectWhoop(token);
          setWhoopLoading(false);
          if (ok) {
            setWhoopConnected(false);
            setWhoopConnectedAt(null);
          }
        },
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: () => {
          logout();
        },
      },
    ]);
  };

  const tdee = profile ? calculateTDEE(profile) : null;
  const remaining = profile?.goalWeight
    ? (profile.weight - profile.goalWeight).toFixed(1)
    : null;
  const estimatedWeeks = profile?.goalWeight && profile?.weeklyGoal
    ? Math.round((profile.weight - profile.goalWeight) / profile.weeklyGoal)
    : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.screenTitle}>Perfil</Text>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {profile ? (
          <>
            {/* Stats */}
            <View style={styles.statsRow}>
              <StatCard label="Peso actual" value={profile.weight} unit="kg" />
              <StatCard label="TDEE" value={tdee ?? '—'} unit="kcal" />
            </View>

            {/* Goal progress */}
            {profile.goalWeight && (
              <GlassCard>
                <Text style={styles.sectionTitle}>Meta de peso</Text>
                <View style={styles.goalRow}>
                  <View style={styles.goalItem}>
                    <Text style={styles.goalValue}>{profile.goalWeight} kg</Text>
                    <Text style={styles.goalLabel}>Meta</Text>
                  </View>
                  {remaining && (
                    <View style={styles.goalItem}>
                      <Text style={styles.goalValue}>{remaining} kg</Text>
                      <Text style={styles.goalLabel}>Restante</Text>
                    </View>
                  )}
                  {estimatedWeeks != null && estimatedWeeks > 0 && (
                    <View style={styles.goalItem}>
                      <Text style={styles.goalValue}>~{estimatedWeeks}</Text>
                      <Text style={styles.goalLabel}>Semanas</Text>
                    </View>
                  )}
                </View>
              </GlassCard>
            )}

            {/* Edit / View */}
            <GlassCard>
              {editing ? (
                <EditProfileForm
                  profile={profile}
                  onSave={handleSave}
                  onCancel={() => setEditing(false)}
                  isLoading={isLoading}
                />
              ) : (
                <>
                  <View style={styles.editHeader}>
                    <Text style={styles.sectionTitle}>Configuración</Text>
                    <Pressable onPress={() => setEditing(true)} style={styles.editButton}>
                      <Text style={styles.editText}>Editar</Text>
                    </Pressable>
                  </View>

                  <View style={styles.infoGrid}>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>Altura</Text>
                      <Text style={styles.infoValue}>{profile.height} cm</Text>
                    </View>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>Edad</Text>
                      <Text style={styles.infoValue}>{profile.age}</Text>
                    </View>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>Sexo</Text>
                      <Text style={styles.infoValue}>
                        {profile.sex === 'male' ? 'Masculino' : 'Femenino'}
                      </Text>
                    </View>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>Actividad</Text>
                      <Text style={styles.infoValue}>
                        {activityLevelLabels[profile.activityLevel] || 'Moderado'}
                      </Text>
                    </View>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>Meta semanal</Text>
                      <Text style={styles.infoValue}>{profile.weeklyGoal ?? 0.5} kg/sem</Text>
                    </View>
                  </View>
                </>
              )}
            </GlassCard>

            {/* Whoop */}
            <GlassCard style={{ marginTop: 16 }}>
              <Text style={styles.sectionTitle}>Whoop</Text>
              {whoopLoading ? (
                <ActivityIndicator color={colors.primaryLight} />
              ) : whoopConnected ? (
                <>
                  <Text style={styles.whoopStatus}>
                    Conectado{whoopConnectedAt ? ` desde ${new Date(whoopConnectedAt).toLocaleDateString()}` : ''}
                  </Text>
                  <Pressable onPress={handleDisconnectWhoop} style={styles.whoopDisconnect}>
                    <Text style={styles.whoopDisconnectText}>Desconectar</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable onPress={handleConnectWhoop} style={styles.whoopConnect}>
                  <Text style={styles.whoopConnectText}>Conectar Whoop</Text>
                </Pressable>
              )}
            </GlassCard>

            {/* Logout */}
            <Pressable onPress={handleLogout} style={styles.logoutButton}>
              <Text style={styles.logoutText}>Cerrar sesión</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Cargando perfil...</Text>
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
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    paddingVertical: 12,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 12,
  },
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  goalItem: {
    alignItems: 'center',
  },
  goalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  goalLabel: {
    fontSize: 12,
    color: colors.text.muted,
  },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(147,51,234,0.2)',
  },
  editText: {
    color: colors.primaryLight,
    fontSize: 13,
    fontWeight: '500',
  },
  infoGrid: {
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  infoLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  infoValue: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
  },
  whoopStatus: {
    fontSize: 14,
    color: colors.success,
    marginBottom: 12,
  },
  whoopConnect: {
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(147,51,234,0.2)',
    alignItems: 'center',
  },
  whoopConnectText: {
    color: colors.primaryLight,
    fontSize: 15,
    fontWeight: '600',
  },
  whoopDisconnect: {
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center',
  },
  whoopDisconnectText: {
    color: '#fca5a5',
    fontSize: 14,
    fontWeight: '500',
  },
  logoutButton: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center',
  },
  logoutText: {
    color: '#fca5a5',
    fontSize: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: 14,
  },
});
