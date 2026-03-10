'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

interface InviteResult {
  id: string;
  patientEmail: string;
  status: string;
  token: string;
  expiresAt: string;
}

export default function InvitePatientPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setInviteLink(null);

    const res = await api.post<InviteResult>('/api/coach/invite', {
      patientEmail: email,
    });

    if (res.success && res.data) {
      const link = `${window.location.origin}/invite/${res.data.token}`;
      setInviteLink(link);
      setResult({ type: 'success', message: `Invitacion enviada a ${email}` });
      setEmail('');
    } else {
      setResult({ type: 'error', message: res.error || 'Failed to send invitation' });
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
        Invita a un paciente por email. Recibiras un link para compartir por WhatsApp o email.
      </p>

      <form onSubmit={handleInvite} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-white/70 mb-1">
            Email del paciente
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="paciente@email.com"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-nova-primary focus:ring-1 focus:ring-nova-primary transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-nova-primary hover:bg-nova-primary/90 disabled:opacity-50 rounded-xl font-medium transition-colors"
        >
          {loading ? 'Enviando...' : 'Enviar Invitacion'}
        </button>
      </form>

      {result && (
        <div
          className={`mt-4 p-4 rounded-xl text-sm ${
            result.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}
        >
          {result.message}
        </div>
      )}

      {inviteLink && (
        <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
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
        </div>
      )}
    </div>
  );
}
