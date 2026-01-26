import React from 'react';
import type { Message, MessageType } from '@nova/types';

export interface MessageBubbleProps {
  message: Message;
  showTimestamp?: boolean;
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getMessageTypeIcon(type: MessageType): string | null {
  const icons: Record<MessageType, string | null> = {
    text: null,
    image: null,
    weight: '⚖️',
    sleep: '😴',
    meal: '🍽️',
    workout: '💪',
    energy: '⚡',
  };
  return icons[type];
}

export function MessageBubble({ message, showTimestamp = true }: MessageBubbleProps) {
  const isUser = message.sender === 'user';
  const icon = getMessageTypeIcon(message.type);

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}
      data-testid={`message-bubble-${message.id}`}
    >
      <div
        className={`
          max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-2.5
          ${isUser
            ? 'bg-blue-500 text-white rounded-br-md'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md'
          }
        `}
      >
        {icon && (
          <span className="text-sm mr-1.5" aria-hidden="true">
            {icon}
          </span>
        )}

        {message.imageUrl && (
          <div className="mb-2">
            <img
              src={message.imageUrl}
              alt="Attached media"
              className="rounded-lg max-w-full h-auto max-h-64 object-cover"
              loading="lazy"
            />
          </div>
        )}

        {message.content && (
          <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>
        )}

        {showTimestamp && (
          <p
            className={`
              text-xs mt-1.5
              ${isUser ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}
            `}
          >
            {formatTime(message.timestamp)}
          </p>
        )}
      </div>
    </div>
  );
}
