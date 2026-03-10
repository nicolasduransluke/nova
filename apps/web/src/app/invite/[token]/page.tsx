'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface InvitationInfo {
  coachName: string;
  coachEmail: string;
  patientEmail: string | null;
  expiresAt: string;
}

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [responding, setResponding] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadInvitation();
  }, [token]);

  async function loadInvitation() {
    try {
      const res = await fetch(`${API_URL}/api/coach/public/invitations/${token}`);
      const data = await res.json();
      if (data.success && data.data) {
        setInvitation(data.data);
        // Pre-fill email only if invitation was created for a specific email
        if (data.data.patientEmail) {
          setEmail(data.data.patientEmail);
        }
      }
    } catch {
      // Failed to load
    }
    setLoading(false);
  }

  async function handleAccept() {
    setResponding(true);
    setResult(null);
    try {
      const res = await fetch(`${API_URL}/api/coach/public/invitations/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({
          type: 'success',
          message: 'Invitacion aceptada. Tu coach ahora puede ver tu progreso en Nova.',
        });
      } else {
        setResult({
          type: 'error',
          message: data.message || data.error || 'Error al aceptar la invitacion',
        });
      }
    } catch {
      setResult({ type: 'error', message: 'Error de conexion' });
    }
    setResponding(false);
  }

  // Loading
  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#1e1b4b] via-indigo-900 to-purple-900 flex items-center justify-center p-4">
        <div className="h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  // Result
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
            {result.type === 'error' && (
              <button
                onClick={() => setResult(null)}
                className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg transition-colors"
              >
                Volver a intentar
              </button>
            )}
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
            <p className="text-white/40 text-sm">
              Esta invitacion puede haber expirado o ya fue procesada.
            </p>
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
              {invitation.coachName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white text-lg font-semibold">{invitation.coachName}</p>
              <p className="text-white/50 text-sm">{invitation.coachEmail}</p>
            </div>
          </div>

          <p className="text-white/70 text-sm mb-6 leading-relaxed">
            <strong className="text-white">{invitation.coachName}</strong> te invita a ser su paciente en Nova.
            Al aceptar, tu coach podra ver tu historial de calorias, peso y conversaciones con Nova para guiarte mejor.
          </p>

          {/* Email input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-white/70 mb-2">
              Tu email en Nova
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="tu@email.com"
            />
            <p className="text-xs text-white/30 mt-2">
              Ingresa el email con el que te registraste en Nova
            </p>
          </div>

          <button
            onClick={handleAccept}
            disabled={responding || !email}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-all"
          >
            {responding ? 'Procesando...' : 'Aceptar Invitacion'}
          </button>
        </div>
      </div>
    </main>
  );
}
