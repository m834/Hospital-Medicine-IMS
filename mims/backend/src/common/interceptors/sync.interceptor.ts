import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { SyncService } from '../../modules/sync/sync.service';

/**
 * SyncInterceptor - Automatically queue sync operations for all mutations
 * 
 * Apply this to controllers that modify data:
 * @UseInterceptors(SyncInterceptor)
 * 
 * This ensures EVERY create/update/delete is queued for sync
 */
@Injectable()
export class SyncInterceptor implements NestInterceptor {
  constructor(private readonly syncService: SyncService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const entityType = this.extractEntityType(request.url);

    // Only queue for mutations (POST, PUT, PATCH, DELETE)
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (response) => {
        // Extract entity ID from response
        const entityId = response?.id || response?.data?.id;
        if (!entityId) return;

        // Determine operation type
        let operationType: 'CREATE' | 'UPDATE' | 'DELETE';
        switch (method) {
          case 'POST':
            operationType = 'CREATE';
            break;
          case 'DELETE':
            operationType = 'DELETE';
            break;
          default:
            operationType = 'UPDATE';
        }

        // Extract hospital and pharmacy from request
        const hospitalId = request.user?.hospitalId || request.body?.hospitalId;
        const pharmacyId = request.user?.pharmacyId || request.body?.pharmacyId;

        if (!hospitalId || !pharmacyId) {
          console.warn('Cannot queue sync: Missing hospitalId or pharmacyId');
          return;
        }

        // Queue the operation
        try {
          await this.syncService.queueOperation({
            hospitalId,
            pharmacyId,
            operationType,
            entityType,
            entityId,
            payload: method === 'DELETE' ? { id: entityId } : response,
            version: response?.version || 1,
          });
        } catch (error) {
          console.error('Failed to queue sync operation:', error);
          // Don't throw - sync failure shouldn't break the request
        }
      }),
    );
  }

  private extractEntityType(url: string): string {
    // Extract entity type from URL (e.g., /api/patients/123 -> Patient)
    const parts = url.split('/').filter(Boolean);
    const entityPath = parts[1] || parts[0]; // Skip 'api' if present
    
    // Convert plural to singular and capitalize
    const singular = entityPath.endsWith('s') 
      ? entityPath.slice(0, -1) 
      : entityPath;
    
    return singular.charAt(0).toUpperCase() + singular.slice(1);
  }
}
