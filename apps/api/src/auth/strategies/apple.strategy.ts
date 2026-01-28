import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
// @ts-ignore - passport-apple doesn't have type declarations
import { Strategy } from 'passport-apple';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class AppleStrategy extends PassportStrategy(Strategy, 'apple') {
  private readonly logger = new Logger(AppleStrategy.name);

  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    const clientID = configService.get<string>('APPLE_CLIENT_ID');
    const teamID = configService.get<string>('APPLE_TEAM_ID');
    const keyID = configService.get<string>('APPLE_KEY_ID');
    const privateKey = configService.get<string>('APPLE_PRIVATE_KEY');
    const callbackURL = configService.get<string>('APPLE_CALLBACK_URL') || 'http://localhost:3001/api/auth/apple/callback';

    // Use placeholder values if not configured - strategy won't work but app will start
    super({
      clientID: clientID || 'not-configured',
      teamID: teamID || 'not-configured',
      keyID: keyID || 'not-configured',
      privateKeyString: privateKey || 'not-configured',
      callbackURL,
      scope: ['name', 'email'],
      passReqToCallback: false,
    });

    if (!clientID || !teamID || !keyID || !privateKey) {
      this.logger.warn('Apple OAuth not configured - Apple login will not work');
    }
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    idToken: any,
    profile: any,
    done: (error: any, user?: any) => void,
  ): Promise<any> {
    try {
      const { sub, email } = idToken;
      const name = profile?.name?.firstName
        ? `${profile.name.firstName} ${profile.name.lastName || ''}`.trim()
        : email?.split('@')[0] || 'Apple User';

      if (!email) {
        return done(new Error('No email provided by Apple'), undefined);
      }

      const user = await this.authService.validateOAuthUser({
        email,
        name,
        provider: 'apple',
        providerId: sub,
      });

      done(null, user);
    } catch (error) {
      done(error as Error, undefined);
    }
  }
}
