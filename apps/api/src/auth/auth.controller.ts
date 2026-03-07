import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import { CurrentUser, JwtPayload } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RefreshTokenDto,
  AppleNativeAuthDto,
} from './dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return {
      success: true,
      data: result,
    };
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Req() req: Request) {
    const result = await this.authService.login(req.user);
    return {
      success: true,
      data: result,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(@Body() dto: RefreshTokenDto) {
    const result = await this.authService.refreshTokens(dto.refreshToken);
    return {
      success: true,
      data: result,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: JwtPayload) {
    await this.authService.logout(user.sub);
    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const result = await this.authService.forgotPassword(dto);
    return {
      success: true,
      data: result,
    };
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    const result = await this.authService.resetPassword(dto);
    return {
      success: true,
      data: result,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: JwtPayload) {
    const userData = await this.authService.getMe(user.sub);
    return {
      success: true,
      data: userData,
    };
  }

  // OAuth - Google
  @Public()
  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  async googleAuth() {
    // Initiates Google OAuth flow
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const result = await this.authService.login(req.user);

    const params = new URLSearchParams({
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    });

    // Mobile flow: redirect directly to app via deep link
    if (req.query.state === 'mobile') {
      res.redirect(`nova://callback?${params.toString()}`);
      return;
    }

    // Web flow: redirect to frontend callback page
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
  }

  // OAuth - Apple (web flow)
  @Public()
  @Get('apple')
  @UseGuards(AuthGuard('apple'))
  async appleAuth() {
    // Initiates Apple OAuth flow
  }

  @Public()
  @Post('apple/callback')
  @UseGuards(AuthGuard('apple'))
  async appleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const result = await this.authService.login(req.user);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    // Redirect to frontend with tokens
    const params = new URLSearchParams({
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    });

    res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
  }

  // Apple native (mobile)
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('apple/native')
  @HttpCode(HttpStatus.OK)
  async appleNativeAuth(@Body() dto: AppleNativeAuthDto) {
    const result = await this.authService.validateAppleNativeToken(
      dto.identityToken,
      dto.fullName,
    );
    return {
      success: true,
      data: result,
    };
  }

  // Delete account
  @UseGuards(JwtAuthGuard)
  @Delete('account')
  @HttpCode(HttpStatus.OK)
  async deleteAccount(@CurrentUser() user: JwtPayload) {
    const result = await this.authService.deleteAccount(user.sub);
    return {
      success: true,
      data: result,
    };
  }

  // AI consent
  @UseGuards(JwtAuthGuard)
  @Post('ai-consent')
  @HttpCode(HttpStatus.OK)
  async acceptAIConsent(@CurrentUser() user: JwtPayload) {
    const result = await this.authService.acceptAIConsent(user.sub);
    return {
      success: true,
      data: result,
    };
  }

  // Language preference
  @UseGuards(JwtAuthGuard)
  @Post('language')
  @HttpCode(HttpStatus.OK)
  async setLanguage(
    @CurrentUser() user: JwtPayload,
    @Body() body: { language: string },
  ) {
    const result = await this.authService.setPreferredLanguage(user.sub, body.language);
    return {
      success: true,
      data: result,
    };
  }
}
