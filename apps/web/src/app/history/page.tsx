'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { HistoryDay, WeightEntry, HistoryDayEntry, CalorieEntryItem } from '@nova/types';
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

function EditEntryModal({
  entry,
  onClose,
  onSaved,
}: {
  entry: HistoryDayEntry;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [items, setItems] = useState<(CalorieEntryItem & { quantity: number })[]>(
    entry.items.map((item) => ({ ...item, quantity: item.quantity ?? 1 })),
  );
  const [saving, setSaving] = useState(false);

  const totalCalories = items.reduce((sum, item) => sum + item.calories * item.quantity, 0);

  const updateQuantity = (index: number, delta: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item,
      ),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.patch(`/api/history/entries/${entry.id}`, {
        items: items.map((item) => ({
          name: item.name,
          calories: item.calories,
          quantity: item.quantity,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
        })),
      });
      if (res.success) {
        onSaved();
        onClose();
      }
    } catch (err) {
      console.error('Error updating entry:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-indigo-950 border border-white/20 rounded-2xl p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-white text-lg font-semibold mb-1">Editar porciones</h3>
        <p className="text-indigo-300 text-sm mb-4">{entry.description}</p>

        <div className="space-y-3 max-h-60 overflow-y-auto">
          {items.map((item, index) => (
            <div key={index} className="flex items-center justify-between py-2 border-b border-white/10 last:border-0">
              <div className="flex-1 min-w-0 mr-3">
                <p className="text-white text-sm">{item.name}</p>
                <p className="text-green-300 text-xs font-mono">{item.calories * item.quantity} kcal</p>
                {(item.protein || item.carbs || item.fat) && (
                  <p className="text-indigo-400 text-xs font-mono">
                    {item.protein ? `P:${Math.round(item.protein * item.quantity)}g ` : ''}
                    {item.carbs ? `C:${Math.round(item.carbs * item.quantity)}g ` : ''}
                    {item.fat ? `F:${Math.round(item.fat * item.quantity)}g` : ''}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-0">
                <button
                  onClick={() => updateQuantity(index, -1)}
                  disabled={item.quantity <= 1}
                  className="w-8 h-8 rounded-l-lg bg-white/10 text-white text-lg font-semibold hover:bg-white/20 disabled:opacity-30 transition-colors"
                >
                  -
                </button>
                <span className="w-8 h-8 flex items-center justify-center bg-white/5 text-white text-sm font-semibold">
                  {item.quantity}
                </span>
                <button
                  onClick={() => updateQuantity(index, 1)}
                  className="w-8 h-8 rounded-r-lg bg-white/10 text-white text-lg font-semibold hover:bg-white/20 transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-white font-semibold mb-3">Total: {totalCalories} kcal</p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-white/10 text-indigo-300 text-sm font-medium hover:bg-white/20 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-semibold hover:from-purple-500 hover:to-indigo-500 transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MacroLabel({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  if (protein === 0 && carbs === 0 && fat === 0) return null;
  return (
    <span className="text-indigo-400 text-xs font-mono">
      {protein > 0 && <span>P:{Math.round(protein)}g </span>}
      {carbs > 0 && <span>C:{Math.round(carbs)}g </span>}
      {fat > 0 && <span>F:{Math.round(fat)}g</span>}
    </span>
  );
}

function EntryRow({ entry, onDelete, onEdit }: { entry: HistoryDayEntry; onDelete?: (id: string) => void; onEdit?: (entry: HistoryDayEntry) => void }) {
  const isIntake = entry.type === 'intake';
  const isWhoop = entry.id.startsWith('whoop-');
  const canEdit = isIntake && !isWhoop && entry.items.length > 0;
  const [confirming, setConfirming] = useState(false);

  // Sum macros for this entry
  const entryMacros = entry.items.reduce(
    (acc, item) => {
      const qty = item.quantity ?? 1;
      return {
        protein: acc.protein + (item.protein ?? 0) * qty,
        carbs: acc.carbs + (item.carbs ?? 0) * qty,
        fat: acc.fat + (item.fat ?? 0) * qty,
      };
    },
    { protein: 0, carbs: 0, fat: 0 },
  );

  const handleDelete = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    try {
      await api.delete(`/api/history/entries/${entry.id}`);
      onDelete?.(entry.id);
    } catch (err) {
      console.error('Error deleting entry:', err);
    }
    setConfirming(false);
  };

  return (
    <div
      className={`flex items-center justify-between py-2 px-3 border-b border-white/5 last:border-0 group ${canEdit ? 'cursor-pointer hover:bg-white/5' : ''}`}
      onClick={canEdit && onEdit ? () => onEdit(entry) : undefined}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${isIntake ? 'bg-green-500/20 text-green-300' : 'bg-orange-500/20 text-orange-300'}`}>
          {isIntake ? 'ingesta' : 'quema'}
        </span>
        <span className="text-indigo-100 text-sm truncate">{entry.description}</span>
        {isIntake && <MacroLabel {...entryMacros} />}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`font-mono text-sm ${isIntake ? 'text-green-300' : 'text-orange-300'}`}>
          {isIntake ? '+' : '-'}{entry.calories} kcal
        </span>
        {!isWhoop && onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            className={`text-xs px-2 py-1 rounded transition-all ${
              confirming
                ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                : 'opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-300 hover:bg-red-500/20'
            }`}
          >
            {confirming ? 'Confirmar' : 'Borrar'}
          </button>
        )}
      </div>
    </div>
  );
}

function DayCard({ day, onEntryDeleted }: { day: HistoryDay; onEntryDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<HistoryDayEntry | null>(null);
  const { summary } = day;

  // Sum macros across all intake entries for the day
  const dayMacros = day.entries
    .filter((e) => e.type === 'intake')
    .reduce(
      (acc, entry) => {
        for (const item of entry.items) {
          const qty = item.quantity ?? 1;
          acc.protein += (item.protein ?? 0) * qty;
          acc.carbs += (item.carbs ?? 0) * qty;
          acc.fat += (item.fat ?? 0) * qty;
        }
        return acc;
      },
      { protein: 0, carbs: 0, fat: 0 },
    );
  const hasMacros = dayMacros.protein > 0 || dayMacros.carbs > 0 || dayMacros.fat > 0;

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
        <div>
          <span className="text-white font-medium">{formatDate(day.date)}</span>
          {hasMacros && (
            <div className="text-indigo-400 text-xs font-mono mt-0.5">
              P:{Math.round(dayMacros.protein)}g  C:{Math.round(dayMacros.carbs)}g  F:{Math.round(dayMacros.fat)}g
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-green-300">{summary.intake} kcal</span>
          <span className="text-orange-300 flex items-center gap-1">
            {summary.burn} kcal
            {summary.burnSource === 'whoop' && (
              <span title="Whoop">
                <svg className="w-3 h-3 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="10" />
                  <text x="12" y="16" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">W</text>
                </svg>
              </span>
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
            <EntryRow key={e.id} entry={e} onDelete={onEntryDeleted} onEdit={setEditEntry} />
          ))}
        </div>
      )}
      {open && day.entries.length === 0 && (
        <div className="border-t border-white/10 bg-white/5 p-4 text-center text-indigo-300 text-sm">
          Sin registros
        </div>
      )}
      {editEntry && (
        <EditEntryModal
          entry={editEntry}
          onClose={() => setEditEntry(null)}
          onSaved={onEntryDeleted}
        />
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

  const fetchData = useCallback(() => {
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
          history.map((day) => <DayCard key={day.date} day={day} onEntryDeleted={fetchData} />)
        )}
      </div>
    </main>
  );
}
