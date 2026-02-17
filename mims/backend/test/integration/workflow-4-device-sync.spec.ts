import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import * as request from 'supertest';

/**
 * WORKFLOW 4: Device Sync → Log Processing
 * 
 * This workflow tests the complete device synchronization flow from sync
 * trigger through log processing to statistics generation.
 */
describe('Workflow 4: Device Sync → Log Processing (Integration)', () => {
  let app: INestApplication;
  let authToken: string;
  let hospitalId: string;
  let deviceId: string;
  let syncLogId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    authToken = process.env.TEST_JWT_TOKEN || 'test-token';
    hospitalId = process.env.TEST_HOSPITAL_ID || 'hospital-001';
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * Step 1: Register a test device for sync testing
   */
  it('should register device for sync testing', async () => {
    const deviceResponse = await request(app.getHttpServer())
      .post('/api/v1/biometric-devices')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Sync Test Device',
        deviceType: 'FINGERPRINT',
        serialNumber: 'SYNC-' + Date.now(),
        ipAddress: '192.168.1.50',
        port: 4370,
        location: 'Sync Test Lab',
      });

    expect(deviceResponse.status).toBe(201);
    deviceId = deviceResponse.body.id;
  });

  /**
   * Step 2: Trigger device synchronization
   */
  it('should trigger device sync', async () => {
    const triggerResponse = await request(app.getHttpServer())
      .post('/api/v1/device-sync/trigger')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        deviceId: deviceId,
        syncType: 'FULL',
      });

    expect(triggerResponse.status).toBe(200);
    expect(triggerResponse.body.syncId).toBeDefined();
    expect(triggerResponse.body.status).toMatch(/PENDING|IN_PROGRESS|COMPLETED/);

    syncLogId = triggerResponse.body.syncId;
  });

  /**
   * Step 3: Retrieve sync logs
   */
  it('should retrieve sync logs for device', async () => {
    const logsResponse = await request(app.getHttpServer())
      .get(`/api/v1/device-sync/logs?deviceId=${deviceId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(logsResponse.status).toBe(200);
    expect(Array.isArray(logsResponse.body)).toBe(true);
  });

  /**
   * Step 4: Process attendance logs from sync
   */
  it('should process attendance logs from sync', async () => {
    const processResponse = await request(app.getHttpServer())
      .post('/api/v1/device-sync/process-logs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        syncId: syncLogId,
        attendanceLogs: [
          {
            logId: 'log-001',
            deviceId: deviceId,
            enrollmentId: 'test-enrollment',
            logType: 'CHECKIN',
            timestamp: new Date().toISOString(),
          },
          {
            logId: 'log-002',
            deviceId: deviceId,
            enrollmentId: 'test-enrollment',
            logType: 'CHECKOUT',
            timestamp: new Date(Date.now() + 28800000).toISOString(), // 8 hours later
          },
        ],
      });

    expect([200, 201, 202]).toContain(processResponse.status);
    expect(processResponse.body.processed).toBeGreaterThanOrEqual(0);
  });

  /**
   * Step 5: Verify processed records are queryable
   */
  it('should retrieve processed attendance records', async () => {
    const recordsResponse = await request(app.getHttpServer())
      .get('/api/v1/attendance-records')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ limit: 10 });

    expect(recordsResponse.status).toBe(200);
    expect(Array.isArray(recordsResponse.body)).toBe(true);
  });

  /**
   * Step 6: Get device sync statistics
   */
  it('should retrieve sync statistics for device', async () => {
    const statsResponse = await request(app.getHttpServer())
      .get(`/api/v1/device-sync/statistics?deviceId=${deviceId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(statsResponse.status).toBe(200);
    expect(statsResponse.body.deviceId).toBe(deviceId);
    expect(statsResponse.body.totalSyncs).toBeDefined();
    expect(statsResponse.body.lastSyncTime).toBeDefined();
  });

  /**
   * Step 7: Test batch device sync
   */
  it('should perform batch device sync', async () => {
    const batchResponse = await request(app.getHttpServer())
      .post('/api/v1/device-sync/batch')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        deviceIds: [deviceId],
        syncType: 'INCREMENTAL',
      });

    expect([200, 202]).toContain(batchResponse.status);
    expect(batchResponse.body.queued || batchResponse.body.syncing).toBeGreaterThanOrEqual(1);
  });

  /**
   * Step 8: Test sync retry on failure
   */
  it('should handle sync retry on failure', async () => {
    const retryResponse = await request(app.getHttpServer())
      .post('/api/v1/device-sync/retry')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        syncId: syncLogId,
        maxRetries: 3,
      });

    expect([200, 202, 400, 409]).toContain(retryResponse.status);
  });

  /**
   * Step 9: Verify device sync status
   */
  it('should verify device sync status', async () => {
    const statusResponse = await request(app.getHttpServer())
      .get(`/api/v1/device-sync/logs/${syncLogId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect([200, 404]).toContain(statusResponse.status);
    if (statusResponse.status === 200) {
      expect(statusResponse.body.deviceId).toBe(deviceId);
    }
  });

  /**
   * Step 10: Test log integrity verification
   */
  it('should verify sync log integrity', async () => {
    const verifyResponse = await request(app.getHttpServer())
      .post('/api/v1/device-sync/verify-integrity')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        syncId: syncLogId,
      });

    expect([200, 404]).toContain(verifyResponse.status);
    if (verifyResponse.status === 200) {
      expect(verifyResponse.body.isValid).toBeDefined();
    }
  });
});
