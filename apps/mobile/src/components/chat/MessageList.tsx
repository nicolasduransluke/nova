import React, { useRef, useEffect } from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import type { Message } from '@nova/types';
import { MessageBubble } from './MessageBubble';
import { DateSeparator } from './DateSeparator';
import { TypingIndicator } from './TypingIndicator';
import { colors } from '@/theme';

function isSameDay(date1: Date, date2: Date): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

type ListItem =
  | { type: 'date'; date: Date; key: string }
  | { type: 'message'; message: Message; key: string }
  | { type: 'typing'; key: string };

function buildListItems(messages: Message[], isTyping: boolean): ListItem[] {
  const items: ListItem[] = [];

  messages.forEach((msg, i) => {
    const msgDate = new Date(msg.timestamp);
    const prev = i > 0 ? new Date(messages[i - 1].timestamp) : null;

    if (!prev || !isSameDay(prev, msgDate)) {
      items.push({ type: 'date', date: msgDate, key: `date-${i}` });
    }

    items.push({ type: 'message', message: msg, key: msg.id });
  });

  if (isTyping) {
    items.push({ type: 'typing', key: 'typing' });
  }

  return items;
}

interface Props {
  messages: Message[];
  isAgentTyping: boolean;
}

export function MessageList({ messages, isAgentTyping }: Props) {
  const listRef = useRef<FlatList>(null);

  const items = buildListItems(messages, isAgentTyping);

  useEffect(() => {
    if (items.length > 0) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [items.length]);

  const renderItem = ({ item }: { item: ListItem }) => {
    switch (item.type) {
      case 'date':
        return <DateSeparator date={item.date} />;
      case 'message':
        return <MessageBubble message={item.message} />;
      case 'typing':
        return <TypingIndicator />;
    }
  };

  if (messages.length === 0 && !isAgentTyping) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>N</Text>
        </View>
        <Text style={styles.welcomeTitle}>Bienvenido a NOVA</Text>
        <Text style={styles.welcomeSubtitle}>
          Tu coach personal de salud. Comparte tus comidas, ejercicios, sueño o cómo te sientes.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      data={items}
      renderItem={renderItem}
      keyExtractor={(item) => item.key}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingVertical: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 48,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
