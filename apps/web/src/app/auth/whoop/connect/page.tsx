'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

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

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // Fetch the Whoop OAuth URL from our API, then redirect
    fetch(`${apiUrl}/api/auth/whoop/auth-url`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to get auth URL');
        return res.json();
      })
      .then((data) => {
        // Navigate to Whoop OAuth (same as web flow redirect)
        window.location.href = data.url;
      })
      .catch(() => {
        setError('Error al conectar con el servidor');
      });
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
