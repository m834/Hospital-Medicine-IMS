import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString } from 'class-validator';

export const CLIENT_ERROR_KINDS = ['error', 'unhandledrejection', 'api'] as const;

/**
 * One error seen by a browser. Every text field is cut to a fixed length by
 * the service, and the whole request is size-capped by the controller, so an
 * oversized stack can never fill the table.
 */
export class CreateClientErrorDto {
  @IsIn(CLIENT_ERROR_KINDS)
  kind: (typeof CLIENT_ERROR_KINDS)[number];

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  stack?: string;

  @IsOptional()
  @IsString()
  route?: string;

  @IsOptional()
  @IsString()
  apiUrl?: string;

  @IsOptional()
  @IsString()
  apiMethod?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  apiStatus?: number;

  @IsOptional()
  @IsString()
  appVersion?: string;

  @IsOptional()
  @IsString()
  machineId?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}
