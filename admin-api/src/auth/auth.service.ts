import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import ms, { StringValue } from 'ms';
import { IsNull, Repository } from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { User } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { PasswordResetMailService } from './services/password-reset-mail.service';
import { JwtPayload } from './types/jwt-payload.type';

type AuthRequestContext = {
  ipAddress: string;
  userAgent: string | null;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokensRepository: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokensRepository: Repository<PasswordResetToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly passwordResetMailService: PasswordResetMailService,
  ) {}

  async register(dto: RegisterDto, requestContext: AuthRequestContext) {
    const existingUser = await this.usersRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new UnauthorizedException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = this.usersRepository.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      firstName: dto.firstName ?? null,
      lastName: dto.lastName ?? null,
      role: Role.CUSTOMER,
    });

    const savedUser = await this.usersRepository.save(user);

    return this.buildAuthResponse(savedUser, requestContext);
  }

  async login(dto: LoginDto, requestContext: AuthRequestContext) {
    const user = await this.usersRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(user, requestContext);
  }

  async refresh(dto: RefreshTokenDto, requestContext: AuthRequestContext) {
    if (!dto.refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const refreshToken = dto.refreshToken;
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const fallbackSecret = this.configService.getOrThrow<string>('JWT_SECRET');

    let payload: JwtPayload;

    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: refreshSecret ?? fallbackSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.tokenType !== 'refresh' || !payload.tokenId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const currentToken = await this.refreshTokensRepository.findOne({
      where: {
        tokenId: payload.tokenId,
        tokenHash,
        revokedAt: IsNull(),
      },
      relations: ['user'],
    });

    if (!currentToken || currentToken.expiresAt <= new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    if (!currentToken.user.isActive) {
      throw new UnauthorizedException('User is not active');
    }

    if (currentToken.user.id !== payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const fingerprintHash = this.buildFingerprintHash(requestContext);
    if (currentToken.fingerprintHash !== fingerprintHash) {
      throw new UnauthorizedException('Session fingerprint mismatch');
    }

    const tokens = await this.issueTokenPair(currentToken.user, requestContext);

    currentToken.revokedAt = new Date();
    currentToken.replacedByTokenId = tokens.refreshTokenId;
    currentToken.lastUsedAt = new Date();
    await this.refreshTokensRepository.save(currentToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(userId: string, dto: RefreshTokenDto) {
    if (!dto.refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.hashToken(dto.refreshToken);

    const existingToken = await this.refreshTokensRepository.findOne({
      where: {
        tokenHash,
        revokedAt: IsNull(),
        user: { id: userId },
      },
      relations: ['user'],
    });

    if (existingToken) {
      existingToken.revokedAt = new Date();
      await this.refreshTokensRepository.save(existingToken);
    }

    return { message: 'Logout successful' };
  }

  async logoutAll(userId: string) {
    await this.refreshTokensRepository.update(
      {
        user: { id: userId },
        revokedAt: IsNull(),
      },
      {
        revokedAt: new Date(),
      },
    );

    return { message: 'All sessions closed' };
  }

  async revokeSession(userId: string, tokenId: string) {
    const token = await this.refreshTokensRepository.findOne({
      where: {
        tokenId,
        user: { id: userId },
      },
      relations: ['user'],
    });

    if (!token) {
      throw new UnauthorizedException('Session not found');
    }

    if (!token.revokedAt) {
      token.revokedAt = new Date();
      await this.refreshTokensRepository.save(token);
    }

    return { message: 'Session revoked' };
  }

  async getActiveSessions(userId: string) {
    const sessions = await this.refreshTokensRepository.find({
      where: {
        user: { id: userId },
        revokedAt: IsNull(),
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return sessions.map((session) => ({
      tokenId: session.tokenId,
      deviceName: session.deviceName,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      lastUsedAt: session.lastUsedAt,
    }));
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase();
    const user = await this.usersRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user) {
      this.logger.warn(`Password reset requested for non-existing email: ${normalizedEmail}`);
      // Don't reveal if email doesn't exist (security best practice)
      return { message: 'If that email exists, you will receive a password reset link' };
    }

    // Generate reset token
    const resetToken = randomUUID();
    const tokenHash = this.hashToken(resetToken);

    // Expire in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Invalidate all previous tokens for this user before issuing a new one
    await this.passwordResetTokensRepository.delete({
      user: { id: user.id },
    });

    // Create new token record
    const tokenRecord = this.passwordResetTokensRepository.create({
      user,
      tokenHash,
      expiresAt,
    });

    await this.passwordResetTokensRepository.save(tokenRecord);

    try {
      // Send email with reset link
      await this.passwordResetMailService.sendResetPasswordEmail(user, resetToken);
      this.logger.log(`Password reset email queued for user ${user.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown email error';
      this.logger.error(`Password reset email failed for user ${user.id}: ${message}`);
    }

    return { message: 'If that email exists, you will receive a password reset link' };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const tokenHash = this.hashToken(token);

    const tokenRecord = await this.passwordResetTokensRepository.findOne({
      where: {
        tokenHash,
        usedAt: IsNull(),
      },
      relations: ['user'],
    });

    if (!tokenRecord) {
      this.logger.warn('Password reset failed: invalid token');
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Check if token is still valid (1 hour expiry)
    if (tokenRecord.expiresAt <= new Date()) {
      this.logger.warn(`Password reset failed: expired token for user ${tokenRecord.user.id}`);
      throw new BadRequestException('Password reset token has expired');
    }

    // Update user password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    tokenRecord.user.passwordHash = passwordHash;
    await this.usersRepository.save(tokenRecord.user);

    // Mark token as used
    tokenRecord.usedAt = new Date();
    await this.passwordResetTokensRepository.save(tokenRecord);

    // Optionally: revoke all active sessions after password reset
    await this.refreshTokensRepository.update(
      {
        user: { id: tokenRecord.user.id },
        revokedAt: IsNull(),
      },
      {
        revokedAt: new Date(),
      },
    );

    this.logger.log(`Password reset completed for user ${tokenRecord.user.id}`);

    return { message: 'Password reset successfully' };
  }

  async me(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  private async buildAuthResponse(user: User, requestContext: AuthRequestContext) {
    const { accessToken, refreshToken } = await this.issueTokenPair(user, requestContext);

    const { passwordHash, ...safeUser } = user;

    return {
      accessToken,
      refreshToken,
      user: safeUser,
    };
  }

  private async issueTokenPair(user: User, requestContext: AuthRequestContext) {
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const fallbackSecret = this.configService.getOrThrow<string>('JWT_SECRET');
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d';

    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenType: 'access',
    };

    const refreshTokenId = randomUUID();
    const refreshPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenType: 'refresh',
      tokenId: refreshTokenId,
    };

    const accessToken = this.jwtService.sign(accessPayload);
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: refreshSecret ?? fallbackSecret,
      expiresIn: refreshExpiresIn as StringValue,
    });

    const expiresAt = this.calculateExpiryDate(refreshExpiresIn);

    const refreshTokenRecord = this.refreshTokensRepository.create({
      tokenId: refreshTokenId,
      tokenHash: this.hashToken(refreshToken),
      fingerprintHash: this.buildFingerprintHash(requestContext),
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      deviceName: this.buildDeviceName(requestContext.userAgent),
      user,
      expiresAt,
      revokedAt: null,
      replacedByTokenId: null,
      lastUsedAt: null,
    });

    await this.refreshTokensRepository.save(refreshTokenRecord);

    return {
      accessToken,
      refreshToken,
      refreshTokenId,
    };
  }

  private calculateExpiryDate(expiresIn: string) {
    const duration = ms(expiresIn as StringValue);

    if (typeof duration !== 'number') {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    return new Date(Date.now() + duration);
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private buildFingerprintHash(requestContext: AuthRequestContext) {
    const fingerprintSalt =
      this.configService.get<string>('JWT_REFRESH_FINGERPRINT_SALT') ??
      this.configService.getOrThrow<string>('JWT_SECRET');

    return this.hashToken(
      `${requestContext.ipAddress}|${requestContext.userAgent ?? 'unknown'}|${fingerprintSalt}`,
    );
  }

  private buildDeviceName(userAgent: string | null) {
    if (!userAgent || userAgent.trim().length === 0) {
      return 'Unknown device';
    }

    return userAgent.length > 120 ? `${userAgent.slice(0, 117)}...` : userAgent;
  }
}
