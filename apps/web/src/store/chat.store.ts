import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message, User, MessageType } from '@nova/types';
import { generateId } from '@nova/utils';

export interface ChatState {
  messages: Message[];
  isAgentTyping: boolean;
  currentUser: User | null;
  isLoading: boolean;
  error: string | null;
}

export interface ChatActions {
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => Message;
  setAgentTyping: (typing: boolean) => void;
  setCurrentUser: (user: User | null) => void;
  loadHistory: () => Promise<void>;
  clearMessages: () => void;
  setError: (error: string | null) => void;
  sendUserMessage: (content: string, imageUrl?: string, type?: MessageType) => Promise<void>;
}

export type ChatStore = ChatState & ChatActions;

// Mock agent responses
const agentResponses: Record<string, string[]> = {
  default: [
    "I'm here to help you on your wellness journey. What would you like to track today?",
    "That's great progress! Keep up the good work.",
    "I've noted that down. How are you feeling overall?",
    "Thanks for sharing. Remember, consistency is key to reaching your goals.",
  ],
  weight: [
    "Got it! I've recorded your weight. You're making steady progress.",
    "Weight logged. Remember, daily fluctuations are normal.",
    "Thanks for tracking your weight. Consistency in logging helps us see trends.",
  ],
  meal: [
    "Nice meal choice! I've logged it for you.",
    "Food tracked! How did this meal make you feel?",
    "Got it. Remember to stay hydrated throughout the day.",
  ],
  workout: [
    "Great workout! I've added those NOVA points to your score.",
    "Exercise logged! How's your energy level after that?",
    "Awesome effort! Rest and recovery are just as important.",
  ],
  sleep: [
    "Sleep logged. Quality rest is crucial for your goals.",
    "Got it! How do you feel this morning?",
    "Thanks for tracking. Consistent sleep schedules help improve quality.",
  ],
  energy: [
    "Energy level noted. Let's see what factors might be affecting it.",
    "Thanks for checking in. Your energy patterns help us optimize your routine.",
  ],
};

function getAgentResponse(messageType: MessageType): string {
  const responses = agentResponses[messageType] || agentResponses.default;
  return responses[Math.floor(Math.random() * responses.length)];
}

function detectMessageType(content: string, hasImage: boolean): MessageType {
  const lowerContent = content.toLowerCase();

  if (hasImage) {
    if (lowerContent.includes('weight') || lowerContent.includes('scale')) return 'weight';
    if (lowerContent.includes('food') || lowerContent.includes('meal') || lowerContent.includes('ate') || lowerContent.includes('breakfast') || lowerContent.includes('lunch') || lowerContent.includes('dinner')) return 'meal';
    if (lowerContent.includes('workout') || lowerContent.includes('gym') || lowerContent.includes('exercise')) return 'workout';
    return 'image';
  }

  if (lowerContent.includes('sleep') || lowerContent.includes('slept') || lowerContent.includes('tired')) return 'sleep';
  if (lowerContent.includes('energy') || lowerContent.includes('feel')) return 'energy';
  if (lowerContent.includes('workout') || lowerContent.includes('exercise') || lowerContent.includes('run') || lowerContent.includes('gym')) return 'workout';
  if (lowerContent.includes('ate') || lowerContent.includes('food') || lowerContent.includes('meal')) return 'meal';
  if (lowerContent.includes('weight') || lowerContent.includes('kg') || lowerContent.includes('lb')) return 'weight';

  return 'text';
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      // State
      messages: [],
      isAgentTyping: false,
      currentUser: null,
      isLoading: false,
      error: null,

      // Actions
      addMessage: (messageData) => {
        const message: Message = {
          ...messageData,
          id: generateId(),
          timestamp: new Date(),
        };

        set((state) => ({
          messages: [...state.messages, message],
        }));

        return message;
      },

      setAgentTyping: (typing) => {
        set({ isAgentTyping: typing });
      },

      setCurrentUser: (user) => {
        set({ currentUser: user });
      },

      loadHistory: async () => {
        set({ isLoading: true, error: null });

        try {
          // In a real app, this would fetch from the API
          // For now, we just simulate a delay
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Messages are already persisted via zustand/persist
          set({ isLoading: false });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to load history',
          });
        }
      },

      clearMessages: () => {
        set({ messages: [] });
      },

      setError: (error) => {
        set({ error });
      },

      sendUserMessage: async (content, imageUrl, explicitType) => {
        const { addMessage, setAgentTyping } = get();

        // Detect message type
        const type = explicitType || detectMessageType(content, !!imageUrl);

        // Add user message
        addMessage({
          type,
          content,
          imageUrl,
          sender: 'user',
        });

        // Simulate agent typing
        setAgentTyping(true);

        // Random delay between 1-2 seconds
        const delay = 1000 + Math.random() * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Add agent response
        setAgentTyping(false);
        addMessage({
          type: 'text',
          content: getAgentResponse(type),
          sender: 'agent',
        });
      },
    }),
    {
      name: 'nova-chat-storage',
      partialize: (state) => ({
        messages: state.messages,
        currentUser: state.currentUser,
      }),
    }
  )
);
