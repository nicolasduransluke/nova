import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { API_URL } from '@/config/env';

// Configure foreground notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(
  accessToken: string,
): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permission if not granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return null;
  }

  // Get the Expo push token
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.error('Missing EAS project ID for push notifications');
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const pushToken = tokenData.data;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Register token with backend
    await fetch(`${API_URL}/api/coaching/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ pushToken, timezone }),
    });

    console.log('Push token registered:', pushToken.substring(0, 25) + '...');

    // Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('coaching', {
        name: 'Coaching',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }

    return pushToken;
  } catch (error) {
    console.error('Failed to register push token:', error);
    return null;
  }
}

export function setupNotificationListeners(
  onNotificationTap?: (data: Record<string, unknown>) => void,
): () => void {
  // Handle notification tap (app in background/closed)
  const responseSubscription =
    Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      onNotificationTap?.(data);
    });

  return () => {
    responseSubscription.remove();
  };
}
