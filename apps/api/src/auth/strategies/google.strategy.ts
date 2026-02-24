import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL') || 'http://localhost:3001/api/auth/google/callback';

    // Use placeholder values if not configured - strategy won't work but app will start
    super({
      clientID: clientID || 'not-configured',
      clientSecret: clientSecret || 'not-configured',
      callbackURL,
      scope: ['email', 'profile'],
    });

    if (!clientID || !clientSecret) {
      this.logger.warn('Google OAuth not configured - Google login will not work');
    }
  }

  authorizationParams(): Record<string, string> {
    return { prompt: 'select_account' };
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, emails, displayName } = profile;
    const email = emails?.[0]?.value;

    if (!email) {
      return done(new Error('No email provided by Google'), undefined);
    }

    try {
      const user = await this.authService.validateOAuthUser({
        email,
        name: displayName || email.split('@')[0],
        provider: 'google',
        providerId: id,
      });
      done(null, user);
    } catch (error) {
      done(error as Error, undefined);
    }
  }
}
