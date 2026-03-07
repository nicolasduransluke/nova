'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';

function OAuthCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { handleOAuthCallback } = useAuthStore();

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');

    if (accessToken && refreshToken) {
      // Check if this OAuth flow was initiated from the mobile app
      // Primary: check URL param (set by API when state=mobile)
      // Fallback: check localStorage (legacy, may not persist in iOS in-app browser)
      const isMobile = searchParams.get('mobile') === 'true' || localStorage.getItem('oauth_mobile') === 'true';
      if (isMobile) {
        localStorage.removeItem('oauth_mobile');
        window.location.href = `nova://callback?accessToken=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}`;
        return;
      }

      handleOAuthCallback(accessToken, refreshToken).then(() => {
        router.push('/');
      });
    } else {
      // No tokens, redirect to login
      router.push('/login');
    }
  }, [searchParams, handleOAuthCallback, router]);

  return (
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-indigo-200">Completando inicio de sesión...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-nova-dark via-indigo-900 to-purple-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">NOVA</h1>
        </div>

        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8">
          <Suspense fallback={
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-indigo-200">Cargando...</p>
            </div>
          }>
            <OAuthCallbackHandler />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
