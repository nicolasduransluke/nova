'use client';

import React, { useRef, useEffect } from 'react';
import type { Message } from '@nova/types';
import { MessageBubble } from './MessageBubble';
import { DateSeparator } from './DateSeparator';
import { TypingIndicator } from './TypingIndicator';

export interface ChatContainerProps {
  messages: Message[];
  isAgentTyping?: boolean;
  onScrollToBottom?: () => void;
  className?: string;
}

function isSameDay(date1: Date, date2: Date): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function groupMessagesByDate(messages: Message[]): { date: Date; messages: Message[] }[] {
  const groups: { date: Date; messages: Message[] }[] = [];

  messages.forEach((message) => {
    const messageDate = new Date(message.timestamp);
    const lastGroup = groups[groups.length - 1];

    if (!lastGroup || !isSameDay(lastGroup.date, messageDate)) {
      groups.push({ date: messageDate, messages: [message] });
    } else {
      lastGroup.messages.push(message);
    }
  });

  return groups;
}

export function ChatContainer({
  messages,
  isAgentTyping = false,
  onScrollToBottom,
  className = '',
}: ChatContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      onScrollToBottom?.();
    }
  }, [messages, isAgentTyping, onScrollToBottom]);

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div
      ref={containerRef}
      className={`
        flex-1 overflow-y-auto px-4 py-4
        bg-white dark:bg-gray-900
        ${className}
      `}
      data-testid="chat-container"
    >
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center px-6">
          <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <span className="text-2xl text-white font-bold">N</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
            Welcome to NOVA
          </h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-sm">
            Your personal health coach. Share your meals, workouts, sleep, or how you're feeling.
          </p>
        </div>
      ) : (
        <>
          {groupedMessages.map((group, groupIndex) => (
            <div key={groupIndex}>
              <DateSeparator date={group.date} />
              {group.messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </div>
          ))}
        </>
      )}

      {isAgentTyping && <TypingIndicator />}

      <div ref={bottomRef} />
    </div>
  );
}
