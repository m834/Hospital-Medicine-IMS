import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/services/cache.service';
import { LoginDto, RegisterDto, RequestPasswordResetDto, ResetPasswordDto, ChangePasswordDto } from './dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private cacheService: CacheService,
  ) {}

  /**
   * Register a new user
   */
  async register(registerDto: RegisterDto) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // SUPER_ADMIN does not need hospitalId (manages all hospitals)
    if (registerDto.role === 'SUPER_ADMIN') {
      if (registerDto.hospitalId) {
        throw new BadRequestException('SUPER_ADMIN should not be assigned to a specific hospital');
      }
      if (registerDto.pharmacyId) {
        throw new BadRequestException('SUPER_ADMIN should not be assigned to a pharmacy');
      }
    } else {
      // All other roles require hospitalId
      if (!registerDto.hospitalId) {
        throw new BadRequestException('Hospital ID is required for this role');
      }

      // Verify hospital exists
      const hospital = await this.prisma.hospital.findUnique({
        where: { id: registerDto.hospitalId },
      });

      if (!hospital) {
        throw new BadRequestException('Invalid hospital ID');
      }

      // Verify pharmacy exists if provided
      if (registerDto.pharmacyId) {
        const pharmacy = await this.prisma.pharmacy.findFirst({
          where: {
            id: registerDto.pharmacyId,
            hospitalId: registerDto.hospitalId,
          },
        });

        if (!pharmacy) {
          throw new BadRequestException('Invalid pharmacy ID for this hospital');
        }
      }
    }

    // Hash password with Argon2
    const hashedPassword = await argon2.hash(registerDto.password);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        passwordHash: hashedPassword,
        fullName: registerDto.fullName,
        phone: registerDto.phone,
        role: registerDto.role,
        hospitalId: registerDto.hospitalId,
        pharmacyId: registerDto.pharmacyId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        hospitalId: true,
        pharmacyId: true,
        status: true,
        createdAt: true,
      },
    });

    // Generate JWT token
    const token = await this.generateToken(user);
    const refreshToken = await this.generateRefreshToken(user);

    return {
      user,
      accessToken: token,
      refreshToken,
    };
  }

  /**
   * Login user
   * OPTIMIZED: Removed blocking lastLogin update to reduce response time
   */
  async login(loginDto: LoginDto) {
    // Find user by email - fetch only needed fields for faster query
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        fullName: true,
        phone: true,
        role: true,
        hospitalId: true,
        pharmacyId: true,
        status: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if user is active
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Verify password with Argon2
    const isPasswordValid = await argon2.verify(user.passwordHash, loginDto.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update last login asynchronously (don't wait for it)
    // This reduces login response time by ~100-200ms
    this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    }).catch(err => {
      // Log error but don't fail the login
      console.error('Failed to update lastLogin:', err);
    });

    // Generate JWT token
    const token = await this.generateToken(user);
    const refreshToken = await this.generateRefreshToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        hospitalId: user.hospitalId,
        pharmacyId: user.pharmacyId,
        status: user.status,
      },
      accessToken: token,
      refreshToken,
    };
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(requestDto: RequestPasswordResetDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: requestDto.email },
    });

    if (!user) {
      // Don't reveal if user exists for security
      return { message: 'If the email exists, a reset link has been sent' };
    }

    // Generate reset token (valid for 1 hour)
    const resetToken = randomBytes(32).toString('hex');
    const resetTokenHash = await argon2.hash(resetToken);
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: resetTokenHash,
        resetTokenExpiry,
      },
    });

    // TODO: Send email with reset link
    // For now, return the token (in production, only send via email)
    console.log(`Password reset token for ${user.email}: ${resetToken}`);

    return { message: 'If the email exists, a reset link has been sent' };
  }

  /**
   * Reset password with token
   */
  async resetPassword(resetDto: ResetPasswordDto) {
    const users = await this.prisma.user.findMany({
      where: {
        resetToken: { not: null },
        resetTokenExpiry: { gte: new Date() },
      },
    });

    // Find user with matching token
    let matchedUser = null;
    for (const user of users) {
      if (user.resetToken) {
        const isValid = await argon2.verify(user.resetToken, resetDto.token);
        if (isValid) {
          matchedUser = user;
          break;
        }
      }
    }

    if (!matchedUser) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await argon2.hash(resetDto.newPassword);

    // Update password and clear reset token
    await this.prisma.user.update({
      where: { id: matchedUser.id },
      data: {
        passwordHash: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return { message: 'Password reset successfully' };
  }

  /**
   * Change password (for logged-in users)
   */
  async changePassword(userId: string, changeDto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Verify current password
    const isPasswordValid = await argon2.verify(user.passwordHash, changeDto.currentPassword);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await argon2.hash(changeDto.newPassword);

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    });

    return { message: 'Password changed successfully' };
  }

  /**
   * Get current user profile
   * OPTIMIZED: Cache profile to avoid repeated DB queries
   */
  async getProfile(userId: string) {
    // Try cache first (5 minute TTL)
    const cacheKey = `user:profile:${userId}`;
    const cached = this.cacheService.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        hospitalId: true,
        pharmacyId: true,
        status: true,
        lastLogin: true,
        createdAt: true,
        hospital: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        pharmacy: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
          },
        },
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Cache for 5 minutes
    this.cacheService.set(cacheKey, user, 300000);

    return user;
  }

  /**
   * Generate JWT token
   */
  /**
   * Refresh access token
   * CRITICAL: Allows extending session without re-login
   */
  async refreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET') || this.configService.get('JWT_SECRET'),
      });

      // Get user from database
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || user.status !== 'ACTIVE') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new access token
      const newAccessToken = await this.generateToken(user);

      return {
        accessToken: newAccessToken,
        refreshToken, // Return same refresh token (or generate new one)
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Generate JWT access token
   */
  private async generateToken(user: any): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      hospitalId: user.hospitalId,
      pharmacyId: user.pharmacyId,
    };

    return this.jwtService.sign(payload);
  }

  /**
   * Generate JWT refresh token (longer expiry)
   */
  private async generateRefreshToken(user: any): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      hospitalId: user.hospitalId,
      pharmacyId: user.pharmacyId,
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET') || this.configService.get('JWT_SECRET'),
      expiresIn: '7d', // Refresh token valid for 7 days
    });
  }
}
