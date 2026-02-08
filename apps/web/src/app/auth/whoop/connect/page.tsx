'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

const WHOOP_CLIENT_ID = '8e820c10-a75d-4701-867f-72fd8225d967';
const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const WHOOP_REDIRECT_URI = 'https://nova-ebon-seven.vercel.app/auth/whoop/callback';
const WHOOP_SCOPES = 'read:profile read:cycles read:recovery read:workout read:sleep read:body_measurement';

export default function WhoopConnect() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const hasCalledRef = useRef(false);

  useEffect(() => {
    if (hasCalledRef.current) return;
    hasCalledRef.current = true;

    const token = searchParams.get('token');
    if (!token) {
      setError('Token no proporcionado');
      return;
    }

    // Decode JWT to get userId for state (no verification needed - API verifies later)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const state = `mobile_${payload.sub}`;

      const params = new URLSearchParams({
        client_id: WHOOP_CLIENT_ID,
        redirect_uri: WHOOP_REDIRECT_URI,
        response_type: 'code',
        scope: WHOOP_SCOPES,
        state,
      });

      // Redirect to Whoop OAuth (from our web domain, like the web flow)
      window.location.href = `${WHOOP_AUTH_URL}?${params.toString()}`;
    } catch {
      setError('Token inválido');
    }
  }, [searchParams]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-nova-dark via-indigo-900 to-purple-900 flex items-center justify-center p-8">
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-8 max-w-md w-full text-center">
        {error ? (
          <>
            <div className="text-red-400 text-5xl mb-4">✗</div>
            <p className="text-white text-lg">{error}</p>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white text-lg">Conectando con Whoop...</p>
          </>
        )}
      </div>
    </main>
  );
}
