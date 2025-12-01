import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { CacheService } from '../../../common/services/cache.service';

export interface JwtPayload {
  sub: string; // user ID
  email: string;
  role: string;
  hospitalId?: string; // NULL for SUPER_ADMIN
  pharmacyId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    // PERFORMANCE OPTIMIZATION: Cache user data to avoid DB hit on every request
    // Cache for 2 minutes - balances performance vs data freshness
    const cacheKey = `user:auth:${payload.sub}`;
    const cachedUser = this.cacheService.get<any>(cacheKey);
    
    if (cachedUser) {
      // Verify user is still active (even from cache)
      if (cachedUser.status !== 'ACTIVE') {
        throw new UnauthorizedException('Invalid or inactive user');
      }
      return cachedUser;
    }

    // Cache miss - fetch from database
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        hospitalId: true,
        pharmacyId: true,
        status: true,
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid or inactive user');
    }

    // Cache for 2 minutes (120,000ms)
    this.cacheService.set(cacheKey, user, 120000);

    return user;
  }
}
