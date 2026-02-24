import { Injectable, Logger } from '@nestjs/common';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private readonly EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

  isValidToken(token: string): boolean {
    return /^ExponentPushToken\[.+\]$/.test(token);
  }

  async sendPushNotification(
    token: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<boolean> {
    if (!this.isValidToken(token)) {
      this.logger.warn(`Invalid Expo push token: ${token}`);
      return false;
    }

    const message: ExpoPushMessage = {
      to: token,
      title,
      body: body.length > 178 ? body.substring(0, 175) + '...' : body,
      data,
      sound: 'default',
    };

    try {
      const response = await fetch(this.EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const result = await response.json();

      if (result.data?.[0]?.status === 'error') {
        this.logger.error(`Push notification error: ${result.data[0].message}`);
        return false;
      }

      this.logger.debug(`Push sent to ${token.substring(0, 25)}...`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send push notification: ${error}`);
      return false;
    }
  }
}
