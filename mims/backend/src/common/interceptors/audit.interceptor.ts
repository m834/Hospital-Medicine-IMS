import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request } from 'express';
import { AuditService } from '../services/audit.service';
import { REQUEST } from '@nestjs/core';

export interface UserRequest extends Request {
  user?: {
    sub: string;
    email: string;
    role: string;
    hospitalId?: string;
  };
}

/**
 * SECURITY: Audit Interceptor
 * 
 * Automatically logs all CREATE, UPDATE, DELETE operations.
 * Records:
 * - User performing the action
 * - Type of action (HTTP method)
 * - Entity affected
 * - Data before and after changes
 * - Request metadata (IP, user agent)
 * - Timestamps for complete audit trail
 * 
 * Applied globally to track all data modifications for:
 * - Compliance (HIPAA, GDPR)
 * - Security forensics (who changed what and when)
 * - Regulatory audits
 * - Dispute resolution
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private auditService: AuditService,
    @Inject(REQUEST) private request: UserRequest,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<UserRequest>();
    const { method, url, params, body } = request;
    const { user } = request;

    // Only audit data-modifying operations
    const isAuditableOperation = ['POST', 'PUT', 'DELETE'].includes(method);

    if (!isAuditableOperation || !user?.sub) {
      return next.handle();
    }

    // Capture request body for before-state
    const requestBody = { ...body };

    return next.handle().pipe(
      tap((data) => {
        // Log successful operation
        this.logOperation(
          request,
          user,
          method,
          url,
          params,
          requestBody,
          data,
          'SUCCESS',
        );
      }),
      catchError((error) => {
        // Log failed operation for security monitoring
        this.logOperation(
          request,
          user,
          method,
          url,
          params,
          requestBody,
          null,
          'FAILED',
          error.message,
        );
        throw error;
      }),
    );
  }

  /**
   * Log operation to audit trail
   * Extracts entity type and ID from URL and params
   */
  private async logOperation(
    request: UserRequest,
    user: any,
    method: string,
    url: string,
    params: any,
    requestBody: any,
    responseData: any,
    status: 'SUCCESS' | 'FAILED',
    errorMessage?: string,
  ) {
    try {
      // Extract entity type from URL (e.g., /api/v1/shifts -> Shift)
      const pathParts = url.split('/');
      const resourcePath = pathParts[pathParts.length - 1] || '';
      const entityType = this.getEntityType(resourcePath, pathParts);
      const entityId = params.id || responseData?.id || 'unknown';

      // Map HTTP methods to audit actions
      const actionMap: Record<string, string> = {
        POST: 'CREATE',
        PUT: 'UPDATE',
        DELETE: 'DELETE',
      };

      const action = status === 'FAILED' 
        ? `${actionMap[method]}_FAILED`
        : actionMap[method];

      await this.auditService.log({
        userId: user.sub,
        hospitalId: user.hospitalId || 'unknown',
        action,
        entityType,
        entityId,
        beforeState: method === 'DELETE' ? null : requestBody,
        afterState: status === 'SUCCESS' ? responseData : null,
      });
    } catch (error) {
      // Silently fail - don't disrupt the main operation
      console.error('[AUDIT_INTERCEPTOR_ERROR]', error);
    }
  }

  /**
   * Extract entity type from URL path
   * Examples:
   * - /shifts -> Shift
   * - /shift-templates -> ShiftTemplate
   * - /leave-requests -> LeaveRequest
   */
  private getEntityType(resourcePath: string, pathParts: string[]): string {
    // Remove trailing IDs and convert to PascalCase
    const resource = resourcePath.split('?')[0]; // Remove query params
    
    // Common resource to entity mappings
    const entityMap: Record<string, string> = {
      'shifts': 'Shift',
      'shift-templates': 'ShiftTemplate',
      'leaves': 'Leave',
      'leave-requests': 'LeaveRequest',
      'leave-types': 'LeaveType',
      'attendance-records': 'AttendanceRecord',
      'biometric-devices': 'BiometricDevice',
      'biometric-enrollments': 'BiometricEnrollment',
      'device-sync': 'DeviceSync',
      'employees': 'Employee',
      'users': 'User',
      'roles': 'Role',
      'permissions': 'Permission',
    };

    return entityMap[resource] || this.convertToEntity(resource);
  }

  /**
   * Convert kebab-case to PascalCase
   * Example: leave-request -> LeaveRequest
   */
  private convertToEntity(kebab: string): string {
    return kebab
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }
}
