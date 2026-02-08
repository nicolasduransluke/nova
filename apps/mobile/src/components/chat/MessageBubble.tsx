import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import type { Message, MessageType } from '@nova/types';
import { colors } from '@/theme';

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getMessageTypeIcon(type: MessageType): string | null {
  const icons: Record<MessageType, string | null> = {
    text: null,
    image: null,
    weight: '\u2696\uFE0F',
    sleep: '\uD83D\uDE34',
    meal: '\uD83C\uDF7D\uFE0F',
    workout: '\uD83D\uDCAA',
    energy: '\u26A1',
  };
  return icons[type];
}

interface Props {
  message: Message;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.sender === 'user';
  const icon = getMessageTypeIcon(message.type);

  return (
    <View style={[styles.row, isUser ? styles.rowRight : styles.rowLeft]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.agentBubble]}>
        {icon && <Text style={styles.icon}>{icon}</Text>}

        {message.imageUrl && (
          <Image
            source={{ uri: message.imageUrl }}
            style={styles.image}
            resizeMode="cover"
          />
        )}

        {message.content ? (
          <Text style={[styles.content, isUser ? styles.userText : styles.agentText]}>
            {message.content}
          </Text>
        ) : null}

        <Text style={[styles.time, isUser ? styles.userTime : styles.agentTime]}>
          {formatTime(message.timestamp)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  rowLeft: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    backgroundColor: colors.chat.userBubble,
    borderBottomRightRadius: 4,
  },
  agentBubble: {
    backgroundColor: colors.chat.agentBubble,
    borderBottomLeftRadius: 4,
  },
  icon: {
    fontSize: 14,
    marginBottom: 2,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 6,
  },
  content: {
    fontSize: 15,
    lineHeight: 21,
  },
  userText: {
    color: '#fff',
  },
  agentText: {
    color: colors.text.primary,
  },
  time: {
    fontSize: 11,
    marginTop: 4,
  },
  userTime: {
    color: 'rgba(255,255,255,0.6)',
  },
  agentTime: {
    color: colors.text.dimmed,
  },
});
