import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Profile, WeightLog } from '@nova/types';
import { api } from '@/lib/api';
import { asyncStorage } from '@/lib/storage';
import i18n from '@/i18n';
import { capture } from '@/lib/analytics';

export interface ProfileState {
  profile: Profile | null;
  weightLogs: WeightLog[];
  isLoading: boolean;
  error: string | null;
}

export interface ProfileActions {
  loadProfile: (userId: string) => Promise<void>;
  loadWeightLogs: (userId: string) => Promise<void>;
  updateProfile: (userId: string, data: Partial<Profile>) => Promise<void>;
  createProfile: (data: Record<string, unknown>) => Promise<boolean>;
  setError: (error: string | null) => void;
  clearProfile: () => void;
}

export type ProfileStore = ProfileState & ProfileActions;

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set) => ({
      profile: null,
      weightLogs: [],
      isLoading: false,
      error: null,

      loadProfile: async (userId: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await api.get<Profile>(`/api/profiles/${userId}`);

          if (response.success && response.data) {
            set({ profile: response.data, isLoading: false });
          } else {
            set({ profile: null, isLoading: false, error: response.error || i18n.t('profile.profileLoadError') });
          }
        } catch (error) {
          set({
            profile: null,
            isLoading: false,
            error: error instanceof Error ? error.message : i18n.t('profile.connectionError'),
          });
        }
      },

      loadWeightLogs: async (userId: string) => {
        try {
          const response = await api.get<WeightLog[]>(`/api/weight-logs/${userId}?limit=30`);

          if (response.success && response.data) {
            set({ weightLogs: response.data });
          }
        } catch (error) {
          console.error('Error loading weight logs:', error);
        }
      },

      updateProfile: async (userId: string, updates: Partial<Profile>) => {
        set({ isLoading: true, error: null });

        try {
          const response = await api.patch<Profile>(`/api/profiles/${userId}`, updates);

          if (response.success && response.data) {
            capture('profile_updated', { fields: Object.keys(updates) });
            set({ profile: response.data, isLoading: false });
          } else {
            set({ isLoading: false, error: response.error || i18n.t('profile.profileUpdateError') });
          }
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : i18n.t('profile.connectionError'),
          });
        }
      },

      createProfile: async (data: Record<string, unknown>) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<Profile>('/api/profiles', data);
          if (response.success && response.data) {
            capture('profile_created');
            set({ profile: response.data, isLoading: false });
            return true;
          }
          set({ isLoading: false, error: response.error || i18n.t('profile.profileCreateError') });
          return false;
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : i18n.t('profile.connectionError'),
          });
          return false;
        }
      },

      setError: (error) => set({ error }),

      clearProfile: () => set({ profile: null, weightLogs: [], error: null }),
    }),
    {
      name: 'nova-profile-storage',
      storage: createJSONStorage(() => asyncStorage),
      partialize: (state) => ({
        profile: state.profile,
        weightLogs: state.weightLogs,
      }),
    },
  ),
);

export const selectIsOnboarded = (state: ProfileStore): boolean => {
  const p = state.profile;
  if (!p) return false;
  return p.weight > 0 && p.height > 0 && p.age > 0 && !!p.sex && p.goalWeight != null;
};
