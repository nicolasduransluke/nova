'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { HistoryDay, WeightEntry } from '@nova/types';

interface PatientDetail {
  patient: { id: string; name: string; email: string; createdAt: string; timezone: string | null };
  profile: {
    id: string;
    userId: string;
    weight: number;
    height: number;
    age: number;
    sex: string;
    objective: string;
    activityLevel: string;
    goalWeight: number | null;
    weeklyGoal: number | null;
    targetWeeks: number | null;
  } | null;
  latestWeight: { weight: number; date: string } | null;
}

interface ChatMsg {
  id: string;
  type: string;
  content: string;
  sender: string;
  createdAt: string;
}

type Tab = 'overview' | 'history' | 'weight' | 'chat';

export default function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [detail, setDetail] = useState<PatientDetail | null>(null);
  const [history, setHistory] = useState<HistoryDay[]>([]);
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDetail();
  }, [patientId]);

  useEffect(() => {
    if (tab === 'history' && history.length === 0) loadHistory();
    if (tab === 'weight' && weightHistory.length === 0) loadWeight();
    if (tab === 'chat' && messages.length === 0) loadMessages();
  }, [tab]);

  async function loadDetail() {
    const res = await api.get<PatientDetail>(`/api/coach/patients/${patientId}`);
    if (res.success && res.data) setDetail(res.data);
    setLoading(false);
  }

  async function loadHistory() {
    const res = await api.get<HistoryDay[]>(`/api/coach/patients/${patientId}/history?days=14`);
    if (res.success && res.data) setHistory(res.data);
  }

  async function loadWeight() {
    const res = await api.get<WeightEntry[]>(`/api/coach/patients/${patientId}/weight?days=60`);
    if (res.success && res.data) setWeightHistory(res.data);
  }

  async function loadMessages() {
    const res = await api.get<ChatMsg[]>(`/api/coach/patients/${patientId}/messages?limit=100`);
    if (res.success && res.data) setMessages(res.data);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-nova-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="text-center py-20">
        <p className="text-white/50">Patient not found</p>
        <Link href="/coach" className="text-nova-primary text-sm mt-2 inline-block">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const { patient, profile, latestWeight } = detail;
  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'history', label: 'Calorie History' },
    { key: 'weight', label: 'Weight' },
    { key: 'chat', label: 'Chat Log' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/coach')}
          className="text-white/40 hover:text-white transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="h-12 w-12 rounded-full bg-nova-primary/20 flex items-center justify-center text-nova-primary text-lg font-semibold">
          {patient.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold">{patient.name}</h1>
          <p className="text-sm text-white/40">{patient.email}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-white/10 pb-px">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tab === t.key
                ? 'text-nova-primary border-b-2 border-nova-primary'
                : 'text-white/50 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && <OverviewTab profile={profile} latestWeight={latestWeight} patient={patient} />}
      {tab === 'history' && <HistoryTab history={history} />}
      {tab === 'weight' && <WeightTab weightHistory={weightHistory} profile={profile} />}
      {tab === 'chat' && <ChatTab messages={messages} />}
    </div>
  );
}

function OverviewTab({
  profile,
  latestWeight,
  patient,
}: {
  profile: PatientDetail['profile'];
  latestWeight: PatientDetail['latestWeight'];
  patient: PatientDetail['patient'];
}) {
  if (!profile) {
    return <p className="text-white/40">This patient hasn&apos;t set up their profile yet.</p>;
  }

  const currentWeight = latestWeight?.weight ?? profile.weight;
  const remaining = profile.goalWeight ? currentWeight - profile.goalWeight : null;

  const stats = [
    { label: 'Current Weight', value: `${currentWeight} kg` },
    { label: 'Goal Weight', value: profile.goalWeight ? `${profile.goalWeight} kg` : '—' },
    { label: 'Remaining', value: remaining != null ? `${remaining.toFixed(1)} kg` : '—' },
    { label: 'Weekly Goal', value: profile.weeklyGoal ? `${profile.weeklyGoal} kg/wk` : '—' },
    { label: 'Height', value: `${profile.height} cm` },
    { label: 'Age', value: `${profile.age}` },
    { label: 'Sex', value: profile.sex },
    { label: 'Activity', value: profile.activityLevel.replace('_', ' ') },
    { label: 'Objective', value: profile.objective.replace('_', ' ') },
  ];

  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-white/5 border border-white/10 p-4">
            <p className="text-xs text-white/40 uppercase mb-1">{s.label}</p>
            <p className="text-lg font-semibold capitalize">{s.value}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-white/30 mt-4">
        Member since {new Date(patient.createdAt).toLocaleDateString()}
      </p>
    </div>
  );
}

