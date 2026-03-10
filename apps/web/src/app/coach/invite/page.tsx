'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

interface InviteResult {
  id: string;
  patientEmail: string | null;
  status: string;
  token: string;
  expiresAt: string;
}

export default function InvitePatientPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleGenerateLink() {
    setLoading(true);
    setError(null);
    setInviteLink(null);

    const res = await api.post<InviteResult>('/api/coach/invite', {});

    if (res.success && res.data) {
      const link = `${window.location.origin}/invite/${res.data.token}`;
      setInviteLink(link);
    } else {
      setError(res.error || 'Failed to generate invitation link');
    }
    setLoading(false);
  }

  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-2">Invitar Paciente</h1>
      <p className="text-white/50 text-sm mb-8">
        Genera un link de invitacion y compartelo por WhatsApp, email o como prefieras. Tu paciente lo abre, ingresa su email de Nova y listo.
      </p>

      <button
        onClick={handleGenerateLink}
        disabled={loading}
        className="w-full py-3 bg-nova-primary hover:bg-nova-primary/90 disabled:opacity-50 rounded-xl font-medium transition-colors"
      >
        {loading ? 'Generando...' : 'Generar Link de Invitacion'}
      </button>

      {error && (
        <div className="mt-4 p-4 rounded-xl text-sm bg-red-500/10 border border-red-500/20 text-red-400">
          {error}
        </div>
      )}

      {inviteLink && (
        <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
          <p className="text-sm text-white/70 mb-3">Comparte este link con tu paciente:</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={inviteLink}
              className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm truncate"
            />
            <button
              onClick={copyLink}
              className="px-4 py-2 bg-nova-primary hover:bg-nova-primary/90 rounded-lg text-sm font-medium whitespace-nowrap transition-colors"
            >
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          <p className="text-xs text-white/30 mt-3">
            El link expira en 7 dias
          </p>
        </div>
      )}
    </div>
  );
}
