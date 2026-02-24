import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useChatStore } from '@/store/chat.store';
import { useAuthStore } from '@/store/auth.store';
import { MessageList } from '@/components/chat/MessageList';
import { MessageInput } from '@/components/chat/MessageInput';
import { colors } from '@/theme';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isGuest, logout } = useAuthStore();
  const {
    messages,
    isAgentTyping,
    sendUserMessage,
    loadHistory,
    refreshDailySummary,
  } = useChatStore();

  const isFocused = useIsFocused();

  const appState = useRef(AppState.currentState);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Reload history when app comes back to foreground (e.g. after using web)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        loadHistory();
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [loadHistory]);

  useEffect(() => {
    if (isFocused) {
      loadHistory();
      refreshDailySummary();
    }
  }, [isFocused, loadHistory, refreshDailySummary]);

  const handleSend = (content: string, imageUrl?: string) => {
    sendUserMessage(content, imageUrl);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>N</Text>
          </View>
          <Text style={styles.headerTitle}>NOVA</Text>
        </View>

        {!isGuest && (
          <Pressable
            onPress={() => navigation.navigate('Profile')}
            style={styles.profileButton}
          >
            <Text style={styles.profileButtonText}>{'👤'}</Text>
          </Pressable>
        )}
      </View>

      {/* Guest banner */}
      {isGuest && (
        <Pressable onPress={logout} style={styles.guestBanner}>
          <Text style={styles.guestBannerText}>
            Modo invitado — Crea una cuenta para guardar tu progreso
          </Text>
        </Pressable>
      )}

      {/* Messages */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={0}
      >
        <MessageList messages={messages} isAgentTyping={isAgentTyping} />
        <MessageInput onSend={handleSend} disabled={isAgentTyping} />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gradient.from,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileButtonText: {
    fontSize: 20,
  },
  guestBanner: {
    backgroundColor: 'rgba(147, 51, 234, 0.3)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  guestBannerText: {
    color: colors.text.secondary,
    fontSize: 13,
    textAlign: 'center',
  },
});
