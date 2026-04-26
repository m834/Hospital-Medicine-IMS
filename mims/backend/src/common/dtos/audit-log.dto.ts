import { IsOptional, IsString, IsEnum, IsISO8601, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  FAILED_LOGIN = 'FAILED_LOGIN',
  STATUS_CHANGE = 'STATUS_CHANGE',
}

export class AuditLogFilterDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  hospitalId?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsString()
  searchText?: string;

  @IsOptional()
  @IsString()
  module?: string;
}

export class PaginationDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(500)
  limit?: number;
}

export class AuditLogQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  hospitalId?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsString()
  searchText?: string;

  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(500)
  limit?: number;
}

export class AuditLogResponseDto {
  id: string;
  userId: string;
  hospitalId: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState: any;
  afterState: any;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: Date;
}

export class PaginatedAuditLogsDto {
  logs: AuditLogResponseDto[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

export class AuditStatisticsDto {
  totalOperations: number;
  operationsByType: Record<string, number>;
  operationsByUser: Record<string, number>;
  operationsByEntity: Record<string, number>;
  sensitiveOperations: number;
}

export class EntityHistoryDto {
  logs: AuditLogResponseDto[];
  entityType: string;
  entityId: string;
  totalChanges: number;
  lastModifiedAt: Date | null;
  lastModifiedBy: string | null;
}

export class UserActivityDto {
  logs: AuditLogResponseDto[];
  userId: string;
  totalActions: number;
  actionsByType: Record<string, number>;
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
}

export class SensitiveOperationsDto {
  logs: AuditLogResponseDto[];
  hospitalId: string;
  totalOperations: number;
  operationsByType: Record<string, number>;
  operationsByEntity: Record<string, number>;
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
}
