import { act, renderHook } from '@testing-library/react';
import { useChatStore } from '@/store/chat.store';

describe('ChatStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useChatStore());
    act(() => {
      result.current.clearMessages();
      result.current.setAgentTyping(false);
      result.current.setError(null);
    });
  });

  describe('addMessage', () => {
    it('adds a message to the store', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.addMessage({
          type: 'text',
          content: 'Hello, NOVA!',
          sender: 'user',
        });
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].content).toBe('Hello, NOVA!');
      expect(result.current.messages[0].sender).toBe('user');
    });

    it('generates unique id and timestamp for each message', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.addMessage({
          type: 'text',
          content: 'Message 1',
          sender: 'user',
        });
        result.current.addMessage({
          type: 'text',
          content: 'Message 2',
          sender: 'agent',
        });
      });

      expect(result.current.messages[0].id).toBeDefined();
      expect(result.current.messages[1].id).toBeDefined();
      expect(result.current.messages[0].id).not.toBe(result.current.messages[1].id);
      expect(result.current.messages[0].timestamp).toBeInstanceOf(Date);
    });

    it('returns the created message', () => {
      const { result } = renderHook(() => useChatStore());

      let createdMessage;
      act(() => {
        createdMessage = result.current.addMessage({
          type: 'text',
          content: 'Test message',
          sender: 'user',
        });
      });

      expect(createdMessage).toHaveProperty('id');
      expect(createdMessage).toHaveProperty('timestamp');
      expect(createdMessage?.content).toBe('Test message');
    });
  });

  describe('setAgentTyping', () => {
    it('sets agent typing state to true', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.setAgentTyping(true);
      });

      expect(result.current.isAgentTyping).toBe(true);
    });

    it('sets agent typing state to false', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.setAgentTyping(true);
        result.current.setAgentTyping(false);
      });

      expect(result.current.isAgentTyping).toBe(false);
    });
  });

  describe('clearMessages', () => {
    it('removes all messages', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.addMessage({
          type: 'text',
          content: 'Message 1',
          sender: 'user',
        });
        result.current.addMessage({
          type: 'text',
          content: 'Message 2',
          sender: 'agent',
        });
        result.current.clearMessages();
      });

      expect(result.current.messages).toHaveLength(0);
    });
  });

  describe('setError', () => {
    it('sets error message', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.setError('Something went wrong');
      });

      expect(result.current.error).toBe('Something went wrong');
    });

    it('clears error message', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.setError('Error');
        result.current.setError(null);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('setCurrentUser', () => {
    it('sets the current user', () => {
      const { result } = renderHook(() => useChatStore());

      const user = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      act(() => {
        result.current.setCurrentUser(user);
      });

      expect(result.current.currentUser).toEqual(user);
    });

    it('clears the current user', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.setCurrentUser({
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        result.current.setCurrentUser(null);
      });

      expect(result.current.currentUser).toBeNull();
    });
  });

  describe('sendUserMessage', () => {
    it('adds user message and triggers agent response', async () => {
      const { result } = renderHook(() => useChatStore());

      await act(async () => {
        await result.current.sendUserMessage('Hello!');
      });

      // Should have user message and agent response
      expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
      expect(result.current.messages[0].sender).toBe('user');
      expect(result.current.messages[0].content).toBe('Hello!');
      expect(result.current.messages[1].sender).toBe('agent');
    });

    it('detects message type from content', async () => {
      const { result } = renderHook(() => useChatStore());

      await act(async () => {
        await result.current.sendUserMessage('I slept 8 hours');
      });

      expect(result.current.messages[0].type).toBe('sleep');
    });

    it('handles image messages', async () => {
      const { result } = renderHook(() => useChatStore());

      await act(async () => {
        await result.current.sendUserMessage('My meal', 'https://example.com/food.jpg');
      });

      expect(result.current.messages[0].imageUrl).toBe('https://example.com/food.jpg');
    });

    it('sets and clears typing indicator', async () => {
      const { result } = renderHook(() => useChatStore());

      // Start the message sending
      const promise = act(async () => {
        await result.current.sendUserMessage('Hello!');
      });

      // After completion, typing should be false
      await promise;
      expect(result.current.isAgentTyping).toBe(false);
    });
  });

  describe('loadHistory', () => {
    it('sets loading state', async () => {
      const { result } = renderHook(() => useChatStore());

      await act(async () => {
        await result.current.loadHistory();
      });

      expect(result.current.isLoading).toBe(false);
    });
  });
});
