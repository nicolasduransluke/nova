'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

export default function WhoopCallback() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Conectando con Whoop...');
  const hasCalledRef = useRef(false);

  useEffect(() => {
    // Prevent double execution in React Strict Mode
    if (hasCalledRef.current) return;
    hasCalledRef.current = true;

    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');

    // Mobile deep link flow: web flow always sends state=userId, mobile sends no state
    if (!state) {
      if (code) {
        window.location.href = `nova://whoop/callback?code=${encodeURIComponent(code)}`;
      } else {
        window.location.href = `nova://whoop/callback?error=${encodeURIComponent(error || 'unknown')}`;
      }
      return;
    }

    if (error) {
      setStatus('error');
      setMessage(`Error de autenticación: ${error}`);
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage('No se recibió código de autorización');
      return;
    }

    // Exchange the code for tokens via our API
    const exchangeCode = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

        // Get token from Zustand persisted storage
        const authStorage = localStorage.getItem('nova-auth-storage');
        let token: string | null = null;
        if (authStorage) {
          try {
            const parsed = JSON.parse(authStorage);
            token = parsed.state?.accessToken || null;
          } catch {
            console.error('Failed to parse auth storage');
          }
        }

        console.log('Whoop callback - code:', code?.substring(0, 20) + '...');
        console.log('Whoop callback - token exists:', !!token);
        console.log('Whoop callback - API URL:', apiUrl);

        const response = await fetch(`${apiUrl}/api/auth/whoop/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ code }),
        });

        console.log('Whoop callback - response status:', response.status);

        if (response.ok) {
          setStatus('success');
          setMessage('¡Whoop conectado exitosamente! Redirigiendo...');
          localStorage.removeItem('nova-onboarding-whoop-pending');
          setTimeout(() => {
            window.location.href = '/chat';
          }, 2000);
        } else {
          const data = await response.json();
          console.log('Whoop callback - error response:', data);
          setStatus('error');
          setMessage(data.message || 'Error al conectar con Whoop');
        }
      } catch (err) {
        console.error('Whoop callback - exception:', err);
        setStatus('error');
        setMessage('Error de conexión con el servidor');
      }
    };

    exchangeCode();
  }, [searchParams]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-nova-dark via-indigo-900 to-purple-900 flex items-center justify-center p-8">
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white text-lg">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-green-400 text-5xl mb-4">✓</div>
            <p className="text-white text-lg">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-red-400 text-5xl mb-4">✗</div>
            <p className="text-white text-lg mb-4">{message}</p>
            <a
              href="/chat"
              className="inline-block px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              Volver al inicio
            </a>
          </>
        )}
      </div>
    </main>
  );
}
