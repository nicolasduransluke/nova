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
  const [ready, setReady] = useState(false);
  // null = not checked yet, true/false = onboarded status at load time
  const [wasOnboardedOnLoad, setWasOnboardedOnLoad] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    loadProfile(user.id)
      .then(() => {
        // Capture onboarded status at load time (before form interaction)
        const onboarded = selectIsOnboarded(useProfileStore.getState());
        setWasOnboardedOnLoad(onboarded);
        setReady(true);
      })
      .catch(() => {
        // 404 expected for new users - show form
        setWasOnboardedOnLoad(false);
        setReady(true);
      });
  }, [user?.id, loadProfile]);

  // Only redirect if user was already onboarded when the page first loaded
  useEffect(() => {
    if (wasOnboardedOnLoad === true) {
      router.replace('/');
    }
  }, [wasOnboardedOnLoad, router]);

  if (!user) return null;

  if (!ready || wasOnboardedOnLoad === true) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-nova-dark via-indigo-900 to-purple-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
      </main>
    );
  }

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
