import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ReceiptType } from '@prisma/client';
import { ReportsService } from './reports.service';
import { PrismaService } from '@/database/prisma.service';

describe('ReportsService.getRegistrationReport', () => {
  let service: ReportsService;

  const mockPrismaService = {
    patient: { groupBy: jest.fn() },
    receipt: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  const baseDto = {
    hospitalId: 'hospital-1',
    startDate: '2026-09-01',
    endDate: '2026-09-01',
  };

  it('attributes registrations and lab charges to the registering staff member', async () => {
    mockPrismaService.patient.groupBy.mockResolvedValue([
      { registeredBy: 'staff-1', _count: { _all: 3 } },
      { registeredBy: 'staff-2', _count: { _all: 1 } },
    ]);
    mockPrismaService.receipt.findMany.mockResolvedValue([
      { totalAmount: 500, paidAmount: 500, patient: { registeredBy: 'staff-1' } },
      { totalAmount: 250.5, paidAmount: 0, patient: { registeredBy: 'staff-1' } },
      { totalAmount: 100, paidAmount: 0, patient: { registeredBy: 'staff-2' } },
    ]);
    mockPrismaService.user.findMany.mockResolvedValue([
      {
        id: 'staff-1',
        fullName: 'Ayesha Khan',
        role: 'REGISTRATION_STAFF',
        department: { id: 'dept-1', name: 'Outpatient' },
      },
      {
        id: 'staff-2',
        fullName: 'Bilal Ahmed',
        role: 'REGISTRATION_STAFF',
        department: { id: 'dept-1', name: 'Outpatient' },
      },
    ]);

    const report = await service.getRegistrationReport(baseDto);

    expect(report.totals).toEqual({
      registrations: 4,
      labTestOrders: 3,
      labTestRevenue: 850.5,
      labTestCollected: 500,
      labTestOutstanding: 350.5,
      staffCount: 2,
    });

    const [first, second] = report.staff;
    expect(first).toMatchObject({
      staffId: 'staff-1',
      staffName: 'Ayesha Khan',
      registrations: 3,
      labTestOrders: 2,
      labTestRevenue: 750.5,
      labTestCollected: 500,
      labTestOutstanding: 250.5,
    });
    expect(second).toMatchObject({ staffId: 'staff-2', registrations: 1, labTestRevenue: 100 });

    expect(report.departments).toHaveLength(1);
    expect(report.departments[0]).toMatchObject({
      departmentId: 'dept-1',
      departmentName: 'Outpatient',
      registrations: 4,
      labTestRevenue: 850.5,
    });
    expect(report.departments[0].staff).toHaveLength(2);
  });

  it('counts only LAB_TEST receipts over the full day, and only the requested hospital', async () => {
    mockPrismaService.patient.groupBy.mockResolvedValue([]);
    mockPrismaService.receipt.findMany.mockResolvedValue([]);
    mockPrismaService.user.findMany.mockResolvedValue([]);

    await service.getRegistrationReport(baseDto);

    const receiptWhere = mockPrismaService.receipt.findMany.mock.calls[0][0].where;
    expect(receiptWhere.receiptType).toBe(ReceiptType.LAB_TEST);
    expect(receiptWhere.hospitalId).toBe('hospital-1');
    expect(receiptWhere.createdAt.gte.getHours()).toBe(0);
    expect(receiptWhere.createdAt.lte.getHours()).toBe(23);
    expect(receiptWhere.patient).toBeUndefined();

    const patientWhere = mockPrismaService.patient.groupBy.mock.calls[0][0].where;
    expect(patientWhere.hospitalId).toBe('hospital-1');
    expect(patientWhere.registeredByUser).toBeUndefined();
  });

  it('narrows both sections to the registering staff member’s department', async () => {
    mockPrismaService.patient.groupBy.mockResolvedValue([]);
    mockPrismaService.receipt.findMany.mockResolvedValue([]);
    mockPrismaService.user.findMany.mockResolvedValue([]);

    await service.getRegistrationReport({ ...baseDto, departmentId: 'dept-1' });

    expect(mockPrismaService.patient.groupBy.mock.calls[0][0].where.registeredByUser).toEqual({
      departmentId: 'dept-1',
    });
    expect(mockPrismaService.receipt.findMany.mock.calls[0][0].where.patient).toEqual({
      registeredByUser: { departmentId: 'dept-1' },
    });
  });

  it('keeps a staff member who took lab money but registered nobody in the period', async () => {
    mockPrismaService.patient.groupBy.mockResolvedValue([]);
    mockPrismaService.receipt.findMany.mockResolvedValue([
      { totalAmount: 400, paidAmount: 400, patient: { registeredBy: 'staff-9' } },
    ]);
    mockPrismaService.user.findMany.mockResolvedValue([
      { id: 'staff-9', fullName: 'Sana Iqbal', role: 'REGISTRATION_STAFF', department: null },
    ]);

    const report = await service.getRegistrationReport(baseDto);

    expect(report.staff[0]).toMatchObject({
      staffName: 'Sana Iqbal',
      registrations: 0,
      labTestRevenue: 400,
      departmentId: null,
      departmentName: 'Unassigned',
    });
    expect(report.departments[0].departmentName).toBe('Unassigned');
  });

  /**
   * user.findMany serves two purposes here: the desk roster behind the staff
   * filter (asked for by role) and the names for the rows. Answer them apart so
   * a test can tell which one it is looking at.
   */
  const mockUsers = (roster: any[], rowNames: any[]) => {
    mockPrismaService.user.findMany.mockImplementation((args: any) =>
      Promise.resolve(args?.where?.role ? roster : rowNames),
    );
  };

  it('narrows both halves of the report to one staff member', async () => {
    mockPrismaService.patient.groupBy.mockResolvedValue([
      { registeredBy: 'staff-1', _count: { _all: 2 } },
    ]);
    mockPrismaService.receipt.findMany.mockResolvedValue([]);
    mockUsers([], [
      { id: 'staff-1', fullName: 'Ayesha Khan', role: 'REGISTRATION_STAFF', department: null },
    ]);

    const report = await service.getRegistrationReport({ ...baseDto, staffId: 'staff-1' });

    expect(mockPrismaService.patient.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ registeredBy: 'staff-1' }),
      }),
    );
    expect(mockPrismaService.receipt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patient: expect.objectContaining({ registeredBy: 'staff-1' }),
        }),
      }),
    );
    expect(report.filters.staffId).toBe('staff-1');
    expect(report.staff).toHaveLength(1);
  });

  it('combines the staff and department filters rather than dropping one', async () => {
    mockPrismaService.patient.groupBy.mockResolvedValue([]);
    mockPrismaService.receipt.findMany.mockResolvedValue([]);
    mockUsers([], []);

    await service.getRegistrationReport({
      ...baseDto,
      staffId: 'staff-1',
      departmentId: 'dept-1',
    });

    expect(mockPrismaService.patient.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          registeredBy: 'staff-1',
          registeredByUser: { departmentId: 'dept-1' },
        }),
      }),
    );
  });

  // Otherwise picking a staff member with a quiet day would empty the very
  // dropdown that picked them.
  it('offers the whole desk roster even when nobody registered anyone', async () => {
    mockPrismaService.patient.groupBy.mockResolvedValue([]);
    mockPrismaService.receipt.findMany.mockResolvedValue([]);
    mockUsers(
      [
        { id: 'staff-2', fullName: 'Bilal Ahmed', role: 'REGISTRATION_STAFF' },
        { id: 'staff-1', fullName: 'Ayesha Khan', role: 'REGISTRATION_STAFF' },
      ],
      [],
    );

    const report = await service.getRegistrationReport({ ...baseDto, staffId: 'staff-1' });

    expect(report.staff).toHaveLength(0);
    expect(report.staffOptions.map((option) => option.fullName)).toEqual([
      'Ayesha Khan',
      'Bilal Ahmed',
    ]);
  });

  it('adds a registrar who holds no desk role to the picker', async () => {
    mockPrismaService.patient.groupBy.mockResolvedValue([
      { registeredBy: 'admin-1', _count: { _all: 1 } },
    ]);
    mockPrismaService.receipt.findMany.mockResolvedValue([]);
    mockUsers(
      [{ id: 'staff-1', fullName: 'Ayesha Khan', role: 'REGISTRATION_STAFF' }],
      [
        {
          id: 'admin-1',
          fullName: 'Hospital Admin',
          role: 'HOSPITAL_ADMIN',
          department: null,
        },
      ],
    );

    const report = await service.getRegistrationReport(baseDto);

    expect(report.staffOptions.map((option) => option.id)).toEqual(['staff-1', 'admin-1']);
  });

  it('marks a single-day range so the UI can label it as a daily report', async () => {
    mockPrismaService.patient.groupBy.mockResolvedValue([]);
    mockPrismaService.receipt.findMany.mockResolvedValue([]);
    mockPrismaService.user.findMany.mockResolvedValue([]);

    const daily = await service.getRegistrationReport(baseDto);
    expect(daily.range.isSingleDay).toBe(true);

    const range = await service.getRegistrationReport({ ...baseDto, endDate: '2026-09-30' });
    expect(range.range.isSingleDay).toBe(false);
  });

  it('rejects a range that ends before it starts', async () => {
    await expect(
      service.getRegistrationReport({ ...baseDto, startDate: '2026-09-10', endDate: '2026-09-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockPrismaService.patient.groupBy).not.toHaveBeenCalled();
  });
});
