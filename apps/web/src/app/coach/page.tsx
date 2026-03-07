'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface PatientData {
  patient: { id: string; name: string; email: string; createdAt: string };
  relationship: { id: string; status: string; notes: string | null; createdAt: string };
  profile: {
    weight: number;
    height: number;
    age: number;
    sex: string;
    objective: string;
    activityLevel: string;
    goalWeight: number | null;
    weeklyGoal: number | null;
  } | null;
  latestWeight: { weight: number; date: string } | null;
}

export default function CoachDashboard() {
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPatients();
  }, []);

  async function loadPatients() {
    const res = await api.get<PatientData[]>('/api/coach/patients');
    if (res.success && res.data) {
      setPatients(res.data);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-nova-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">My Patients</h1>
          <p className="text-white/50 text-sm mt-1">
            {patients.length} active {patients.length === 1 ? 'patient' : 'patients'}
          </p>
        </div>
        <Link
          href="/coach/invite"
          className="px-4 py-2 bg-nova-primary hover:bg-nova-primary/90 rounded-lg text-sm font-medium transition-colors"
        >
          + Invite Patient
        </Link>
      </div>

      {patients.length === 0 ? (
        <div className="text-center py-20 border border-white/10 rounded-2xl bg-white/5">
          <div className="text-4xl mb-4">👥</div>
          <h2 className="text-lg font-semibold mb-2">No patients yet</h2>
          <p className="text-white/50 text-sm mb-6">
            Invite your first patient to start coaching
          </p>
          <Link
            href="/coach/invite"
            className="px-4 py-2 bg-nova-primary hover:bg-nova-primary/90 rounded-lg text-sm font-medium transition-colors"
          >
            Invite Patient
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {patients.map((p) => (
            <Link
              key={p.patient.id}
              href={`/coach/patients/${p.patient.id}`}
              className="block rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-nova-primary/40 hover:bg-white/[0.08] transition-all"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-nova-primary/20 flex items-center justify-center text-nova-primary font-semibold">
                  {p.patient.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold">{p.patient.name}</h3>
                  <p className="text-xs text-white/40">{p.patient.email}</p>
                </div>
              </div>

              {p.profile ? (
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-white/5 p-2">
                    <p className="text-lg font-semibold">
                      {p.latestWeight?.weight ?? p.profile.weight}
                    </p>
                    <p className="text-[10px] text-white/40 uppercase">kg</p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-2">
                    <p className="text-lg font-semibold">
                      {p.profile.goalWeight ?? '—'}
                    </p>
                    <p className="text-[10px] text-white/40 uppercase">goal kg</p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-2">
                    <p className="text-lg font-semibold capitalize">
                      {p.profile.objective.replace('_', ' ').slice(0, 8)}
                    </p>
                    <p className="text-[10px] text-white/40 uppercase">objective</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-white/30">No profile set up yet</p>
              )}

              <p className="text-[10px] text-white/30 mt-3">
                Patient since {new Date(p.relationship.createdAt).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
