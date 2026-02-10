import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface WhoopTokens {
  access_token: string;
  refresh_token: string;
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

  constructor(private readonly configService: ConfigService) {
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
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Failed to refresh token: ${error}`);
      throw new Error(`Failed to refresh token: ${error}`);
    }

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
  ): Promise<Map<string, number>> {
    const start = startDate.toISOString();
    const end = endDate.toISOString();

    const response = await fetch(
      `${this.baseUrl}/cycle?start=${start}&end=${end}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`Failed to get cycles: ${response.status} ${response.statusText} - ${body}`);
      return new Map();
    }

    const data = await response.json();
    const records = data.records || [];
    this.logger.debug(`Whoop getCyclesForRange: ${records.length} records from ${start} to ${end}`);

    // Map date -> calories burned
    const caloriesByDate = new Map<string, number>();
    for (const cycle of records) {
      if (cycle.score?.kilojoule) {
        const dateKey = cycle.start.split('T')[0];
        const calories = Math.round(cycle.score.kilojoule * 0.239);
        caloriesByDate.set(dateKey, calories);
      }
    }

    this.logger.debug(`Whoop calories by date: ${JSON.stringify(Object.fromEntries(caloriesByDate))}`);
    return caloriesByDate;
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret && this.redirectUri);
  }
}
