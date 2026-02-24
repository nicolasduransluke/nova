import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message, MessageType, DailySummary } from '@nova/types';
import { generateId } from '@nova/utils';
import { useAuthStore } from './auth.store';

export interface ChatState {
  messages: Message[];
  isAgentTyping: boolean;
  isLoading: boolean;
  error: string | null;
  dailySummary: DailySummary | null;
}

export interface ChatActions {
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => Message;
  setAgentTyping: (typing: boolean) => void;
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

      loadHistory: async () => {
        set({ isLoading: true, error: null });
        const authState = useAuthStore.getState();
        const accessToken = authState.accessToken;
        console.log('[web loadHistory] called, hasToken:', !!accessToken);

        try {
          if (accessToken) {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            console.log('[web loadHistory] fetching from:', API_URL);
            const response = await fetch(`${API_URL}/api/messages/history?limit=50`, {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
            });

            if (response.status === 401) {
              const refreshed = await useAuthStore.getState().refreshTokens();
              if (refreshed) {
                const newToken = useAuthStore.getState().accessToken;
                const retryResponse = await fetch(`${API_URL}/api/messages/history?limit=50`, {
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${newToken}`,
                  },
                });
                const retryData = await retryResponse.json();
                if (retryData.success && retryData.data) {
                  set({ messages: retryData.data });
                }
              }
            } else {
              const data = await response.json();
              console.log('[web loadHistory] response:', data.success, 'count:', data.data?.length);
              if (data.success && data.data) {
                set({ messages: data.data });
              }
            }
          } else {
            console.log('[web loadHistory] no accessToken, skipping fetch');
          }

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
        const { addMessage, setAgentTyping } = get();
        const authState = useAuthStore.getState();
        const userId = authState.user?.id;
        const accessToken = authState.accessToken;

        if (!userId) {
          addMessage({
            type: 'text',
            content: 'Error: No hay sesión activa. Por favor inicia sesión.',
            sender: 'agent',
          });
          return;
        }

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
            userId,
            content,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          };

          const response = await fetch(`${API_URL}/api/messages/process/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
            body: JSON.stringify(body),
          });

          // Handle 401 - try to refresh token and retry
          if (response.status === 401) {
            const refreshed = await useAuthStore.getState().refreshTokens();
            if (refreshed) {
              // Retry with new token
              const newAccessToken = useAuthStore.getState().accessToken;
              const retryResponse = await fetch(`${API_URL}/api/messages/process/sync`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(newAccessToken ? { Authorization: `Bearer ${newAccessToken}` } : {}),
                },
                body: JSON.stringify(body),
              });
              const retryData = await retryResponse.json();
              setAgentTyping(false);

              if (retryData.success && retryData.data?.response?.message) {
                const retryResponse = retryData.data.response;
                const retryIntent = retryData.data.intent;
                addMessage({
                  type: retryIntent === 'meal_log' ? 'meal' : 'text',
                  content: retryResponse.message,
                  sender: 'agent',
                  metadata: {
                    ...(retryResponse.foodItems ? { foodItems: retryResponse.foodItems } : {}),
                    ...(retryIntent ? { intent: retryIntent } : {}),
                  },
                });
                if (retryResponse.dailySummary) {
                  set({ dailySummary: retryResponse.dailySummary });
                }
                return;
              }
            } else {
              // Refresh failed, redirect to login
              setAgentTyping(false);
              window.location.href = '/login';
              return;
            }
          }

          const data = await response.json();
          setAgentTyping(false);

          if (data.success && data.data?.response?.message) {
            const responseData = data.data.response;
            const intent = data.data.intent;
            addMessage({
              type: intent === 'meal_log' ? 'meal' : 'text',
              content: responseData.message,
              sender: 'agent',
              metadata: {
                ...(responseData.foodItems ? { foodItems: responseData.foodItems } : {}),
                ...(intent ? { intent } : {}),
              },
            });

            // Update daily summary from response
            if (responseData.dailySummary) {
              set({ dailySummary: responseData.dailySummary });
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
        dailySummary: state.dailySummary,
      }),
    }
  )
);
