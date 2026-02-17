import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsObject,
  IsNotEmpty,
  Min,
  Max,
} from 'class-validator';
import { EnrollmentType, EnrollmentStatus } from '@prisma/client';

export class StartEnrollmentDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsEnum(EnrollmentType)
  @IsNotEmpty()
  enrollmentType: EnrollmentType;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class EnrollBiometricDto {
  @IsString()
  @IsNotEmpty()
  enrollmentId: string;

  @IsString()
  @IsNotEmpty()
  biometricData: string; // Base64 encoded biometric template

  @IsNumber()
  @Min(0)
  @Max(100)
  quality: number; // Quality score 0-100

  @IsOptional()
  @IsString()
  deviceSerial?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class VerifyEnrollmentDto {
  @IsString()
  @IsNotEmpty()
  enrollmentId: string;

  @IsString()
  @IsNotEmpty()
  verificationData: string; // Base64 encoded biometric for verification

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class RevokeEnrollmentDto {
  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsString()
  revokedBy?: string;
}

export class QueryEnrollmentsDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsEnum(EnrollmentType)
  enrollmentType?: EnrollmentType;

  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  skip?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  take?: number;
}

export class UpdateEnrollmentMetadataDto {
  @IsObject()
  @IsNotEmpty()
  metadata: Record<string, any>;

  @IsOptional()
  @IsString()
  notes?: string;
}
