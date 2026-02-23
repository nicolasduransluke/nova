import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Platform } from 'react-native';
import type { HistoryDay, HistoryDayEntry } from '@nova/types';
import { api } from '@/lib/api';
import { colors } from '@/theme';
import { EditEntryModal } from './EditEntryModal';

function EntryRow({
  entry,
  onDelete,
  onEdit,
}: {
  entry: HistoryDayEntry;
  onDelete?: (id: string) => void;
  onEdit?: (entry: HistoryDayEntry) => void;
}) {
  const isIntake = entry.type === 'intake';
  const isWhoop = entry.id.startsWith('whoop-');
  const canEdit = isIntake && !isWhoop && entry.items.length > 0;

  // Derive source from first item that has one
  const itemSource = entry.items.find(i => i.source)?.source;
  const sourceBadges: Record<string, { text: string; color: string }> = {
    usda: { text: 'USDA', color: '#4ade80' },
    gemini: { text: 'IA', color: '#a78bfa' },
    vision: { text: 'IA', color: '#a78bfa' },
    fallback: { text: 'est.', color: '#f87171' },
  };
  const badge = itemSource ? sourceBadges[itemSource] : undefined;

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
  const hasMacros = entryMacros.protein > 0 || entryMacros.carbs > 0 || entryMacros.fat > 0;

  const handleDelete = () => {
    Alert.alert('Eliminar entrada', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/history/entries/${entry.id}`);
            onDelete?.(entry.id);
          } catch (err) {
            console.error('Error deleting entry:', err);
          }
        },
      },
    ]);
  };

  const row = (
    <View style={styles.entryRow}>
      <View style={styles.entryLeft}>
        <View style={[styles.badge, isIntake ? styles.badgeIntake : styles.badgeBurn]}>
          <Text style={[styles.badgeText, isIntake ? styles.badgeTextIntake : styles.badgeTextBurn]}>
            {isIntake ? 'ingesta' : 'quema'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.entryDesc} numberOfLines={1}>{entry.description}</Text>
          {(() => {
            const portionItem = entry.items.find(i => i.portionSize != null && i.portionLabel);
            return portionItem ? (
              <Text style={styles.entryPortion}>
                {portionItem.portionSize} {portionItem.portionLabel}
              </Text>
            ) : null;
          })()}
          {isIntake && hasMacros && (
            <Text style={styles.entryMacros}>
              {entryMacros.protein > 0 ? `P:${Math.round(entryMacros.protein)}g ` : ''}
              {entryMacros.carbs > 0 ? `C:${Math.round(entryMacros.carbs)}g ` : ''}
              {entryMacros.fat > 0 ? `F:${Math.round(entryMacros.fat)}g` : ''}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.entryRight}>
        {badge && (
          <Text style={[styles.sourceTag, { color: badge.color }]}>{badge.text}</Text>
        )}
        <Text style={[styles.entryCal, isIntake ? styles.calIntake : styles.calBurn]}>
          {isIntake ? '+' : '-'}{entry.calories}
        </Text>
        {!isWhoop && onDelete && (
          <Pressable onPress={handleDelete} style={styles.deleteButton}>
            <Text style={styles.deleteText}>{'✕'}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  if (canEdit && onEdit) {
    return (
      <Pressable onPress={() => onEdit(entry)}>
        {row}
      </Pressable>
    );
  }

  return row;
}

interface Props {
  day: HistoryDay;
  onEntryDeleted: () => void;
}

export function DayCard({ day, onEntryDeleted }: Props) {
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
  const hasDayMacros = dayMacros.protein > 0 || dayMacros.carbs > 0 || dayMacros.fat > 0;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-MX', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <View style={styles.card}>
      <Pressable onPress={() => setOpen(!open)} style={styles.cardHeader}>
        <Text style={styles.dateText}>{formatDate(day.date)}</Text>
        <View style={styles.statsRow}>
          <Text style={styles.intakeText}>{summary.intake} kcal</Text>
          <Text style={[styles.deficitText, summary.deficit < 0 && styles.deficitNeg]}>
            {summary.deficit >= 0 ? '+' : ''}{summary.deficit}
          </Text>
          <Text style={styles.arrow}>{open ? '\u25B2' : '\u25BC'}</Text>
        </View>
      </Pressable>

      {open && (
        <View style={styles.entriesContainer}>
          {hasDayMacros && (
            <View style={styles.macrosSummary}>
              <Text style={styles.macrosLabel}>Macros</Text>
              <View style={styles.macrosRow}>
                <Text style={styles.macroItem}>P: {Math.round(dayMacros.protein)}g</Text>
                <Text style={styles.macroItem}>C: {Math.round(dayMacros.carbs)}g</Text>
                <Text style={styles.macroItem}>F: {Math.round(dayMacros.fat)}g</Text>
              </View>
            </View>
          )}
          {day.entries.length > 0 ? (
            day.entries.map((e) => (
              <EntryRow key={e.id} entry={e} onDelete={onEntryDeleted} onEdit={setEditEntry} />
            ))
          ) : (
            <Text style={styles.emptyText}>Sin registros</Text>
          )}
        </View>
      )}

      <EditEntryModal
        entry={editEntry}
        visible={editEntry !== null}
        onClose={() => setEditEntry(null)}
        onSaved={onEntryDeleted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.glass.bg,
    borderWidth: 1,
    borderColor: colors.glass.border,
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  dateText: {
    color: colors.text.primary,
    fontWeight: '500',
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  intakeText: {
    color: '#86efac',
    fontSize: 13,
    fontWeight: '600',
  },
  deficitText: {
    color: '#a5b4fc',
    fontWeight: '600',
    fontSize: 13,
  },
  deficitNeg: {
    color: colors.error,
  },
  arrow: {
    color: colors.text.dimmed,
    fontSize: 10,
  },
  entriesContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  macrosSummary: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  macrosLabel: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  macrosRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 4,
  },
  macroItem: {
    color: '#818cf8',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  macroDetail: {
    color: colors.text.muted,
    fontSize: 12,
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: 14,
    textAlign: 'center',
    padding: 16,
  },

  // Entry row
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  entryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeIntake: {
    backgroundColor: 'rgba(34,197,94,0.2)',
  },
  badgeBurn: {
    backgroundColor: 'rgba(249,115,22,0.2)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  badgeTextIntake: {
    color: '#86efac',
  },
  badgeTextBurn: {
    color: '#fdba74',
  },
  entryDesc: {
    color: '#c7d2fe',
    fontSize: 13,
    flex: 1,
  },
  entryPortion: {
    color: colors.text.dimmed,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 1,
  },
  entryMacros: {
    color: '#818cf8',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 1,
  },
  entryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sourceTag: {
    fontSize: 9,
    fontWeight: '600',
    opacity: 0.7,
  },
  entryCal: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
  },
  calIntake: {
    color: '#86efac',
  },
  calBurn: {
    color: '#fdba74',
  },
  deleteButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteText: {
    color: '#fca5a5',
    fontSize: 12,
  },
});
