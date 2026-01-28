'use client';

import { useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChatContainer,
  ChatHeader,
  MessageInput,
} from '@nova/ui';
import { DailySummaryCard } from '@nova/ui';
import { useChatStore } from '@/store/chat.store';

export default function ChatPage() {
  const router = useRouter();
  const [showSummary, setShowSummary] = useState(false);
  const {
    messages,
    isAgentTyping,
    isLoading,
    dailySummary,
    loadHistory,
    sendUserMessage,
  } = useChatStore();

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleSend = useCallback(
    async (content: string, imageUrl?: string) => {
      await sendUserMessage(content, imageUrl);
    },
    [sendUserMessage]
  );

  const handleBack = useCallback(() => {
    router.push('/');
  }, [router]);

  const handleSettings = useCallback(() => {
    setShowSummary((prev) => !prev);
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
        <ChatHeader
          title="NOVA"
          subtitle="Loading..."
          onBack={handleBack}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      <ChatHeader
        title="NOVA"
        subtitle="Coach de Déficit Calórico"
        onBack={handleBack}
        onSettings={handleSettings}
      />

      {showSummary && dailySummary && (
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <DailySummaryCard summary={dailySummary} compact />
        </div>
      )}

      <ChatContainer
        messages={messages}
        isAgentTyping={isAgentTyping}
        className="flex-1"
      />

      <MessageInput
        onSend={handleSend}
        placeholder="Describe tu comida o actividad..."
      />
    </div>
  );
}
