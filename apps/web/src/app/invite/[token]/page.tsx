'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';

interface InvitationInfo {
  id: string;
  coachId: string;
  patientEmail: string;
  status: string;
  token: string;
  expiresAt: string;
  coach: {
    id: string;
    name: string;
    email: string;
  };
}

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadInvitation();
  }, [isAuthenticated, token]);

  async function loadInvitation() {
    setLoading(true);
    const res = await api.get<InvitationInfo[]>('/api/coach/pending-invitations');
    if (res.success && res.data) {
      const match = res.data.find((inv) => inv.token === token);
      if (match) {
        setInvitation(match);
      }
    }
    setLoading(false);
  }

  async function handleRespond(action: 'accept' | 'decline') {
    setResponding(true);
    const res = await api.post(`/api/coach/invitations/${token}/${action}`, {});
    if (res.success) {
      setResult({
        type: 'success',
        message: action === 'accept'
          ? 'Invitacion aceptada. Tu coach ahora puede ver tu progreso.'
          : 'Invitacion rechazada.',
      });
      setInvitation(null);
    } else {
      setResult({ type: 'error', message: res.error || 'Error al procesar la invitacion' });
    }
    setResponding(false);
  }

  // Not logged in — prompt to login
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#1e1b4b] via-indigo-900 to-purple-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">NOVA</h1>
            <p className="text-indigo-200">Invitacion de Coach</p>
          </div>

          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-white mb-2">Un coach te ha invitado a Nova</p>
            <p className="text-white/50 text-sm mb-6">
              Inicia sesion para ver y aceptar la invitacion.
            </p>
            <Link
              href={`/login?redirect=/invite/${token}`}
              className="inline-block w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-lg transition-all text-center"
            >
              Iniciar Sesion
            </Link>
            <p className="mt-4 text-sm text-indigo-300">
              No tienes cuenta?{' '}
              <Link href={`/register?redirect=/invite/${token}`} className="text-purple-300 hover:text-purple-200 font-medium">
                Registrate
              </Link>
            </p>
          </div>
        </div>
      </main>
    );
  }

  // Loading
  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#1e1b4b] via-indigo-900 to-purple-900 flex items-center justify-center p-4">
        <div className="h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  // Result (after accept/decline)
  if (result) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#1e1b4b] via-indigo-900 to-purple-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">NOVA</h1>
          </div>
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8 text-center">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
              result.type === 'success' ? 'bg-emerald-500/20' : 'bg-red-500/20'
            }`}>
              {result.type === 'success' ? (
                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <p className={`text-lg mb-6 ${result.type === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>
              {result.message}
            </p>
            <button
              onClick={() => router.push('/chat')}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-lg transition-all"
            >
              Ir a Nova
            </button>
          </div>
        </div>
      </main>
    );
  }

  // No invitation found
  if (!invitation) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#1e1b4b] via-indigo-900 to-purple-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">NOVA</h1>
          </div>
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8 text-center">
            <p className="text-white/70 mb-2">Invitacion no encontrada</p>
            <p className="text-white/40 text-sm mb-6">
              Esta invitacion puede haber expirado, ya fue aceptada, o no corresponde a tu cuenta ({user?.email}).
            </p>
            <button
              onClick={() => router.push('/chat')}
              className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg transition-colors"
            >
              Ir a Nova
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Show invitation
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#1e1b4b] via-indigo-900 to-purple-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">NOVA</h1>
          <p className="text-indigo-200">Invitacion de Coach</p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8">
          {/* Coach info */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 text-xl font-bold">
              {invitation.coach.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white text-lg font-semibold">{invitation.coach.name}</p>
              <p className="text-white/50 text-sm">{invitation.coach.email}</p>
            </div>
          </div>

          <p className="text-white/70 text-sm mb-6 leading-relaxed">
            <strong className="text-white">{invitation.coach.name}</strong> te invita a ser su paciente en Nova.
            Al aceptar, tu coach podra ver tu historial de calorias, peso y conversaciones con Nova para guiarte mejor.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => handleRespond('accept')}
              disabled={responding}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-all"
            >
              {responding ? 'Procesando...' : 'Aceptar Invitacion'}
            </button>
            <button
              onClick={() => handleRespond('decline')}
              disabled={responding}
              className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white/70 rounded-lg transition-colors disabled:opacity-50"
            >
              Rechazar
            </button>
          </div>

          <p className="text-center text-white/30 text-xs mt-6">
            Logueado como {user?.email}
          </p>
        </div>
      </div>
    </main>
  );
}
