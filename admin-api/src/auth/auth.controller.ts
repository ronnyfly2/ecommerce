import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { GetUser } from '../common/decorators/get-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthRateLimiterService } from './auth-rate-limiter.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { RevokeSessionDto } from './dto/revoke-session.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly authRateLimiterService: AuthRateLimiterService,
  ) {}

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.authRateLimiterService.assertWithinLimit(
      `register:${this.getClientIp(request)}`,
      8,
      60_000,
      'Too many register attempts. Please try again later.',
    );

    const authResponse = await this.authService.register(dto, this.getRequestContext(request));
    this.setRefreshCookie(response, authResponse.refreshToken);

    return {
      accessToken: authResponse.accessToken,
      user: authResponse.user,
    };
  }

  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.authRateLimiterService.assertWithinLimit(
      `login:${this.getClientIp(request)}`,
      5,
      60_000,
      'Too many login attempts. Please try again later.',
    );

    const authResponse = await this.authService.login(dto, this.getRequestContext(request));
    this.setRefreshCookie(response, authResponse.refreshToken);

    return {
      accessToken: authResponse.accessToken,
      user: authResponse.user,
    };
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.authRateLimiterService.assertWithinLimit(
      `refresh:${this.getClientIp(request)}`,
      12,
      60_000,
      'Too many refresh attempts. Please try again later.',
    );

    const refreshToken = dto.refreshToken ?? this.getRefreshTokenFromCookie(request);
    const authResponse = await this.authService.refresh(
      { refreshToken },
      this.getRequestContext(request),
    );

    this.setRefreshCookie(response, authResponse.refreshToken);

    return {
      accessToken: authResponse.accessToken,
    };
  }

  @ApiBearerAuth()
  @Post('logout')
  async logout(
    @GetUser('id') userId: string,
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = dto.refreshToken ?? this.getRefreshTokenFromCookie(request);
    const result = await this.authService.logout(userId, { refreshToken });
    this.clearRefreshCookie(response);
    return result;
  }

  @ApiBearerAuth()
  @Post('logout-all')
  async logoutAll(
    @GetUser('id') userId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.logoutAll(userId);
    this.clearRefreshCookie(response);
    return result;
  }

  @ApiBearerAuth()
  @Post('logout-device')
  logoutDevice(@GetUser('id') userId: string, @Body() dto: RevokeSessionDto) {
    return this.authService.revokeSession(userId, dto.tokenId);
  }

  @ApiBearerAuth()
  @Get('sessions')
  sessions(@GetUser('id') userId: string) {
    return this.authService.getActiveSessions(userId);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@GetUser('id') userId: string) {
    return this.authService.me(userId);
  }

  private getRefreshTokenFromCookie(request: Request) {
    const cookieName = this.configService.get<string>('JWT_REFRESH_COOKIE_NAME') ?? 'refresh_token';
    const cookieHeader = request.headers.cookie;

    if (!cookieHeader) {
      return '';
    }

    const parsed = cookieHeader
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${cookieName}=`));

    return parsed ? decodeURIComponent(parsed.split('=')[1] ?? '') : '';
  }

  private setRefreshCookie(response: Response, refreshToken: string) {
    const cookieName = this.configService.get<string>('JWT_REFRESH_COOKIE_NAME') ?? 'refresh_token';
    const secure = this.configService.get<boolean>('JWT_REFRESH_COOKIE_SECURE', false);
    const sameSite =
      this.configService.get<'lax' | 'strict' | 'none'>('JWT_REFRESH_COOKIE_SAME_SITE') ??
      'lax';

    response.cookie(cookieName, refreshToken, {
      httpOnly: true,
      secure,
      sameSite,
      path: '/api/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  private clearRefreshCookie(response: Response) {
    const cookieName = this.configService.get<string>('JWT_REFRESH_COOKIE_NAME') ?? 'refresh_token';
    response.clearCookie(cookieName, {
      path: '/api/auth',
    });
  }

  private getClientIp(request: Request) {
    const forwardedFor = request.headers['x-forwarded-for'];

    if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
      return forwardedFor.split(',')[0].trim();
    }

    return request.ip ?? request.socket.remoteAddress ?? 'unknown';
  }

  private getRequestContext(request: Request) {
    return {
      ipAddress: this.getClientIp(request),
      userAgent: request.headers['user-agent'] ?? null,
    };
  }
}
