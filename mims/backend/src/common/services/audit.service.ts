import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

export interface AuditLogPayload {
  userId: string;
  hospitalId: string;
  action: string; // 'CREATE', 'UPDATE', 'DELETE', 'READ'
  entityType: string; // 'User', 'Shift', 'LeaveRequest', etc.
  entityId: string;
  beforeState?: any;
  afterState?: any;
}

/**
 * SECURITY: Audit Service
 * 
 * Provides comprehensive audit logging for all security-related operations.
 * Tracks:
 * - User actions (CREATE, UPDATE, DELETE)
 * - Data changes (before/after state)
 * - Request metadata (IP address, user agent)
 * - Timestamps for forensic analysis
 * 
 * Usage in interceptors: Automatically logs all CRUD operations
 * Usage in guards: Manually log sensitive authentication events
 */
@Injectable()
export class AuditService {
  constructor(
    private prisma: PrismaService,
    @Inject(REQUEST) private request: Request,
  ) {}

  /**
   * Log a security event or data operation
   * 
   * @param payload Audit log data (userId, hospitalId, action, entity info)
   * @returns Created audit log record
   */
  async log(payload: AuditLogPayload) {
    const ipAddress = this.getClientIp();
    const userAgent = this.request.headers['user-agent'] || 'Unknown';

    return await this.prisma.auditLog.create({
      data: {
        userId: payload.userId,
        hospitalId: payload.hospitalId,
        action: payload.action,
        entityType: payload.entityType,
        entityId: payload.entityId,
        beforeState: payload.beforeState || null,
        afterState: payload.afterState || null,
        ipAddress,
        userAgent: userAgent as string,
        timestamp: new Date(),
      },
    });
  }

  /**
   * Get audit logs for a specific entity
   * Useful for reviewing all changes made to a particular record
   * 
   * @param entityType Type of entity (e.g., 'Shift', 'LeaveRequest')
   * @param entityId ID of the entity
   * @param limit Number of records to return
   * @returns Array of audit logs
   */
  async getEntityHistory(
    entityType: string,
    entityId: string,
    limit: number = 100,
  ) {
    return await this.prisma.auditLog.findMany({
      where: {
        entityType,
        entityId,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });
  }

  /**
   * Get audit logs for a specific user
   * Useful for reviewing user activity
   * 
   * @param userId User ID
   * @param hospitalId Hospital ID
   * @param limit Number of records to return
   * @returns Array of audit logs
   */
  async getUserActivity(
    userId: string,
    hospitalId: string,
    limit: number = 100,
  ) {
    return await this.prisma.auditLog.findMany({
      where: {
        userId,
        hospitalId,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });
  }

  /**
   * Get audit logs for sensitive actions
   * Filters for CREATE, UPDATE, DELETE operations
   * 
   * @param hospitalId Hospital ID
   * @param startDate Optional start date filter
   * @param endDate Optional end date filter
   * @param limit Number of records to return
   * @returns Array of sensitive operations
   */
  async getSensitiveOperations(
    hospitalId: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 1000,
  ) {
    return await this.prisma.auditLog.findMany({
      where: {
        hospitalId,
        action: {
          in: ['CREATE', 'UPDATE', 'DELETE'],
        },
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Get suspicious activity (multiple failed auth attempts, etc.)
   * 
   * @param hospitalId Hospital ID
   * @param threshold Number of failures to flag as suspicious
   * @returns Array of suspicious audit patterns
   */
  async getSuspiciousActivity(hospitalId: string, threshold: number = 5) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    return await this.prisma.auditLog.findMany({
      where: {
        hospitalId,
        action: 'FAILED_LOGIN',
        timestamp: {
          gte: oneHourAgo,
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });
  }

  /**
   * Extract client IP address from request
   * Handles X-Forwarded-For and X-Real-IP headers (for proxied requests)
   * 
   * @returns Client IP address
   */
  private getClientIp(): string {
    const forwarded = this.request.headers['x-forwarded-for'];
    
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }

    return (
      (this.request.headers['x-real-ip'] as string) ||
      this.request.socket.remoteAddress ||
      'Unknown'
    );
  }
}
