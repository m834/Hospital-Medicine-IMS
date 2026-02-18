import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from '../services/dashboard.service';
import { ExportService } from '../services/export.service';
import { ComplianceService } from '../services/compliance.service';
import { PrismaService } from '../../database/prisma.service';

/**
 * Phase 5 Dashboard Services Test Suite
 * Tests for DashboardService, ExportService, and ComplianceService
 */
describe('Phase 5 Dashboard Services', () => {
  let dashboardService: DashboardService;
  let exportService: ExportService;
  let complianceService: ComplianceService;
  let prisma: PrismaService;

  const mockHospitalId = 'hospital-123';
  const mockDate = new Date('2026-02-18');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        ExportService,
        ComplianceService,
        {
          provide: PrismaService,
          useValue: {
            threatAlert: {
              findMany: jest.fn(),
              count: jest.fn(),
            },
            auditLog: {
              findMany: jest.fn(),
              count: jest.fn(),
            },
            biometricEnrollment: {
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    dashboardService = module.get<DashboardService>(DashboardService);
    exportService = module.get<ExportService>(ExportService);
    complianceService = module.get<ComplianceService>(ComplianceService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('DashboardService', () => {
    it('should return security metrics', async () => {
      (prisma.threatAlert.findMany as jest.Mock).mockResolvedValue([
        { severity: 'CRITICAL', alertType: 'FAILED_LOGIN_ATTEMPTS', read: false, requiresAction: true, dismissedAt: null },
        { severity: 'HIGH', alertType: 'BULK_OPERATIONS', read: true, requiresAction: false, dismissedAt: new Date() },
      ]);
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([
        { action: 'CREATE', userId: 'user-1' },
        { action: 'UPDATE', userId: 'user-2' },
      ]);

      const result = await dashboardService.getSecurityMetrics(mockHospitalId);
      expect(result.totalThreats).toBe(2);
      expect(result.unreadAlerts).toBe(1);
    });

    it('should return threat trends', async () => {
      (prisma.threatAlert.findMany as jest.Mock).mockResolvedValue([
        { createdAt: new Date('2026-02-18'), severity: 'HIGH', alertType: 'FAILED_LOGIN_ATTEMPTS' },
        { createdAt: new Date('2026-02-17'), severity: 'MEDIUM', alertType: 'SUSPICIOUS_IP' },
      ]);

      const result = await dashboardService.getThreatTrend(mockHospitalId);
      expect(result.totalThreatsInPeriod).toBe(2);
    });

    it('should return compliance status', async () => {
      (prisma.threatAlert.count as jest.Mock).mockResolvedValue(0);
      (prisma.biometricEnrollment.count as jest.Mock).mockResolvedValue(100);

      const result = await dashboardService.getComplianceStatus(mockHospitalId);
      expect(result.complianceScore).toBeDefined();
    });

    it('should return encryption status', async () => {
      (prisma.biometricEnrollment.count as jest.Mock).mockResolvedValue(500);

      const result = await dashboardService.getEncryptionStatus(mockHospitalId);
      expect(result.encryptionAlgorithm).toBe('AES-256-GCM');
    });

    it('should return alert distribution', async () => {
      (prisma.threatAlert.findMany as jest.Mock).mockResolvedValue([
        { severity: 'HIGH', alertType: 'FAILED_LOGIN_ATTEMPTS', read: false, dismissedAt: null, requiresAction: true },
      ]);

      const result = await dashboardService.getAlertDistribution(mockHospitalId);
      expect(result.totalAlerts).toBe(1);
    });

    it('should return audit activity', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([
        { action: 'CREATE', entityType: 'User', userId: 'user-1', timestamp: mockDate, id: '1', entityId: 'id-1' },
      ]);

      const result = await dashboardService.getAuditActivity(mockHospitalId);
      expect(result.totalActions).toBe(1);
    });
  });

  describe('ExportService', () => {
    it('should export audit logs to CSV', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1', action: 'CREATE', entityType: 'User', userId: 'user-1', timestamp: mockDate,
          beforeState: null, afterState: null, ipAddress: '192.168.1.1', userAgent: 'Chrome', entityId: 'id-1', hospitalId: mockHospitalId,
        },
      ]);

      const csv = await exportService.exportAuditLogsToCSV(mockHospitalId);
      expect(csv).toContain('CREATE');
    });

    it('should export audit logs to JSON', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1', action: 'CREATE', entityType: 'User', userId: 'user-1', timestamp: mockDate,
          beforeState: null, afterState: null, ipAddress: '192.168.1.1', userAgent: 'Chrome', entityId: 'id-1', hospitalId: mockHospitalId,
        },
      ]);

      const json = await exportService.exportAuditLogsToJSON(mockHospitalId);
      const parsed = JSON.parse(json);
      expect(parsed.exportType).toBe('AuditLogs');
    });

    it('should export threats to CSV', async () => {
      (prisma.threatAlert.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1', alertType: 'FAILED_LOGIN_ATTEMPTS', severity: 'HIGH', description: 'Test',
          requiresAction: true, read: false, dismissedAt: null, createdAt: mockDate, updatedAt: mockDate,
          hospitalId: mockHospitalId, userId: 'user-1', adminId: null, details: {},
        },
      ]);

      const csv = await exportService.exportThreatsToCSV(mockHospitalId);
      expect(csv).toContain('FAILED_LOGIN_ATTEMPTS');
    });

    it('should export threats to JSON', async () => {
      (prisma.threatAlert.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1', alertType: 'FAILED_LOGIN_ATTEMPTS', severity: 'HIGH', description: 'Test',
          requiresAction: true, read: false, dismissedAt: null, createdAt: mockDate, updatedAt: mockDate,
          hospitalId: mockHospitalId, userId: 'user-1', adminId: null, details: {},
        },
      ]);

      const json = await exportService.exportThreatsToJSON(mockHospitalId);
      const parsed = JSON.parse(json);
      expect(parsed.exportType).toBe('ThreatAlerts');
    });

    it('should return export summary', async () => {
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(1000);
      (prisma.threatAlert.count as jest.Mock).mockResolvedValue(150);

      const summary = await exportService.getExportSummary(mockHospitalId);
      expect(summary['availableDataSets'].auditLogs.count).toBe(1000);
    });
  });

  describe('ComplianceService', () => {
    it('should generate monthly report', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.threatAlert.findMany as jest.Mock).mockResolvedValue([]);

      const report = await complianceService.generateMonthlyReport(mockHospitalId, 2026, 2);
      expect(report.reportType).toBe('MONTHLY');
    });

    it('should generate quarterly report', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.threatAlert.findMany as jest.Mock).mockResolvedValue([]);

      const report = await complianceService.generateQuarterlyReport(mockHospitalId, 2026, 1);
      expect(report.reportType).toBe('QUARTERLY');
    });

    it('should generate annual report', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.threatAlert.findMany as jest.Mock).mockResolvedValue([]);

      const report = await complianceService.generateAnnualReport(mockHospitalId, 2026);
      expect(report.reportType).toBe('ANNUAL');
    });

    it('should return compliance metrics', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.threatAlert.findMany as jest.Mock).mockResolvedValue([]);

      const metrics = await complianceService.getComplianceMetrics(mockHospitalId);
      expect(metrics.complianceScore).toBeDefined();
    });
  });
});
