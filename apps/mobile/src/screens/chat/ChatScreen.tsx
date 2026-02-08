import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChatStore } from '@/store/chat.store';
import { MessageList } from '@/components/chat/MessageList';
import { MessageInput } from '@/components/chat/MessageInput';
import { DailySummarySheet } from '@/components/chat/DailySummarySheet';
import { colors } from '@/theme';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const {
    messages,
    isAgentTyping,
    dailySummary,
    sendUserMessage,
    loadHistory,
  } = useChatStore();

  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

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

        {dailySummary && (
          <Pressable
            onPress={() => setShowSummary(true)}
            style={styles.summaryButton}
          >
            <Text style={styles.summaryButtonText}>{'📊'}</Text>
          </Pressable>
        )}
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={0}
      >
        <MessageList messages={messages} isAgentTyping={isAgentTyping} />
        <MessageInput onSend={handleSend} disabled={isAgentTyping} />
      </KeyboardAvoidingView>

      {/* Daily Summary Sheet */}
      {dailySummary && (
        <DailySummarySheet
          summary={dailySummary}
          visible={showSummary}
          onClose={() => setShowSummary(false)}
        />
      )}
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
  summaryButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryButtonText: {
    fontSize: 20,
  },
});
