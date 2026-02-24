import React, { useEffect, useRef, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import type { RootStackParamList } from './types';
import { useAuthStore } from '@/store/auth.store';
import { useProfileStore, selectIsOnboarded } from '@/store/profile.store';
import { colors } from '@/theme';
import { registerForPushNotifications, setupNotificationListeners } from '@/lib/notifications';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import OnboardingScreen from '@/screens/onboarding/OnboardingScreen';
import ProfileScreen from '@/screens/profile/ProfileScreen';
import AIConsentScreen from '@/screens/consent/AIConsentScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { isAuthenticated, user, accessToken, isGuest, hasAIConsent } = useAuthStore();
  const { loadProfile } = useProfileStore();
  const isOnboarded = useProfileStore(selectIsOnboarded);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const pushRegistered = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !user?.id || isGuest) {
      setCheckingOnboarding(false);
      return;
    }

    loadProfile(user.id)
      .then(() => setCheckingOnboarding(false))
      .catch(() => setCheckingOnboarding(false));
  }, [isAuthenticated, user?.id, loadProfile, isGuest]);

  // Register push notifications when authenticated + onboarded
  useEffect(() => {
    if (!isAuthenticated || !isOnboarded || !accessToken || pushRegistered.current || isGuest) return;

    pushRegistered.current = true;
    registerForPushNotifications(accessToken).catch((err) =>
      console.error('Push registration failed:', err),
    );

    const cleanup = setupNotificationListeners((data) => {
      console.log('Notification tapped:', data);
    });

    return cleanup;
  }, [isAuthenticated, isOnboarded, accessToken, isGuest]);

  if (isAuthenticated && !isGuest && checkingOnboarding) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const getScreens = () => {
    if (!isAuthenticated) {
      return <Stack.Screen name="Auth" component={AuthStack} />;
    }

    // Guest mode: skip onboarding + consent, go straight to MainTabs
    if (isGuest) {
      return (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
        </>
      );
    }

    // Not onboarded yet
    if (!isOnboarded) {
      return <Stack.Screen name="OnboardingFlow" component={OnboardingScreen} />;
    }

    // Onboarded but no AI consent
    if (!hasAIConsent) {
      return <Stack.Screen name="AIConsent" component={AIConsentScreen} />;
    }

    // Fully authenticated, onboarded, and consented
    return (
      <>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            headerShown: true,
            headerTitle: 'Perfil',
            headerStyle: { backgroundColor: colors.gradient.from },
            headerTintColor: colors.text.primary,
            headerShadowVisible: false,
          }}
        />
      </>
    );
  };

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {getScreens()}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gradient.from,
  },
});
