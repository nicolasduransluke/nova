import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import type { HistoryDayEntry, CalorieEntryItem } from '@nova/types';
import { api } from '@/lib/api';
import { colors } from '@/theme';

interface Props {
  entry: HistoryDayEntry | null;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function EditEntryModal({ entry, visible, onClose, onSaved }: Props) {
  const [items, setItems] = useState<(CalorieEntryItem & { quantity: number })[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (entry?.items) {
      setItems(
        entry.items.map((item) => ({
          ...item,
          quantity: item.quantity ?? 1,
        })),
      );
    }
  }, [entry]);

  const totalCalories = items.reduce(
    (sum, item) => sum + item.calories * item.quantity,
    0,
  );

  const updateQuantity = (index: number, delta: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item,
      ),
    );
  };

  const handleSave = async () => {
    if (!entry) return;
    setSaving(true);
    try {
      const res = await api.patch(`/api/history/entries/${entry.id}`, {
        items: items.map((item) => ({
          name: item.name,
          calories: item.calories,
          quantity: item.quantity,
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

  if (!entry) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Editar porciones</Text>
          <Text style={styles.subtitle}>{entry.description}</Text>

          <ScrollView style={styles.itemList}>
            {items.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemCal}>
                    {item.calories * item.quantity} kcal
                  </Text>
                </View>
                <View style={styles.stepper}>
                  <Pressable
                    onPress={() => updateQuantity(index, -1)}
                    style={[styles.stepBtn, item.quantity <= 1 && styles.stepBtnDisabled]}
                    disabled={item.quantity <= 1}
                  >
                    <Text style={styles.stepText}>-</Text>
                  </Pressable>
                  <Text style={styles.stepValue}>{item.quantity}</Text>
                  <Pressable
                    onPress={() => updateQuantity(index, 1)}
                    style={styles.stepBtn}
                  >
                    <Text style={styles.stepText}>+</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.totalText}>Total: {totalCalories} kcal</Text>
            <View style={styles.footerButtons}>
              <Pressable onPress={onClose} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={handleSave} style={styles.saveBtn} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveText}>Guardar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1e1b4b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '70%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    color: colors.text.muted,
    fontSize: 14,
    marginBottom: 16,
  },
  itemList: {
    maxHeight: 300,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    color: colors.text.primary,
    fontSize: 15,
  },
  itemCal: {
    color: '#86efac',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.3,
  },
  stepText: {
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: '600',
  },
  stepValue: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    width: 36,
    textAlign: 'center',
  },
  footer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 16,
  },
  totalText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  cancelText: {
    color: colors.text.muted,
    fontSize: 15,
    fontWeight: '500',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
  },
  saveText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
