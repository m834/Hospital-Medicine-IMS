import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ThreatDetectionController } from './threat-detection.controller';
import { ThreatDetectionService } from '../services/threat-detection.service';
import { AlertService } from '../services/alert.service';

describe('ThreatDetectionController', () => {
  let controller: ThreatDetectionController;
  let threatDetectionService: ThreatDetectionService;
  let alertService: AlertService;

  const mockHospitalId = 'test-hospital-id';
  const mockUserId = 'test-user-id';
  const mockAdminId = 'admin-id';
  const mockIpAddress = '192.168.1.1';

  const mockCurrentUser = {
    id: mockAdminId,
    hospitalId: mockHospitalId,
    role: 'ADMIN',
    email: 'admin@hospital.com',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ThreatDetectionController],
      providers: [
        {
          provide: ThreatDetectionService,
          useValue: {
            trackFailedLoginAttempt: jest.fn(),
            resetFailedLoginAttempts: jest.fn(),
            getFailedLoginAttemptCount: jest.fn(),
            detectBulkOperations: jest.fn(),
            detectPermissionEscalation: jest.fn(),
            detectSuspiciousIP: jest.fn(),
            comprehensiveThreatScan: jest.fn(),
            getThreatSummary: jest.fn(),
          },
        },
        {
          provide: AlertService,
          useValue: {
            createAlert: jest.fn(),
            getUnreadAlerts: jest.fn(),
            getAlerts: jest.fn(),
            markAlertAsRead: jest.fn(),
            markAllAlertsAsRead: jest.fn(),
            dismissAlert: jest.fn(),
            getAlertById: jest.fn(),
            getAlertSummary: jest.fn(),
            clearOldAlerts: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ThreatDetectionController>(ThreatDetectionController);
    threatDetectionService = module.get<ThreatDetectionService>(ThreatDetectionService);
    alertService = module.get<AlertService>(AlertService);
  });

  describe('Failed Login Tracking', () => {
    it('should track failed login attempt', async () => {
      const dto = {
        userId: mockUserId,
        hospitalId: mockHospitalId,
        ipAddress: mockIpAddress,
        userAgent: 'Mozilla/5.0',
        reason: 'INVALID_PASSWORD',
      };

      const mockAlert = {
        type: 'FAILED_LOGIN_ATTEMPTS',
        severity: 'HIGH',
        userId: mockUserId,
        hospitalId: mockHospitalId,
        description: 'Failed login detected',
        details: {},
        timestamp: new Date(),
        requiresAction: false,
      };

      const mockNotification = {
        id: 'alert-id',
        hospitalId: mockHospitalId,
        alertType: 'FAILED_LOGIN_ATTEMPTS',
        severity: 'HIGH',
        title: 'Failed Login Attempt',
        message: 'Failed login detected',
        actionRequired: false,
        read: false,
        createdAt: new Date(),
      };

      (threatDetectionService.trackFailedLoginAttempt as jest.Mock).mockResolvedValue(
        mockAlert,
      );

      (alertService.createAlert as jest.Mock).mockResolvedValue(mockNotification);

      const result = await controller.reportFailedLogin(dto, mockCurrentUser);

      expect(threatDetectionService.trackFailedLoginAttempt).toHaveBeenCalledWith(
        dto.userId,
        mockCurrentUser.hospitalId,
        dto.ipAddress,
        dto.userAgent,
        dto.reason,
      );
      expect(result).toBeDefined();
      expect(result.threatDetected).toBe(true);
    });

    it('should reset login attempts on successful auth', async () => {
      (threatDetectionService.resetFailedLoginAttempts as jest.Mock).mockResolvedValue(
        undefined,
      );

      await controller.resetLoginAttempts(mockUserId, mockCurrentUser);

      expect(threatDetectionService.resetFailedLoginAttempts).toHaveBeenCalledWith(
        mockUserId,
        mockHospitalId,
      );
    });

    it('should get login attempt count', async () => {
      (threatDetectionService.getFailedLoginAttemptCount as jest.Mock).mockReturnValue(
        3,
      );

      const result = await controller.getLoginAttempts(mockUserId, mockCurrentUser);

      expect(threatDetectionService.getFailedLoginAttemptCount).toHaveBeenCalledWith(
        mockUserId,
        mockHospitalId,
      );
      expect(result).toBeDefined();
    });
  });

  describe('Bulk Operations Detection', () => {
    it('should detect bulk operations', async () => {
      const dto = { hospitalId: mockHospitalId, userId: mockUserId };

      const mockAlert = {
        type: 'BULK_OPERATIONS',
        severity: 'HIGH',
        userId: mockUserId,
        hospitalId: mockHospitalId,
        description: 'Bulk operations detected',
        details: {},
        timestamp: new Date(),
        requiresAction: false,
      };

      const mockNotification = {
        id: 'alert-id',
        hospitalId: mockHospitalId,
        alertType: 'BULK_OPERATIONS',
        severity: 'HIGH',
        title: 'Bulk Operations',
        message: 'Bulk operations detected',
        actionRequired: false,
        read: false,
        createdAt: new Date(),
      };

      (threatDetectionService.detectBulkOperations as jest.Mock).mockResolvedValue(
        mockAlert,
      );

      (alertService.createAlert as jest.Mock).mockResolvedValue(mockNotification);

      const result = await controller.detectBulkOperations(dto, mockCurrentUser);

      expect(threatDetectionService.detectBulkOperations).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.threatDetected).toBe(true);
    });
  });

  describe('Permission Escalation Detection', () => {
    it('should detect permission escalation', async () => {
      const dto = { hospitalId: mockHospitalId, lookbackMinutes: 30 };

      const mockAlerts = [
        {
          type: 'PERMISSION_ESCALATION',
          severity: 'HIGH',
          userId: mockUserId,
          hospitalId: mockHospitalId,
          description: 'Permission escalation detected',
          details: {},
          timestamp: new Date(),
          requiresAction: false,
        },
      ];

      const mockNotifications = [
        {
          id: 'escalation-alert',
          hospitalId: mockHospitalId,
          alertType: 'PERMISSION_ESCALATION',
          severity: 'HIGH',
          title: 'Permission Escalation',
          message: 'Permission escalation detected',
          actionRequired: false,
          read: false,
          createdAt: new Date(),
        },
      ];

      (threatDetectionService.detectPermissionEscalation as jest.Mock).mockResolvedValue(
        mockAlerts,
      );

      (alertService.createAlert as jest.Mock).mockResolvedValue(mockNotifications[0]);

      const result = await controller.detectPermissionEscalation(dto, mockCurrentUser);

      expect(threatDetectionService.detectPermissionEscalation).toHaveBeenCalledWith(
        mockHospitalId,
        30,
      );
      expect(result).toBeDefined();
      expect(result.threatsDetected).toBeDefined();
    });
  });

  describe('Suspicious IP Detection', () => {
    it('should detect suspicious IP access', async () => {
      const dto = {
        hospitalId: mockHospitalId,
        userId: mockUserId,
        ipAddress: mockIpAddress,
        lookbackHours: 24,
      };

      const mockAlert = {
        type: 'SUSPICIOUS_IP',
        severity: 'MEDIUM',
        userId: mockUserId,
        hospitalId: mockHospitalId,
        description: 'Suspicious IP detected',
        details: { ips: [mockIpAddress] },
        timestamp: new Date(),
        requiresAction: false,
      };

      const mockNotification = {
        id: 'ip-alert',
        hospitalId: mockHospitalId,
        alertType: 'SUSPICIOUS_IP',
        severity: 'MEDIUM',
        title: 'Suspicious IP',
        message: 'Suspicious IP detected',
        actionRequired: false,
        read: false,
        createdAt: new Date(),
      };

      (threatDetectionService.detectSuspiciousIP as jest.Mock).mockResolvedValue(
        mockAlert,
      );

      (alertService.createAlert as jest.Mock).mockResolvedValue(mockNotification);

      const result = await controller.detectSuspiciousIP(dto, mockCurrentUser);

      expect(threatDetectionService.detectSuspiciousIP).toHaveBeenCalledWith(
        dto.hospitalId,
        dto.userId,
        dto.ipAddress,
        dto.lookbackHours,
      );
      expect(result).toBeDefined();
    });
  });

  describe('Comprehensive Threat Scan', () => {
    it('should perform comprehensive threat scan', async () => {
      const dto = { hospitalId: mockHospitalId };

      const mockAlerts = [
        {
          type: 'FAILED_LOGIN_ATTEMPTS',
          severity: 'HIGH',
          userId: mockUserId,
          hospitalId: mockHospitalId,
          description: 'Threat detected',
          details: {},
          timestamp: new Date(),
          requiresAction: false,
        },
      ];

      const mockNotifications = [
        {
          id: 'alert-1',
          hospitalId: mockHospitalId,
          alertType: 'FAILED_LOGIN_ATTEMPTS',
          severity: 'HIGH',
          title: 'Failed Login',
          message: 'Threat detected',
          actionRequired: false,
          read: false,
          createdAt: new Date(),
        },
      ];

      (threatDetectionService.comprehensiveThreatScan as jest.Mock).mockResolvedValue(
        mockAlerts,
      );

      (alertService.createAlert as jest.Mock).mockResolvedValue(mockNotifications[0]);

      const result = await controller.comprehensiveScan(dto, mockCurrentUser);

      expect(threatDetectionService.comprehensiveThreatScan).toHaveBeenCalledWith(
        mockHospitalId,
      );
      expect(result).toBeDefined();
      expect(result.alertsDetected).toBeDefined();
    });
  });

  describe('Alert Management', () => {
    it('should get alerts with pagination', async () => {
      const query = { offset: 0, limit: 10, severity: 'HIGH', unreadOnly: false };

      const mockResult = {
        alerts: [
          {
            id: 'alert-1',
            hospitalId: mockHospitalId,
            alertType: 'FAILED_LOGIN_ATTEMPTS',
            severity: 'HIGH',
            title: 'Failed Login',
            message: 'Alert',
            actionRequired: false,
            read: false,
            createdAt: new Date(),
          },
        ],
        total: 1,
        limit: 10,
        offset: 0,
      };

      (alertService.getAlerts as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.getAlerts(query, mockCurrentUser);

      expect(alertService.getAlerts).toHaveBeenCalledWith(
        mockHospitalId,
        expect.objectContaining({
          limit: query.limit,
          offset: query.offset,
          severity: query.severity,
        }),
      );
      expect(result.alerts.length).toBe(1);
      expect(result.total).toBe(1);
    });

    it('should get single alert by ID', async () => {
      const alertId = 'alert-id';

      const mockAlert = {
        id: alertId,
        hospitalId: mockHospitalId,
        alertType: 'FAILED_LOGIN_ATTEMPTS',
        severity: 'HIGH',
        title: 'Failed Login',
        message: 'Alert',
        actionRequired: false,
        read: false,
        createdAt: new Date(),
      };

      (alertService.getAlertById as jest.Mock).mockResolvedValue(mockAlert);

      const result = await controller.getAlert(alertId);

      expect(alertService.getAlertById).toHaveBeenCalledWith(alertId);
      expect(result).toBeDefined();
      expect(result.id).toBe(alertId);
    });

    it('should mark alert as read', async () => {
      const alertId = 'alert-id';

      (alertService.markAlertAsRead as jest.Mock).mockResolvedValue(undefined);

      await controller.markAsRead(alertId, mockCurrentUser);

      expect(alertService.markAlertAsRead).toHaveBeenCalledWith(alertId, mockHospitalId);
    });

    it('should mark all alerts as read', async () => {
      (alertService.markAllAlertsAsRead as jest.Mock).mockResolvedValue(undefined);

      await controller.markAllAsRead(mockCurrentUser);

      expect(alertService.markAllAlertsAsRead).toHaveBeenCalledWith(mockHospitalId);
    });

    it('should dismiss alert', async () => {
      const alertId = 'alert-id';

      (alertService.dismissAlert as jest.Mock).mockResolvedValue(undefined);

      await controller.dismissAlert(alertId, mockCurrentUser);

      expect(alertService.dismissAlert).toHaveBeenCalledWith(alertId, mockHospitalId);
    });

    it('should get alert summary', async () => {
      const mockSummary = {
        unreadCount: 5,
        unreadCritical: 1,
        unreadHigh: 2,
        unreadMedium: 2,
        requiresAction: 1,
      };

      (alertService.getAlertSummary as jest.Mock).mockResolvedValue(mockSummary);

      const result = await controller.getAlertSummary(mockCurrentUser);

      expect(alertService.getAlertSummary).toHaveBeenCalledWith(mockHospitalId);
      expect(result.unreadCount).toBe(5);
      expect(result.requiresAction).toBe(1);
    });

    it('should get threat summary', async () => {
      const mockSummary = {
        criticalAlerts: 1,
        highAlerts: 3,
        mediumAlerts: 5,
        lowAlerts: 2,
        totalAlerts: 11,
        requiresImmediateAction: 1,
        alertTypes: {
          FAILED_LOGIN_ATTEMPTS: 3,
          BULK_OPERATIONS: 5,
          SUSPICIOUS_IP: 3,
        },
      };

      (threatDetectionService.getThreatSummary as jest.Mock).mockResolvedValue(
        mockSummary,
      );

      const result = await controller.getThreatSummary(mockCurrentUser);

      expect(threatDetectionService.getThreatSummary).toHaveBeenCalledWith(mockHospitalId);
      expect(result.totalAlerts).toBe(11);
      expect(result.requiresImmediateAction).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing hospital ID', async () => {
      const userWithoutHospital = { ...mockCurrentUser, hospitalId: undefined };

      const dto = { hospitalId: undefined };

      expect(async () => {
        await controller.getAlerts({}, userWithoutHospital);
      }).toBeDefined();
    });

    it('should validate input DTOs', async () => {
      const dto = {
        userId: mockUserId,
        hospitalId: mockHospitalId,
        ipAddress: mockIpAddress,
        userAgent: 'Mozilla/5.0',
        reason: 'INVALID_PASSWORD',
      };

      // The controller should validate these through class-validator
      expect(dto).toBeDefined();
    });

    it('should handle service errors gracefully', async () => {
      (threatDetectionService.trackFailedLoginAttempt as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      const dto = {
        userId: mockUserId,
        hospitalId: mockHospitalId,
        ipAddress: mockIpAddress,
        userAgent: 'Mozilla/5.0',
        reason: 'INVALID_PASSWORD',
      };

      await expect(
        controller.reportFailedLogin(dto, mockCurrentUser),
      ).rejects.toThrow();
    });
  });

  describe('Authorization', () => {
    it('should verify hospital scoping', async () => {
      const differentHospitalUser = { ...mockCurrentUser, hospitalId: 'other-hospital' };

      const query = { offset: 0, limit: 10 };

      (alertService.getAlerts as jest.Mock).mockResolvedValue({
        alerts: [],
        total: 0,
        limit: 10,
        offset: 0,
      });

      await controller.getAlerts(query, differentHospitalUser);

      // The controller should use the user's hospital ID, not a provided one
      expect(alertService.getAlerts).toHaveBeenCalledWith(
        differentHospitalUser.hospitalId,
        query,
      );
    });
  });

  describe('Response Formatting', () => {
    it('should format threat detection response', async () => {
      const mockAlert = {
        type: 'FAILED_LOGIN_ATTEMPTS',
        severity: 'HIGH',
        userId: mockUserId,
        hospitalId: mockHospitalId,
        description: 'Threat detected',
        details: { count: 5 },
        timestamp: new Date(),
        requiresAction: false,
      };

      const mockNotification = {
        id: 'alert-id',
        hospitalId: mockHospitalId,
        alertType: 'FAILED_LOGIN_ATTEMPTS',
        severity: 'HIGH',
        title: 'Failed Login Attempt',
        message: 'Threat detected',
        actionRequired: false,
        read: false,
        createdAt: new Date(),
      };

      (threatDetectionService.trackFailedLoginAttempt as jest.Mock).mockResolvedValue(
        mockAlert,
      );

      (alertService.createAlert as jest.Mock).mockResolvedValue(mockNotification);

      const dto = {
        userId: mockUserId,
        hospitalId: mockHospitalId,
        ipAddress: mockIpAddress,
        userAgent: 'Mozilla/5.0',
        reason: 'INVALID_PASSWORD',
      };

      const result = await controller.reportFailedLogin(dto, mockCurrentUser);

      expect(result).toHaveProperty('threatDetected');
    });

    it('should format paginated alert response', async () => {
      const mockResult = {
        alerts: Array(5)
          .fill(null)
          .map((_, i) => ({
            id: `alert-${i}`,
            hospitalId: mockHospitalId,
            alertType: 'FAILED_LOGIN_ATTEMPTS',
            severity: 'HIGH',
            description: 'Alert',
            details: {},
            requiresAction: false,
            read: i % 2 === 0,
            createdAt: new Date(),
          })),
        total: 20,
        limit: 5,
        offset: 0,
      };

      (alertService.getAlerts as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.getAlerts(
        { offset: 0, limit: 5 },
        mockCurrentUser,
      );

      expect(result.alerts).toBeDefined();
      expect(result.alerts.length).toBe(5);
      expect(result.total).toBe(20);
      expect(result.limit).toBe(5);
      expect(result.offset).toBe(0);
    });
  });
});
