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
        <Text style={styles.entryDesc} numberOfLines={1}>{entry.description}</Text>
      </View>
      <View style={styles.entryRight}>
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
          <Text style={styles.intakeText}>{summary.intake}</Text>
          <Text style={styles.burnText}>{summary.burn}</Text>
          <Text style={[styles.deficitText, summary.deficit < 0 && styles.deficitNeg]}>
            {summary.deficit >= 0 ? '+' : ''}{summary.deficit}
          </Text>
          <Text style={styles.arrow}>{open ? '\u25B2' : '\u25BC'}</Text>
        </View>
      </Pressable>

      {open && (
        <View style={styles.entriesContainer}>
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
  },
  burnText: {
    color: '#fdba74',
    fontSize: 13,
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
  entryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
