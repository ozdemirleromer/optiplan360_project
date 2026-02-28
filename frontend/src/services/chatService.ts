/**
 * AI Chatbot Assistant
 * Natural language processing + backend integration
 */

import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  confidence?: number; // 0-1 für AI dönem
  action?: {
    type: 'CREATE_ORDER' | 'UPDATE_STATUS' | 'GENERATE_REPORT' | 'EXPORT_DATA' | 'NAVIGATE';
    payload?: Record<string, unknown>;
  };
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  removeMessage: (id: string) => void;
  clearChat: () => void;
  setLoading: (value: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  error: null,

  addMessage: (message) => {
    const id = `msg-${Date.now()}`;
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id,
          timestamp: new Date().toISOString(),
        },
      ],
    }));
  },

  removeMessage: (id) => {
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== id),
    }));
  },

  clearChat: () => {
    set({ messages: [] });
  },

  setLoading: (value) => {
    set({ isLoading: value });
  },
}));

/**
 * AI Chatbot Service
 */
export const chatService = {
  /**
   * Backend'e chat mesajı gönder ve cevap al
   */
  sendMessage: async (message: string, context?: Record<string, unknown>): Promise<ChatMessage> => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          context, // Mevcut sipariş, müşteri, vb.
        }),
      });

      if (!response.ok) {
        throw new Error('Chat request failed');
      }

      const data = await response.json();

      return {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toISOString(),
        confidence: data.confidence,
        action: data.action,
      };
    } catch (error) {
      console.error('Chat error:', error);
      throw error;
    }
  },

  /**
   * Tahe edilmesi gereken aksiyonu yürüt
   */
  executeAction: async (action: ChatMessage['action']): Promise<unknown> => {
    if (!action) return null;

    try {
      const response = await fetch('/api/chat/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });

      if (!response.ok) {
        throw new Error('Action execution failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Action error:', error);
      throw error;
    }
  },
};

/**
 * useAIChat Hook
 */
import { useCallback } from 'react';

export const useAIChat = () => {
  const { messages, isLoading, addMessage, clearChat, setLoading } = useChatStore();

  const sendMessage = useCallback(
    async (content: string, context?: Record<string, unknown>) => {
      // Kullanıcı mesajını ekle
      addMessage({
        role: 'user',
        content,
      });

      setLoading(true);

      try {
        const response = await chatService.sendMessage(content, context);
        addMessage(response);

        // Action varsa, önerilişi göster
        if (response.action) {
          // UI component'i action'u yürütmeyi sunabilir
        }

        return response;
      } catch (error) {
        addMessage({
          role: 'assistant',
          content: 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.',
        });
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [addMessage, setLoading],
  );

  return {
    messages,
    isLoading,
    sendMessage,
    clearChat,
  };
};
