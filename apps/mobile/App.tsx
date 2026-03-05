import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PostHogProvider } from 'posthog-react-native';
import RootNavigator from '@/navigation/RootNavigator';
import { posthog } from '@/lib/analytics';
import '@/i18n';
import { useLanguageStore } from '@/store/language.store';

// Force hydration of persisted language on app start
useLanguageStore.getState();

export default function App() {
  return (
    <PostHogProvider client={posthog} autocapture={{ captureScreens: true }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </PostHogProvider>
  );
}
