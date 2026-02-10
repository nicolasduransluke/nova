'use client';

import { useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://striking-nature-production.up.railway.app';

export default function GoogleConnect() {
  useEffect(() => {
    // Flag so the callback page knows to redirect to the mobile app
    localStorage.setItem('oauth_mobile', 'true');

    // Redirect to API's Google OAuth endpoint (no token needed - this IS the login)
    window.location.href = `${API_URL}/api/auth/google`;
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-nova-dark via-indigo-900 to-purple-900 flex items-center justify-center p-8">
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-8 max-w-md w-full text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p className="text-white text-lg">Conectando con Google...</p>
      </div>
    </main>
  );
}
