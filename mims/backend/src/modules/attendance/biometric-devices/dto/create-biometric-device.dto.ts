import { IsString, IsNotEmpty, IsInt, IsPositive, IsEnum, IsOptional, IsJSON } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BiometricType, DeviceStatus } from '@prisma/client';

export class CreateBiometricDeviceDto {
  @ApiProperty({
    description: 'Device name/identifier',
    example: 'Device 1 - Reception',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    enum: BiometricType,
    description: 'Type of biometric device',
    example: 'FINGERPRINT',
  })
  @IsEnum(BiometricType)
  deviceType: BiometricType;

  @ApiProperty({
    description: 'Device serial number from manufacturer',
    example: 'ZKT-001-2026',
  })
  @IsString()
  @IsNotEmpty()
  serialNumber: string;

  @ApiProperty({
    description: 'IP address of the device',
    example: '192.168.1.100',
  })
  @IsString()
  @IsNotEmpty()
  ipAddress: string;

  @ApiProperty({
    description: 'Port number for device communication',
    example: 4370,
  })
  @IsInt()
  @IsPositive()
  port: number;

  @ApiProperty({
    description: 'Physical location of the device',
    example: 'Reception Area',
  })
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiPropertyOptional({
    description: 'Device-specific configuration as JSON',
    example: { timezone: 'Asia/Kolkata', language: 'en' },
  })
  @IsOptional()
  @IsJSON()
  configuration?: Record<string, any>;
}

export class UpdateBiometricDeviceDto {
  @ApiPropertyOptional({
    description: 'Updated device name',
    example: 'Device 1 - Main Reception',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated IP address',
    example: '192.168.1.101',
  })
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
