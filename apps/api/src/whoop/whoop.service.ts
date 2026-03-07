import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { encrypt, decrypt, isEncrypted } from '../common/encryption.util';

export interface WhoopTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface WhoopUser {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
}

export interface WhoopCycle {
  id: number;
  user_id: number;
  start: string;
  end: string;
  timezone_offset: string;
  score_state: string;
  score?: {
    strain: number;
    kilojoule: number;
    average_heart_rate: number;
    max_heart_rate: number;
  };
}

export interface WhoopRecovery {
  cycle_id: number;
  sleep_id: number;
  user_id: number;
  score_state: string;
  score?: {
    recovery_score: number;
    resting_heart_rate: number;
    hrv_rmssd_milli: number;
    spo2_percentage?: number;
    skin_temp_celsius?: number;
  };
}

export interface WhoopWorkout {
  id: number;
  user_id: number;
  start: string;
  end: string;
  timezone_offset: string;
  sport_id: number;
  score_state: string;
  score?: {
    strain: number;
    average_heart_rate: number;
    max_heart_rate: number;
    kilojoule: number;
    percent_recorded: number;
    zone_duration?: {
      zone_zero_milli: number;
      zone_one_milli: number;
      zone_two_milli: number;
      zone_three_milli: number;
      zone_four_milli: number;
      zone_five_milli: number;
    };
  };
}

export interface WhoopDailySummary {
  caloriesBurned: number;
  strain: number;
  recovery?: number;
  restingHeartRate?: number;
  hrv?: number;
  workouts: WhoopWorkout[];
}

@Injectable()
export class WhoopService {
  private readonly logger = new Logger(WhoopService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly baseUrl = 'https://api.prod.whoop.com/developer/v1';
  private readonly authUrl = 'https://api.prod.whoop.com/oauth/oauth2';
  private readonly encryptionKey: string | undefined;
  private readonly refreshLocks = new Map<string, Promise<{ accessToken: string; metadata: Record<string, any> } | null>>();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.encryptionKey = this.configService.get<string>('WHOOP_ENCRYPTION_KEY');
    this.clientId = this.configService.get<string>('WHOOP_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('WHOOP_CLIENT_SECRET') || '';

    // Use local redirect URI in development
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    if (nodeEnv === 'development') {
      this.redirectUri = this.configService.get<string>('WHOOP_REDIRECT_URI_LOCAL') || '';
    } else {
      this.redirectUri = this.configService.get<string>('WHOOP_REDIRECT_URI') || '';
    }

    if (!this.clientId || !this.clientSecret) {
      this.logger.warn('Whoop credentials not configured - Whoop integration disabled');
    }
  }

  /**
   * Generate the OAuth authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    const scopes = [
      'read:profile',
      'read:cycles',
      'read:recovery',
      'read:workout',
      'read:sleep',
      'read:body_measurement',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes,
      ...(state && { state }),
    });

    return `${this.authUrl}/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<WhoopTokens> {
    this.logger.log(`Exchanging code with redirect_uri: ${this.redirectUri}`);

    const response = await fetch(`${this.authUrl}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Failed to exchange code: ${error}`);
      this.logger.error(`Used redirect_uri: ${this.redirectUri}`);
      throw new Error(`Failed to exchange authorization code: ${error}`);
    }

    return response.json();
  }

  /**
   * Refresh access token
   */
  async refreshTokens(refreshToken: string): Promise<WhoopTokens> {
    this.logger.debug('Attempting Whoop token refresh...');
    const response = await fetch(`${this.authUrl}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: 'read:profile read:cycles read:recovery read:workout read:sleep read:body_measurement',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Failed to refresh token (HTTP ${response.status}): ${error}`);
      throw new Error(`Failed to refresh token (HTTP ${response.status}): ${error}`);
    }

    this.logger.debug('Whoop token refresh successful');
    return response.json();
  }

