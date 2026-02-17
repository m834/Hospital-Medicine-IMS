import { IsString, IsNotEmpty, IsInt, IsPositive, IsEnum, IsOptional, IsJSON } from 'class-validator';
import { BiometricType, DeviceStatus } from '@prisma/client';

export class CreateBiometricDeviceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(BiometricType)
  deviceType: BiometricType;

  @IsString()
  @IsNotEmpty()
  serialNumber: string;

  @IsString()
  @IsNotEmpty()
  ipAddress: string;

  @IsInt()
  @IsPositive()
  port: number;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsOptional()
  @IsJSON()
  configuration?: Record<string, any>;
}

export class UpdateBiometricDeviceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  ipAddress?: string;

  @IsInt()
  @IsOptional()
  port?: number;

  @IsString()
  @IsOptional()
  location?: string;

  @IsEnum(DeviceStatus)
  @IsOptional()
  status?: DeviceStatus;

  @IsOptional()
  @IsJSON()
  configuration?: Record<string, any>;
}

export class QueryBiometricDevicesDto {
  @IsOptional()
  @IsEnum(BiometricType)
  deviceType?: BiometricType;

  @IsOptional()
  @IsEnum(DeviceStatus)
  status?: DeviceStatus;

  @IsOptional()
  skip?: number;

  @IsOptional()
  take?: number;
}

export class SyncDeviceDto {
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsOptional()
  @IsInt()
  lastSyncTimestamp?: number;
}
