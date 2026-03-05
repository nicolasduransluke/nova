import React, { useState, useEffect, useRef } from 'react';
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
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { colors } from '@/theme';

interface Props {
  entry: HistoryDayEntry | null;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface EditableItem extends CalorieEntryItem {
  quantity: number;
  portionSize?: number;
  portionLabel?: string;
}

/** Snapshot of original values at mount time, used for proportional recalc */
interface OriginalSnapshot {
  calories: number;
  portionSize: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export function EditEntryModal({ entry, visible, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [items, setItems] = useState<EditableItem[]>([]);
  const [saving, setSaving] = useState(false);
  const originals = useRef<OriginalSnapshot[]>([]);

  useEffect(() => {
    if (entry?.items) {
      const mapped = entry.items.map((item) => ({
        ...item,
        quantity: item.quantity ?? 1,
      }));
      setItems(mapped);
      // Snapshot originals for proportional recalc
      originals.current = entry.items.map((item) => ({
        calories: item.calories,
        portionSize: item.portionSize ?? 0,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
      }));
    }
  }, [entry]);

  const hasPortion = (item: EditableItem) =>
    item.portionSize != null && item.portionSize > 0 && !!item.portionLabel;

  const totalCalories = items.reduce((sum, item) => {
    if (hasPortion(item)) {
      return sum + item.calories;
    }
    return sum + item.calories * item.quantity;
  }, 0);

  /** Quantity stepper for items WITHOUT portionSize (legacy behavior) */
  const updateQuantity = (index: number, delta: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item,
      ),
    );
  };

  /** Portion stepper for items WITH portionSize — recalculates calories proportionally */
  const updatePortionSize = (index: number, delta: number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const orig = originals.current[index];
        if (!orig || orig.portionSize === 0) return item;
        const newSize = Math.max(0.25, Math.round(((item.portionSize ?? orig.portionSize) + delta) * 100) / 100);
        const ratio = newSize / orig.portionSize;
        return {
          ...item,
          portionSize: newSize,
          calories: Math.round(orig.calories * ratio),
          protein: orig.protein != null ? Math.round(orig.protein * ratio) : item.protein,
          carbs: orig.carbs != null ? Math.round(orig.carbs * ratio) : item.carbs,
          fat: orig.fat != null ? Math.round(orig.fat * ratio) : item.fat,
        };
      }),
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
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          ...(item.portionSize != null ? { portionSize: item.portionSize } : {}),
          ...(item.portionLabel ? { portionLabel: item.portionLabel } : {}),
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
          <Text style={styles.title}>{t('history.editPortions')}</Text>
          <Text style={styles.subtitle}>{entry.description}</Text>

          <ScrollView style={styles.itemList}>
            {items.map((item, index) => {
              const usePortionStepper = hasPortion(item);
              const stepperValue = usePortionStepper ? (item.portionSize ?? 1) : item.quantity;
              const minValue = usePortionStepper ? 0.25 : 1;
              const stepDelta = usePortionStepper ? 0.5 : 1;
              const displayCal = usePortionStepper ? item.calories : item.calories * item.quantity;
              const displayProtein = usePortionStepper ? item.protein : (item.protein ? item.protein * item.quantity : undefined);
              const displayCarbs = usePortionStepper ? item.carbs : (item.carbs ? item.carbs * item.quantity : undefined);
              const displayFat = usePortionStepper ? item.fat : (item.fat ? item.fat * item.quantity : undefined);

              return (
                <View key={index} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemCal}>
                      {displayCal} kcal
                    </Text>
                    {(displayProtein || displayCarbs || displayFat) && (
                      <Text style={styles.itemMacros}>
                        {displayProtein ? `P:${Math.round(displayProtein)}g ` : ''}
                        {displayCarbs ? `C:${Math.round(displayCarbs)}g ` : ''}
                        {displayFat ? `F:${Math.round(displayFat)}g` : ''}
                      </Text>
                    )}
                    {usePortionStepper && (
                      <Text style={styles.portionHint}>{item.portionLabel}</Text>
                    )}
                  </View>
                  <View style={styles.stepper}>
                    <Pressable
                      onPress={() => usePortionStepper ? updatePortionSize(index, -stepDelta) : updateQuantity(index, -1)}
                      style={[styles.stepBtn, stepperValue <= minValue && styles.stepBtnDisabled]}
                      disabled={stepperValue <= minValue}
                    >
                      <Text style={styles.stepText}>-</Text>
                    </Pressable>
                    <Text style={styles.stepValue}>{Number.isInteger(stepperValue) ? stepperValue : stepperValue.toFixed(1)}</Text>
                    <Pressable
                      onPress={() => usePortionStepper ? updatePortionSize(index, stepDelta) : updateQuantity(index, 1)}
                      style={styles.stepBtn}
                    >
                      <Text style={styles.stepText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.totalText}>{t('history.total', { calories: totalCalories })}</Text>
            <View style={styles.footerButtons}>
              <Pressable onPress={onClose} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable onPress={handleSave} style={styles.saveBtn} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveText}>{t('common.save')}</Text>
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
  itemMacros: {
    color: '#818cf8',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 1,
  },
  portionHint: {
    color: colors.text.dimmed,
    fontSize: 11,
    fontStyle: 'italic',
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
