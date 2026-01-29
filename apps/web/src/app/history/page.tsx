'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { HistoryDay, WeightEntry, HistoryDayEntry } from '@nova/types';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';

const RANGE_OPTIONS = [7, 14, 30] as const;

function WeightChart({ data }: { data: WeightEntry[] }) {
  if (data.length < 2) return null;

  const weights = data.map((d) => d.weight);
  const minW = Math.min(...weights) - 0.5;
  const maxW = Math.max(...weights) + 0.5;
  const range = maxW - minW || 1;

  const width = 600;
  const height = 200;
  const padX = 50;
  const padY = 20;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const points = data.map((d, i) => {
    const x = padX + (i / (data.length - 1)) * chartW;
    const y = padY + chartH - ((d.weight - minW) / range) * chartH;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  return (
    <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-6 mb-6">
      <h3 className="text-white font-semibold mb-4">Peso</h3>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* Y axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const w = minW + range * pct;
          const y = padY + chartH - pct * chartH;
          return (
            <g key={pct}>
              <line x1={padX} y1={y} x2={padX + chartW} y2={y} stroke="rgba(255,255,255,0.1)" />
              <text x={padX - 8} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.5)" fontSize="10">
                {w.toFixed(1)}
              </text>
            </g>
          );
        })}
        {/* Line */}
        <path d={linePath} fill="none" stroke="#818cf8" strokeWidth="2.5" strokeLinejoin="round" />
        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill="#818cf8" stroke="#1e1b4b" strokeWidth="2" />
        ))}
        {/* X labels (first, mid, last) */}
        {[0, Math.floor(data.length / 2), data.length - 1].map((idx) => {
          const p = points[idx];
          if (!p) return null;
          return (
            <text key={idx} x={p.x} y={height - 2} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="10">
              {p.date.slice(5)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function EntryRow({ entry }: { entry: HistoryDayEntry }) {
  const isIntake = entry.type === 'intake';
  return (
    <div className="flex items-center justify-between py-2 px-3 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2">
        <span className={`text-xs px-2 py-0.5 rounded ${isIntake ? 'bg-green-500/20 text-green-300' : 'bg-orange-500/20 text-orange-300'}`}>
          {isIntake ? 'ingesta' : 'quema'}
        </span>
        <span className="text-indigo-100 text-sm">{entry.description}</span>
      </div>
      <span className={`font-mono text-sm ${isIntake ? 'text-green-300' : 'text-orange-300'}`}>
        {isIntake ? '+' : '-'}{entry.calories} kcal
      </span>
    </div>
  );
}

function DayCard({ day }: { day: HistoryDay }) {
  const [open, setOpen] = useState(false);
  const { summary } = day;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-MX', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl mb-3 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
      >
        <span className="text-white font-medium">{formatDate(day.date)}</span>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-green-300">{summary.intake} kcal</span>
          <span className="text-orange-300 flex items-center gap-1">
            {summary.burn} kcal
            {summary.burnSource === 'whoop' && (
              <svg className="w-3 h-3 text-orange-400" viewBox="0 0 24 24" fill="currentColor" title="Whoop">
                <circle cx="12" cy="12" r="10" />
                <text x="12" y="16" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">W</text>
              </svg>
            )}
          </span>
          <span className={`font-semibold ${summary.deficit >= 0 ? 'text-indigo-300' : 'text-red-300'}`}>
            {summary.deficit >= 0 ? '+' : ''}{summary.deficit} déficit
          </span>
          <span className="text-indigo-400 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && day.entries.length > 0 && (
        <div className="border-t border-white/10 bg-white/5">
          {day.entries.map((e) => (
            <EntryRow key={e.id} entry={e} />
          ))}
        </div>
      )}
      {open && day.entries.length === 0 && (
        <div className="border-t border-white/10 bg-white/5 p-4 text-center text-indigo-300 text-sm">
          Sin registros
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const { user } = useAuthStore();
  const userId = user?.id;

  const [days, setDays] = useState<number>(14);
  const [history, setHistory] = useState<HistoryDay[]>([]);
  const [weight, setWeight] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    Promise.all([
      api.get<HistoryDay[]>(`/api/history/daily?userId=${userId}&days=${days}`),
      api.get<WeightEntry[]>(`/api/history/weight?userId=${userId}&days=${days}`),
    ])
      .then(([dailyRes, weightRes]) => {
        setHistory(dailyRes.data ?? []);
        setWeight(weightRes.data ?? []);
      })
      .catch((err) => console.error('Error fetching history:', err))
      .finally(() => setLoading(false));
  }, [days, userId]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-nova-dark via-indigo-900 to-purple-900 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-indigo-300 hover:text-white transition-colors text-sm">
            ← Inicio
          </Link>
          <h1 className="text-2xl font-bold text-white">Historial</h1>
          <div className="w-16" />
        </div>

        {/* Range selector */}
        <div className="flex justify-center gap-2 mb-6">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => setDays(opt)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                days === opt
                  ? 'bg-indigo-500 text-white'
                  : 'bg-white/10 text-indigo-200 hover:bg-white/20'
              }`}
            >
              {opt} días
            </button>
          ))}
        </div>

        {/* Weight chart */}
        {weight.length >= 2 && <WeightChart data={weight} />}

        {/* Daily history */}
        {loading ? (
          <div className="text-center text-indigo-300 py-12">Cargando...</div>
        ) : history.length === 0 ? (
          <div className="text-center text-indigo-300 py-12">
            No hay registros en los últimos {days} días
          </div>
        ) : (
          history.map((day) => <DayCard key={day.date} day={day} />)
        )}
      </div>
    </main>
  );
}
