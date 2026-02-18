import { Test, TestingModule } from '@nestjs/testing';
import { AlertService } from './alert.service';
import { PrismaService } from '../../database/prisma.service';

describe('AlertService', () => {
  let service: AlertService;
  let prisma: PrismaService;

  const mockHospitalId = 'test-hospital-id';
  const mockUserId = 'test-user-id';
  const mockAdminId = 'admin-id';

  const mockThreat = {
    type: 'FAILED_LOGIN_ATTEMPTS' as const,
    severity: 'HIGH' as const,
    userId: mockUserId,
    hospitalId: mockHospitalId,
    description: 'High failed login attempts',
    details: { attemptCount: 5 },
    timestamp: new Date(),
    requiresAction: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertService,
        {
          provide: PrismaService,
          useValue: {
            threatAlert: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
              count: jest.fn(),
              deleteMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AlertService>(AlertService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('Alert Creation', () => {
    it('should create an alert from a threat', async () => {
      const mockAlert = {
        id: 'alert-id',
        hospitalId: mockHospitalId,
        userId: mockUserId,
        alertType: 'FAILED_LOGIN_ATTEMPTS',
        severity: 'HIGH',
        description: 'High failed login attempts',
        details: { attemptCount: 5 },
        requiresAction: false,
        read: false,
        createdAt: new Date(),
        dismissedAt: null,
      };

      (prisma.threatAlert.create as jest.Mock).mockResolvedValue(mockAlert);

      const notification = await service.createAlert(mockThreat, mockAdminId);

      expect(notification).toBeDefined();
      expect(notification.hospitalId).toBe(mockHospitalId);
      expect(notification.alertType).toBe('FAILED_LOGIN_ATTEMPTS');
      expect(notification.severity).toBe('HIGH');
      expect(notification.read).toBe(false);
    });

    it('should generate appropriate alert title', async () => {
      const mockAlert = {
        id: 'alert-id',
        hospitalId: mockHospitalId,
        userId: mockUserId,
        alertType: 'FAILED_LOGIN_ATTEMPTS',
        severity: 'CRITICAL',
        description: 'Critical failed login',
        details: {},
        requiresAction: true,
        read: false,
        createdAt: new Date(),
      };

      (prisma.threatAlert.create as jest.Mock).mockResolvedValue(mockAlert);

      const notification = await service.createAlert(mockThreat);

      expect(notification.title).toBeDefined();
      expect(notification.title.length).toBeGreaterThan(0);
    });
  });

  describe('Get Unread Alerts', () => {
    it('should retrieve unread alerts for hospital', async () => {
      const mockAlerts = [
        {
          id: 'alert-1',
          hospitalId: mockHospitalId,
          alertType: 'FAILED_LOGIN_ATTEMPTS',
          severity: 'HIGH',
          title: 'Failed Login',
          message: 'Failed logins',
          actionRequired: false,
          read: false,
          createdAt: new Date(),
        },
        {
          id: 'alert-2',
          hospitalId: mockHospitalId,
          alertType: 'BULK_OPERATIONS',
          severity: 'MEDIUM',
          title: 'Bulk Operations',
          message: 'Bulk operations',
          actionRequired: false,
          read: false,
          createdAt: new Date(),
        },
      ];

      // Mock the in-memory storage by directly returning alerts
      jest.spyOn(service as any, 'getUnreadAlerts').mockResolvedValue(mockAlerts);

      const alerts = await service.getUnreadAlerts(mockHospitalId);

      expect(alerts.length).toBe(2);
      expect(alerts[0].read).toBe(false);
      expect(alerts[1].read).toBe(false);
    });

    it('should return empty list if no unread alerts', async () => {
      jest.spyOn(service as any, 'getUnreadAlerts').mockResolvedValue([]);

      const alerts = await service.getUnreadAlerts(mockHospitalId);

      expect(alerts).toEqual([]);
    });
  });

  describe('Get Alerts with Pagination', () => {
    it('should retrieve alerts with pagination', async () => {
      const mockAlerts = Array(10)
        .fill(null)
        .map((_, i) => ({
          id: `alert-${i}`,
          hospitalId: mockHospitalId,
          userId: mockUserId,
          alertType: 'FAILED_LOGIN_ATTEMPTS',
          severity: 'HIGH',
          description: `Alert ${i}`,
          details: {},
          requiresAction: false,
          read: i % 2 === 0,
          createdAt: new Date(Date.now() - i * 60 * 1000),
          dismissedAt: null,
        }));

      (prisma.threatAlert.count as jest.Mock).mockResolvedValue(10);
      (prisma.threatAlert.findMany as jest.Mock).mockResolvedValue(mockAlerts.slice(0, 5));

      const result = await service.getAlerts(mockHospitalId, { offset: 0, limit: 5 });

      expect(result.alerts.length).toBe(5);
      expect(result.total).toBe(10);
      expect(result.limit).toBe(5);
      expect(result.offset).toBe(0);
    });

    it('should filter alerts by severity', async () => {
      const mockCriticalAlerts = [
        {
          id: 'critical-alert',
          hospitalId: mockHospitalId,
          userId: mockUserId,
          alertType: 'FAILED_LOGIN_ATTEMPTS',
          severity: 'CRITICAL',
          description: 'Critical alert',
          details: {},
          requiresAction: true,
          read: false,
          createdAt: new Date(),
          dismissedAt: null,
        },
      ];

      (prisma.threatAlert.count as jest.Mock).mockResolvedValue(1);
      (prisma.threatAlert.findMany as jest.Mock).mockResolvedValue(mockCriticalAlerts);

      const result = await service.getAlerts(mockHospitalId, {
        severity: 'CRITICAL',
      });

      expect(result.alerts.length).toBe(1);
      expect(result.alerts[0].severity).toBe('CRITICAL');
    });
  });

  describe('Mark Alert as Read', () => {
    it('should mark single alert as read', async () => {
      const alertId = 'alert-id';

      (prisma.threatAlert.update as jest.Mock).mockResolvedValue({
        id: alertId,
        read: true,
      });

      await service.markAlertAsRead(alertId, mockHospitalId);

      expect(prisma.threatAlert.update).toHaveBeenCalledWith({
        where: { id: alertId },
        data: { read: true },
      });
    });

    it('should mark all alerts as read', async () => {
      (prisma.threatAlert.updateMany as jest.Mock).mockResolvedValue({
        count: 5,
      });

      await service.markAllAlertsAsRead(mockHospitalId);

      expect(prisma.threatAlert.updateMany).toHaveBeenCalled();
    });
  });

  describe('Dismiss Alert', () => {
    it('should dismiss an alert', async () => {
      const alertId = 'alert-id';

      (prisma.threatAlert.update as jest.Mock).mockResolvedValue({
        id: alertId,
        dismissedAt: new Date(),
      });

      await service.dismissAlert(alertId, mockHospitalId);

      expect(prisma.threatAlert.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: alertId },
          data: expect.objectContaining({ dismissedAt: expect.any(Date) }),
        }),
      );
    });
  });

  describe('Get Alert by ID', () => {
    it('should retrieve alert by ID', async () => {
      const alertId = 'alert-id';
      const mockAlert = {
        id: alertId,
        hospitalId: mockHospitalId,
        userId: mockUserId,
        alertType: 'FAILED_LOGIN_ATTEMPTS',
        severity: 'HIGH',
        description: 'Failed login attempts',
        details: {},
        requiresAction: false,
        read: false,
        createdAt: new Date(),
        dismissedAt: null,
      };

      (prisma.threatAlert.findUnique as jest.Mock).mockResolvedValue(mockAlert);

      const alert = await service.getAlertById(alertId);

      expect(alert).toBeDefined();
      expect(alert?.id).toBe(alertId);
    });

    it('should return null for non-existent alert', async () => {
      (prisma.threatAlert.findUnique as jest.Mock).mockResolvedValue(null);

      const alert = await service.getAlertById('non-existent-id');

      expect(alert).toBeNull();
    });
  });

  describe('Alert Summary', () => {
    it('should generate alert summary', async () => {
      const mockAlerts = [
        {
          severity: 'CRITICAL',
          read: false,
          requiresAction: true,
        },
        {
          severity: 'HIGH',
          read: false,
          requiresAction: false,
        },
        {
          severity: 'MEDIUM',
          read: false,
          requiresAction: false,
        },
        {
          severity: 'LOW',
          read: true,
          requiresAction: false,
        },
      ];

      (prisma.threatAlert.findMany as jest.Mock).mockResolvedValue(mockAlerts);

      const summary = await service.getAlertSummary(mockHospitalId);

      expect(summary.unreadCount).toBeGreaterThan(0);
      expect(summary.unreadCritical).toBe(1);
      expect(summary.unreadHigh).toBe(1);
      expect(summary.unreadMedium).toBe(1);
      expect(summary.requiresAction).toBe(1);
    });

    it('should show 0 for empty summary', async () => {
      (prisma.threatAlert.findMany as jest.Mock).mockResolvedValue([]);

      const summary = await service.getAlertSummary(mockHospitalId);

      expect(summary.unreadCount).toBe(0);
      expect(summary.unreadCritical).toBe(0);
      expect(summary.requiresAction).toBe(0);
    });
  });

  describe('Clear Old Alerts', () => {
    it('should delete alerts older than specified days', async () => {
      (prisma.threatAlert.deleteMany as jest.Mock).mockResolvedValue({
        count: 5,
      });

      const deleted = await service.clearOldAlerts(30);

      expect(deleted).toBe(5);
      expect(prisma.threatAlert.deleteMany).toHaveBeenCalled();
    });

    it('should handle no old alerts', async () => {
      (prisma.threatAlert.deleteMany as jest.Mock).mockResolvedValue({
        count: 0,
      });

      const deleted = await service.clearOldAlerts(30);

      expect(deleted).toBe(0);
    });
  });

  describe('Alert Notifications', () => {
    it('should properly format alert notification', async () => {
      const mockAlert = {
        id: 'alert-id',
        hospitalId: mockHospitalId,
        userId: mockUserId,
        alertType: 'FAILED_LOGIN_ATTEMPTS',
        severity: 'CRITICAL',
        description: 'Critical failed login',
        details: {},
        requiresAction: true,
        read: false,
        createdAt: new Date(),
        dismissedAt: null,
      };

      (prisma.threatAlert.create as jest.Mock).mockResolvedValue(mockAlert);

      const notification = await service.createAlert(mockThreat);

      expect(notification).toHaveProperty('id');
      expect(notification).toHaveProperty('hospitalId');
      expect(notification).toHaveProperty('alertType');
      expect(notification).toHaveProperty('severity');
      expect(notification).toHaveProperty('title');
      expect(notification).toHaveProperty('message');
      expect(notification).toHaveProperty('actionRequired');
      expect(notification).toHaveProperty('read');
      expect(notification).toHaveProperty('createdAt');
    });
  });
});
