import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Platform } from 'react-native';
import type { User, AuthTokens, LoginResponse } from '@nova/types';
import { secureStorage } from '@/lib/storage';
import { API_URL } from '@/config/env';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfileStore } from '@/store/profile.store';
import { useChatStore } from '@/store/chat.store';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isGuest: boolean;
  hasAIConsent: boolean;
}

export interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshTokens: () => Promise<boolean>;
  forgotPassword: (email: string) => Promise<{ message: string }>;
  resetPassword: (token: string, password: string) => Promise<void>;
  setTokens: (tokens: AuthTokens) => void;
  setUser: (user: User) => void;
  setError: (error: string | null) => void;
  clearAuth: () => void;
  handleOAuthCallback: (accessToken: string, refreshToken: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  enterGuestMode: () => void;
  acceptAIConsent: () => Promise<void>;
}

export type AuthStore = AuthState & AuthActions;

const clearUserData = async () => {
  // Clear profile only (messages will be loaded from server after login)
  useProfileStore.getState().clearProfile();
  await AsyncStorage.multiRemove(['nova-profile-storage']).catch(() => {});
};

const clearAllUserData = async () => {
  // Clear everything including messages (for logout)
  useChatStore.getState().clearMessages();
  useProfileStore.getState().clearProfile();
  await AsyncStorage.multiRemove(['nova-chat-storage', 'nova-profile-storage']).catch(() => {});
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      isGuest: false,
      hasAIConsent: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        await clearUserData();

        try {
          const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || 'Login failed');
          }

          const { user, tokens } = data.data as LoginResponse;
          const metadata = (user as any).metadata as Record<string, unknown> | undefined;

          set({
            user,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            isGuest: false,
            hasAIConsent: !!metadata?.aiConsentAccepted,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Login failed',
          });
          throw error;
        }
      },

      register: async (name: string, email: string, password: string) => {
        set({ isLoading: true, error: null });
        await clearUserData();

        try {
          const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
          }

          const { user, tokens } = data.data as LoginResponse;

          set({
            user,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            isGuest: false,
            hasAIConsent: false,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Registration failed',
          });
          throw error;
        }
      },

      logout: async () => {
        const { accessToken } = get();

        if (accessToken) {
          fetch(`${API_URL}/api/auth/logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
          }).catch(() => {});
        }

        await clearAllUserData();
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null,
          isGuest: false,
          hasAIConsent: false,
        });
      },

      deleteAccount: async () => {
        const { accessToken } = get();

        if (!accessToken) return;

        const response = await fetch(`${API_URL}/api/auth/account`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Error al eliminar la cuenta');
        }

        await clearAllUserData();
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null,
          isGuest: false,
          hasAIConsent: false,
        });
      },

      refreshTokens: async () => {
        const { refreshToken } = get();

        if (!refreshToken) return false;

        try {
          const response = await fetch(`${API_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (!response.ok) {
            get().clearAuth();
            return false;
          }

          const data = await response.json();
          const { user, tokens } = data.data as LoginResponse;

          set({
            user,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            isAuthenticated: true,
          });

          return true;
        } catch {
          get().clearAuth();
          return false;
        }
      },

      forgotPassword: async (email: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || 'Failed to send reset email');
          }

          set({ isLoading: false });
          return data.data;
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to send reset email',
          });
          throw error;
        }
      },

      resetPassword: async (token: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch(`${API_URL}/api/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, password }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || 'Failed to reset password');
          }

          set({ isLoading: false });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to reset password',
          });
          throw error;
        }
      },

      setTokens: (tokens: AuthTokens) => {
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          isAuthenticated: true,
        });
      },

      setUser: (user: User) => set({ user }),

      setError: (error: string | null) => set({ error }),

      clearAuth: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null,
          isGuest: false,
          hasAIConsent: false,
        });
      },

      handleOAuthCallback: async (accessToken: string, refreshToken: string) => {
        await clearUserData();
        set({
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: true,
          isGuest: false,
        });

        try {
          const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (response.ok) {
            const data = await response.json();
            const userData = data.data;
            const metadata = (userData as any).metadata as Record<string, unknown> | undefined;
            set({
              user: userData,
              isLoading: false,
              hasAIConsent: !!metadata?.aiConsentAccepted,
            });
          } else {
            set({ isLoading: false });
          }
        } catch {
          set({ isLoading: false });
        }
      },

      loginWithGoogle: async () => {
        set({ isLoading: true, error: null });
        await clearUserData();

        try {
          const WEB_URL = 'https://nova-ebon-seven.vercel.app';
          const result = await WebBrowser.openAuthSessionAsync(
            `${WEB_URL}/auth/google/connect`,
            'nova://',
          );

          if (result.type !== 'success' || !result.url) {
            set({ isLoading: false });
            return;
          }

          const url = new URL(result.url);
          const accessToken = url.searchParams.get('accessToken');
          const refreshToken = url.searchParams.get('refreshToken');

          if (!accessToken || !refreshToken) {
            set({ isLoading: false, error: 'No se recibieron tokens de autenticación' });
            return;
          }

          await get().handleOAuthCallback(accessToken, refreshToken);
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Error al iniciar sesión con Google',
          });
        }
      },

      loginWithApple: async () => {
        if (Platform.OS !== 'ios') return;

        set({ isLoading: true, error: null });
        await clearUserData();

        try {
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          });

          if (!credential.identityToken) {
            set({ isLoading: false, error: 'No se recibió token de Apple' });
            return;
          }

          const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
            .filter(Boolean)
            .join(' ') || undefined;

          const response = await fetch(`${API_URL}/api/auth/apple/native`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              identityToken: credential.identityToken,
              fullName,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || 'Error al iniciar sesión con Apple');
          }

          const { user, tokens } = data.data as LoginResponse;
          const metadata = (user as any).metadata as Record<string, unknown> | undefined;

          set({
            user,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            isGuest: false,
            hasAIConsent: !!metadata?.aiConsentAccepted,
          });
        } catch (error: any) {
          if (error?.code === 'ERR_REQUEST_CANCELED') {
            set({ isLoading: false });
            return;
          }
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Error al iniciar sesión con Apple',
          });
        }
      },

      enterGuestMode: () => {
        clearUserData();
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: true,
          isGuest: true,
          hasAIConsent: true,
          isLoading: false,
          error: null,
        });
      },

      acceptAIConsent: async () => {
        const { accessToken } = get();
        if (!accessToken) return;

        try {
          await fetch(`${API_URL}/api/auth/ai-consent`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
          });
          set({ hasAIConsent: true });
        } catch {
          // Silently fail — consent flag will be retried
        }
      },
    }),
    {
      name: 'nova-auth-storage',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        isGuest: state.isGuest,
        hasAIConsent: state.hasAIConsent,
      }),
    },
  ),
);
