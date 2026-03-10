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

interface DashboardStats {
  totals: {
    patients: number;
    weekMessages: number;
    weekEntries: number;
    activePatients7d: number;
    avgStreak: number;
  };
  patients: {
    patientId: string;
    name: string;
    weekMessages: number;
    weekEntries: number;
    streak: number;
    activeDays30d: number;
    lastMessageAt: string | null;
  }[];
}

export default function CoachDashboard() {
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPatients();
    loadStats();
  }, []);

  async function loadPatients() {
    const res = await api.get<PatientData[]>('/api/coach/patients');
    if (res.success && res.data) {
      setPatients(res.data);
    }
    setLoading(false);
  }

  async function loadStats() {
    const res = await api.get<DashboardStats>('/api/coach/dashboard-stats');
    if (res.success && res.data) setStats(res.data);
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

      {/* Consolidated Stats */}
      {stats && stats.totals.patients > 0 && (
        <div className="mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs text-white/40 uppercase mb-1">Active Patients</p>
              <p className="text-2xl font-bold">{stats.totals.activePatients7d}<span className="text-sm text-white/40 font-normal">/{stats.totals.patients}</span></p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs text-white/40 uppercase mb-1">Messages (week)</p>
              <p className="text-2xl font-bold">{stats.totals.weekMessages}</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs text-white/40 uppercase mb-1">Entries (week)</p>
              <p className="text-2xl font-bold">{stats.totals.weekEntries}</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs text-white/40 uppercase mb-1">Avg Streak</p>
              <p className="text-2xl font-bold">{stats.totals.avgStreak}d</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs text-white/40 uppercase mb-1">Msgs / Patient</p>
              <p className="text-2xl font-bold">{stats.totals.patients > 0 ? Math.round(stats.totals.weekMessages / stats.totals.patients * 10) / 10 : 0}</p>
            </div>
          </div>

          {/* Per-patient comparison table */}
          <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/40 text-xs uppercase">
                  <th className="text-left py-2 px-4">Patient</th>
                  <th className="text-right py-2 px-4">Msgs/wk</th>
                  <th className="text-right py-2 px-4">Entries/wk</th>
                  <th className="text-right py-2 px-4">Streak</th>
                  <th className="text-right py-2 px-4">Active Days</th>
                  <th className="text-right py-2 px-4">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {stats.patients
                  .sort((a, b) => b.weekMessages - a.weekMessages)
                  .map((p) => (
                    <tr key={p.patientId} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2 px-4 font-medium">{p.name}</td>
                      <td className="py-2 px-4 text-right">{p.weekMessages}</td>
                      <td className="py-2 px-4 text-right">{p.weekEntries}</td>
                      <td className="py-2 px-4 text-right">{p.streak}d</td>
                      <td className="py-2 px-4 text-right">{p.activeDays30d}/30</td>
                      <td className="py-2 px-4 text-right text-white/40">
                        {p.lastMessageAt
                          ? (() => {
                              const diff = Date.now() - new Date(p.lastMessageAt).getTime();
                              const hrs = Math.floor(diff / 3600000);
                              if (hrs < 1) return `${Math.floor(diff / 60000)}m`;
                              if (hrs < 24) return `${hrs}h`;
                              return `${Math.floor(hrs / 24)}d`;
                            })()
                          : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
