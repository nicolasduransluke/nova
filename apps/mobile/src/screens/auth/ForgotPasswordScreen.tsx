import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/store/auth.store';
import { GradientBackground } from '@/components/common/GradientBackground';
import { GlassCard } from '@/components/common/GlassCard';
import { TextInput } from '@/components/common/TextInput';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { useTranslation } from 'react-i18next';
import { colors } from '@/theme';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { forgotPassword, isLoading, error, setError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) {
      setError(t('auth.enterEmail'));
      return;
    }

    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch {
      // Error set in store
    }
  };

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
            <Text style={styles.title}>{t('auth.forgotPasswordTitle')}</Text>

            {sent ? (
              <View style={styles.successContainer}>
                <Text style={styles.successIcon}>{'✓'}</Text>
                <Text style={styles.successText}>
                  {t('auth.emailSent')}
                </Text>
                <Pressable
                  onPress={() => navigation.navigate('Login')}
                  style={styles.backButton}
                >
                  <Text style={styles.backText}>{t('auth.backToLogin')}</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.description}>
                  {t('auth.forgotDescription')}
                </Text>

                {error && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <TextInput
                  label={t('auth.email')}
                  placeholder={t('auth.emailPlaceholder')}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (error) setError(null);
                  }}
                  keyboardType="email-address"
                  autoComplete="email"
                />

                <PrimaryButton
                  title={t('auth.sendLink')}
                  onPress={handleSend}
                  loading={isLoading}
                  disabled={!email.trim()}
                />

                <Pressable
                  onPress={() => navigation.goBack()}
                  style={styles.backLink}
                >
                  <Text style={styles.linkText}>{t('common.back')}</Text>
                </Pressable>
              </>
            )}
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
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
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
  backLink: {
    alignItems: 'center',
    marginTop: 20,
  },
  linkText: {
    color: colors.text.muted,
    fontSize: 14,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  successIcon: {
    fontSize: 48,
    color: colors.success,
    marginBottom: 16,
  },
  successText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.glass.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.glass.border,
  },
  backText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '500',
  },
});
