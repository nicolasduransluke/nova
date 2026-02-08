import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Appearance } from 'react-native';
import { asyncStorage } from '@/lib/storage';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
}

interface ThemeActions {
  setMode: (mode: ThemeMode) => void;
}

export type ThemeStore = ThemeState & ThemeActions;

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return Appearance.getColorScheme() || 'dark';
  }
  return mode;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      mode: 'dark',
      resolvedTheme: 'dark',

      setMode: (mode: ThemeMode) => {
        set({ mode, resolvedTheme: resolveTheme(mode) });
      },
    }),
    {
      name: 'nova-theme-storage',
      storage: createJSONStorage(() => asyncStorage),
      partialize: (state) => ({ mode: state.mode }),
    },
  ),
);
