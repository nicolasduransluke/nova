'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Button, Card, UserProfile } from '@nova/ui';
import { DailySummaryCard } from '@nova/ui';
import { useChatStore } from '@/store/chat.store';
import { useProfileStore } from '@/store/profile.store';
import { useAuthStore } from '@/store/auth.store';

export default function Home() {
  const { dailySummary } = useChatStore();
  const { user, logout } = useAuthStore();
  const [showProfile, setShowProfile] = useState(false);

  const userId = user?.id;

  const {
    profile,
    weightLogs,
    isLoading: profileLoading,
    loadProfile,
    loadWeightLogs,
    updateProfile,
  } = useProfileStore();

  const handleProfile = useCallback(() => {
    if (!profile && userId) {
      loadProfile(userId);
      loadWeightLogs(userId);
    }
    setShowProfile(true);
  }, [profile, userId, loadProfile, loadWeightLogs]);

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

  const handleLogout = useCallback(() => {
    logout();
    window.location.href = '/login';
  }, [logout]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-nova-dark via-indigo-900 to-purple-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Profile and logout buttons */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button
            onClick={handleProfile}
            className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Mi Perfil"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-white"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>
          <button
            onClick={handleLogout}
            className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Cerrar sesión"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-white"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>

        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-2">
            NOVA
          </h1>
          <p className="text-xl text-indigo-200">
            Coach de Déficit Calórico
          </p>
        </header>

        {dailySummary ? (
          <div className="mb-8">
            <DailySummaryCard summary={dailySummary} />
          </div>
        ) : (
          <Card variant="elevated" className="bg-white/10 backdrop-blur-lg border border-white/20 mb-8">
            <div className="text-center py-4">
              <p className="text-indigo-200 text-lg mb-2">
                Registra tu primera comida o actividad para ver tu resumen del día
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
            </div>
          </Card>
        )}

        <div className="text-center space-y-4">
          <Link href="/chat">
            <Button variant="primary" size="lg" className="px-12 py-4 text-lg">
              Hablar con NOVA
            </Button>
          </Link>
          <div>
            <Link href="/history">
              <Button variant="outline" size="md" className="px-8 py-3 text-indigo-200 border-indigo-400/50 hover:bg-white/10">
                Ver Historial
              </Button>
            </Link>
          </div>
        </div>

        <footer className="mt-12 text-center text-indigo-300 text-sm">
          <p>NOVA v0.2.0 - Tu coach de déficit calórico</p>
        </footer>
      </div>

      {showProfile && (
        <UserProfile
          profile={profile}
          weightLogs={weightLogs}
          currentWeight={dailySummary?.currentWeight ?? weightLogs[0]?.weight}
          estimatedWeeks={dailySummary?.weightProgress?.estimatedWeeks}
          onUpdate={handleUpdateProfile}
          onClose={handleCloseProfile}
          isLoading={profileLoading}
        />
      )}
    </main>
  );
}
