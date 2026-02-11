import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import type { RootStackParamList } from './types';
import { useAuthStore } from '@/store/auth.store';
import { useProfileStore, selectIsOnboarded } from '@/store/profile.store';
import { colors } from '@/theme';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import OnboardingScreen from '@/screens/onboarding/OnboardingScreen';
import ProfileScreen from '@/screens/profile/ProfileScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { isAuthenticated, user } = useAuthStore();
  const { loadProfile } = useProfileStore();
  const isOnboarded = useProfileStore(selectIsOnboarded);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setCheckingOnboarding(false);
      return;
    }

    loadProfile(user.id)
      .then(() => setCheckingOnboarding(false))
      .catch(() => setCheckingOnboarding(false));
  }, [isAuthenticated, user?.id, loadProfile]);

  if (isAuthenticated && checkingOnboarding) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthStack} />
      ) : !isOnboarded ? (
        <Stack.Screen name="OnboardingFlow" component={OnboardingScreen} />
      ) : (
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
      )}
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
