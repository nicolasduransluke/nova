import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MainTabsParamList } from './types';
import { colors } from '@/theme';
import ChatScreen from '@/screens/chat/ChatScreen';
import PanelScreen from '@/screens/chat/PanelScreen';
import HistoryScreen from '@/screens/history/HistoryScreen';

const Tab = createBottomTabNavigator<MainTabsParamList>();

function ChatIcon({ color, size }: { color: string; size: number }) {
  return (
    <View style={[styles.iconContainer, { width: size, height: size }]}>
      <Text style={[styles.iconText, { color, fontSize: size * 0.6 }]}>N</Text>
    </View>
  );
}

function PanelIcon({ color, size }: { color: string; size: number }) {
  return (
    <View style={[styles.iconContainer, { width: size, height: size }]}>
      <Text style={{ color, fontSize: size * 0.7 }}>{'📊'}</Text>
    </View>
  );
}

function HistoryIcon({ color, size }: { color: string; size: number }) {
  return (
    <View style={[styles.iconContainer, { width: size, height: size }]}>
      <Text style={{ color, fontSize: size * 0.7 }}>{'⏱'}</Text>
    </View>
  );
}

export default function MainTabs() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar.bg,
          borderTopColor: colors.chat.border,
          borderTopWidth: 0.5,
        },
        tabBarActiveTintColor: colors.tabBar.active,
        tabBarInactiveTintColor: colors.tabBar.inactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarLabel: t('tabs.nova'),
          tabBarIcon: ChatIcon,
        }}
      />
      <Tab.Screen
        name="Panel"
        component={PanelScreen}
        options={{
          tabBarLabel: t('tabs.panel'),
          tabBarIcon: PanelIcon,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: t('tabs.history'),
          tabBarIcon: HistoryIcon,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontWeight: '700',
  },
});
