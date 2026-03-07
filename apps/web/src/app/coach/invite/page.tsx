'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

export default function InvitePatientPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const res = await api.post<{ patientEmail: string }>('/api/coach/invite', {
      patientEmail: email,
    });

    if (res.success) {
      setResult({ type: 'success', message: `Invitation sent to ${email}` });
      setEmail('');
    } else {
      setResult({ type: 'error', message: res.error || 'Failed to send invitation' });
    }
    setLoading(false);
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-2">Invite a Patient</h1>
      <p className="text-white/50 text-sm mb-8">
        Send an invitation to a patient by email. They will need to accept it in their Nova app.
      </p>

      <form onSubmit={handleInvite} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-white/70 mb-1">
            Patient email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="patient@example.com"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-nova-primary focus:ring-1 focus:ring-nova-primary transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-nova-primary hover:bg-nova-primary/90 disabled:opacity-50 rounded-xl font-medium transition-colors"
        >
          {loading ? 'Sending...' : 'Send Invitation'}
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
    </div>
  );
}
