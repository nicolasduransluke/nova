import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
  ActivityIndicator,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useProfileStore } from '@/store/profile.store';
import { GradientBackground } from '@/components/common/GradientBackground';
import { GlassCard } from '@/components/common/GlassCard';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ProgressDots } from '@/components/common/ProgressDots';
import { useTranslation } from 'react-i18next';
import { colors } from '@/theme';
import { connectWhoop } from '@/lib/whoop';

const TOTAL_STEPS = 5;

interface OnboardingData {
  sex: 'male' | 'female' | null;
  age: number;
  height: string;
  weight: string;
  goalWeight: string;
  weeklyGoal: number;
}

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { createProfile, isLoading } = useProfileStore();

  const WEEKLY_OPTIONS = useMemo(() => [
    { value: 0.25, label: `0.25 ${t('common.kgPerWeek')}`, desc: t('onboarding.conservative') },
    { value: 0.5, label: `0.5 ${t('common.kgPerWeek')}`, desc: t('onboarding.recommended') },
    { value: 0.75, label: `0.75 ${t('common.kgPerWeek')}`, desc: t('onboarding.moderateGoal') },
    { value: 1.0, label: `1.0 ${t('common.kgPerWeek')}`, desc: t('onboarding.aggressive') },
  ], [t]);

  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [whoopLoading, setWhoopLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [data, setData] = useState<OnboardingData>({
    sex: null,
    age: 25,
    height: '170',
    weight: '70',
    goalWeight: '65',
    weeklyGoal: 0.5,
  });

  const update = (partial: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  };

  const animateToStep = (newStep: number) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      setStep(newStep);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const isStepValid = (): boolean => {
    const h = parseFloat(data.height) || 0;
    const w = parseFloat(data.weight) || 0;
    const gw = parseFloat(data.goalWeight) || 0;

    switch (step) {
      case 0: return data.sex !== null;
      case 1: return data.age >= 16 && data.age <= 80;
      case 2: return h >= 100 && h <= 250 && w >= 30 && w <= 300;
      case 3: return gw > 30 && gw < w && data.weeklyGoal > 0;
      case 4: return true;
      default: return true;
    }
  };

  const finishOnboarding = async () => {
    setError(null);
    const success = await createProfile({
      weight: parseFloat(data.weight),
      height: parseFloat(data.height),
      age: data.age,
      sex: data.sex,
      objective: 'weight_loss',
      activityLevel: 'moderate',
      goalWeight: parseFloat(data.goalWeight),
      weeklyGoal: data.weeklyGoal,
    });

    if (!success) {
      setError(t('onboarding.createProfileError'));
    }
  };

  const handleConnectWhoop = async () => {
    setWhoopLoading(true);
    const result = await connectWhoop();
    setWhoopLoading(false);
    // Finish onboarding regardless of Whoop result
    await finishOnboarding();
  };

  const handleNext = async () => {
    if (step < 4) {
      animateToStep(step + 1);
      return;
    }

    // Step 4 "Omitir" — create profile without Whoop
    await finishOnboarding();
  };

  const handleBack = () => {
    if (step > 0) animateToStep(step - 1);
  };

  const estimatedWeeks = (() => {
    const w = parseFloat(data.weight) || 0;
    const gw = parseFloat(data.goalWeight) || 0;
    if (w > gw && data.weeklyGoal > 0) {
      return Math.ceil((w - gw) / data.weeklyGoal);
    }
    return null;
  })();

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <GlassCard>
            <ProgressDots total={TOTAL_STEPS} current={step} />

            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Animated.View style={{ opacity: fadeAnim }}>
              {step === 0 && (
                <View style={styles.stepPanel}>
                  <Text style={styles.stepTitle}>{t('onboarding.welcomeTitle')}</Text>
                  <Text style={styles.stepSubtitle}>{t('onboarding.welcomeSubtitle')}</Text>
                  <View style={styles.sexRow}>
                    <Pressable
                      onPress={() => update({ sex: 'male' })}
                      style={[
                        styles.sexCard,
                        data.sex === 'male' && styles.sexCardActive,
                      ]}
                    >
                      <Text style={styles.sexIcon}>{'👨'}</Text>
                      <Text style={styles.sexLabel}>{t('onboarding.male')}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => update({ sex: 'female' })}
                      style={[
                        styles.sexCard,
                        data.sex === 'female' && styles.sexCardActive,
                      ]}
                    >
                      <Text style={styles.sexIcon}>{'👩'}</Text>
                      <Text style={styles.sexLabel}>{t('onboarding.female')}</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {step === 1 && (
                <View style={styles.stepPanel}>
                  <Text style={styles.stepTitle}>{t('onboarding.ageTitle')}</Text>
                  <Text style={styles.stepSubtitle}>{t('onboarding.ageSubtitle')}</Text>
                  <View style={styles.ageRow}>
                    <Pressable
                      onPress={() => update({ age: Math.max(16, data.age - 1) })}
                      style={styles.ageButton}
                    >
                      <Text style={styles.ageButtonText}>-</Text>
                    </Pressable>
                    <Text style={styles.ageValue}>{data.age}</Text>
                    <Pressable
                      onPress={() => update({ age: Math.min(80, data.age + 1) })}
                      style={styles.ageButton}
                    >
                      <Text style={styles.ageButtonText}>+</Text>
                    </Pressable>
                  </View>
                  <Slider
                    style={styles.slider}
                    minimumValue={16}
                    maximumValue={80}
                    step={1}
                    value={data.age}
                    onValueChange={(val) => update({ age: Math.round(val) })}
                    minimumTrackTintColor={colors.primary}
                    maximumTrackTintColor="rgba(255,255,255,0.1)"
                    thumbTintColor={colors.primary}
                  />
                  <View style={styles.sliderLabels}>
                    <Text style={styles.sliderLabel}>16</Text>
                    <Text style={styles.sliderLabel}>80</Text>
                  </View>
                </View>
              )}

              {step === 2 && (
                <View style={styles.stepPanel}>
                  <Text style={styles.stepTitle}>{t('onboarding.measuresTitle')}</Text>
                  <Text style={styles.stepSubtitle}>{t('onboarding.measuresSubtitle')}</Text>

                  <Text style={styles.inputLabel}>{t('onboarding.heightLabel')}</Text>
                  <View style={styles.inputRow}>
                    <RNTextInput
                      style={styles.numericInput}
                      value={data.height}
                      onChangeText={(text) => update({ height: text })}
                      keyboardType="numeric"
                      placeholderTextColor={colors.text.placeholder}
                      placeholder="170"
                    />
                    <Text style={styles.unitText}>cm</Text>
                  </View>

                  <Text style={styles.inputLabel}>{t('onboarding.currentWeight')}</Text>
                  <View style={styles.inputRow}>
                    <RNTextInput
                      style={styles.numericInput}
                      value={data.weight}
                      onChangeText={(text) => update({ weight: text })}
                      keyboardType="decimal-pad"
                      placeholderTextColor={colors.text.placeholder}
                      placeholder="70"
                    />
                    <Text style={styles.unitText}>kg</Text>
                  </View>
                </View>
              )}

              {step === 3 && (
                <View style={styles.stepPanel}>
                  <Text style={styles.stepTitle}>{t('onboarding.goalTitle')}</Text>
                  <Text style={styles.stepSubtitle}>{t('onboarding.goalSubtitle')}</Text>

                  <Text style={styles.inputLabel}>{t('onboarding.goalWeight')}</Text>
                  <View style={styles.inputRow}>
                    <RNTextInput
                      style={styles.numericInput}
                      value={data.goalWeight}
                      onChangeText={(text) => update({ goalWeight: text })}
                      keyboardType="decimal-pad"
                      placeholderTextColor={colors.text.placeholder}
                      placeholder="65"
                    />
                    <Text style={styles.unitText}>kg</Text>
                  </View>

                  <Text style={styles.inputLabel}>{t('onboarding.weeklyPace')}</Text>
                  <View style={styles.weeklyGrid}>
                    {WEEKLY_OPTIONS.map((opt) => (
                      <Pressable
                        key={opt.value}
                        onPress={() => update({ weeklyGoal: opt.value })}
                        style={[
                          styles.weeklyCard,
                          data.weeklyGoal === opt.value && styles.weeklyCardActive,
                        ]}
                      >
                        <Text style={styles.weeklyLabel}>{opt.label}</Text>
                        <Text style={styles.weeklyDesc}>{opt.desc}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {estimatedWeeks && (
                    <View style={styles.estimateBox}>
                      <Text style={styles.estimateLabel}>{t('onboarding.estimatedTime')}</Text>
                      <Text style={styles.estimateValue}>{t('onboarding.estimatedWeeks', { weeks: estimatedWeeks })}</Text>
                    </View>
                  )}
                </View>
              )}

              {step === 4 && (
                <View style={styles.stepPanel}>
                  <Text style={styles.stepTitle}>{t('onboarding.whoopTitle')}</Text>
                  <Text style={styles.stepSubtitle}>
                    {t('onboarding.whoopSubtitle')}
                  </Text>

                  {whoopLoading ? (
                    <View style={styles.whoopLoadingBox}>
                      <ActivityIndicator color={colors.primaryLight} size="large" />
                      <Text style={styles.whoopLoadingText}>{t('onboarding.connecting')}</Text>
                    </View>
                  ) : (
                    <Pressable onPress={handleConnectWhoop} style={styles.whoopConnectButton}>
                      <Text style={styles.whoopConnectText}>{t('onboarding.connectWhoop')}</Text>
                    </Pressable>
                  )}
                </View>
              )}

            </Animated.View>

            <View style={styles.navRow}>
              {step > 0 ? (
                <Pressable onPress={handleBack} style={styles.backButton}>
                  <Text style={styles.backText}>{t('onboarding.previous')}</Text>
                </Pressable>
              ) : (
                <View />
              )}
              <PrimaryButton
                title={isLoading ? t('common.saving') : step === 4 ? t('onboarding.skip') : t('onboarding.next')}
                onPress={handleNext}
                loading={isLoading}
                disabled={!isStepValid() || whoopLoading}
                style={{ minWidth: 140 }}
              />
            </View>
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  stepPanel: {
    paddingHorizontal: 4,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  sexRow: {
    flexDirection: 'row',
    gap: 12,
  },
  sexCard: {
    flex: 1,
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  sexCardActive: {
    backgroundColor: 'rgba(147,51,234,0.2)',
    borderColor: colors.primary,
  },
  sexIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  sexLabel: {
    color: colors.text.primary,
    fontWeight: '500',
    fontSize: 16,
  },
  ageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 16,
  },
  ageButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ageButtonText: {
    color: colors.text.primary,
    fontSize: 24,
    fontWeight: '600',
  },
  ageValue: {
    fontSize: 56,
    fontWeight: '700',
    color: colors.text.primary,
    width: 96,
    textAlign: 'center',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sliderLabel: {
    fontSize: 12,
    color: colors.text.muted,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.secondary,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glass.bgLight,
    borderWidth: 1,
    borderColor: colors.glass.border,
    borderRadius: 12,
    marginBottom: 16,
  },
  numericInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text.primary,
  },
  unitText: {
    color: colors.text.muted,
    fontSize: 14,
    paddingRight: 16,
  },
  weeklyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  weeklyCard: {
    width: '48%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  weeklyCardActive: {
    backgroundColor: 'rgba(147,51,234,0.2)',
    borderColor: colors.primary,
  },
  weeklyLabel: {
    color: colors.text.primary,
    fontWeight: '500',
    fontSize: 14,
  },
  weeklyDesc: {
    color: colors.text.muted,
    fontSize: 12,
    marginTop: 2,
  },
  estimateBox: {
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    alignItems: 'center',
  },
  estimateLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  estimateValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  whoopConnectButton: {
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(147,51,234,0.2)',
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    marginTop: 8,
  },
  whoopConnectText: {
    color: colors.primaryLight,
    fontSize: 16,
    fontWeight: '600',
  },
  whoopLoadingBox: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  whoopLoadingText: {
    color: colors.text.secondary,
    fontSize: 14,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  backText: {
    color: colors.text.muted,
    fontSize: 14,
  },
});
