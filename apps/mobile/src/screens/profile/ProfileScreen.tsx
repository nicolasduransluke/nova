import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import type { Profile, ActivityLevel } from '@nova/types';
import { useAuthStore } from '@/store/auth.store';
import { useProfileStore } from '@/store/profile.store';
import { StatCard } from '@/components/profile/StatCard';
import { EditProfileForm } from '@/components/profile/EditProfileForm';
import { GlassCard } from '@/components/common/GlassCard';
import { AccountHeader } from '@/components/profile/AccountHeader';
import { useTranslation } from 'react-i18next';
import { colors } from '@/theme';
import { connectWhoop, getWhoopStatus, disconnectWhoop } from '@/lib/whoop';
import { useLanguageStore, type LanguageCode } from '@/store/language.store';

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
  const { t } = useTranslation();
  const { user, logout, deleteAccount } = useAuthStore();
  const { profile, isLoading, loadProfile, updateProfile } = useProfileStore();
  const { language, setLanguage } = useLanguageStore();

  const activityLevelLabels: Record<ActivityLevel, string> = {
    sedentary: t('profile.sedentary'),
    light: t('profile.light'),
    moderate: t('profile.moderate'),
    active: t('profile.active'),
    very_active: t('profile.veryActive'),
  };

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
      Alert.alert(t('common.error'), result.error || t('profile.whoopConnectError'));
    }
  };

  const handleDisconnectWhoop = () => {
    Alert.alert(t('profile.whoopDisconnectTitle'), t('profile.whoopDisconnectConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.whoopDisconnect'),
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
    Alert.alert(t('profile.logoutTitle'), t('profile.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.logout'),
        style: 'destructive',
        onPress: () => {
          logout();
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('profile.deleteAccountTitle'),
      t('profile.deleteAccountMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.deleteAccount'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('profile.deleteAccountConfirmTitle'),
              t('profile.deleteAccountConfirmMessage'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('profile.deleteAccountConfirmButton'),
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await deleteAccount();
                    } catch {
                      Alert.alert(t('common.error'), t('profile.deleteAccountFailure'));
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const tdee = profile ? calculateTDEE(profile) : null;
  const remaining = profile?.goalWeight
    ? (profile.weight - profile.goalWeight).toFixed(1)
    : null;
  const estimatedWeeks = profile?.goalWeight && profile?.weeklyGoal
    ? Math.round((profile.weight - profile.goalWeight) / profile.weeklyGoal)
    : null;

  return (
    <View style={styles.container}>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {profile ? (
          <>
            {/* Account */}
            {user && (
              <AccountHeader
                name={user.name}
                email={user.email}
                provider={user.provider}
              />
            )}

            {/* Stats */}
            <View style={styles.statsRow}>
              <StatCard label={t('profile.currentWeight')} value={profile.weight} unit={t('common.kg')} />
              <StatCard label={t('profile.tdee')} value={tdee ?? '—'} unit={t('common.kcal')} />
            </View>
            <Text
              style={styles.citationText}
              onPress={() => Linking.openURL('https://pubmed.ncbi.nlm.nih.gov/15883556/')}
            >
              {t('profile.tdeeCitation')}
            </Text>

            {/* Goal progress */}
            {profile.goalWeight && (
              <GlassCard>
                <Text style={styles.sectionTitle}>{t('profile.weightGoal')}</Text>
                <View style={styles.goalRow}>
                  <View style={styles.goalItem}>
                    <Text style={styles.goalValue}>{profile.goalWeight} kg</Text>
                    <Text style={styles.goalLabel}>{t('profile.goal')}</Text>
                  </View>
                  {remaining && (
                    <View style={styles.goalItem}>
                      <Text style={styles.goalValue}>{remaining} kg</Text>
                      <Text style={styles.goalLabel}>{t('profile.remaining')}</Text>
                    </View>
                  )}
                  {estimatedWeeks != null && estimatedWeeks > 0 && (
                    <View style={styles.goalItem}>
                      <Text style={styles.goalValue}>~{estimatedWeeks}</Text>
                      <Text style={styles.goalLabel}>{t('profile.weeks')}</Text>
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
                    <Text style={styles.sectionTitle}>{t('profile.settings')}</Text>
                    <Pressable onPress={() => setEditing(true)} style={styles.editButton}>
                      <Text style={styles.editText}>{t('common.edit')}</Text>
                    </Pressable>
                  </View>

                  <View style={styles.infoGrid}>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>{t('profile.height')}</Text>
                      <Text style={styles.infoValue}>{profile.height} {t('common.cm')}</Text>
                    </View>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>{t('profile.age')}</Text>
                      <Text style={styles.infoValue}>{profile.age}</Text>
                    </View>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>{t('profile.sex')}</Text>
                      <Text style={styles.infoValue}>
                        {profile.sex === 'male' ? t('profile.male') : t('profile.female')}
                      </Text>
                    </View>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>{t('profile.activity')}</Text>
                      <Text style={styles.infoValue}>
                        {activityLevelLabels[profile.activityLevel] || t('profile.moderate')}
                      </Text>
                    </View>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>{t('profile.weeklyGoal')}</Text>
                      <Text style={styles.infoValue}>{profile.weeklyGoal ?? 0.5} {t('common.kgPerWeek')}</Text>
                    </View>
                  </View>
                </>
              )}
            </GlassCard>

            {/* Whoop */}
            <GlassCard style={{ marginTop: 16 }}>
              <Text style={styles.sectionTitle}>{t('profile.whoop')}</Text>
              {whoopLoading ? (
                <ActivityIndicator color={colors.primaryLight} />
              ) : whoopConnected ? (
                <>
                  <Text style={styles.whoopStatus}>
                    {whoopConnectedAt
                      ? t('profile.whoopConnectedSince', { date: new Date(whoopConnectedAt).toLocaleDateString() })
                      : t('profile.whoopConnected')}
                  </Text>
                  <Pressable onPress={handleDisconnectWhoop} style={styles.whoopDisconnect}>
                    <Text style={styles.whoopDisconnectText}>{t('profile.whoopDisconnect')}</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable onPress={handleConnectWhoop} style={styles.whoopConnect}>
                  <Text style={styles.whoopConnectText}>{t('profile.whoopConnect')}</Text>
                </Pressable>
              )}
            </GlassCard>

            {/* Language */}
            <GlassCard style={{ marginTop: 16 }}>
              <Text style={styles.sectionTitle}>{t('profile.language')}</Text>
              <View style={styles.languageRow}>
                {(['es', 'en'] as LanguageCode[]).map((lang) => (
                  <Pressable
                    key={lang}
                    onPress={() => setLanguage(lang)}
                    style={[
                      styles.languageChip,
                      language === lang && styles.languageChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.languageChipText,
                        language === lang && styles.languageChipTextActive,
                      ]}
                    >
                      {lang === 'es' ? 'Español' : 'English'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </GlassCard>

            {/* Logout */}
            <Pressable onPress={handleLogout} style={styles.logoutButton}>
              <Text style={styles.logoutText}>{t('profile.logout')}</Text>
            </Pressable>

            {/* Delete account */}
            <Pressable onPress={handleDeleteAccount} style={styles.deleteButton}>
              <Text style={styles.deleteText}>{t('profile.deleteAccount')}</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('profile.loadingProfile')}</Text>
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
  languageRow: {
    flexDirection: 'row',
    gap: 12,
  },
  languageChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.glass.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  languageChipActive: {
    backgroundColor: 'rgba(147,51,234,0.2)',
    borderColor: colors.primary,
  },
  languageChipText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  languageChipTextActive: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  citationText: {
    fontSize: 11,
    color: colors.text.muted,
    marginBottom: 16,
    marginTop: -8,
    paddingHorizontal: 4,
    textDecorationLine: 'underline',
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
  deleteButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.5)',
    backgroundColor: 'rgba(239,68,68,0.15)',
    alignItems: 'center',
  },
  deleteText: {
    color: '#ef4444',
    fontSize: 14,
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
