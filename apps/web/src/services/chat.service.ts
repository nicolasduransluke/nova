import type { Message, ApiResponse, CreateMessageDTO } from '@nova/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export class ChatService {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  async sendMessage(dto: CreateMessageDTO): Promise<ApiResponse<Message>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dto),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  async getHistory(userId: string): Promise<ApiResponse<Message[]>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat/history/${userId}`);

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  async uploadImage(file: File): Promise<ApiResponse<{ url: string }>> {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`${this.baseUrl}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }
}

// Mock implementation for development
export class MockChatService extends ChatService {
  private mockDelay(ms: number = 500): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async sendMessage(dto: CreateMessageDTO): Promise<ApiResponse<Message>> {
    await this.mockDelay();

    const message: Message = {
      id: `msg-${Date.now()}`,
      ...dto,
      timestamp: new Date(),
    };

    return { success: true, data: message };
  }

  async getHistory(): Promise<ApiResponse<Message[]>> {
    await this.mockDelay();
    return { success: true, data: [] };
  }

  async uploadImage(): Promise<ApiResponse<{ url: string }>> {
    await this.mockDelay(1000);

    // Return a placeholder image URL for mock
    return {
      success: true,
      data: { url: 'https://via.placeholder.com/300x200?text=Uploaded+Image' },
    };
  }
}

// Export singleton instance
export const chatService =
  process.env.NODE_ENV === 'development' ? new MockChatService() : new ChatService();
