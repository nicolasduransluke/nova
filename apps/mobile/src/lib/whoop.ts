import * as WebBrowser from 'expo-web-browser';
import { API_URL } from '@/config/env';
import { useAuthStore } from '@/store/auth.store';

export async function connectWhoop(): Promise<{ success: boolean; error?: string }> {
  const accessToken = useAuthStore.getState().accessToken;
  if (!accessToken) {
    return { success: false, error: 'No estás autenticado' };
  }

  // Fetch the OAuth URL from our API (built with server-side config)
  let authUrl: string;
  try {
    const urlRes = await fetch(`${API_URL}/api/auth/whoop/auth-url`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!urlRes.ok) {
      return { success: false, error: 'No se pudo obtener la URL de Whoop' };
    }
    const urlData = await urlRes.json();
    authUrl = urlData.url;
  } catch {
    return { success: false, error: 'Error de conexión con el servidor' };
  }

  try {
    // Opens in-app browser; returns when URL matches nova:// scheme
    const result = await WebBrowser.openAuthSessionAsync(authUrl, 'nova://');

    if (result.type !== 'success' || !result.url) {
      return { success: false, error: 'Autorización cancelada' };
    }

    // Parse the returned deep link URL
    const url = new URL(result.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      return { success: false, error: `Error de Whoop: ${error}` };
    }

    if (!code) {
      return { success: false, error: 'No se recibió código de autorización' };
    }

    // Exchange code via our API
    const response = await fetch(`${API_URL}/api/auth/whoop/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({ message: 'Error al conectar' }));
      return { success: false, error: data.message || 'Error al conectar con Whoop' };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error de conexión',
    };
  }
}

export async function getWhoopStatus(accessToken: string): Promise<{
  connected: boolean;
  connectedAt?: string;
}> {
  try {
    const response = await fetch(`${API_URL}/api/auth/whoop/status`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) return { connected: false };

    const data = await response.json();
    return {
      connected: data.connected,
      connectedAt: data.connectedAt,
    };
  } catch {
    return { connected: false };
  }
}

export async function disconnectWhoop(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/auth/whoop/disconnect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}
