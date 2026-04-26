import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditLog, Prisma } from '@prisma/client';

export interface AuditLogFilter {
  userId?: string;
  hospitalId?: string;
  entityType?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  searchText?: string;
  module?: string;
}

export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

export interface AuditLogResponse {
  logs: AuditLog[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

export interface AuditStatistics {
  totalOperations: number;
  operationsByType: Record<string, number>;
  operationsByUser: Record<string, number>;
  operationsByEntity: Record<string, number>;
  sensitiveOperations: number;
}

@Injectable()
export class AuditLogViewerService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get paginated audit logs with filtering
   */
  async getAuditLogs(
    filters: AuditLogFilter,
    pagination: PaginationParams,
  ): Promise<AuditLogResponse> {
    const limit = Math.min(pagination.limit || 50, 500);

    // Build Prisma where clause
    const where = this.buildWhereClause(filters);

    // Build cursor if provided
    const cursorCondition = pagination.cursor
      ? { id: pagination.cursor }
      : undefined;

    // Get logs
    const logs = await this.prisma.auditLog.findMany({
      where,
      skip: pagination.cursor ? 1 : 0,
      cursor: cursorCondition,
      take: limit + 1,
      orderBy: { timestamp: 'desc' },
      include: {
        user: {
          select: { id: true, email: true, fullName: true, role: true },
        },
      },
    });

    const hasMore = logs.length > limit;
    const results = hasMore ? logs.slice(0, -1) : logs;
    const nextCursor =
      hasMore && results.length > 0
        ? results[results.length - 1].id
        : null;

    const total = await this.prisma.auditLog.count({ where });

    return {
      logs: results,
      nextCursor,
      hasMore,
      total,
    };
  }

  /**
   * Get audit log by ID
   */
  async getAuditLogById(id: string): Promise<AuditLog | null> {
    return this.prisma.auditLog.findUnique({
      where: { id },
    });
  }

  /**
   * Get entity change history
   */
  async getEntityHistory(
    entityType: string,
    entityId: string,
  ): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      where: {
        entityType,
        entityId,
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  /**
   * Get user activity for a specific user
   */
  async getUserActivity(
    userId: string,
    hospitalId: string,
    days: number = 30,
  ): Promise<AuditLog[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.prisma.auditLog.findMany({
      where: {
        userId,
        hospitalId,
        timestamp: { gte: startDate },
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  /**
   * Get sensitive operations (CREATE, UPDATE, DELETE on sensitive entities)
   */
  async getSensitiveOperations(
    hospitalId: string,
    days: number = 30,
  ): Promise<AuditLog[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const sensitiveEntities = [
      'BiometricEnrollment',
      'User',
      'Permission',
      'Role',
      'MedicineInventory',
      'InventoryTransfer',
    ];

    return this.prisma.auditLog.findMany({
      where: {
        hospitalId,
        entityType: { in: sensitiveEntities },
        action: { in: ['CREATE', 'UPDATE', 'DELETE'] },
        timestamp: { gte: startDate },
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  /**
   * Get suspicious activities (DELETE operations)
   */
  async getSuspiciousActivity(
    hospitalId: string,
    days: number = 7,
  ): Promise<AuditLog[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.prisma.auditLog.findMany({
      where: {
        hospitalId,
        action: 'DELETE',
        timestamp: { gte: startDate },
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  /**
   * Get audit statistics for a hospital
   */
  async getAuditStatistics(
    hospitalId: string,
    days: number = 30,
  ): Promise<AuditStatistics> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await this.prisma.auditLog.findMany({
      where: {
        hospitalId,
        timestamp: { gte: startDate },
      },
      select: {
        action: true,
        userId: true,
        entityType: true,
      },
    });

    const operationsByType: Record<string, number> = {};
    const operationsByUser: Record<string, number> = {};
    const operationsByEntity: Record<string, number> = {};

    for (const log of logs) {
      operationsByType[log.action] = (operationsByType[log.action] || 0) + 1;
      operationsByUser[log.userId] = (operationsByUser[log.userId] || 0) + 1;
      operationsByEntity[log.entityType] =
        (operationsByEntity[log.entityType] || 0) + 1;
    }

    const sensitiveEntities = [
      'BiometricEnrollment',
      'User',
      'Permission',
      'Role',
    ];
    const sensitiveCount = logs.filter(
      (l) => sensitiveEntities.includes(l.entityType) &&
             ['CREATE', 'UPDATE', 'DELETE'].includes(l.action),
    ).length;

    return {
      totalOperations: logs.length,
      operationsByType,
      operationsByUser,
      operationsByEntity,
      sensitiveOperations: sensitiveCount,
    };
  }

  /**
   * Build Prisma where clause from filters
   */
  private buildWhereClause(filters: AuditLogFilter): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.hospitalId) {
      where.hospitalId = filters.hospitalId;
    }

    if (filters.entityType) {
      where.entityType = filters.entityType;
    }

    if (filters.action) {
      where.action = filters.action;
    }

    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) {
        where.timestamp.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.timestamp.lte = filters.endDate;
      }
    }

    if (filters.module) {
      where.module = filters.module;
    }

    if (filters.searchText) {
      where.OR = [
        { userId: { contains: filters.searchText, mode: 'insensitive' } },
        { entityType: { contains: filters.searchText, mode: 'insensitive' } },
        { entityId: { contains: filters.searchText, mode: 'insensitive' } },
        { description: { contains: filters.searchText, mode: 'insensitive' } },
        { ipAddress: { contains: filters.searchText, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}
