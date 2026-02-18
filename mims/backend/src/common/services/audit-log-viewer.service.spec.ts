import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogViewerService } from '../services/audit-log-viewer.service';
import { PrismaService } from '../../database/prisma.service';

describe('AuditLogViewerService - Task 17 Phase 3', () => {
  let service: AuditLogViewerService;
  let prisma: PrismaService;

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
    timestamp: new Date('2025-02-20'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
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
    }).compile();

    service = module.get<AuditLogViewerService>(AuditLogViewerService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getAuditLogs', () => {
    it('should fetch paginated audit logs', async () => {
      const mockLogs = [mockAuditLog];
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValueOnce(mockLogs as any);
      jest.spyOn(prisma.auditLog, 'count').mockResolvedValueOnce(1);

      const result = await service.getAuditLogs(
        { hospitalId: 'hospital-123' },
        { limit: 50 },
      );

      expect(result.logs).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('should support cursor-based pagination', async () => {
      const mockLogs = [
        { ...mockAuditLog, id: 'log-2' },
        { ...mockAuditLog, id: 'log-3' }, // Extra one to signal hasMore=true
      ];
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValueOnce(mockLogs as any);
      jest.spyOn(prisma.auditLog, 'count').mockResolvedValueOnce(100);

      const result = await service.getAuditLogs(
        { hospitalId: 'hospital-123' },
        { cursor: 'log-1', limit: 1 },
      );

      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe('log-2');
    });

    it('should filter by entityType', async () => {
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValueOnce([mockAuditLog] as any);
      jest.spyOn(prisma.auditLog, 'count').mockResolvedValueOnce(1);

      await service.getAuditLogs(
        { hospitalId: 'hospital-123', entityType: 'BiometricEnrollment' },
        { limit: 50 },
      );

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entityType: 'BiometricEnrollment',
          }),
        }),
      );
    });

    it('should filter by action', async () => {
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValueOnce([mockAuditLog] as any);
      jest.spyOn(prisma.auditLog, 'count').mockResolvedValueOnce(1);

      await service.getAuditLogs(
        { hospitalId: 'hospital-123', action: 'DELETE' },
        { limit: 50 },
      );

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: 'DELETE',
          }),
        }),
      );
    });

    it('should filter by date range', async () => {
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValueOnce([mockAuditLog] as any);
      jest.spyOn(prisma.auditLog, 'count').mockResolvedValueOnce(1);

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-12-31');

      await service.getAuditLogs(
        { hospitalId: 'hospital-123', startDate, endDate },
        { limit: 50 },
      );

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: expect.objectContaining({
              gte: startDate,
              lte: endDate,
            }),
          }),
        }),
      );
    });

    it('should search by text', async () => {
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValueOnce([mockAuditLog] as any);
      jest.spyOn(prisma.auditLog, 'count').mockResolvedValueOnce(1);

      await service.getAuditLogs(
        { hospitalId: 'hospital-123', searchText: '192.168.1.1' },
        { limit: 50 },
      );

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        }),
      );
    });

    it('should cap limit at 500', async () => {
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValueOnce([]);
      jest.spyOn(prisma.auditLog, 'count').mockResolvedValueOnce(0);

      await service.getAuditLogs(
        { hospitalId: 'hospital-123' },
        { limit: 1000 },
      );

      const callArgs = (prisma.auditLog.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.take).toBeLessThanOrEqual(501); // limit + 1 for hasMore check
    });
  });

  describe('getAuditLogById', () => {
    it('should retrieve audit log by id', async () => {
      jest.spyOn(prisma.auditLog, 'findUnique').mockResolvedValueOnce(mockAuditLog as any);

      const result = await service.getAuditLogById('log-1');

      expect(result).toEqual(mockAuditLog);
      expect(prisma.auditLog.findUnique).toHaveBeenCalledWith({
        where: { id: 'log-1' },
      });
    });

    it('should return null if log not found', async () => {
      jest.spyOn(prisma.auditLog, 'findUnique').mockResolvedValueOnce(null);

      const result = await service.getAuditLogById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getEntityHistory', () => {
    it('should retrieve all changes for an entity', async () => {
      const logs = [
        mockAuditLog,
        { ...mockAuditLog, id: 'log-2', action: 'UPDATE' },
        { ...mockAuditLog, id: 'log-3', action: 'DELETE' },
      ];
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValueOnce(logs as any);

      const result = await service.getEntityHistory('BiometricEnrollment', 'enrollment-1');

      expect(result).toHaveLength(3);
      expect(result[0].action).toBe('CREATE');
      expect(result[1].action).toBe('UPDATE');
      expect(result[2].action).toBe('DELETE');
    });

    it('should order by timestamp descending', async () => {
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValueOnce([mockAuditLog] as any);

      await service.getEntityHistory('BiometricEnrollment', 'enrollment-1');

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { timestamp: 'desc' },
        }),
      );
    });
  });

  describe('getUserActivity', () => {
    it('should retrieve user activity', async () => {
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValueOnce([mockAuditLog] as any);

      const result = await service.getUserActivity('user-123', 'hospital-123', 30);

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user-123');
    });

    it('should default to 30 days lookback', async () => {
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValueOnce([]);

      await service.getUserActivity('user-123', 'hospital-123');

      const callArgs = (prisma.auditLog.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.timestamp).toBeDefined();
    });

    it('should respect custom days parameter', async () => {
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValueOnce([]);

      await service.getUserActivity('user-123', 'hospital-123', 90);

      const callArgs = (prisma.auditLog.findMany as jest.Mock).mock.calls[0][0];
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - 90);
      
      expect(callArgs.where.timestamp.gte.getTime())
        .toBeLessThanOrEqual(expectedDate.getTime() + 1000); // Allow 1s margin
    });
  });

  describe('getSensitiveOperations', () => {
    it('should retrieve sensitive operations', async () => {
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValueOnce([mockAuditLog] as any);

      const result = await service.getSensitiveOperations('hospital-123', 30);

      expect(result).toHaveLength(1);
      expect(result[0].entityType).toBe('BiometricEnrollment');
    });

    it('should filter sensitive entity types', async () => {
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValueOnce([mockAuditLog] as any);

      await service.getSensitiveOperations('hospital-123', 30);

      const callArgs = (prisma.auditLog.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.entityType).toBeDefined();
      expect(callArgs.where.entityType.in).toContain('BiometricEnrollment');
      expect(callArgs.where.entityType.in).toContain('User');
    });

    it('should only track CREATE, UPDATE, DELETE actions', async () => {
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValueOnce([mockAuditLog] as any);

      await service.getSensitiveOperations('hospital-123', 30);

      const callArgs = (prisma.auditLog.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.action.in).toEqual(['CREATE', 'UPDATE', 'DELETE']);
    });
  });

  describe('getSuspiciousActivity', () => {
    it('should retrieve suspicious activities', async () => {
      const deleteLogs = [
        { ...mockAuditLog, action: 'DELETE' },
        { ...mockAuditLog, id: 'log-2', action: 'DELETE' },
      ];
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValueOnce(deleteLogs as any);

      const result = await service.getSuspiciousActivity('hospital-123', 7);

      expect(result).toHaveLength(2);
      expect(result[0].action).toBe('DELETE');
    });

    it('should default to 7 days lookback', async () => {
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValueOnce([]);

      await service.getSuspiciousActivity('hospital-123');

      const callArgs = (prisma.auditLog.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.timestamp).toBeDefined();
    });

    it('should track DELETE operations', async () => {
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValueOnce([]);

      await service.getSuspiciousActivity('hospital-123', 7);

      const callArgs = (prisma.auditLog.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.action).toBe('DELETE');
    });
  });

  describe('getAuditStatistics', () => {
    it('should calculate statistics', async () => {
      const logs = [
        mockAuditLog,
        { ...mockAuditLog, id: 'log-2', action: 'UPDATE', userId: 'user-456' },
        { ...mockAuditLog, id: 'log-3', action: 'DELETE', entityType: 'User' },
      ];
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValueOnce(logs as any);

      const result = await service.getAuditStatistics('hospital-123', 30);

      expect(result.totalOperations).toBe(3);
      expect(result.operationsByType.CREATE).toBe(1);
      expect(result.operationsByType.UPDATE).toBe(1);
      expect(result.operationsByType.DELETE).toBe(1);
    });

    it('should count operations by user', async () => {
      const logs = [
        mockAuditLog,
        { ...mockAuditLog, id: 'log-2', userId: 'user-456' },
        { ...mockAuditLog, id: 'log-3', userId: 'user-456' },
      ];
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValueOnce(logs as any);

      const result = await service.getAuditStatistics('hospital-123', 30);

      expect(result.operationsByUser['user-123']).toBe(1);
      expect(result.operationsByUser['user-456']).toBe(2);
    });

    it('should count operations by entity type', async () => {
      const logs = [
        mockAuditLog,
        { ...mockAuditLog, id: 'log-2', entityType: 'User' },
        { ...mockAuditLog, id: 'log-3', entityType: 'User' },
      ];
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValueOnce(logs as any);

      const result = await service.getAuditStatistics('hospital-123', 30);

      expect(result.operationsByEntity.BiometricEnrollment).toBe(1);
      expect(result.operationsByEntity.User).toBe(2);
    });

    it('should count sensitive operations', async () => {
      const logs = [
        mockAuditLog, // BiometricEnrollment - sensitive
        { ...mockAuditLog, id: 'log-2', entityType: 'User', action: 'UPDATE' }, // User - sensitive
        { ...mockAuditLog, id: 'log-3', entityType: 'OtherEntity', action: 'CREATE' }, // Not sensitive
      ];
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValueOnce(logs as any);

      const result = await service.getAuditStatistics('hospital-123', 30);

      expect(result.sensitiveOperations).toBe(2);
    });

    it('should default to 30 days', async () => {
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValueOnce([]);

      await service.getAuditStatistics('hospital-123');

      const callArgs = (prisma.auditLog.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.timestamp).toBeDefined();
    });

    it('should support custom date range', async () => {
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValueOnce([]);

      await service.getAuditStatistics('hospital-123', 365);

      const callArgs = (prisma.auditLog.findMany as jest.Mock).mock.calls[0][0];
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - 365);
      
      expect(callArgs.where.timestamp.gte.getTime())
        .toBeLessThanOrEqual(expectedDate.getTime() + 1000);
    });
  });

  describe('Filter Building', () => {
    it('should build correct where clause for multiple filters', async () => {
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValueOnce([]);
      jest.spyOn(prisma.auditLog, 'count').mockResolvedValueOnce(0);

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-12-31');

      await service.getAuditLogs(
        {
          hospitalId: 'hospital-123',
          userId: 'user-123',
          entityType: 'BiometricEnrollment',
          action: 'CREATE',
          startDate,
          endDate,
          searchText: 'test',
        },
        { limit: 50 },
      );

      const callArgs = (prisma.auditLog.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where).toMatchObject({
        hospitalId: 'hospital-123',
        userId: 'user-123',
        entityType: 'BiometricEnrollment',
        action: 'CREATE',
      });
      expect(callArgs.where.timestamp).toBeDefined();
      expect(callArgs.where.OR).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should use indexes efficiently', async () => {
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValueOnce([]);
      jest.spyOn(prisma.auditLog, 'count').mockResolvedValueOnce(0);

      // Query that should use hospitalId index
      await service.getAuditLogs(
        { hospitalId: 'hospital-123' },
        { limit: 50 },
      );

      const findArgs = (prisma.auditLog.findMany as jest.Mock).mock.calls[0][0];
      expect(findArgs.where.hospitalId).toBeDefined();
      expect(findArgs.orderBy).toEqual({ timestamp: 'desc' });
    });

    it('should limit result set for large queries', async () => {
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValueOnce([]);
      jest.spyOn(prisma.auditLog, 'count').mockResolvedValueOnce(10000);

      await service.getAuditLogs(
        { hospitalId: 'hospital-123' },
        { limit: 50 },
      );

      const callArgs = (prisma.auditLog.findMany as jest.Mock).mock.calls[0][0];
      // Should request limit + 1 (for hasMore check)
      expect(callArgs.take).toBe(51);
    });
  });
});
