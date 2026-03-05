import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { asyncStorage } from '@/lib/storage';
import { useAuthStore } from '@/store/auth.store';
import { API_URL } from '@/config/env';
import i18n from '@/i18n';
import { capture } from '@/lib/analytics';

export type LanguageCode = 'es' | 'en';

interface LanguageState {
  language: LanguageCode;
}

interface LanguageActions {
  setLanguage: (lang: LanguageCode) => void;
}

export type LanguageStore = LanguageState & LanguageActions;

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set) => ({
      language: (i18n.language as LanguageCode) || 'es',

      setLanguage: (lang: LanguageCode) => {
        i18n.changeLanguage(lang);
        capture('language_changed', { language: lang });
        set({ language: lang });

        // Sync to server if authenticated
        const token = useAuthStore.getState().accessToken;
        if (token) {
          fetch(`${API_URL}/api/auth/language`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ language: lang }),
          }).catch(() => {});
        }
      },
    }),
    {
      name: 'nova-language-storage',
      storage: createJSONStorage(() => asyncStorage),
      partialize: (state) => ({ language: state.language }),
      onRehydrateStorage: () => (state) => {
        if (state?.language) {
          i18n.changeLanguage(state.language);
        }
      },
    },
  ),
);
