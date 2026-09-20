import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ReceiptType } from '@prisma/client';
import { ReportsService } from './reports.service';
import { PrismaService } from '@/database/prisma.service';

describe('ReportsService.getRegistrationReport', () => {
  let service: ReportsService;

  const mockPrismaService = {
    patient: { findMany: jest.fn() },
    receipt: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
    labTest: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrismaService.labTest.findMany.mockResolvedValue([]);

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

  /**
   * Patient rows in the shape the report selects them. `registeredAt` defaults
   * to a time inside baseDto's day so the trend table has somewhere to put it.
   */
  const registered = (registeredBy: string, count: number, at = '2026-09-01T09:00:00') =>
    Array.from({ length: count }, (_, index) => ({
      id: `patient-${registeredBy}-${index}`,
      nrNumber: `MRN-${registeredBy}-${index}`,
      fullName: `Patient ${registeredBy} ${index}`,
      registeredAt: new Date(at),
      visitType: 'OPD',
      registeredBy,
    }));

  /** A LAB_TEST receipt in the shape the report selects it. */
  const labReceipt = (overrides: Partial<Record<string, any>> = {}) => ({
    totalAmount: 0,
    paidAmount: 0,
    generatedById: 'staff-1',
    description: null,
    notes: null,
    createdAt: new Date('2026-09-01T10:00:00'),
    ...overrides,
  });

  it('attributes registrations to the registrar and lab charges to the order creator', async () => {
    mockPrismaService.patient.findMany.mockResolvedValue([
      ...registered('staff-1', 3),
      ...registered('staff-2', 1),
    ]);
    mockPrismaService.receipt.findMany.mockResolvedValue([
      labReceipt({ totalAmount: 500, paidAmount: 500, generatedById: 'staff-1' }),
      labReceipt({ totalAmount: 250.5, generatedById: 'staff-1' }),
      labReceipt({ totalAmount: 100, generatedById: 'staff-2' }),
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
    mockPrismaService.patient.findMany.mockResolvedValue([]);
    mockPrismaService.receipt.findMany.mockResolvedValue([]);
    mockPrismaService.user.findMany.mockResolvedValue([]);

    await service.getRegistrationReport(baseDto);

    const receiptWhere = mockPrismaService.receipt.findMany.mock.calls[0][0].where;
    expect(receiptWhere.receiptType).toBe(ReceiptType.LAB_TEST);
    expect(receiptWhere.hospitalId).toBe('hospital-1');
    expect(receiptWhere.createdAt.gte.getHours()).toBe(0);
    expect(receiptWhere.createdAt.lte.getHours()).toBe(23);
    expect(receiptWhere.generatedById).toBeUndefined();
    expect(receiptWhere.generatedBy).toBeUndefined();

    const patientWhere = mockPrismaService.patient.findMany.mock.calls[0][0].where;
    expect(patientWhere.hospitalId).toBe('hospital-1');
    expect(patientWhere.registeredByUser).toBeUndefined();
  });

  it('narrows each section by its own staff member’s department', async () => {
    mockPrismaService.patient.findMany.mockResolvedValue([]);
    mockPrismaService.receipt.findMany.mockResolvedValue([]);
    mockPrismaService.user.findMany.mockResolvedValue([]);

    await service.getRegistrationReport({ ...baseDto, departmentId: 'dept-1' });

    expect(mockPrismaService.patient.findMany.mock.calls[0][0].where.registeredByUser).toEqual({
      departmentId: 'dept-1',
    });
    expect(mockPrismaService.receipt.findMany.mock.calls[0][0].where.generatedBy).toEqual({
      departmentId: 'dept-1',
    });
  });

  it('keeps a staff member who took lab money but registered nobody in the period', async () => {
    mockPrismaService.patient.findMany.mockResolvedValue([]);
    mockPrismaService.receipt.findMany.mockResolvedValue([
      labReceipt({ totalAmount: 400, paidAmount: 400, generatedById: 'staff-9' }),
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
    mockPrismaService.patient.findMany.mockResolvedValue(registered('staff-1', 2));
    mockPrismaService.receipt.findMany.mockResolvedValue([]);
    mockUsers([], [
      { id: 'staff-1', fullName: 'Ayesha Khan', role: 'REGISTRATION_STAFF', department: null },
    ]);

    const report = await service.getRegistrationReport({ ...baseDto, staffId: 'staff-1' });

    expect(mockPrismaService.patient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ registeredBy: 'staff-1' }),
      }),
    );
    expect(mockPrismaService.receipt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ generatedById: 'staff-1' }),
      }),
    );
    expect(report.filters.staffId).toBe('staff-1');
    expect(report.staff).toHaveLength(1);
  });

  it('combines the staff and department filters rather than dropping one', async () => {
    mockPrismaService.patient.findMany.mockResolvedValue([]);
    mockPrismaService.receipt.findMany.mockResolvedValue([]);
    mockUsers([], []);

    await service.getRegistrationReport({
      ...baseDto,
      staffId: 'staff-1',
      departmentId: 'dept-1',
    });

    expect(mockPrismaService.patient.findMany).toHaveBeenCalledWith(
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
    mockPrismaService.patient.findMany.mockResolvedValue([]);
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
    mockPrismaService.patient.findMany.mockResolvedValue(registered('admin-1', 1));
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
    mockPrismaService.patient.findMany.mockResolvedValue([]);
    mockPrismaService.receipt.findMany.mockResolvedValue([]);
    mockPrismaService.user.findMany.mockResolvedValue([]);

    const daily = await service.getRegistrationReport(baseDto);
    expect(daily.range.isSingleDay).toBe(true);

    const range = await service.getRegistrationReport({ ...baseDto, endDate: '2026-09-30' });
    expect(range.range.isSingleDay).toBe(false);
  });

  /**
   * The bug this attribution replaced: a returning patient keeps the registrar
   * they were first registered against, so crediting lab money that way hid
   * every charge the person who booked the test had just raised.
   */
  it('credits a test booked for a patient someone else registered to whoever booked it', async () => {
    mockPrismaService.patient.findMany.mockResolvedValue([]);
    mockPrismaService.receipt.findMany.mockResolvedValue([
      labReceipt({ totalAmount: 100, generatedById: 'lab-desk-1' }),
    ]);
    mockUsers([], [
      { id: 'lab-desk-1', fullName: 'Kiran Shah', role: 'RECEPTIONIST', department: null },
    ]);

    const report = await service.getRegistrationReport({ ...baseDto, staffId: 'lab-desk-1' });

    expect(mockPrismaService.receipt.findMany.mock.calls[0][0].where.generatedById).toBe(
      'lab-desk-1',
    );
    expect(report.staff[0]).toMatchObject({
      staffName: 'Kiran Shah',
      registrations: 0,
      labTestOrders: 1,
      labTestRevenue: 100,
    });
  });

  it('breaks a staff member’s lab money down per test, biggest earner first', async () => {
    mockPrismaService.patient.findMany.mockResolvedValue([]);
    mockPrismaService.receipt.findMany.mockResolvedValue([
      labReceipt({
        totalAmount: 50,
        generatedById: 'staff-1',
        notes: JSON.stringify({ labOrderId: 'order-1', labTestId: 'test-cbc' }),
      }),
      labReceipt({
        totalAmount: 50,
        generatedById: 'staff-1',
        notes: JSON.stringify({ labOrderId: 'order-2', labTestId: 'test-cbc' }),
      }),
      labReceipt({
        totalAmount: 120,
        generatedById: 'staff-1',
        notes: JSON.stringify({ labOrderId: 'order-3', labTestId: 'test-xray' }),
      }),
    ]);
    mockPrismaService.labTest.findMany.mockResolvedValue([
      { id: 'test-cbc', testName: 'CBC' },
      { id: 'test-xray', testName: 'X-Ray Chest' },
    ]);
    mockUsers([], [
      { id: 'staff-1', fullName: 'Ayesha Khan', role: 'REGISTRATION_STAFF', department: null },
    ]);

    const report = await service.getRegistrationReport(baseDto);

    expect(report.staff[0].labTestRevenue).toBe(220);
    expect(report.staff[0].tests).toEqual([
      { testName: 'X-Ray Chest', orders: 1, revenue: 120 },
      { testName: 'CBC', orders: 2, revenue: 100 },
    ]);
  });

  // Older receipts predate the ids in notes; the description still names the test.
  it('falls back to the receipt description when notes carry no test id', async () => {
    mockPrismaService.patient.findMany.mockResolvedValue([]);
    mockPrismaService.receipt.findMany.mockResolvedValue([
      labReceipt({ totalAmount: 75, generatedById: 'staff-1', description: 'Lab Test - Urine R/E' }),
      labReceipt({ totalAmount: 25, generatedById: 'staff-1', notes: 'hand written note' }),
    ]);
    mockUsers([], [
      { id: 'staff-1', fullName: 'Ayesha Khan', role: 'REGISTRATION_STAFF', department: null },
    ]);

    const report = await service.getRegistrationReport(baseDto);

    expect(mockPrismaService.labTest.findMany).not.toHaveBeenCalled();
    expect(report.staff[0].tests).toEqual([
      { testName: 'Urine R/E', orders: 1, revenue: 75 },
      { testName: 'Unnamed test', orders: 1, revenue: 25 },
    ]);
  });

  it('groups lab money by test category, biggest category first', async () => {
    mockPrismaService.patient.findMany.mockResolvedValue([]);
    mockPrismaService.receipt.findMany.mockResolvedValue([
      labReceipt({ totalAmount: 50, notes: JSON.stringify({ labTestId: 'test-cbc' }) }),
      labReceipt({ totalAmount: 50, notes: JSON.stringify({ labTestId: 'test-cbc' }) }),
      labReceipt({ totalAmount: 30, notes: JSON.stringify({ labTestId: 'test-lft' }) }),
      labReceipt({ totalAmount: 400, notes: JSON.stringify({ labTestId: 'test-xray' }) }),
    ]);
    mockPrismaService.labTest.findMany.mockResolvedValue([
      { id: 'test-cbc', testName: 'CBC', testCategory: 'Hematology' },
      { id: 'test-lft', testName: 'LFT', testCategory: 'Hematology' },
      { id: 'test-xray', testName: 'X-Ray Chest', testCategory: 'Radiology' },
    ]);
    mockUsers([], [
      { id: 'staff-1', fullName: 'Ayesha Khan', role: 'REGISTRATION_STAFF', department: null },
    ]);

    const report = await service.getRegistrationReport(baseDto);

    expect(report.categories).toEqual([
      {
        category: 'Radiology',
        orders: 1,
        revenue: 400,
        tests: [{ testName: 'X-Ray Chest', orders: 1, revenue: 400 }],
      },
      {
        category: 'Hematology',
        orders: 3,
        revenue: 130,
        tests: [
          { testName: 'CBC', orders: 2, revenue: 100 },
          { testName: 'LFT', orders: 1, revenue: 30 },
        ],
      },
    ]);
  });

  it('files a test with no category of its own under Uncategorised', async () => {
    mockPrismaService.patient.findMany.mockResolvedValue([]);
    mockPrismaService.receipt.findMany.mockResolvedValue([
      labReceipt({ totalAmount: 20, notes: JSON.stringify({ labTestId: 'test-blank' }) }),
    ]);
    mockPrismaService.labTest.findMany.mockResolvedValue([
      { id: 'test-blank', testName: 'Sugar Random', testCategory: '  ' },
    ]);
    mockUsers([], [
      { id: 'staff-1', fullName: 'Ayesha Khan', role: 'REGISTRATION_STAFF', department: null },
    ]);

    const report = await service.getRegistrationReport(baseDto);

    expect(report.categories[0].category).toBe('Uncategorised');
  });

  it('reports every day of the range, quiet days included', async () => {
    mockPrismaService.patient.findMany.mockResolvedValue([
      ...registered('staff-1', 2, '2026-09-01T09:00:00'),
      ...registered('staff-1', 1, '2026-09-03T18:30:00'),
    ]);
    mockPrismaService.receipt.findMany.mockResolvedValue([
      labReceipt({ totalAmount: 100, createdAt: new Date('2026-09-03T11:00:00') }),
    ]);
    mockUsers([], [
      { id: 'staff-1', fullName: 'Ayesha Khan', role: 'REGISTRATION_STAFF', department: null },
    ]);

    const report = await service.getRegistrationReport({ ...baseDto, endDate: '2026-09-03' });

    expect(report.daily).toEqual([
      { date: '2026-09-01', registrations: 2, labTestOrders: 0, labTestRevenue: 0 },
      { date: '2026-09-02', registrations: 0, labTestOrders: 0, labTestRevenue: 0 },
      { date: '2026-09-03', registrations: 1, labTestOrders: 1, labTestRevenue: 100 },
    ]);
  });

  it('lists the patients behind the registration count, newest first', async () => {
    mockPrismaService.patient.findMany.mockResolvedValue(registered('staff-1', 2));
    mockPrismaService.receipt.findMany.mockResolvedValue([]);
    mockUsers([], [
      { id: 'staff-1', fullName: 'Ayesha Khan', role: 'REGISTRATION_STAFF', department: null },
    ]);

    const report = await service.getRegistrationReport(baseDto);

    expect(mockPrismaService.patient.findMany.mock.calls[0][0].orderBy).toEqual({
      registeredAt: 'desc',
    });
    expect(report.patientsTruncated).toBe(false);
    expect(report.patients).toHaveLength(2);
    expect(report.patients[0]).toMatchObject({
      nrNumber: 'MRN-staff-1-0',
      fullName: 'Patient staff-1 0',
      visitType: 'OPD',
      staffId: 'staff-1',
      staffName: 'Ayesha Khan',
    });
  });

  it('caps the patient list and says so rather than returning a month of rows', async () => {
    mockPrismaService.patient.findMany.mockResolvedValue(registered('staff-1', 501));
    mockPrismaService.receipt.findMany.mockResolvedValue([]);
    mockUsers([], [
      { id: 'staff-1', fullName: 'Ayesha Khan', role: 'REGISTRATION_STAFF', department: null },
    ]);

    const report = await service.getRegistrationReport(baseDto);

    expect(report.patients).toHaveLength(500);
    expect(report.patientsTruncated).toBe(true);
    // The count itself is not capped — it is read off every row.
    expect(report.totals.registrations).toBe(501);
  });

  it('rejects a range that ends before it starts', async () => {
    await expect(
      service.getRegistrationReport({ ...baseDto, startDate: '2026-09-10', endDate: '2026-09-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockPrismaService.patient.findMany).not.toHaveBeenCalled();
  });
});
