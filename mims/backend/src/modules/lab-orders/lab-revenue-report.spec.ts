import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ReceiptType } from '@prisma/client';
import { LabOrdersService } from './lab-orders.service';
import { PrismaService } from '../../database/prisma.service';

describe('LabOrdersService.getRevenueReport', () => {
  let service: LabOrdersService;

  const mockPrismaService = {
    labOrder: { findMany: jest.fn() },
    receipt: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [LabOrdersService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<LabOrdersService>(LabOrdersService);
  });

  /** A lab order in the shape the revenue report selects it. */
  const order = (overrides: Record<string, any> = {}) => ({
    id: 'order-1',
    orderedById: 'staff-1',
    labTest: { testName: 'CBC', testCategory: 'Hematology', price: 50 },
    orderedBy: { id: 'staff-1', fullName: 'Ayesha Khan', role: 'REGISTRATION_STAFF' },
    ...overrides,
  });

  /** A LAB_TEST receipt, linked to its order the only way it can be. */
  const receipt = (labOrderId: string, totalAmount: number) => ({
    totalAmount,
    notes: JSON.stringify({ labOrderId, labTestId: 'test-1' }),
  });

  it('groups tests by category with a subtotal and a grand total', async () => {
    mockPrismaService.labOrder.findMany.mockResolvedValue([
      order({ id: 'o1' }),
      order({ id: 'o2' }),
      order({
        id: 'o3',
        labTest: { testName: 'X-Ray Chest', testCategory: 'Radiology', price: 400 },
      }),
    ]);
    mockPrismaService.receipt.findMany.mockResolvedValue([
      receipt('o1', 50),
      receipt('o2', 50),
      receipt('o3', 400),
    ]);

    const report = await service.getRevenueReport('hospital-1');

    expect(report.categories).toEqual([
      {
        category: 'Radiology',
        quantity: 1,
        subtotal: 400,
        tests: [{ testName: 'X-Ray Chest', unitPrice: 400, quantity: 1, total: 400 }],
      },
      {
        category: 'Hematology',
        quantity: 2,
        subtotal: 100,
        tests: [{ testName: 'CBC', unitPrice: 50, quantity: 2, total: 100 }],
      },
    ]);
    expect(report.grandTotal).toBe(500);
    expect(report.totalQuantity).toBe(3);
  });

  // Quantity is a count of orders: there is no quantity column to read.
  it('counts one order as one test', async () => {
    mockPrismaService.labOrder.findMany.mockResolvedValue([
      order({ id: 'o1' }),
      order({ id: 'o2' }),
      order({ id: 'o3' }),
    ]);
    mockPrismaService.receipt.findMany.mockResolvedValue([]);

    const report = await service.getRevenueReport('hospital-1');

    expect(report.categories[0].tests[0]).toEqual({
      testName: 'CBC',
      unitPrice: 50,
      quantity: 3,
      total: 150,
    });
  });

  it('charges what the receipt says, not what the catalogue says today', async () => {
    mockPrismaService.labOrder.findMany.mockResolvedValue([order({ id: 'o1' })]);
    // The catalogue has since been repriced to 50; the slip was 30.
    mockPrismaService.receipt.findMany.mockResolvedValue([receipt('o1', 30)]);

    const report = await service.getRevenueReport('hospital-1');

    expect(report.categories[0].tests[0]).toMatchObject({ unitPrice: 30, total: 30 });
  });

  /**
   * Otherwise Quantity x Test Price would not equal Total Price on the printed
   * line, and the report would not add up in front of the manager.
   */
  it('splits a test repriced mid-range onto one row per price', async () => {
    mockPrismaService.labOrder.findMany.mockResolvedValue([
      order({ id: 'o1' }),
      order({ id: 'o2' }),
      order({ id: 'o3' }),
    ]);
    mockPrismaService.receipt.findMany.mockResolvedValue([
      receipt('o1', 30),
      receipt('o2', 30),
      receipt('o3', 50),
    ]);

    const report = await service.getRevenueReport('hospital-1');

    expect(report.categories[0].tests).toEqual([
      { testName: 'CBC', unitPrice: 30, quantity: 2, total: 60 },
      { testName: 'CBC', unitPrice: 50, quantity: 1, total: 50 },
    ]);
    expect(report.categories[0].subtotal).toBe(110);
  });

  it('falls back to the catalogue price when an order has no receipt', async () => {
    mockPrismaService.labOrder.findMany.mockResolvedValue([order({ id: 'o1' })]);
    mockPrismaService.receipt.findMany.mockResolvedValue([]);

    const report = await service.getRevenueReport('hospital-1');

    expect(report.categories[0].tests[0]).toMatchObject({ unitPrice: 50, total: 50 });
  });

  it('files a test with no category under Uncategorised', async () => {
    mockPrismaService.labOrder.findMany.mockResolvedValue([
      order({ labTest: { testName: 'Sugar Random', testCategory: '  ', price: 20 } }),
    ]);
    mockPrismaService.receipt.findMany.mockResolvedValue([]);

    const report = await service.getRevenueReport('hospital-1');

    expect(report.categories[0].category).toBe('Uncategorised');
  });

  it('counts the tests each resource created, busiest first', async () => {
    mockPrismaService.labOrder.findMany.mockResolvedValue([
      order({ id: 'o1', orderedById: 'staff-1' }),
      order({
        id: 'o2',
        orderedById: 'staff-2',
        orderedBy: { id: 'staff-2', fullName: 'Bilal Ahmed', role: 'RECEPTIONIST' },
      }),
      order({ id: 'o3', orderedById: 'staff-1' }),
    ]);
    mockPrismaService.receipt.findMany.mockResolvedValue([]);

    const report = await service.getRevenueReport('hospital-1');

    expect(report.resources).toEqual([
      { resourceId: 'staff-1', resourceName: 'Ayesha Khan', role: 'REGISTRATION_STAFF', tests: 2 },
      { resourceId: 'staff-2', resourceName: 'Bilal Ahmed', role: 'RECEPTIONIST', tests: 1 },
    ]);
  });

  // Revenue is raised when the slip is created, so an unapproved order still
  // counts — the money was taken at the counter either way.
  it('counts every order in the range, whatever its status', async () => {
    mockPrismaService.labOrder.findMany.mockResolvedValue([]);
    mockPrismaService.receipt.findMany.mockResolvedValue([]);

    await service.getRevenueReport('hospital-1');

    const where = mockPrismaService.labOrder.findMany.mock.calls[0][0].where;
    expect(where.status).toBeUndefined();
    expect(where.hospitalId).toBe('hospital-1');
  });

  it('widens a day range to cover the whole closing day', async () => {
    mockPrismaService.labOrder.findMany.mockResolvedValue([]);
    mockPrismaService.receipt.findMany.mockResolvedValue([]);

    await service.getRevenueReport(
      'hospital-1',
      new Date('2026-09-01'),
      new Date('2026-09-21'),
    );

    const where = mockPrismaService.labOrder.findMany.mock.calls[0][0].where;
    expect(where.createdAt.gte.getHours()).toBe(0);
    expect(where.createdAt.lte.getHours()).toBe(23);

    const receiptWhere = mockPrismaService.receipt.findMany.mock.calls[0][0].where;
    expect(receiptWhere.receiptType).toBe(ReceiptType.LAB_TEST);
    expect(receiptWhere.createdAt.lte.getHours()).toBe(23);
  });

  it('reports the whole history when no range is given', async () => {
    mockPrismaService.labOrder.findMany.mockResolvedValue([]);
    mockPrismaService.receipt.findMany.mockResolvedValue([]);

    await service.getRevenueReport('hospital-1');

    expect(mockPrismaService.labOrder.findMany.mock.calls[0][0].where.createdAt).toBeUndefined();
  });

  it('rejects a range that ends before it starts', async () => {
    await expect(
      service.getRevenueReport('hospital-1', new Date('2026-09-21'), new Date('2026-09-01')),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockPrismaService.labOrder.findMany).not.toHaveBeenCalled();
  });

  // A registration staff member works one desk; the list on the same tab is
  // already scoped that way, and the revenue beside it must match.
  it('scopes a self-scoped role to their own orders', async () => {
    mockPrismaService.labOrder.findMany.mockResolvedValue([]);
    mockPrismaService.receipt.findMany.mockResolvedValue([]);

    await service.getRevenueReport('hospital-1', undefined, undefined, {
      id: 'staff-9',
      role: 'REGISTRATION_STAFF',
    });

    expect(mockPrismaService.labOrder.findMany.mock.calls[0][0].where.orderedById).toBe('staff-9');
  });

  it('shows the whole desk to a manager', async () => {
    mockPrismaService.labOrder.findMany.mockResolvedValue([]);
    mockPrismaService.receipt.findMany.mockResolvedValue([]);

    await service.getRevenueReport('hospital-1', undefined, undefined, {
      id: 'manager-1',
      role: 'REGISTRATION_STAFF_MANAGER',
    });

    expect(
      mockPrismaService.labOrder.findMany.mock.calls[0][0].where.orderedById,
    ).toBeUndefined();
  });
});
