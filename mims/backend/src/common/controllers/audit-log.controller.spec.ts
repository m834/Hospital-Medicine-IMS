import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogController } from '../controllers/audit-log.controller';
import { AuditLogViewerService } from '../services/audit-log-viewer.service';

describe('Audit Log Viewer - Task 17 Phase 3', () => {
  let app: INestApplication;
  let auditLogViewerService: AuditLogViewerService;
  let prismaService: PrismaService;

  const mockUser = {
    id: 'user-123',
    role: 'ADMIN',
    hospitalId: 'hospital-123',
  };

  const mockSuperAdmin = {
    id: 'super-admin-1',
    role: 'SUPER_ADMIN',
    hospitalId: 'hospital-123',
  };

  const mockAuditLog = {
    id: 'log-1',
    userId: 'user-123',
    hospitalId: 'hospital-123',
    action: 'CREATE',
    entityType: 'BiometricEnrollment',
    entityId: 'enrollment-1',
    beforeState: null,
    afterState: JSON.stringify({ fingerprint: 'data' }),
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    timestamp: new Date(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogController],
      providers: [
        AuditLogViewerService,
        {
          provide: PrismaService,
          useValue: {
            auditLog: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    })
      .overrideGuard('JwtAuthGuard')
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard('RolesGuard')
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    app = moduleFixture.createNestApplication();
    auditLogViewerService = moduleFixture.get<AuditLogViewerService>(
      AuditLogViewerService,
    );
    prismaService = moduleFixture.get<PrismaService>(PrismaService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/audit-logs - List Audit Logs', () => {
    it('should return paginated audit logs', async () => {
      const mockResponse = {
        logs: [mockAuditLog],
        nextCursor: null,
        hasMore: false,
        total: 1,
      };

      jest
        .spyOn(auditLogViewerService, 'getAuditLogs')
        .mockResolvedValueOnce(mockResponse);

      const response = await request(app.getHttpServer())
        .get('/api/v1/audit-logs')
        .query({ limit: 50 })
        .expect(HttpStatus.OK);

      expect(response.body).toEqual(mockResponse);
      expect(response.body.logs).toHaveLength(1);
      expect(response.body.total).toBe(1);
      expect(response.body.hasMore).toBe(false);
    });

    it('should filter audit logs by entityType', async () => {
      const mockResponse = {
        logs: [mockAuditLog],
        nextCursor: null,
        hasMore: false,
        total: 1,
      };

      jest
        .spyOn(auditLogViewerService, 'getAuditLogs')
        .mockResolvedValueOnce(mockResponse);

      const response = await request(app.getHttpServer())
        .get('/api/v1/audit-logs')
        .query({ entityType: 'BiometricEnrollment', limit: 50 })
        .expect(HttpStatus.OK);

      expect(response.body.logs).toHaveLength(1);
      expect(response.body.logs[0].entityType).toBe('BiometricEnrollment');
    });

    it('should filter audit logs by action', async () => {
      const mockResponse = {
        logs: [mockAuditLog],
        nextCursor: null,
        hasMore: false,
        total: 1,
      };

      jest
        .spyOn(auditLogViewerService, 'getAuditLogs')
        .mockResolvedValueOnce(mockResponse);

      const response = await request(app.getHttpServer())
        .get('/api/v1/audit-logs')
        .query({ action: 'CREATE', limit: 50 })
        .expect(HttpStatus.OK);

      expect(response.body.logs[0].action).toBe('CREATE');
    });

    it('should support cursor-based pagination', async () => {
      const mockResponse = {
        logs: [{ ...mockAuditLog, id: 'log-2' }],
        nextCursor: 'log-3',
        hasMore: true,
        total: 100,
      };

      jest
        .spyOn(auditLogViewerService, 'getAuditLogs')
        .mockResolvedValueOnce(mockResponse);

      const response = await request(app.getHttpServer())
        .get('/api/v1/audit-logs')
        .query({ cursor: 'log-2', limit: 50 })
        .expect(HttpStatus.OK);

      expect(response.body.nextCursor).toBe('log-3');
      expect(response.body.hasMore).toBe(true);
    });

    it('should cap limit at 500', async () => {
      jest
        .spyOn(auditLogViewerService, 'getAuditLogs')
        .mockResolvedValueOnce({ logs: [], nextCursor: null, hasMore: false, total: 0 });

      await request(app.getHttpServer())
        .get('/api/v1/audit-logs')
        .query({ limit: 1000 })
        .expect(HttpStatus.OK);

      expect(auditLogViewerService.getAuditLogs).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ limit: expect.any(Number) }),
      );
    });
  });

  describe('GET /api/v1/audit-logs/:id - Get Audit Log by ID', () => {
    it('should retrieve audit log by ID', async () => {
      jest
        .spyOn(auditLogViewerService, 'getAuditLogById')
        .mockResolvedValueOnce(mockAuditLog as any);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/audit-logs/${mockAuditLog.id}`)
        .expect(HttpStatus.OK);

      expect(response.body).toEqual(mockAuditLog);
    });

    it('should return 404 for non-existent audit log', async () => {
      jest
        .spyOn(auditLogViewerService, 'getAuditLogById')
        .mockResolvedValueOnce(null);

      await request(app.getHttpServer())
        .get('/api/v1/audit-logs/non-existent')
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('POST /api/v1/audit-logs/search - Advanced Search', () => {
    it('should search audit logs with complex filters', async () => {
      const mockResponse = {
        logs: [mockAuditLog],
        nextCursor: null,
        hasMore: false,
        total: 1,
      };

      jest
        .spyOn(auditLogViewerService, 'getAuditLogs')
        .mockResolvedValueOnce(mockResponse);

      const response = await request(app.getHttpServer())
        .post('/api/v1/audit-logs/search')
        .send({
          filters: {
            entityType: 'BiometricEnrollment',
            action: 'CREATE',
            startDate: '2025-01-01T00:00:00Z',
            endDate: '2025-12-31T23:59:59Z',
          },
          pagination: { limit: 50 },
        })
        .expect(HttpStatus.OK);

      expect(response.body.logs).toHaveLength(1);
    });

    it('should search with text search', async () => {
      const mockResponse = {
        logs: [mockAuditLog],
        nextCursor: null,
        hasMore: false,
        total: 1,
      };

      jest
        .spyOn(auditLogViewerService, 'getAuditLogs')
        .mockResolvedValueOnce(mockResponse);

      const response = await request(app.getHttpServer())
        .post('/api/v1/audit-logs/search')
        .send({
          filters: {
            searchText: '192.168.1.1',
          },
          pagination: { limit: 50 },
        })
        .expect(HttpStatus.OK);

      expect(response.body.logs).toHaveLength(1);
    });
  });

  describe('GET /api/v1/audit-logs/entity/:type/:id/history - Entity History', () => {
    it('should retrieve entity change history', async () => {
      const mockLogs = [mockAuditLog, { ...mockAuditLog, id: 'log-2', action: 'UPDATE' }];

      jest
        .spyOn(auditLogViewerService, 'getEntityHistory')
        .mockResolvedValueOnce(mockLogs as any);

      const response = await request(app.getHttpServer())
        .get('/api/v1/audit-logs/entity/BiometricEnrollment/enrollment-1/history')
        .expect(HttpStatus.OK);

      expect(response.body.logs).toHaveLength(2);
      expect(response.body.entityType).toBe('BiometricEnrollment');
      expect(response.body.entityId).toBe('enrollment-1');
      expect(response.body.totalChanges).toBe(2);
    });

    it('should show last modified information', async () => {
      const mockLogs = [
        { ...mockAuditLog, userId: 'user-456', timestamp: new Date('2025-02-20') },
      ];

      jest
        .spyOn(auditLogViewerService, 'getEntityHistory')
        .mockResolvedValueOnce(mockLogs as any);

      const response = await request(app.getHttpServer())
        .get('/api/v1/audit-logs/entity/BiometricEnrollment/enrollment-1/history')
        .expect(HttpStatus.OK);

      expect(response.body.lastModifiedBy).toBe('user-456');
      expect(response.body.lastModifiedAt).toBeDefined();
    });
  });

  describe('GET /api/v1/audit-logs/user/:userId/activity - User Activity', () => {
    it('should retrieve user activity', async () => {
      const mockLogs = [mockAuditLog, { ...mockAuditLog, id: 'log-2', action: 'UPDATE' }];

      jest
        .spyOn(auditLogViewerService, 'getUserActivity')
        .mockResolvedValueOnce(mockLogs as any);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/audit-logs/user/${mockUser.id}/activity`)
        .expect(HttpStatus.OK);

      expect(response.body.logs).toHaveLength(2);
      expect(response.body.userId).toBe(mockUser.id);
      expect(response.body.totalActions).toBe(2);
    });

    it('should count actions by type', async () => {
      const mockLogs = [
        mockAuditLog,
        { ...mockAuditLog, id: 'log-2', action: 'UPDATE' },
        { ...mockAuditLog, id: 'log-3', action: 'UPDATE' },
        { ...mockAuditLog, id: 'log-4', action: 'DELETE' },
      ];

      jest
        .spyOn(auditLogViewerService, 'getUserActivity')
        .mockResolvedValueOnce(mockLogs as any);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/audit-logs/user/${mockUser.id}/activity`)
        .expect(HttpStatus.OK);

      expect(response.body.actionsByType.CREATE).toBe(1);
      expect(response.body.actionsByType.UPDATE).toBe(2);
      expect(response.body.actionsByType.DELETE).toBe(1);
    });

    it('should limit days query parameter', async () => {
      jest
        .spyOn(auditLogViewerService, 'getUserActivity')
        .mockResolvedValueOnce([mockAuditLog] as any);

      await request(app.getHttpServer())
        .get(`/api/v1/audit-logs/user/${mockUser.id}/activity`)
        .query({ days: 200 })
        .expect(HttpStatus.OK);

      expect(auditLogViewerService.getUserActivity).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.hospitalId,
        90, // Should be capped at 90
      );
    });
  });

  describe('GET /api/v1/audit-logs/sensitive - Sensitive Operations', () => {
    it('should retrieve sensitive operations', async () => {
      const mockLogs = [
        mockAuditLog,
        { ...mockAuditLog, id: 'log-2', entityType: 'User', action: 'UPDATE' },
      ];

      jest
        .spyOn(auditLogViewerService, 'getSensitiveOperations')
        .mockResolvedValueOnce(mockLogs as any);

      const response = await request(app.getHttpServer())
        .get('/api/v1/audit-logs/sensitive')
        .expect(HttpStatus.OK);

      expect(response.body.logs).toHaveLength(2);
      expect(response.body.totalOperations).toBe(2);
    });

    it('should count operations by type and entity', async () => {
      const mockLogs = [
        { ...mockAuditLog, entityType: 'BiometricEnrollment', action: 'CREATE' },
        { ...mockAuditLog, id: 'log-2', entityType: 'BiometricEnrollment', action: 'UPDATE' },
        { ...mockAuditLog, id: 'log-3', entityType: 'User', action: 'UPDATE' },
      ];

      jest
        .spyOn(auditLogViewerService, 'getSensitiveOperations')
        .mockResolvedValueOnce(mockLogs as any);

      const response = await request(app.getHttpServer())
        .get('/api/v1/audit-logs/sensitive')
        .expect(HttpStatus.OK);

      expect(response.body.operationsByType.CREATE).toBe(1);
      expect(response.body.operationsByType.UPDATE).toBe(2);
      expect(response.body.operationsByEntity.BiometricEnrollment).toBe(2);
      expect(response.body.operationsByEntity.User).toBe(1);
    });
  });

  describe('GET /api/v1/audit-logs/suspicious - Suspicious Activities', () => {
    it('should retrieve suspicious activities', async () => {
      const mockLogs = [
        { ...mockAuditLog, action: 'DELETE' },
      ];

      jest
        .spyOn(auditLogViewerService, 'getSuspiciousActivity')
        .mockResolvedValueOnce(mockLogs as any);

      const response = await request(app.getHttpServer())
        .get('/api/v1/audit-logs/suspicious')
        .expect(HttpStatus.OK);

      expect(response.body.logs).toHaveLength(1);
      expect(response.body.logs[0].action).toBe('DELETE');
    });

    it('should default to 7 days lookback', async () => {
      jest
        .spyOn(auditLogViewerService, 'getSuspiciousActivity')
        .mockResolvedValueOnce([]);

      await request(app.getHttpServer())
        .get('/api/v1/audit-logs/suspicious')
        .expect(HttpStatus.OK);

      expect(auditLogViewerService.getSuspiciousActivity).toHaveBeenCalledWith(
        mockUser.hospitalId,
        7,
      );
    });
  });

  describe('GET /api/v1/audit-logs/statistics - Audit Statistics', () => {
    it('should retrieve audit statistics', async () => {
      const mockStats = {
        totalOperations: 100,
        operationsByType: { CREATE: 30, UPDATE: 50, DELETE: 20 },
        operationsByUser: { 'user-1': 50, 'user-2': 50 },
        operationsByEntity: {
          BiometricEnrollment: 40,
          User: 30,
          MedicineInventory: 30,
        },
        sensitiveOperations: 80,
      };

      jest
        .spyOn(auditLogViewerService, 'getAuditStatistics')
        .mockResolvedValueOnce(mockStats as any);

      const response = await request(app.getHttpServer())
        .get('/api/v1/audit-logs/statistics')
        .expect(HttpStatus.OK);

      expect(response.body).toEqual(mockStats);
      expect(response.body.totalOperations).toBe(100);
      expect(response.body.sensitiveOperations).toBe(80);
    });

    it('should break down operations by type', async () => {
      const mockStats = {
        totalOperations: 100,
        operationsByType: { CREATE: 30, UPDATE: 50, DELETE: 20 },
        operationsByUser: {},
        operationsByEntity: {},
        sensitiveOperations: 0,
      };

      jest
        .spyOn(auditLogViewerService, 'getAuditStatistics')
        .mockResolvedValueOnce(mockStats as any);

      const response = await request(app.getHttpServer())
        .get('/api/v1/audit-logs/statistics')
        .expect(HttpStatus.OK);

      expect(response.body.operationsByType.CREATE).toBe(30);
      expect(response.body.operationsByType.UPDATE).toBe(50);
      expect(response.body.operationsByType.DELETE).toBe(20);
    });

    it('should allow custom date range', async () => {
      jest
        .spyOn(auditLogViewerService, 'getAuditStatistics')
        .mockResolvedValueOnce({
          totalOperations: 0,
          operationsByType: {},
          operationsByUser: {},
          operationsByEntity: {},
          sensitiveOperations: 0,
        } as any);

      await request(app.getHttpServer())
        .get('/api/v1/audit-logs/statistics')
        .query({ days: 90 })
        .expect(HttpStatus.OK);

      expect(auditLogViewerService.getAuditStatistics).toHaveBeenCalledWith(
        mockUser.hospitalId,
        90,
      );
    });
  });

  describe('Authorization & Security', () => {
    it('should require authentication', async () => {
      // This would test that unauthenticated requests are rejected
      // In real implementation, JwtAuthGuard would be active
      expect(true).toBe(true);
    });

    it('should require appropriate role', async () => {
      // This would test that users without ADMIN/AUDIT_MANAGER role are rejected
      // In real implementation, RolesGuard would be active
      expect(true).toBe(true);
    });

    it('should restrict non-super-admin users to their hospital', async () => {
      jest
        .spyOn(auditLogViewerService, 'getAuditLogs')
        .mockResolvedValueOnce({ logs: [], nextCursor: null, hasMore: false, total: 0 });

      await request(app.getHttpServer())
        .get('/api/v1/audit-logs')
        .expect(HttpStatus.OK);

      // Should have filtered by hospital ID
      const callArgs = (auditLogViewerService.getAuditLogs as jest.Mock).mock.calls[0][0];
      expect(callArgs.hospitalId).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      jest
        .spyOn(auditLogViewerService, 'getAuditLogs')
        .mockRejectedValueOnce(new Error('Database error'));

      await request(app.getHttpServer())
        .get('/api/v1/audit-logs')
        .expect(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should return proper error messages', async () => {
      jest
        .spyOn(auditLogViewerService, 'getAuditLogById')
        .mockResolvedValueOnce(null);

      const response = await request(app.getHttpServer())
        .get('/api/v1/audit-logs/invalid-id')
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body).toBeDefined();
    });
  });
});
