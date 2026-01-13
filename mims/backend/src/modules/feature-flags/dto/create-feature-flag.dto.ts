import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateFeatureFlagDto {
  @IsOptional()
  @IsUUID()
  hospitalId?: string; // NULL = global flag

  @IsNotEmpty()
  @IsString()
  key: string;

  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
