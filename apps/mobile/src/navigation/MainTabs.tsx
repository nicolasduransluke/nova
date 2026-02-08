import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import type { MainTabsParamList } from './types';
import { colors } from '@/theme';
import ChatScreen from '@/screens/chat/ChatScreen';
import HistoryScreen from '@/screens/history/HistoryScreen';
import ProfileScreen from '@/screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabsParamList>();

function ChatIcon({ color, size }: { color: string; size: number }) {
  return (
    <View style={[styles.iconContainer, { width: size, height: size }]}>
      <Text style={[styles.iconText, { color, fontSize: size * 0.6 }]}>N</Text>
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

function ProfileIcon({ color, size }: { color: string; size: number }) {
  return (
    <View style={[styles.iconContainer, { width: size, height: size }]}>
      <Text style={{ color, fontSize: size * 0.7 }}>{'👤'}</Text>
    </View>
  );
}

export default function MainTabs() {
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
          tabBarLabel: 'NOVA',
          tabBarIcon: ChatIcon,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: 'Historial',
          tabBarIcon: HistoryIcon,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Perfil',
          tabBarIcon: ProfileIcon,
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
