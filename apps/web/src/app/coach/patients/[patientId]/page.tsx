'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { HistoryDay, WeightEntry, CoachingPlan, CoachingPlanGoals, CoachingPlanProgress } from '@nova/types';

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

type Tab = 'overview' | 'plan' | 'history' | 'weight' | 'chat' | 'coaching';

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
    { key: 'plan', label: 'Plan' },
    { key: 'history', label: 'Calorie History' },
    { key: 'weight', label: 'Weight' },
    { key: 'chat', label: 'Chat Log' },
    { key: 'coaching', label: 'Coaching AI' },
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
      {tab === 'overview' && <OverviewTab profile={profile} latestWeight={latestWeight} patient={patient} patientId={patientId} />}
      {tab === 'plan' && <PlanTab patientId={patientId} />}
      {tab === 'history' && <HistoryTab history={history} />}
      {tab === 'weight' && <WeightTab weightHistory={weightHistory} profile={profile} />}
      {tab === 'chat' && <ChatTab messages={messages} />}
      {tab === 'coaching' && <CoachingTab patientId={patientId} />}
    </div>
  );
}

interface UsageStats {
  totalMessages: number;
  weekMessages: number;
  totalEntries: number;
  weekEntries: number;
  totalWeightLogs: number;
  photoMessages: number;
  activeDays30d: number;
  streak: number;
  lastMessageAt: string | null;
  lastEntryAt: string | null;
}

