import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { RegisterDto, ForgotPasswordDto, ResetPasswordDto } from './dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface OAuthUserData {
  email: string;
  name: string;
  provider: string;
  providerId: string;
}

@Injectable()
export class AuthService {
  private readonly saltRounds = 10;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, this.saltRounds);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        name: dto.name,
        password: hashedPassword,
        provider: 'local',
        emailVerified: false,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.name);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || !user.password) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    return this.sanitizeUser(user);
  }

  async login(user: any) {
    const tokens = await this.generateTokens(user.id, user.email, user.name);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      user,
      tokens,
    };
  }

  async validateOAuthUser(data: OAuthUserData) {
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email.toLowerCase() },
          {
            provider: data.provider,
            providerId: data.providerId,
          },
        ],
      },
    });

    if (user) {
      // Update provider info if user exists but logged in with different provider
      if (user.provider !== data.provider || user.providerId !== data.providerId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            provider: data.provider,
            providerId: data.providerId,
            emailVerified: true,
          },
        });
      }
    } else {
      // Create new user
      user = await this.prisma.user.create({
        data: {
          email: data.email.toLowerCase(),
          name: data.name,
          provider: data.provider,
          providerId: data.providerId,
          emailVerified: true,
        },
      });
    }

    return this.sanitizeUser(user);
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_SECRET') || 'nova-jwt-secret-change-in-production',
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const isTokenValid = await bcrypt.compare(refreshToken, user.refreshToken);
      if (!isTokenValid) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokens = await this.generateTokens(user.id, user.email, user.name);
      await this.updateRefreshToken(user.id, tokens.refreshToken);

      return {
        user: this.sanitizeUser(user),
        tokens,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if email exists
      return { message: 'If your email is registered, you will receive a password reset link' };
    }

    if (user.provider !== 'local') {
      return { message: 'This account uses social login. Please sign in with ' + user.provider };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(resetToken, this.saltRounds);
    const resetTokenExp = new Date(Date.now() + 3600000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: hashedToken,
        resetTokenExp,
      },
    });

    // Return the token - in production, this would be sent via email
    return {
      message: 'If your email is registered, you will receive a password reset link',
      // In production, remove this and send email instead
      _devResetToken: resetToken,
      _devResetUrl: `http://localhost:3000/reset-password?token=${resetToken}&email=${user.email}`,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const users = await this.prisma.user.findMany({
      where: {
        resetToken: { not: null },
        resetTokenExp: { gt: new Date() },
      },
    });

    let matchedUser = null;
    for (const user of users) {
      if (user.resetToken) {
        const isTokenValid = await bcrypt.compare(dto.token, user.resetToken);
        if (isTokenValid) {
          matchedUser = user;
          break;
        }
      }
    }

    if (!matchedUser) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(dto.password, this.saltRounds);

    await this.prisma.user.update({
      where: { id: matchedUser.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExp: null,
      },
    });

    return { message: 'Password reset successfully' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.sanitizeUser(user);
  }

  private async generateTokens(userId: string, email: string, name: string): Promise<AuthTokens> {
    const payload = { sub: userId, email, name };
    const accessExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '15m';
    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: accessExpiresIn,
      } as any),
      this.jwtService.signAsync(payload, {
        expiresIn: refreshExpiresIn,
      } as any),
    ]);

    return { accessToken, refreshToken };
  }

  private async updateRefreshToken(userId: string, refreshToken: string) {
    const hashedToken = await bcrypt.hash(refreshToken, this.saltRounds);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashedToken },
    });
  }

  private sanitizeUser(user: any) {
    const { password, refreshToken, resetToken, resetTokenExp, ...sanitized } = user;
    return sanitized;
  }
}
