import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth.store';
import { GradientBackground } from '@/components/common/GradientBackground';
import { GlassCard } from '@/components/common/GlassCard';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { useTranslation } from 'react-i18next';
import { colors } from '@/theme';

const PRIVACY_URL = 'https://nova-ebon-seven.vercel.app/privacy';

export default function AIConsentScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { acceptAIConsent, logout } = useAuthStore();

  const handleAccept = async () => {
    await acceptAIConsent();
  };

  const handleDecline = async () => {
    await logout();
  };

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 24 }]}
      >
        <Text style={styles.title}>{t('consent.title')}</Text>

        <GlassCard>
          <Text style={styles.heading}>{t('consent.heading')}</Text>

          <Text style={styles.body}>{t('consent.body')}</Text>

          <Text style={styles.subheading}>{t('consent.dataSharedTitle')}</Text>

          <View style={styles.bulletList}>
            <Text style={styles.bullet}>
              {'\u2022'} {t('consent.dataSharedMeals')}
            </Text>
            <Text style={styles.bullet}>
              {'\u2022'} {t('consent.dataSharedProfile')}
            </Text>
            <Text style={styles.bullet}>
              {'\u2022'} {t('consent.dataSharedHistory')}
            </Text>
          </View>

          <Text style={styles.subheading}>{t('consent.sharedWithTitle')}</Text>

          <View style={styles.bulletList}>
            <Text style={styles.bullet}>
              {'\u2022'} {t('consent.sharedWithGemini')}
            </Text>
          </View>

          <Text style={styles.body}>{t('consent.disclaimer')}</Text>

          <Pressable onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Text style={styles.link}>{t('consent.privacyLink')}</Text>
          </Pressable>

          <PrimaryButton
            title={t('consent.accept')}
            onPress={handleAccept}
            style={styles.acceptButton}
          />

          <Pressable onPress={handleDecline} style={styles.declineButton}>
            <Text style={styles.declineText}>{t('consent.decline')}</Text>
          </Pressable>
        </GlassCard>
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 24,
  },
  heading: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 16,
  },
  subheading: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: 16,
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 21,
    marginBottom: 8,
  },
  bulletList: {
    marginLeft: 8,
    marginBottom: 8,
  },
  bullet: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  link: {
    color: colors.primaryLight,
    fontSize: 14,
    textDecorationLine: 'underline',
    marginTop: 12,
    marginBottom: 24,
  },
  acceptButton: {
    marginBottom: 12,
  },
  declineButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  declineText: {
    color: colors.text.muted,
    fontSize: 14,
  },
});
