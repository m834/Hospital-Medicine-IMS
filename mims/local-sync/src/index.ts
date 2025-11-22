import Database from 'better-sqlite3';
import { createLogger, format, transports } from 'winston';
import axios from 'axios';
import { CronJob } from 'cron';
import * as dotenv from 'dotenv';

dotenv.config();

// ============================================
// CONFIGURATION
// ============================================

const config = {
  cloudApiUrl: process.env.CLOUD_API_URL || 'http://localhost:3000/api',
  cloudApiToken: process.env.CLOUD_API_TOKEN || '',
  syncQueuePath: process.env.SYNC_QUEUE_PATH || './data/sync-queue.db',
  hospitalId: process.env.HOSPITAL_ID || '',
  pharmacyId: process.env.PHARMACY_ID || '',
  syncIntervalMs: parseInt(process.env.SYNC_INTERVAL_MS || '30000'),
  networkCheckIntervalMs: parseInt(process.env.NETWORK_CHECK_INTERVAL_MS || '10000'),
  maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '5'),
  batchSize: parseInt(process.env.BATCH_SIZE || '100'),
  logLevel: process.env.LOG_LEVEL || 'info',
};

// ============================================
// LOGGER
// ============================================

const logger = createLogger({
  level: config.logLevel,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ level, message, timestamp, ...meta }) => {
          return `${timestamp} [${level}] ${message} ${
            Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
          }`;
        })
      ),
    }),
    new transports.File({
      filename: process.env.LOG_FILE_PATH || './logs/sync.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  ],
});

// ============================================
// SYNC QUEUE DATABASE (SQLite)
// ============================================

class SyncQueue {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  private initializeDatabase() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'PENDING',
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        synced_at TEXT,
        error_message TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_status ON sync_queue(status);
      CREATE INDEX IF NOT EXISTS idx_created_at ON sync_queue(created_at);
      CREATE INDEX IF NOT EXISTS idx_entity ON sync_queue(entity_type, entity_id);
    `);

    logger.info('Sync queue database initialized');
  }

  push(operation: {
    operationType: 'CREATE' | 'UPDATE' | 'DELETE';
    entityType: string;
    entityId: string;
    payload: any;
    version: number;
  }) {
    const stmt = this.db.prepare(`
      INSERT INTO sync_queue (operation_type, entity_type, entity_id, payload, version)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      operation.operationType,
      operation.entityType,
      operation.entityId,
      JSON.stringify(operation.payload),
      operation.version
    );

    logger.debug(`Queued operation: ${operation.operationType} ${operation.entityType}:${operation.entityId}`);
  }

  getPending(limit: number = 100): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_queue
      WHERE status = 'PENDING' AND retry_count < ?
      ORDER BY created_at ASC
      LIMIT ?
    `);

    const rows = stmt.all(config.maxRetryAttempts, limit);
    return rows.map((row: any) => ({
      id: row.id,
      operationType: row.operation_type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      payload: JSON.parse(row.payload),
      version: row.version,
      retryCount: row.retry_count,
      createdAt: row.created_at,
    }));
  }

  markSynced(id: number) {
    const stmt = this.db.prepare(`
      UPDATE sync_queue
      SET status = 'SYNCED', synced_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(id);
  }

  markFailed(id: number, errorMessage: string) {
    const stmt = this.db.prepare(`
      UPDATE sync_queue
      SET status = 'FAILED', retry_count = retry_count + 1, error_message = ?
      WHERE id = ?
    `);
    stmt.run(errorMessage, id);
  }

  markConflict(id: number, conflictData: any) {
    const stmt = this.db.prepare(`
      UPDATE sync_queue
      SET status = 'CONFLICT', error_message = ?
      WHERE id = ?
    `);
    stmt.run(JSON.stringify(conflictData), id);
  }

  getStats() {
    const stmt = this.db.prepare(`
      SELECT
        status,
        COUNT(*) as count
      FROM sync_queue
      GROUP BY status
    `);

    const rows = stmt.all() as any[];
    const stats: Record<string, number> = {
      PENDING: 0,
      SYNCED: 0,
      FAILED: 0,
      CONFLICT: 0,
    };

    rows.forEach((row) => {
      stats[row.status] = row.count;
    });

    return stats;
  }

  close() {
    this.db.close();
  }
}

// ============================================
// NETWORK MONITOR
// ============================================

class NetworkMonitor {
  private isOnline: boolean = false;
  private lastCheckTime: Date = new Date();

  async checkConnectivity(): Promise<boolean> {
    try {
      const response = await axios.get(`${config.cloudApiUrl}/health`, {
        timeout: 5000,
        headers: {
          Authorization: `Bearer ${config.cloudApiToken}`,
        },
      });

      this.isOnline = response.status === 200;
      this.lastCheckTime = new Date();
      
      return this.isOnline;
    } catch (error) {
      this.isOnline = false;
      return false;
    }
  }

  getStatus() {
    return {
      isOnline: this.isOnline,
      lastCheck: this.lastCheckTime,
    };
  }
}

// ============================================
// SYNC SERVICE
// ============================================

class SyncService {
  private queue: SyncQueue;
  private networkMonitor: NetworkMonitor;
  private lastSyncTime: Date | null = null;

  constructor(queue: SyncQueue, networkMonitor: NetworkMonitor) {
    this.queue = queue;
    this.networkMonitor = networkMonitor;
  }

