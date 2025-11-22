import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SyncService } from './sync.service';

/**
 * SyncController - API endpoints for synchronization management
 * Used by both cloud server and offline facilities
 */
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /**
   * Trigger manual sync (for testing or manual intervention)
   */
  @Post('trigger')
  async triggerSync(@Query('hospitalId') hospitalId?: string) {
    return this.syncService.syncPendingOperations(hospitalId);
  }

  /**
   * Get pending operations to download (for offline facility)
   * 
   * Offline facility calls this when network is available:
   * - Downloads all operations since last sync
   * - Applies them to local database
   * - Uploads local pending operations
   */
  @Get('pending/:hospitalId/:pharmacyId')
  async getPendingOperations(
    @Param('hospitalId') hospitalId: string,
    @Param('pharmacyId') pharmacyId: string,
    @Query('lastSync') lastSync?: string,
  ) {
    const lastSyncDate = lastSync ? new Date(lastSync) : undefined;
    
    return this.syncService.getPendingSyncOperations(
      hospitalId,
      pharmacyId,
      lastSyncDate,
    );
  }

  /**
   * Upload local operations (from offline facility)
   */
  @Post('upload')
  async uploadOperations(@Body() operations: any[]) {
    const results = {
      queued: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const op of operations) {
      try {
        await this.syncService.queueOperation(op);
        results.queued++;
      } catch (error) {
        results.failed++;
        results.errors.push(`${op.entityType}:${op.entityId} - ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Get sync statistics for monitoring dashboard
   */
  @Get('stats/:hospitalId')
  async getSyncStats(@Param('hospitalId') hospitalId: string) {
    return this.syncService.getSyncStats(hospitalId);
  }

  /**
   * Resolve a conflict manually
   */
  @Post('conflicts/:syncOperationId/resolve')
  async resolveConflict(
    @Param('syncOperationId') syncOperationId: string,
    @Body() body: {
      resolution: 'USE_LOCAL' | 'USE_REMOTE' | 'MERGE';
      mergedData?: any;
    },
  ) {
    await this.syncService.resolveConflict(
      syncOperationId,
      body.resolution,
      body.mergedData,
    );

    return { message: 'Conflict resolved successfully' };
  }
}
