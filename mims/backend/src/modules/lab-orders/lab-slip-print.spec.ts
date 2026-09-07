import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LabOrdersService } from './lab-orders.service';
import { PrismaService } from '@/database/prisma.service';

/**
 * A lab slip drops into a slot on a pre-printed A4 form, so it is worth exactly
 * one print. These cover who gets a second one.
 */
describe('LabOrdersService slip printing', () => {
  let service: LabOrdersService;

  const order = (overrides: Partial<any> = {}) => ({
    id: 'order-1',
    hospitalId: 'hospital-1',
    orderNumber: 'LAB-20260907-0001',
    slipPrintCount: 0,
    labTest: { testName: 'Complete Blood Count' },
    ...overrides,
  });

  const mockPrismaService = {
    labOrder: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn().mockResolvedValue([]),
  };

  const staff = { id: 'user-1', role: 'REGISTRATION_STAFF', hospitalId: 'hospital-1' };
  const manager = {
    id: 'user-2',
    role: 'REGISTRATION_STAFF_MANAGER',
    hospitalId: 'hospital-1',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrismaService.$transaction.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LabOrdersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<LabOrdersService>(LabOrdersService);
  });

  it('lets any staff member take the first print', async () => {
    mockPrismaService.labOrder.findMany.mockResolvedValue([order()]);

    const result = await service.recordSlipPrints(['order-1'], staff);

    expect(result[0].slipPrintCount).toBe(1);
    expect(mockPrismaService.labOrder.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['order-1'] } },
      data: expect.objectContaining({ slipPrintCount: { increment: 1 } }),
    });
  });

  it('refuses a second print to ordinary staff', async () => {
    mockPrismaService.labOrder.findMany.mockResolvedValue([
      order({ slipPrintCount: 1 }),
    ]);

    await expect(service.recordSlipPrints(['order-1'], staff)).rejects.toThrow(
      ForbiddenException,
    );
    expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
  });

  it('lets a registration staff manager reprint', async () => {
    mockPrismaService.labOrder.findMany.mockResolvedValue([
      order({ slipPrintCount: 1 }),
    ]);

    const result = await service.recordSlipPrints(['order-1'], manager);

    expect(result[0].slipPrintCount).toBe(2);
  });

  it.each(['MASTER_ADMIN', 'SUPER_ADMIN', 'HOSPITAL_ADMIN'])(
    'lets a %s reprint',
    async (role) => {
      mockPrismaService.labOrder.findMany.mockResolvedValue([
        order({ slipPrintCount: 3 }),
      ]);

      await expect(
        service.recordSlipPrints(['order-1'], { id: 'admin', role, hospitalId: null }),
      ).resolves.toHaveLength(1);
    },
  );

  it('logs the reprint as REPRINT, naming the print number', async () => {
    mockPrismaService.labOrder.findMany.mockResolvedValue([
      order({ slipPrintCount: 1 }),
    ]);

    await service.recordSlipPrints(['order-1'], manager);

    expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'REPRINT',
        userId: 'user-2',
        entityType: 'LabOrder',
        entityId: 'order-1',
        description: expect.stringContaining('print #2'),
      }),
    });
  });

  it('logs the first print as PRINT', async () => {
    mockPrismaService.labOrder.findMany.mockResolvedValue([order()]);

    await service.recordSlipPrints(['order-1'], staff);

    expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'PRINT' }),
    });
  });

  // One order of six tests is six slips; a refusal on any of them holds back the
  // whole set rather than sending half of it to the printer.
  it('refuses the whole set when one slip is already printed', async () => {
    mockPrismaService.labOrder.findMany.mockResolvedValue([
      order(),
      order({ id: 'order-2', orderNumber: 'LAB-20260907-0002', slipPrintCount: 1 }),
    ]);

    await expect(
      service.recordSlipPrints(['order-1', 'order-2'], staff),
    ).rejects.toThrow(/LAB-20260907-0002/);
    expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
  });

  it('refuses a slip belonging to another hospital', async () => {
    mockPrismaService.labOrder.findMany.mockResolvedValue([
      order({ hospitalId: 'hospital-2' }),
    ]);

    await expect(service.recordSlipPrints(['order-1'], staff)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects an unknown order', async () => {
    mockPrismaService.labOrder.findMany.mockResolvedValue([]);

    await expect(service.recordSlipPrints(['order-1'], staff)).rejects.toThrow(
      NotFoundException,
    );
  });
});