function HistoryTab({ history }: { history: HistoryDay[] }) {
  if (history.length === 0) {
    return <p className="text-white/40 text-center py-12">No calorie data yet.</p>;
  }

  return (
    <div className="space-y-3">
      {history.map((day) => (
        <div key={day.date} className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">{day.date}</h3>
            <span
              className={`text-sm font-semibold ${
                day.summary.deficit > 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {day.summary.deficit > 0 ? '+' : ''}
              {day.summary.deficit} cal deficit
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div>
              <p className="text-white/40 text-xs">Intake</p>
              <p className="font-semibold">{day.summary.intake}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs">Burn</p>
              <p className="font-semibold">
                {day.summary.burn}
                {day.summary.burnSource === 'whoop' && (
                  <span className="text-xs text-nova-primary ml-1">W</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-white/40 text-xs">TDEE</p>
              <p className="font-semibold">{day.summary.tdee}</p>
            </div>
          </div>
          {day.entries.length > 0 && (
            <div className="mt-3 border-t border-white/5 pt-3 space-y-1">
              {day.entries.map((entry) => (
                <div key={entry.id} className="flex justify-between text-sm">
                  <span className="text-white/60 truncate mr-2">{entry.description}</span>
                  <span
                    className={`shrink-0 ${
                      entry.type === 'intake' ? 'text-orange-400' : 'text-emerald-400'
                    }`}
                  >
                    {entry.type === 'intake' ? '+' : '-'}
                    {entry.calories}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function WeightTab({
  weightHistory,
  profile,
}: {
  weightHistory: WeightEntry[];
  profile: PatientDetail['profile'];
}) {
  if (weightHistory.length === 0) {
    return <p className="text-white/40 text-center py-12">No weight data yet.</p>;
  }

  const first = weightHistory[0];
  const last = weightHistory[weightHistory.length - 1];
  const change = last.weight - first.weight;
  const maxW = Math.max(...weightHistory.map((w) => w.weight));
  const minW = Math.min(...weightHistory.map((w) => w.weight));
  const range = maxW - minW || 1;

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
          <p className="text-xs text-white/40">Start</p>
          <p className="text-lg font-semibold">{first.weight} kg</p>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
          <p className="text-xs text-white/40">Current</p>
          <p className="text-lg font-semibold">{last.weight} kg</p>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
          <p className="text-xs text-white/40">Change</p>
          <p className={`text-lg font-semibold ${change <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {change > 0 ? '+' : ''}
            {change.toFixed(1)} kg
          </p>
        </div>
      </div>

      {/* Simple bar chart */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <div className="flex items-end gap-1 h-40">
          {weightHistory.map((w) => {
            const height = ((w.weight - minW) / range) * 100 + 10;
            return (
              <div
                key={w.date}
                className="flex-1 group relative"
              >
                <div
                  className="bg-nova-primary/60 hover:bg-nova-primary rounded-t transition-colors mx-px"
                  style={{ height: `${height}%` }}
                />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-800 text-xs px-2 py-1 rounded whitespace-nowrap">
                  {w.date}: {w.weight}kg
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-white/30 mt-2">
          <span>{weightHistory[0]?.date}</span>
          <span>{weightHistory[weightHistory.length - 1]?.date}</span>
        </div>
        {profile?.goalWeight && (
          <p className="text-xs text-white/40 mt-2 text-center">
            Goal: {profile.goalWeight} kg
          </p>
        )}
      </div>
    </div>
  );
}

function ChatTab({ messages }: { messages: ChatMsg[] }) {
  if (messages.length === 0) {
    return <p className="text-white/40 text-center py-12">No messages yet.</p>;
  }

  // Messages come in desc order, reverse for display
  const sorted = [...messages].reverse();

  return (
    <div className="space-y-2 max-h-[600px] overflow-y-auto">
      {sorted.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
              msg.sender === 'user'
                ? 'bg-nova-primary/20 text-white'
                : 'bg-white/5 text-white/80'
            }`}
          >
            <p className="whitespace-pre-wrap">{msg.content}</p>
            <p className="text-[10px] text-white/30 mt-1">
              {new Date(msg.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
