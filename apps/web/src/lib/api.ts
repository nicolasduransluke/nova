import type { ApiResponse, HealthCheck } from '@nova/types';
import { useAuthStore } from '../store/auth.store';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private baseUrl: string;
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getAuthHeaders(): Record<string, string> {
    const accessToken = useAuthStore.getState().accessToken;
    if (accessToken) {
      return { Authorization: `Bearer ${accessToken}` };
    }
    return {};
  }

  private async handleUnauthorized(): Promise<boolean> {
    // Avoid multiple simultaneous refresh attempts
    if (this.isRefreshing) {
      return this.refreshPromise || Promise.resolve(false);
    }

    this.isRefreshing = true;
    this.refreshPromise = useAuthStore.getState().refreshTokens();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async fetch<T>(
    endpoint: string,
    options?: RequestInit,
    retry: boolean = true
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
          ...options?.headers,
        },
      });

      // Handle 401 Unauthorized - try to refresh token
      if (response.status === 401 && retry) {
        const refreshed = await this.handleUnauthorized();
        if (refreshed) {
          // Retry the request with new token
          return this.fetch<T>(endpoint, options, false);
        } else {
          // Redirect to login if refresh failed
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
          return {
            success: false,
            error: 'Session expired. Please login again.',
          };
        }
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'An error occurred' }));
        return {
          success: false,
          error: error.message || 'An error occurred',
        };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  async healthCheck(): Promise<ApiResponse<HealthCheck>> {
    return this.fetch<HealthCheck>('/api/health');
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.fetch<T>(endpoint);
  }

  async post<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return this.fetch<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async put<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return this.fetch<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async patch<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return this.fetch<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.fetch<T>(endpoint, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient(API_URL);
