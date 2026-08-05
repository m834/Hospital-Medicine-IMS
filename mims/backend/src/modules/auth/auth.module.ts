import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { DatabaseModule } from '../../database/database.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { PermissionsGuard } from './guards/permissions.guard';
import { CommonModule } from '../../common/common.module';
import { resolveSessionExpiry } from './session-expiry.util';

@Module({
  imports: [
    DatabaseModule,
    PassportModule,
    CommonModule,
    PermissionsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'development-secret-key',
        signOptions: {
          // Session length. The deployed .env sets JWT_EXPIRES_IN, but this read
          // JWT_EXPIRATION — a name that is set nowhere — so the configured value
          // was silently ignored and the fallback always won. Read the variable
          // that is actually configured, keeping the old name as a fallback.
          //
          // resolveSessionExpiry enforces an 8h floor: staff work full shifts,
          // so no configuration can shorten the session below that.
          expiresIn: resolveSessionExpiry(
            configService.get<string>('JWT_EXPIRES_IN') ||
              configService.get<string>('JWT_EXPIRATION'),
          ) as any,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PermissionsGuard],
  exports: [AuthService, PermissionsGuard],
})
export class AuthModule {}
