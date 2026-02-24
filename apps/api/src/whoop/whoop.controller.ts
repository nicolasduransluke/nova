import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { WhoopService } from './whoop.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../infrastructure/database/prisma.service';

interface AuthenticatedRequest extends Request {
  user: { sub: string; email: string; name: string };
}

@Controller('auth/whoop')
export class WhoopController {
  constructor(
    private readonly whoopService: WhoopService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Initiate Whoop OAuth flow
   * Web: GET /api/auth/whoop (JWT in Authorization header)
   * Mobile: GET /api/auth/whoop?token=JWT&mobile=true (JWT in query param)
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  initiateOAuth(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Query('mobile') mobile?: string,
  ) {
    if (!this.whoopService.isConfigured()) {
      throw new HttpException(
        'Whoop integration not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const state = mobile === 'true'
      ? `mobile_${req.user.sub}`
      : req.user.sub;
    const authUrl = this.whoopService.getAuthorizationUrl(state);
    res.redirect(authUrl);
  }

  /**
   * Handle OAuth callback - exchange code for tokens
   */
  @Post('callback')
  @UseGuards(JwtAuthGuard)
  async handleCallback(
    @Req() req: AuthenticatedRequest,
    @Body() body: { code: string },
  ) {
    console.log('Whoop callback - received request');
    const { code } = body;
    const userId = req.user.sub;
    console.log('Whoop callback - userId:', userId);
    console.log('Whoop callback - code:', code?.substring(0, 20) + '...');

    if (!code) {
      throw new HttpException(
        'Authorization code required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      // Exchange code for tokens
      const tokens = await this.whoopService.exchangeCodeForTokens(code);

      // Get Whoop user profile
      const whoopProfile = await this.whoopService.getProfile(tokens.access_token);

      // Get current metadata and merge with Whoop data
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { metadata: true },
      });

      const currentMetadata = (user?.metadata ?? {}) as Record<string, any>;
      const updatedMetadata = {
        ...currentMetadata,
        whoop: {
          userId: whoopProfile.user_id,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + tokens.expires_in * 1000,
          connectedAt: new Date().toISOString(),
        },
      };

      // Store tokens in user metadata
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          metadata: updatedMetadata,
        },
      });

      return {
        success: true,
        message: 'Whoop connected successfully',
        whoopUser: {
          firstName: whoopProfile.first_name,
          lastName: whoopProfile.last_name,
        },
      };
    } catch (error) {
      console.error('Whoop callback error:', error);
      throw new HttpException(
        'Failed to connect Whoop account',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get Whoop connection status and today's data
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;

    const result = await this.whoopService.getValidToken(userId);
    if (!result) {
      return {
        connected: false,
        message: 'Whoop not connected',
      };
    }

    const connectedAt = result.metadata.whoop?.connectedAt;

    // Get today's summary
    try {
      const summary = await this.whoopService.getDailySummary(result.accessToken);
      return {
        connected: true,
        connectedAt,
        todaySummary: summary,
      };
    } catch (error) {
      return {
        connected: true,
        connectedAt,
        error: 'Failed to fetch today\'s data',
      };
    }
  }

  /**
   * Debug endpoint - check Whoop history data (temporary)
   */
  @Get('debug-history')
  @UseGuards(JwtAuthGuard)
  async debugHistory(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;
    const debug: Record<string, any> = { userId, steps: [] };

    try {
      const result = await this.whoopService.getValidToken(userId);
      debug.now = Date.now();

      if (!result) {
        debug.steps.push('No valid Whoop token (not connected or refresh failed)');
        return debug;
      }

      const accessToken = result.accessToken;
      debug.hasAccessToken = true;
      debug.steps.push('Got valid token via getValidToken()');

      // Try getCyclesForRange
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      since.setDate(since.getDate() - 14);
      const now = new Date();

      debug.rangeStart = since.toISOString();
      debug.rangeEnd = now.toISOString();
      debug.steps.push(`Fetching cycles from ${since.toISOString()} to ${now.toISOString()}`);

      const { caloriesByDate, timezoneOffsetMinutes } = await this.whoopService.getCyclesForRange(accessToken, since, now);
      debug.whoopCyclesCount = caloriesByDate.size;
      debug.whoopCaloriesByDate = Object.fromEntries(caloriesByDate);
      debug.whoopTimezoneOffset = timezoneOffsetMinutes;
      debug.steps.push(`Got ${caloriesByDate.size} days of Whoop data, tz=${timezoneOffsetMinutes}min`);

      // Also get food entry date keys for comparison
      const entries = await this.prisma.calorieEntry.findMany({
        where: { userId, date: { gte: since } },
        select: { date: true, type: true, calories: true },
        orderBy: { date: 'desc' },
      });

      const entryDateKeys = entries.map(e => ({
        rawDate: e.date.toISOString(),
        localDateKey: `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, '0')}-${String(e.date.getDate()).padStart(2, '0')}`,
        type: e.type,
        calories: e.calories,
      }));
      debug.entryDateKeys = entryDateKeys;

      return debug;
    } catch (err) {
      debug.error = `${err}`;
      return debug;
    }
  }

  /**
   * Disconnect Whoop
   */
  @Post('disconnect')
  @UseGuards(JwtAuthGuard)
  async disconnect(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { metadata: true },
    });

    const metadata = (user?.metadata ?? {}) as Record<string, any>;
    delete metadata.whoop;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        metadata: metadata,
      },
    });

    return {
      success: true,
      message: 'Whoop disconnected',
    };
  }
}