function OverviewTab({
  profile,
  latestWeight,
  patient,
  patientId,
}: {
  profile: PatientDetail['profile'];
  latestWeight: PatientDetail['latestWeight'];
  patient: PatientDetail['patient'];
  patientId: string;
}) {
  const [usage, setUsage] = useState<UsageStats | null>(null);

  useEffect(() => {
    api.get<UsageStats>(`/api/coach/patients/${patientId}/usage`).then((res) => {
      if (res.success && res.data) setUsage(res.data);
    });
  }, [patientId]);

  if (!profile) {
    return <p className="text-white/40">This patient hasn&apos;t set up their profile yet.</p>;
  }

  const currentWeight = latestWeight?.weight ?? profile.weight;
  const remaining = profile.goalWeight ? currentWeight - profile.goalWeight : null;

  // Mifflin-St Jeor TDEE calculation
  const bmr = profile.sex === 'male'
    ? 10 * currentWeight + 6.25 * profile.height - 5 * profile.age + 5
    : 10 * currentWeight + 6.25 * profile.height - 5 * profile.age - 161;
  const activityMultipliers: Record<string, number> = {
    sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
  };
  const tdee = Math.round(bmr * (activityMultipliers[profile.activityLevel] || 1.55));

  const stats = [
    { label: 'Current Weight', value: `${currentWeight} kg` },
    { label: 'Goal Weight', value: profile.goalWeight ? `${profile.goalWeight} kg` : '—' },
    { label: 'Remaining', value: remaining != null ? `${remaining.toFixed(1)} kg` : '—' },
    { label: 'Weekly Goal', value: profile.weeklyGoal ? `${profile.weeklyGoal} kg/wk` : '—' },
    { label: 'TDEE', value: `${tdee} kcal` },
    { label: 'Height', value: `${profile.height} cm` },
    { label: 'Age', value: `${profile.age}` },
    { label: 'Sex', value: profile.sex },
    { label: 'Activity', value: profile.activityLevel.replace('_', ' ') },
    { label: 'Objective', value: profile.objective.replace('_', ' ') },
  ];

  function timeAgo(dateStr: string | null) {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

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

      {/* Usage / Adoption */}
      {usage && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-white/60 uppercase mb-3">Adoption & Usage</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs text-white/40 uppercase mb-1">Streak</p>
              <p className="text-lg font-semibold">{usage.streak}d</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs text-white/40 uppercase mb-1">Active Days (30d)</p>
              <p className="text-lg font-semibold">{usage.activeDays30d}</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs text-white/40 uppercase mb-1">Messages (week)</p>
              <p className="text-lg font-semibold">{usage.weekMessages}</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs text-white/40 uppercase mb-1">Entries (week)</p>
              <p className="text-lg font-semibold">{usage.weekEntries}</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs text-white/40 uppercase mb-1">Food Photos</p>
              <p className="text-lg font-semibold">{usage.photoMessages}</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs text-white/40 uppercase mb-1">Weight Logs</p>
              <p className="text-lg font-semibold">{usage.totalWeightLogs}</p>
            </div>
          </div>
          <div className="flex gap-6 mt-3 text-xs text-white/30">
            <span>Last message: {timeAgo(usage.lastMessageAt)}</span>
            <span>Last entry: {timeAgo(usage.lastEntryAt)}</span>
            <span>Total messages: {usage.totalMessages} | Total entries: {usage.totalEntries}</span>
          </div>
        </div>
      )}

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

// ─── Plan Tab ───────────────────────────────────────────────

function PlanTab({ patientId }: { patientId: string }) {
  const [progress, setProgress] = useState<CoachingPlanProgress | null>(null);
  const [plans, setPlans] = useState<CoachingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [insights, setInsights] = useState<string[]>([]);
  const [newInsight, setNewInsight] = useState('');
  const [savingInsights, setSavingInsights] = useState(false);

  // Smart Command Bar state
  const [commandText, setCommandText] = useState('');
  const [parsedGoals, setParsedGoals] = useState<CoachingPlanGoals | null>(null);
  const [parsedInstructions, setParsedInstructions] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Edit mode for active plan
  const [editing, setEditing] = useState(false);
  const [editGoals, setEditGoals] = useState<CoachingPlanGoals>({});
  const [editInstructions, setEditInstructions] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [patientId]);

  async function loadData() {
    setLoading(true);
    const [progressRes, plansRes, insightsRes] = await Promise.all([
      api.get<CoachingPlanProgress>(`/api/coach/patients/${patientId}/plans/progress`),
      api.get<CoachingPlan[]>(`/api/coach/patients/${patientId}/plans`),
      api.get<string[]>(`/api/coach/patients/${patientId}/insights`),
    ]);
    if (progressRes.success && progressRes.data) setProgress(progressRes.data);
    if (plansRes.success && plansRes.data) setPlans(plansRes.data);
    if (insightsRes.success && insightsRes.data) setInsights(insightsRes.data);
    setLoading(false);
  }

  function parseCommand(text: string) {
    const goals: CoachingPlanGoals = {};
    const instructionParts: string[] = [];

    // Parse calories
    const calMatch = text.match(/(\d{3,4})\s*(?:kcal|cal|calorias|calorías)/i);
    if (calMatch) goals.dailyCalories = parseInt(calMatch[1]);

    // Parse workouts
    const workoutMatch = text.match(/(\d+)\s*(?:cardio|entreno|entrenamiento|sesion|sesiones|workout|ejercicio)/i);
    if (workoutMatch) goals.weeklyWorkouts = parseInt(workoutMatch[1]);

    // Parse weight goal
    const weightMatch = text.match(/(?:bajar|perder|meta)\s*(?:de\s*)?(-?[\d.]+)\s*(?:kg|kilo)/i);
    if (weightMatch) goals.weeklyWeightGoal = parseFloat(weightMatch[1]);

    // Parse protein
    const proteinMatch = text.match(/(\d+)\s*(?:g|gr|gramos)?\s*(?:de\s*)?prote[ií]na/i);
    if (proteinMatch) goals.proteinTarget = parseInt(proteinMatch[1]);

    // Everything that wasn't captured as goals becomes instructions
    let remaining = text;
    [calMatch, workoutMatch, weightMatch, proteinMatch].forEach((m) => {
      if (m) remaining = remaining.replace(m[0], '');
    });

    // Remove patient name prefix (e.g., "Paulina:" or "para Paulina,")
    remaining = remaining.replace(/^[\w]+\s*[:,-]\s*/i, '');

    const cleaned = remaining.replace(/[,;]+/g, ',').split(',').map(s => s.trim()).filter(Boolean);
    cleaned.forEach(part => {
      if (part.length > 3) instructionParts.push(part);
    });

    const hasGoals = Object.keys(goals).length > 0;
    setParsedGoals(hasGoals ? goals : {});
    setParsedInstructions(hasGoals ? instructionParts.join('. ') : text);
    setShowPreview(hasGoals || text.trim().length > 10);
  }

  async function createPlan() {
    setCreating(true);
    const res = await api.post(`/api/coach/patients/${patientId}/plans`, {
      goals: parsedGoals,
      instructions: parsedInstructions,
    });
    if (res.success) {
      setCommandText('');
      setParsedGoals(null);
      setParsedInstructions('');
      setShowPreview(false);
      await loadData();
    }
    setCreating(false);
  }

  async function saveInsights() {
    setSavingInsights(true);
    await api.patch(`/api/coach/patients/${patientId}/insights`, { insights });
    setSavingInsights(false);
  }

  function startEditing() {
    if (!progress) return;
    const goals = progress.plan.goals as CoachingPlanGoals;
    setEditGoals({ ...goals });
    setEditInstructions(progress.plan.instructions || '');
    setEditing(true);
  }

  async function saveEdit() {
    if (!progress) return;
    setSaving(true);
    const res = await api.patch(`/api/coach/patients/${patientId}/plans/${progress.plan.id}`, {
      goals: editGoals,
      instructions: editInstructions,
    });
    if (res.success) {
      setEditing(false);
      await loadData();
    }
    setSaving(false);
  }

  function addInsight() {
    if (!newInsight.trim()) return;
    setInsights([...insights, newInsight.trim()]);
    setNewInsight('');
  }

  function removeInsight(index: number) {
    setInsights(insights.filter((_, i) => i !== index));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="h-6 w-6 border-2 border-nova-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Smart Command Bar */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <label className="block text-sm font-medium text-white/60 mb-2">
          {progress ? 'Crear Nuevo Plan (reemplaza el actual)' : 'Crear Plan Semanal'}
        </label>
        <textarea
          value={commandText}
          onChange={(e) => {
            setCommandText(e.target.value);
            parseCommand(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
          placeholder='Ej: "2000 kcal, 3 cardio, no comer tras 9pm"'
          className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-nova-primary focus:border-transparent resize-none overflow-hidden"
          rows={1}
        />

        {/* Live Preview */}
        {showPreview && parsedGoals && (
          <div className="mt-4 rounded-lg bg-white/5 border border-nova-primary/30 p-4">
            <p className="text-sm text-nova-primary font-medium mb-3">Preview del plan:</p>
            <div className="grid grid-cols-2 gap-3">
              {parsedGoals.dailyCalories != null && (
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">Calorías/día</span>
                  <input
                    type="number"
                    value={parsedGoals.dailyCalories}
                    onChange={(e) => setParsedGoals({ ...parsedGoals, dailyCalories: parseInt(e.target.value) || 0 })}
                    className="w-24 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm text-right"
                  />
                </div>
              )}
              {parsedGoals.weeklyWorkouts != null && (
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">Entrenamientos/sem</span>
                  <input
                    type="number"
                    value={parsedGoals.weeklyWorkouts}
                    onChange={(e) => setParsedGoals({ ...parsedGoals, weeklyWorkouts: parseInt(e.target.value) || 0 })}
                    className="w-24 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm text-right"
                  />
                </div>
              )}
              {parsedGoals.weeklyWeightGoal != null && (
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">Meta peso/sem</span>
                  <input
                    type="number"
                    step="0.1"
                    value={parsedGoals.weeklyWeightGoal}
                    onChange={(e) => setParsedGoals({ ...parsedGoals, weeklyWeightGoal: parseFloat(e.target.value) || 0 })}
                    className="w-24 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm text-right"
                  />
                </div>
              )}
              {parsedGoals.proteinTarget != null && (
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">Proteína/día (g)</span>
                  <input
                    type="number"
                    value={parsedGoals.proteinTarget}
                    onChange={(e) => setParsedGoals({ ...parsedGoals, proteinTarget: parseInt(e.target.value) || 0 })}
                    className="w-24 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm text-right"
                  />
                </div>
              )}
            </div>
            {parsedInstructions && (
              <div className="mt-3">
                <span className="text-white/60 text-sm">Instrucciones:</span>
                <textarea
                  value={parsedInstructions}
                  onChange={(e) => {
                    setParsedInstructions(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  onFocus={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                  className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/20 rounded text-white text-sm resize-none overflow-hidden"
                  rows={2}
                />
              </div>
            )}
            <button
              onClick={createPlan}
              disabled={creating}
              className="mt-4 w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-all"
            >
              {creating ? 'Creando...' : 'Activar Plan'}
            </button>
          </div>
        )}
      </div>

      {/* Active Plan Progress */}
      {progress && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">
              Plan v{progress.plan.version} — Semana {progress.plan.weekStart.split('T')[0]}
            </h3>
            <div className="flex items-center gap-2">
              {!editing && (
                <button
                  onClick={startEditing}
                  className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-all"
                >
                  Editar
                </button>
              )}
              <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400">
                Activo
              </span>
            </div>
          </div>

          {editing ? (
            /* ── Edit Mode ── */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 block mb-1">Calorías/día</label>
                  <input
                    type="number"
                    value={editGoals.dailyCalories ?? ''}
                    onChange={(e) => setEditGoals({ ...editGoals, dailyCalories: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="ej: 1500"
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/40 block mb-1">Entrenamientos/sem</label>
                  <input
                    type="number"
                    value={editGoals.weeklyWorkouts ?? ''}
                    onChange={(e) => setEditGoals({ ...editGoals, weeklyWorkouts: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="ej: 4"
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/40 block mb-1">Proteína/día (g)</label>
                  <input
                    type="number"
                    value={editGoals.proteinTarget ?? ''}
                    onChange={(e) => setEditGoals({ ...editGoals, proteinTarget: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="ej: 120"
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/40 block mb-1">Meta peso/sem (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editGoals.weeklyWeightGoal ?? ''}
                    onChange={(e) => setEditGoals({ ...editGoals, weeklyWeightGoal: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="ej: 0.5"
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-white/40 block mb-1">Instrucciones al AI</label>
                <textarea
                  value={editInstructions}
                  onChange={(e) => {
                    setEditInstructions(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  onFocus={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                  className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white text-sm resize-none overflow-hidden"
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="flex-1 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-all"
                >
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/60 rounded-lg text-sm transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            /* ── View Mode ── */
            <>
              <div className="space-y-3">
                {(progress.plan.goals as CoachingPlanGoals).dailyCalories != null && (
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-white/60">Calorías hoy</span>
                      <span className="text-white">
                        {progress.today.caloriesConsumed} / {(progress.plan.goals as CoachingPlanGoals).dailyCalories} kcal
                      </span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          progress.today.caloriesConsumed <= ((progress.plan.goals as CoachingPlanGoals).dailyCalories || 0)
                            ? 'bg-emerald-500'
                            : 'bg-red-500'
                        }`}
                        style={{
                          width: `${Math.min(100, (progress.today.caloriesConsumed / ((progress.plan.goals as CoachingPlanGoals).dailyCalories || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {(progress.plan.goals as CoachingPlanGoals).weeklyWorkouts != null && (
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-white/60">Entrenamientos esta semana</span>
                      <span className="text-white">
                        {progress.week.workoutsCompleted} / {(progress.plan.goals as CoachingPlanGoals).weeklyWorkouts}
                      </span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (progress.week.workoutsCompleted / ((progress.plan.goals as CoachingPlanGoals).weeklyWorkouts || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{progress.week.complianceRate}%</p>
                    <p className="text-xs text-white/40">Cumplimiento</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{progress.week.daysOnTarget}/{progress.week.daysTracked}</p>
                    <p className="text-xs text-white/40">Días en meta</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${progress.week.weightChange != null && progress.week.weightChange <= 0 ? 'text-emerald-400' : 'text-white'}`}>
                      {progress.week.weightChange != null ? `${progress.week.weightChange > 0 ? '+' : ''}${progress.week.weightChange.toFixed(1)}` : '—'}
                    </p>
                    <p className="text-xs text-white/40">Peso (kg)</p>
                  </div>
                </div>
              </div>

              {progress.plan.instructions && (
                <div className="mt-4 pt-3 border-t border-white/10">
                  <p className="text-xs text-white/40 mb-1">Instrucciones al AI:</p>
                  <p className="text-sm text-white/70">{progress.plan.instructions}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* No active plan */}
      {!progress && plans.length === 0 && (
        <div className="text-center py-12">
          <p className="text-white/40 mb-2">Sin plan activo</p>
          <p className="text-white/30 text-sm">Usa la barra de arriba para crear el primer plan</p>
        </div>
      )}

      {/* Coach Insights */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <h3 className="font-semibold text-white mb-3">Insights del Coach</h3>
        <p className="text-xs text-white/40 mb-3">Conocimiento que Nova usará para guiar a este paciente</p>

        <div className="space-y-2 mb-3">
          {insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-2 bg-white/5 rounded-lg px-3 py-2">
              <p className="text-sm text-white/70 flex-1">{insight}</p>
              <button
                onClick={() => removeInsight(i)}
                className="text-white/30 hover:text-red-400 transition-colors shrink-0"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newInsight}
            onChange={(e) => setNewInsight(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addInsight()}
            placeholder='Ej: "No le gustan los batidos de proteína"'
            className="flex-1 px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-nova-primary"
          />
          <button
            onClick={addInsight}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm rounded-lg transition-colors"
          >
            +
          </button>
        </div>

        {insights.length > 0 && (
          <button
            onClick={saveInsights}
            disabled={savingInsights}
            className="mt-3 w-full py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            {savingInsights ? 'Guardando...' : 'Guardar Insights'}
          </button>
        )}
      </div>

      {/* Plan History */}
      {plans.filter(p => p.status === 'completed').length > 0 && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <h3 className="font-semibold text-white mb-3">Historial de Planes</h3>
          <div className="space-y-2">
            {plans.filter(p => p.status === 'completed').map((plan) => (
              <div key={plan.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                <div>
                  <span className="text-sm text-white">v{plan.version}</span>
                  <span className="text-xs text-white/40 ml-2">
                    {plan.weekStart.split('T')[0]}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {plan.results && (
                    <>
                      <span className="text-white/60">
                        {(plan.results as CoachingPlan['results'] & { complianceRate: number })?.complianceRate ?? 0}% cumpl.
                      </span>
                      <span className={`${((plan.results as any)?.weightChange ?? 0) <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {((plan.results as any)?.weightChange ?? 0) > 0 ? '+' : ''}{((plan.results as any)?.weightChange ?? 0).toFixed(1)} kg
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Coaching AI Tab ──────────────────────────────────────

interface CoachingLogEntry {
  id: string;
  type: string;
  subtype: string;
  date: string;
  message: string;
  pushSent: boolean;
  sentAt: string;
  triggerData: Record<string, unknown> | null;
  disliked: boolean;
}

const TYPE_LABELS: Record<string, { label: string; schedule: string }> = {
  morning_checkin: { label: 'Morning Check-in', schedule: 'Definido en protocolo' },
  meal_reminder: { label: 'Meal Reminder', schedule: 'Definido en protocolo' },
  daily_summary: { label: 'Daily Summary', schedule: 'Definido en protocolo' },
  streak: { label: 'Streak / Milestone', schedule: 'Evento automático' },
  pattern_insight: { label: 'Pattern Insight', schedule: 'Lunes (evento)' },
  protocol_message: { label: 'Protocolo', schedule: 'Definido en protocolo' },
};

const DEFAULT_PROTOCOL = `08:30 - Pregúntale cómo va su día y si tiene algún plan de actividad física. Recomienda estrategia de alimentación.
11:00 - Si no ha registrado comida, recuérdale registrar su desayuno/almuerzo.
15:00 - Si no ha registrado comida desde las 11, recuérdale registrar su almuerzo/merienda.
21:00 - Resumen diario con balance calórico, déficit y proyección semanal.
lunes 09:00 - Revisar metas de la semana, preguntar objetivos.
streak - Celebrar streaks en días 3, 7, 14, 21, 30, 60, 90.
pattern - Analizar patrones de calorías de las últimas 2 semanas.`;

function CoachingTab({ patientId }: { patientId: string }) {
  const [logs, setLogs] = useState<CoachingLogEntry[]>([]);
  const [style, setStyle] = useState('');
  const [savedStyle, setSavedStyle] = useState('');
  const [protocol, setProtocol] = useState('');
  const [savedProtocol, setSavedProtocol] = useState('');
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [savingStyle, setSavingStyle] = useState(false);
  const [savingProtocol, setSavingProtocol] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [patientId]);

  async function loadData() {
    const [logsRes, styleRes, protocolRes] = await Promise.all([
      api.get<CoachingLogEntry[]>(`/api/coach/patients/${patientId}/coaching-logs?days=30`),
      api.get<string>(`/api/coach/patients/${patientId}/style`),
      api.get<string>(`/api/coach/patients/${patientId}/protocol`),
    ]);
    if (logsRes.success && logsRes.data) setLogs(logsRes.data);
    if (styleRes.success && styleRes.data != null) {
      setStyle(styleRes.data);
      setSavedStyle(styleRes.data);
    }
    if (protocolRes.success && protocolRes.data != null) {
      setProtocol(protocolRes.data);
      setSavedProtocol(protocolRes.data);
    }
    setLoadingLogs(false);
  }

  async function saveStyle() {
    setSavingStyle(true);
    const res = await api.patch(`/api/coach/patients/${patientId}/style`, { styleInstructions: style });
    if (res.success) setSavedStyle(style);
    setSavingStyle(false);
  }

  async function saveProtocol() {
    setSavingProtocol(true);
    const res = await api.patch(`/api/coach/patients/${patientId}/protocol`, { coachingProtocol: protocol });
    if (res.success) setSavedProtocol(protocol);
    setSavingProtocol(false);
  }

  function loadTemplate() {
    setProtocol((prev) => prev ? prev + '\n' + DEFAULT_PROTOCOL : DEFAULT_PROTOCOL);
  }

  async function handleDislike(logId: string) {
    await api.patch(`/api/coach/patients/${patientId}/coaching-logs/${logId}/dislike`, {});
    setLogs((prev) => prev.map((l) => l.id === logId ? { ...l, disliked: true } : l));
  }

  if (loadingLogs) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="h-6 w-6 border-2 border-nova-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* AI Communication Style */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-5">
        <h3 className="font-semibold mb-1">Estilo de comunicacion AI</h3>
        <p className="text-xs text-white/40 mb-3">
          Instrucciones para personalizar como la IA se comunica con este paciente en mensajes automaticos.
        </p>
        <textarea
          value={style}
          onChange={(e) => {
            setStyle(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
          onFocus={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
          placeholder='Ej: "Hablale directo, sin diminutivos. Mensajes cortos. Motivar con energia y consistencia."'
          className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white text-sm placeholder-white/30 resize-none overflow-hidden focus:outline-none focus:ring-1 focus:ring-nova-primary"
          rows={3}
        />
        {style !== savedStyle && (
          <button
            onClick={saveStyle}
            disabled={savingStyle}
            className="mt-2 px-4 py-1.5 bg-nova-primary hover:bg-nova-primary/90 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
          >
            {savingStyle ? 'Guardando...' : 'Guardar estilo'}
          </button>
        )}
      </div>

      {/* Coaching Protocol */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold">Protocolo de coaching</h3>
          {!protocol && (
            <button
              onClick={loadTemplate}
              className="text-xs text-nova-primary hover:text-nova-primary/80 transition-colors"
            >
              Cargar template base
            </button>
          )}
        </div>
        <p className="text-xs text-white/40 mb-3">
          Reglas de comportamiento para los mensajes automaticos. Define cuando y como Nova debe interactuar con este paciente.
        </p>
        <textarea
          value={protocol}
          onChange={(e) => {
            setProtocol(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
          onFocus={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
          placeholder={`Ej:\n- Si es su primera semana, pregúntale cómo se está adaptando\n- Tiene fasting hasta la 1pm, no mencionar desayuno\n- Los miércoles tiene entrenamiento, pregúntale cómo le fue\n- Si lleva 2 días sin registrar, enviar motivación extra`}
          className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white text-sm placeholder-white/30 resize-none overflow-hidden focus:outline-none focus:ring-1 focus:ring-nova-primary"
          rows={5}
        />
        <div className="flex items-center gap-2 mt-2">
          {protocol !== savedProtocol && (
            <button
              onClick={saveProtocol}
              disabled={savingProtocol}
              className="px-4 py-1.5 bg-nova-primary hover:bg-nova-primary/90 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
            >
              {savingProtocol ? 'Guardando...' : 'Guardar protocolo'}
            </button>
          )}
          {protocol && (
            <button
              onClick={loadTemplate}
              className="text-xs text-white/30 hover:text-white/50 transition-colors"
            >
              + Agregar template base
            </button>
          )}
        </div>
      </div>

      {/* Automated Messages */}
      <div>
        <h3 className="font-semibold mb-1">Mensajes automaticos</h3>
        <p className="text-xs text-white/40 mb-4">
          Historial de mensajes enviados automaticamente por NOVA (ultimos 30 dias).
        </p>

        {logs.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-8">No hay mensajes automaticos registrados.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => {
              const typeInfo = TYPE_LABELS[log.type] || { label: log.type, schedule: '—' };
              const isExpanded = expandedLog === log.id;
              return (
                <div
                  key={log.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    log.disliked ? 'bg-red-500/5 border-red-500/20' : 'bg-white/5 border-white/10'
                  }`}
                >
                  {/* Header row */}
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-nova-primary/20 text-nova-primary">
                        {typeInfo.label}
                      </span>
                      <span className="text-xs text-white/40">
                        {new Date(log.sentAt).toLocaleString()}
                      </span>
                      {log.pushSent && (
                        <span className="text-xs text-emerald-400/60" title="Push sent">push</span>
                      )}
                      {log.disliked && (
                        <span className="text-xs text-red-400">disliked</span>
                      )}
                    </div>
                    <svg
                      className={`h-4 w-4 text-white/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {/* Message preview */}
                  <p className={`text-sm text-white/70 mt-2 ${isExpanded ? '' : 'line-clamp-2'}`}>
                    {log.message}
                  </p>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-white/40">Tipo: </span>
                          <span className="text-white/70">{log.type}{log.subtype ? ` / ${log.subtype}` : ''}</span>
                        </div>
                        <div>
                          <span className="text-white/40">Horario: </span>
                          <span className="text-white/70">{typeInfo.schedule}</span>
                        </div>
                      </div>

                      {log.triggerData && (
                        <div className="text-xs">
                          <span className="text-white/40">Trigger: </span>
                          <span className="text-white/70 font-mono">
                            {Object.entries(log.triggerData)
                              .filter(([k]) => k !== 'dailyMap')
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(' | ')}
                          </span>
                        </div>
                      )}

                      {!log.disliked && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDislike(log.id); }}
                          className="text-xs text-white/30 hover:text-red-400 transition-colors flex items-center gap-1 mt-1"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3zm7-13h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" />
                          </svg>
                          Mark as bad output
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Format reference */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-5">
        <h3 className="font-semibold mb-2">Formato del protocolo</h3>
        <p className="text-xs text-white/40 mb-3">El protocolo controla qué mensajes envía Nova y cuándo. Usa este formato:</p>
        <div className="space-y-1 text-xs font-mono text-white/50">
          <p><span className="text-nova-primary">08:30</span> - Mensaje diario a las 8:30am</p>
          <p><span className="text-nova-primary">lunes 09:00</span> - Mensaje solo los lunes a las 9am</p>
          <p><span className="text-nova-primary">streak</span> - Celebrar rachas de días consecutivos</p>
          <p><span className="text-nova-primary">pattern</span> - Análisis semanal de patrones</p>
          <p><span className="text-nova-primary">weight</span> - Celebrar hitos de peso</p>
        </div>
      </div>
    </div>
  );
}
