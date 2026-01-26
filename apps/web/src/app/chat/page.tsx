'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChatContainer,
  ChatHeader,
  MessageInput,
} from '@nova/ui';
import { useChatStore } from '@/store/chat.store';

export default function ChatPage() {
  const router = useRouter();
  const {
    messages,
    isAgentTyping,
    isLoading,
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
    // TODO: Open settings modal or navigate to settings page
    console.log('Settings clicked');
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
        subtitle="Your Health Coach"
        onBack={handleBack}
        onSettings={handleSettings}
      />

      <ChatContainer
        messages={messages}
        isAgentTyping={isAgentTyping}
        className="flex-1"
      />

      <MessageInput
        onSend={handleSend}
        placeholder="Share your meals, workouts, or how you feel..."
      />
    </div>
  );
}