  /**
   * Get user profile
   */
  async getProfile(accessToken: string): Promise<WhoopUser> {
    const response = await fetch(`${this.baseUrl}/user/profile/basic`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get profile: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get today's cycle (daily strain and calories)
   */
  async getTodayCycle(accessToken: string): Promise<WhoopCycle | null> {
    const today = new Date().toISOString().split('T')[0];
    const response = await fetch(
      `${this.baseUrl}/cycle?start=${today}T00:00:00.000Z&end=${today}T23:59:59.999Z`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      this.logger.error(`Failed to get cycle: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data.records?.[0] || null;
  }

  /**
   * Get today's recovery
   */
  async getTodayRecovery(accessToken: string): Promise<WhoopRecovery | null> {
    const today = new Date().toISOString().split('T')[0];
    const response = await fetch(
      `${this.baseUrl}/recovery?start=${today}T00:00:00.000Z&end=${today}T23:59:59.999Z`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      this.logger.error(`Failed to get recovery: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data.records?.[0] || null;
  }

  /**
   * Get today's workouts
   */
  async getTodayWorkouts(accessToken: string): Promise<WhoopWorkout[]> {
    const today = new Date().toISOString().split('T')[0];
    const response = await fetch(
      `${this.baseUrl}/workout?start=${today}T00:00:00.000Z&end=${today}T23:59:59.999Z`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      this.logger.error(`Failed to get workouts: ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    return data.records || [];
  }

  /**
   * Get complete daily summary including calories burned
   */
  async getDailySummary(accessToken: string): Promise<WhoopDailySummary> {
    const [cycle, recovery, workouts] = await Promise.all([
      this.getTodayCycle(accessToken),
      this.getTodayRecovery(accessToken),
      this.getTodayWorkouts(accessToken),
    ]);

    // Convert kilojoules to calories (1 kJ = 0.239 kcal)
    const kilojoules = cycle?.score?.kilojoule || 0;
    const caloriesBurned = Math.round(kilojoules * 0.239);

    return {
      caloriesBurned,
      strain: cycle?.score?.strain || 0,
      recovery: recovery?.score?.recovery_score,
      restingHeartRate: recovery?.score?.resting_heart_rate,
      hrv: recovery?.score?.hrv_rmssd_milli,
      workouts,
    };
  }

  /**
   * Get cycles for a date range (for historical data)
   */
  async getCyclesForRange(
    accessToken: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ caloriesByDate: Map<string, number>; timezoneOffsetMinutes: number }> {
    const start = startDate.toISOString();
    const end = endDate.toISOString();
    const caloriesByDate = new Map<string, number>();
    let timezoneOffsetMinutes = 0;

    // Whoop API paginates with default limit=10, so we must follow next_token
    let nextToken: string | null = null;
    let totalRecords = 0;

    do {
      const url = new URL(`${this.baseUrl}/cycle`);
      url.searchParams.set('start', start);
      url.searchParams.set('end', end);
      url.searchParams.set('limit', '25');
      if (nextToken) url.searchParams.set('nextToken', nextToken);

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        this.logger.error(`Failed to get cycles: ${response.status} ${response.statusText} - ${body}`);
        return { caloriesByDate, timezoneOffsetMinutes };
      }

      const data = await response.json();
      const records = data.records || [];
      totalRecords += records.length;

      for (const cycle of records) {
        // Extract timezone offset from first cycle (e.g. "-05:00" → -300)
        if (timezoneOffsetMinutes === 0 && cycle.timezone_offset) {
          const match = cycle.timezone_offset.match(/^([+-])(\d{2}):(\d{2})$/);
          if (match) {
            const sign = match[1] === '+' ? 1 : -1;
            timezoneOffsetMinutes = sign * (parseInt(match[2]) * 60 + parseInt(match[3]));
          }
        }

        if (cycle.score?.kilojoule) {
          // Apply timezone offset to get LOCAL date key (cycle.start is UTC)
          const cycleStart = new Date(new Date(cycle.start).getTime() + timezoneOffsetMinutes * 60000);
          const dateKey = cycleStart.toISOString().split('T')[0];
          const calories = Math.round(cycle.score.kilojoule * 0.239);
          caloriesByDate.set(dateKey, calories);
        }
      }

      nextToken = data.next_token || null;
    } while (nextToken);

    this.logger.debug(`Whoop getCyclesForRange: ${totalRecords} records, ${caloriesByDate.size} with calories, tz=${timezoneOffsetMinutes}min`);
    this.logger.debug(`Whoop calories by date: ${JSON.stringify(Object.fromEntries(caloriesByDate))}`);
    return { caloriesByDate, timezoneOffsetMinutes };
  }

  /**
   * Get a valid access token for a user, refreshing if expired.
   * Uses a per-user lock to prevent concurrent refresh race conditions.
   */
  async getValidToken(userId: string): Promise<{ accessToken: string; metadata: Record<string, any> } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { metadata: true },
    });

    const metadata = (user?.metadata ?? {}) as Record<string, any>;
    const whoopData = metadata.whoop;

    if (!whoopData?.accessToken) {
      return null;
    }

    // Decrypt tokens if they are encrypted
    const decryptedAccessToken = (whoopData.encrypted && this.encryptionKey)
      ? decrypt(whoopData.accessToken, this.encryptionKey)
      : whoopData.accessToken;

    // 5-minute buffer before expiry
    const bufferMs = 5 * 60 * 1000;
    const isExpired = whoopData.expiresAt && Date.now() > (whoopData.expiresAt - bufferMs);

    if (!isExpired) {
      return { accessToken: decryptedAccessToken, metadata };
    }

    // If a refresh is already in flight for this user, await it
    const existing = this.refreshLocks.get(userId);
    if (existing) {
      return existing;
    }

    const refreshPromise = this.doRefresh(userId, metadata, whoopData)
      .finally(() => this.refreshLocks.delete(userId));

    this.refreshLocks.set(userId, refreshPromise);
    return refreshPromise;
  }

  private async doRefresh(
    userId: string,
    metadata: Record<string, any>,
    whoopData: Record<string, any>,
  ): Promise<{ accessToken: string; metadata: Record<string, any> } | null> {
    try {
      if (!whoopData.refreshToken) {
        this.logger.warn(`No refresh token available for user ${userId}, clearing Whoop data`);
        throw new Error('No refresh token available');
      }

      // Decrypt refresh token if encrypted
      const refreshTokenPlain = (whoopData.encrypted && this.encryptionKey)
        ? decrypt(whoopData.refreshToken, this.encryptionKey)
        : whoopData.refreshToken;

      const newTokens = await this.refreshTokens(refreshTokenPlain);

      // Encrypt new tokens if encryption key is available
      const updatedWhoop = {
        ...whoopData,
        accessToken: this.encryptionKey ? encrypt(newTokens.access_token, this.encryptionKey) : newTokens.access_token,
        refreshToken: newTokens.refresh_token
          ? (this.encryptionKey ? encrypt(newTokens.refresh_token, this.encryptionKey) : newTokens.refresh_token)
          : whoopData.refreshToken,
        expiresAt: Date.now() + newTokens.expires_in * 1000,
        encrypted: !!this.encryptionKey,
      };
      const updatedMetadata = { ...metadata, whoop: updatedWhoop };

      await this.prisma.user.update({
        where: { id: userId },
        data: { metadata: updatedMetadata as any },
      });

      this.logger.debug(`Whoop token refreshed for user ${userId}`);
      return { accessToken: newTokens.access_token, metadata: updatedMetadata };
    } catch (error) {
      this.logger.error(`Failed to refresh Whoop token for user ${userId}: ${error}`);

      // Clear invalid Whoop tokens so the user can reconnect cleanly
      const { whoop: _, ...cleanMetadata } = metadata;
      await this.prisma.user.update({
        where: { id: userId },
        data: { metadata: cleanMetadata as any },
      });
      this.logger.warn(`Cleared invalid Whoop tokens for user ${userId}`);

      return null;
    }
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret && this.redirectUri);
  }
}