  async sync() {
    logger.info('Starting sync cycle...');

    // Check network connectivity
    const isOnline = await this.networkMonitor.checkConnectivity();
    if (!isOnline) {
      logger.warn('Network offline - skipping sync');
      return;
    }

    logger.info('Network online - proceeding with sync');

    try {
      // Step 1: Upload local pending operations
      await this.uploadPendingOperations();

      // Step 2: Download changes from cloud
      await this.downloadCloudOperations();

      this.lastSyncTime = new Date();
      logger.info(`Sync completed successfully at ${this.lastSyncTime}`);
    } catch (error: any) {
      logger.error('Sync failed:', error);
    }
  }

  private async uploadPendingOperations() {
    const pending = this.queue.getPending(config.batchSize);
    
    if (pending.length === 0) {
      logger.debug('No pending operations to upload');
      return;
    }

    logger.info(`Uploading ${pending.length} pending operations...`);

    // Transform to cloud format
    const operations = pending.map((op) => ({
      hospitalId: config.hospitalId,
      pharmacyId: config.pharmacyId,
      operationType: op.operationType,
      entityType: op.entityType,
      entityId: op.entityId,
      payload: op.payload,
      version: op.version,
    }));

    try {
      const response = await axios.post(
        `${config.cloudApiUrl}/sync/upload`,
        operations,
        {
          headers: {
            Authorization: `Bearer ${config.cloudApiToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const result = response.data;
      logger.info(`Upload result: ${result.queued} queued, ${result.failed} failed`);

      // Mark operations as synced
      pending.forEach((op) => {
        this.queue.markSynced(op.id);
      });
    } catch (error: any) {
      logger.error('Upload failed:', error.message);

      // Mark operations as failed
      pending.forEach((op) => {
        this.queue.markFailed(op.id, error.message);
      });

      throw error;
    }
  }

  private async downloadCloudOperations() {
    const lastSync = this.lastSyncTime?.toISOString() || new Date(0).toISOString();
    
    logger.info(`Downloading changes since ${lastSync}...`);

    try {
      const response = await axios.get(
        `${config.cloudApiUrl}/sync/pending/${config.hospitalId}/${config.pharmacyId}`,
        {
          params: { lastSync },
          headers: {
            Authorization: `Bearer ${config.cloudApiToken}`,
          },
          timeout: 30000,
        }
      );

      const operations = response.data;
      
      if (operations.length === 0) {
        logger.debug('No cloud operations to download');
        return;
      }

      logger.info(`Downloaded ${operations.length} operations from cloud`);

      // Note: Actual application of operations would be done by
      // calling the local NestJS backend API, not directly to database
      // This ensures business logic and validation is maintained

      logger.info('Cloud operations downloaded successfully');
    } catch (error: any) {
      logger.error('Download failed:', error.message);
      throw error;
    }
  }

  getStats() {
    const queueStats = this.queue.getStats();
    const networkStatus = this.networkMonitor.getStatus();

    return {
      queue: queueStats,
      network: networkStatus,
      lastSync: this.lastSyncTime,
      nextSync: this.lastSyncTime
        ? new Date(this.lastSyncTime.getTime() + config.syncIntervalMs)
        : null,
    };
  }
}

// ============================================
// MAIN APPLICATION
// ============================================

async function main() {
  logger.info('=================================================');
  logger.info('  M-IMS Local Sync Service Starting');
  logger.info('=================================================');
  logger.info(`Hospital ID: ${config.hospitalId}`);
  logger.info(`Pharmacy ID: ${config.pharmacyId}`);
  logger.info(`Cloud API: ${config.cloudApiUrl}`);
  logger.info(`Sync Interval: ${config.syncIntervalMs}ms`);
  logger.info('=================================================');

  // Initialize components
  const syncQueue = new SyncQueue(config.syncQueuePath);
  const networkMonitor = new NetworkMonitor();
  const syncService = new SyncService(syncQueue, networkMonitor);

  // Initial network check
  const isOnline = await networkMonitor.checkConnectivity();
  logger.info(`Initial network status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

  // Schedule periodic sync
  const syncJob = new CronJob(
    `*/${config.syncIntervalMs / 1000} * * * * *`, // Every N seconds
    async () => {
      await syncService.sync();
    },
    null,
    true,
    'UTC'
  );

  logger.info('Sync scheduler started');

  // Schedule network monitoring
  const networkJob = new CronJob(
    `*/${config.networkCheckIntervalMs / 1000} * * * * *`,
    async () => {
      const wasOnline = networkMonitor.getStatus().isOnline;
      const isNowOnline = await networkMonitor.checkConnectivity();

      if (!wasOnline && isNowOnline) {
        logger.info('🔌 Network connection restored - triggering immediate sync');
        await syncService.sync();
      } else if (wasOnline && !isNowOnline) {
        logger.warn('📡 Network connection lost - entering offline mode');
      }
    },
    null,
    true,
    'UTC'
  );

  logger.info('Network monitor started');

  // Status endpoint (simple HTTP server for monitoring)
  const http = require('http');
  const server = http.createServer((req: any, res: any) => {
    if (req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(syncService.getStats(), null, 2));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  const port = process.env.STATUS_PORT || 3002;
  server.listen(port, () => {
    logger.info(`Status endpoint running on http://localhost:${port}/status`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Shutting down gracefully...');
    syncJob.stop();
    networkJob.stop();
    syncQueue.close();
    server.close();
    process.exit(0);
  });

  logger.info('🚀 Local Sync Service is running');
}

// Start the application
main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
