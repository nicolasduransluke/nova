'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useProfileStore, selectIsOnboarded } from '@/store/profile.store';
import OnboardingForm from './OnboardingForm';

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { loadProfile } = useProfileStore();
  const isOnboarded = useProfileStore(selectIsOnboarded);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    loadProfile(user.id)
      .then(() => setReady(true))
      .catch(() => {
        // 404 expected for new users - show form
        setReady(true);
      });
  }, [user?.id, loadProfile]);

  useEffect(() => {
    if (ready && isOnboarded) {
      router.replace('/');
    }
  }, [ready, isOnboarded, router]);

  if (!user) return null;

  if (!ready) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-nova-dark via-indigo-900 to-purple-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
      </main>
    );
  }

  if (isOnboarded) return null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-nova-dark via-indigo-900 to-purple-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white">NOVA</h1>
        </div>
        <OnboardingForm userId={user.id} />
      </div>
    </main>
  );
}
