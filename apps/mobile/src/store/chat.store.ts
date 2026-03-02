import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Message, MessageType, DailySummary } from '@nova/types';
import { generateId } from '@nova/utils';
import { useAuthStore } from './auth.store';
import { asyncStorage } from '@/lib/storage';
import { API_URL } from '@/config/env';

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
  refreshDailySummary: () => Promise<void>;
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
      messages: [],
      isAgentTyping: false,
      isLoading: false,
      error: null,
      dailySummary: null,

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

      setAgentTyping: (typing) => set({ isAgentTyping: typing }),

      loadHistory: async () => {
        const authState = useAuthStore.getState();
        if (authState.isGuest) return;

        set({ isLoading: true, error: null });
        const accessToken = authState.accessToken;
        console.log('[loadHistory] called, hasToken:', !!accessToken);

        try {
          if (accessToken) {
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
              console.log('[loadHistory] API response:', data.success, 'messages:', data.data?.length);
              if (data.success && data.data) {
                set({ messages: data.data });
              }
            }
          }

          await get().refreshDailySummary();
          set({ isLoading: false });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to load history',
          });
        }
      },

      refreshDailySummary: async () => {
        const authState = useAuthStore.getState();
        const userId = authState.user?.id;
        if (!userId) {
          // No user — show empty panel instead of infinite spinner
          set({ dailySummary: { intake: 0, burn: 0, tdee: 0, deficit: 0, targetDeficit: 0, projectedWeeklyLoss: 0, date: new Date() } });
          return;
        }

        try {
          const res = await fetch(`${API_URL}/api/history/daily?userId=${userId}&days=1`, {
            headers: {
              'Content-Type': 'application/json',
              ...(authState.accessToken ? { Authorization: `Bearer ${authState.accessToken}` } : {}),
            },
          });
          const data = await res.json();
          if (data.success && data.data?.length > 0) {
            const todayEntry = data.data[0];
            if (todayEntry?.summary) {
              set({ dailySummary: todayEntry.summary });
              return;
            }
          }
          // API returned no entries for today — show empty summary instead of spinner
          set({ dailySummary: { intake: 0, burn: 0, tdee: 0, deficit: 0, targetDeficit: 0, projectedWeeklyLoss: 0, date: new Date() } });
        } catch (error) {
          console.error('Error refreshing daily summary:', error);
          // On error, show empty panel instead of infinite spinner
          set({ dailySummary: { intake: 0, burn: 0, tdee: 0, deficit: 0, targetDeficit: 0, projectedWeeklyLoss: 0, date: new Date() } });
        }
      },

      clearMessages: () => set({ messages: [], dailySummary: null }),

      setError: (error) => set({ error }),

      sendUserMessage: async (content, imageUrl, explicitType) => {
        const { addMessage, setAgentTyping } = get();
        const authState = useAuthStore.getState();
        const isGuest = authState.isGuest;
        const userId = authState.user?.id;
        const accessToken = authState.accessToken;

        if (!isGuest && !userId) {
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
          const effectiveContent = content || (imageUrl ? '[Foto de comida]' : '');

          // Guest mode: use the public guest endpoint
          if (isGuest) {
            const guestBody: Record<string, unknown> = { content: effectiveContent };
            if (imageUrl) guestBody.imageUrl = imageUrl;

            const response = await fetch(`${API_URL}/api/messages/guest`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(guestBody),
            });

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
            } else {
              addMessage({
                type: 'text',
                content: 'No pude procesar tu mensaje. Intenta de nuevo.',
                sender: 'agent',
              });
            }
            return;
          }

          // Authenticated user flow
          const body: Record<string, unknown> = {
            userId,
            content: effectiveContent,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          };
          if (imageUrl) {
            body.imageUrl = imageUrl;
          }

          const response = await fetch(`${API_URL}/api/messages/process/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
            body: JSON.stringify(body),
          });

          if (response.status === 401) {
            const refreshed = await useAuthStore.getState().refreshTokens();
            if (refreshed) {
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
              setAgentTyping(false);
              useAuthStore.getState().clearAuth();
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
            content: 'Error de conexión. Verifica tu conexión a internet.',
            sender: 'agent',
          });
        }
      },
    }),
    {
      name: 'nova-chat-storage',
      storage: createJSONStorage(() => asyncStorage),
      partialize: (state) => ({
        dailySummary: state.dailySummary,
      }),
    },
  ),
);
