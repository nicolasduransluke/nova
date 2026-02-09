'use client';

import { useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChatContainer,
  ChatHeader,
  MessageInput,
  UserProfile,
} from '@nova/ui';
import { DailySummaryCard } from '@nova/ui';
import { useChatStore } from '@/store/chat.store';
import { useProfileStore, selectIsOnboarded } from '@/store/profile.store';
import { useAuthStore } from '@/store/auth.store';

export default function ChatPage() {
  const router = useRouter();
  const [showSummary, setShowSummary] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  const { user, logout } = useAuthStore();
  const userId = user?.id;

  const {
    messages,
    isAgentTyping,
    isLoading,
    dailySummary,
    loadHistory,
    sendUserMessage,
  } = useChatStore();

  const {
    profile,
    weightLogs,
    isLoading: profileLoading,
    loadProfile,
    loadWeightLogs,
    updateProfile,
  } = useProfileStore();
  const isOnboarded = useProfileStore(selectIsOnboarded);

  // Check onboarding status
  useEffect(() => {
    if (!userId) {
      setCheckingOnboarding(false);
      return;
    }

    loadProfile(userId)
      .then(() => setCheckingOnboarding(false))
      .catch(() => {
        router.replace('/onboarding');
      });
  }, [userId, loadProfile, router]);

  useEffect(() => {
    if (!checkingOnboarding && !isOnboarded && userId) {
      router.replace('/onboarding');
    }
  }, [checkingOnboarding, isOnboarded, userId, router]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleSend = useCallback(
    async (content: string, imageUrl?: string) => {
      await sendUserMessage(content, imageUrl);
    },
    [sendUserMessage]
  );

  const handleSettings = useCallback(() => {
    setShowSummary((prev) => !prev);
  }, []);

  const handleProfile = useCallback(() => {
    if (userId) {
      loadProfile(userId);
      loadWeightLogs(userId);
    }
    setShowProfile(true);
  }, [userId, loadProfile, loadWeightLogs]);

  const handleCloseProfile = useCallback(() => {
    setShowProfile(false);
  }, []);

  const handleUpdateProfile = useCallback(
    async (updates: Parameters<typeof updateProfile>[1]) => {
      if (userId) {
        await updateProfile(userId, updates);
      }
    },
    [userId, updateProfile]
  );

  const handleHistory = useCallback(() => {
    router.push('/history');
  }, [router]);

  const handleLogout = useCallback(() => {
    logout();
    window.location.href = '/login';
  }, [logout]);

  if (checkingOnboarding || isLoading) {
    return (
      <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
        <ChatHeader
          title="NOVA"
          subtitle="Cargando..."
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      <ChatHeader
        title="NOVA"
        subtitle="Coach de Déficit Calórico"
        onSettings={handleSettings}
        onProfile={handleProfile}
        onHistory={handleHistory}
        onLogout={handleLogout}
      />

      {showSummary && (
        <div className="absolute top-14 left-0 right-0 z-30">
          <div
            className="fixed inset-0 bg-black/30 z-20"
            onClick={() => setShowSummary(false)}
          />
          <div className="relative z-30 mx-4 mt-2 bg-gradient-to-br from-nova-dark via-indigo-900 to-purple-900 rounded-xl shadow-2xl">
            {dailySummary ? (
              <div className="relative">
                <DailySummaryCard summary={dailySummary} />
                <button
                  onClick={() => setShowSummary(false)}
                  className="absolute top-3 right-3 p-1 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                  aria-label="Cerrar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="text-indigo-200 text-lg mb-2">
                  Registra tu primera comida para ver tu resumen del día
                </p>
                <div className="flex justify-center gap-8 mt-4 text-indigo-300">
                  <div>
                    <p className="text-2xl font-bold text-white">0</p>
                    <p className="text-sm">kcal consumidas</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">0</p>
                    <p className="text-sm">kcal quemadas</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">--</p>
                    <p className="text-sm">déficit</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSummary(false)}
                  className="mt-4 text-indigo-400 hover:text-white text-sm transition-colors"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ChatContainer
        messages={messages}
        isAgentTyping={isAgentTyping}
        className="flex-1"
      />

      <MessageInput
        onSend={handleSend}
        placeholder="Describe tu comida o actividad..."
      />

      {showProfile && (
        <UserProfile
          profile={profile}
          weightLogs={weightLogs}
          currentWeight={dailySummary?.currentWeight ?? weightLogs[0]?.weight}
          estimatedWeeks={dailySummary?.weightProgress?.estimatedWeeks}
          onUpdate={handleUpdateProfile}
          onClose={handleCloseProfile}
          isLoading={profileLoading}
          user={user}
        />
      )}
    </div>
  );
}
