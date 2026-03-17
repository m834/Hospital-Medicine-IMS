import { Controller, Post, Body, Get, UseGuards, Patch, HttpCode, HttpStatus } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, RequestPasswordResetDto, ResetPasswordDto, ChangePasswordDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/register
   * Register a new user
   */
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  /**
   * POST /auth/login
   * User login
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /**
   * POST /auth/password-reset/request
   * Request password reset
   */
  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(@Body() requestDto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(requestDto);
  }

  /**
   * POST /auth/password-reset/confirm
   * Reset password with token
   */
  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetDto);
  }

  /**
   * PATCH /auth/change-password
   * Change password (authenticated users only)
   */
  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() changeDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, changeDto);
  }

  /**
   * GET /auth/profile
   * Get current user profile
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }

  /**
   * POST /auth/logout
   * Logout (client-side token removal)
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout() {
    return { message: 'Logged out successfully' };
  }

  /**
   * POST /auth/verify
   * Verify token validity (CRITICAL for preventing zero-data dashboard)
   * Called by frontend before rendering dashboard
   */
  @Post('verify')
  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async verifyToken(@CurrentUser() user: any) {
    // If JwtAuthGuard passes, token is valid
    return {
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        hospitalId: user.hospitalId,
        pharmacyId: user.pharmacyId,
      },
    };
  }

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

}
