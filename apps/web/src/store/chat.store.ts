import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message, User, MessageType, DailySummary } from '@nova/types';
import { generateId } from '@nova/utils';

export interface ChatState {
  messages: Message[];
  isAgentTyping: boolean;
  currentUser: User | null;
  isLoading: boolean;
  error: string | null;
  dailySummary: DailySummary | null;
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

function detectMessageType(content: string, hasImage: boolean): MessageType {
  const lowerContent = content.toLowerCase();

  if (hasImage) {
    if (lowerContent.includes('weight') || lowerContent.includes('scale') || lowerContent.includes('peso')) return 'weight';
    if (lowerContent.includes('food') || lowerContent.includes('meal') || lowerContent.includes('comida')) return 'meal';
    if (lowerContent.includes('workout') || lowerContent.includes('gym') || lowerContent.includes('ejercicio')) return 'workout';
    return 'image';
  }

  if (lowerContent.includes('workout') || lowerContent.includes('exercise') || lowerContent.includes('run') ||
      lowerContent.includes('gym') || lowerContent.includes('entrené') || lowerContent.includes('correr') ||
      lowerContent.includes('ejercicio') || lowerContent.includes('gimnasio') || lowerContent.includes('pesas')) return 'workout';
  if (lowerContent.includes('ate') || lowerContent.includes('food') || lowerContent.includes('meal') ||
      lowerContent.includes('comí') || lowerContent.includes('comida') || lowerContent.includes('almuerzo') ||
      lowerContent.includes('desayuno') || lowerContent.includes('cena') || lowerContent.includes('pollo') ||
      lowerContent.includes('arroz')) return 'meal';
  if (lowerContent.includes('weight') || lowerContent.includes('kg') || lowerContent.includes('lb') ||
      lowerContent.includes('peso') || lowerContent.includes('kilos')) return 'weight';

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
      dailySummary: null,

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
          await new Promise((resolve) => setTimeout(resolve, 300));
          set({ isLoading: false });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to load history',
          });
        }
      },

      clearMessages: () => {
        set({ messages: [], dailySummary: null });
      },

      setError: (error) => {
        set({ error });
      },

      sendUserMessage: async (content, imageUrl, explicitType) => {
        const { addMessage, setAgentTyping, currentUser } = get();

        const type = explicitType || detectMessageType(content, !!imageUrl);

        addMessage({
          type,
          content,
          imageUrl,
          sender: 'user',
        });

        setAgentTyping(true);

        try {
          const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
          const body: Record<string, unknown> = {
            userId: currentUser?.id || 'demo-user-001',
            content,
          };

          const response = await fetch(`${API_URL}/api/messages/process/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          });

          const data = await response.json();

          setAgentTyping(false);

          if (data.success && data.data?.response?.message) {
            addMessage({
              type: 'text',
              content: data.data.response.message,
              sender: 'agent',
            });

            // Update daily summary from response
            if (data.data.response.dailySummary) {
              set({ dailySummary: data.data.response.dailySummary });
            }
          } else {
            addMessage({
              type: 'text',
              content: 'No pude procesar tu mensaje. Intenta de nuevo.',
              sender: 'agent',
            });
          }
        } catch (error) {
          console.error('Error calling API:', error);
          setAgentTyping(false);
          addMessage({
            type: 'text',
            content: 'Error de conexión. Verifica que el servidor esté corriendo.',
            sender: 'agent',
          });
        }
      },
    }),
    {
      name: 'nova-chat-storage',
      partialize: (state) => ({
        messages: state.messages,
        currentUser: state.currentUser,
        dailySummary: state.dailySummary,
      }),
    }
  )
);
