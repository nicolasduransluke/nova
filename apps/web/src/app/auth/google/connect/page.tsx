'use client';

import { useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://striking-nature-production.up.railway.app';

export default function GoogleConnect() {
  useEffect(() => {
    // Redirect to API's Google OAuth endpoint with mobile flag
    // The API passes mobile=true as OAuth state, so Google returns it in the callback
    window.location.href = `${API_URL}/api/auth/google?mobile=true`;
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
