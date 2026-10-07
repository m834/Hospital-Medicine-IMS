import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LabOrdersService } from './lab-orders.service';
import { PrismaService } from '@/database/prisma.service';

/**
 * A super admin can delete any lab test from the Test List. The order goes
 * with its receipt, in one transaction, with a full copy kept in the audit log.
 */
describe('LabOrdersService deleting a lab order', () => {
  let service: LabOrdersService;

  const order = {
    id: 'order-1',
    hospitalId: 'hospital-1',
    orderNumber: 'LAB-20261007-0001',
    status: 'PENDING',
    slipPrintCount: 1,
    labTest: { testCode: 'CBC', testName: 'Complete Blood Count', testCategory: 'Haematology', price: 300 },
    patient: { id: 'patient-1', nrNumber: 'MRN-20261007-482913', fullName: 'Ali Khan' },
  };

  const receiptFor = (labOrderId: string, receiptNumber: string) => ({
    id: `receipt-${receiptNumber}`,
    receiptNumber,
    notes: JSON.stringify({ labOrderId, labTestId: 'test-1' }),
  });

  const prisma: any = {
    labOrder: { findUnique: jest.fn(), delete: jest.fn((args) => ({ op: 'deleteOrder', args })) },
    receipt: { findMany: jest.fn(), delete: jest.fn((args) => ({ op: 'deleteReceipt', args })) },
    auditLog: { create: jest.fn((args) => ({ op: 'audit', args })) },
    $transaction: jest.fn().mockResolvedValue([]),
  };

  const superAdmin = { id: 'admin-1', role: 'SUPER_ADMIN', hospitalId: null };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.labOrder.findUnique.mockResolvedValue(order);
    prisma.receipt.findMany.mockResolvedValue([receiptFor('order-1', 'REC-20261007-0001')]);
    prisma.$transaction.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [LabOrdersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(LabOrdersService);
  });

  it('deletes the order and its receipt together, with an audit entry', async () => {
    await expect(service.deleteOrder('order-1', superAdmin)).resolves.toEqual({
      id: 'order-1',
      orderNumber: 'LAB-20261007-0001',
      deletedReceipts: ['REC-20261007-0001'],
    });

    const [writes] = prisma.$transaction.mock.calls[0];
    expect(writes.map((w: any) => w.op)).toEqual(['deleteReceipt', 'deleteOrder', 'audit']);
    expect(prisma.receipt.delete).toHaveBeenCalledWith({ where: { id: 'receipt-REC-20261007-0001' } });
    expect(prisma.labOrder.delete).toHaveBeenCalledWith({ where: { id: 'order-1' } });
  });

  it('records who deleted what, with a full copy of the order and receipt', async () => {
    await service.deleteOrder('order-1', superAdmin);

    const audit = prisma.auditLog.create.mock.calls[0][0].data;
    expect(audit).toEqual(
      expect.objectContaining({
        userId: 'admin-1',
        action: 'DELETE',
        module: 'Lab Orders',
        entityType: 'LabOrder',
        entityId: 'order-1',
      }),
    );
    expect(audit.description).toContain('LAB-20261007-0001');
    expect(audit.description).toContain('Complete Blood Count');
    expect(audit.description).toContain('REC-20261007-0001');
    expect(audit.beforeState.order.orderNumber).toBe('LAB-20261007-0001');
    expect(audit.beforeState.receipts[0].receiptNumber).toBe('REC-20261007-0001');
  });

  it('spares a receipt that only mentions the order id without belonging to it', async () => {
    prisma.receipt.findMany.mockResolvedValue([
      receiptFor('order-1', 'REC-1'),
      { id: 'receipt-other', receiptNumber: 'REC-2', notes: 'see order-1 in the log' },
      receiptFor('order-10', 'REC-3'),
    ]);

    const result = await service.deleteOrder('order-1', superAdmin);

    expect(result.deletedReceipts).toEqual(['REC-1']);
    expect(prisma.receipt.delete).toHaveBeenCalledTimes(1);
  });

  it('still deletes an order whose receipt cannot be found, and says so', async () => {
    prisma.receipt.findMany.mockResolvedValue([]);

    await service.deleteOrder('order-1', superAdmin);

    expect(prisma.labOrder.delete).toHaveBeenCalled();
    expect(prisma.auditLog.create.mock.calls[0][0].data.description).toContain('no receipt found');
  });

  it.each(['HOSPITAL_ADMIN', 'MASTER_ADMIN', 'REGISTRATION_STAFF_MANAGER', 'REGISTRATION_STAFF', 'LAB_TECHNICIAN'])(
    'refuses %s',
    async (role) => {
      await expect(
        service.deleteOrder('order-1', { id: 'user-1', role, hospitalId: 'hospital-1' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('refuses a super admin tied to another hospital', async () => {
    await expect(
      service.deleteOrder('order-1', { ...superAdmin, hospitalId: 'hospital-2' }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an unknown order', async () => {
    prisma.labOrder.findUnique.mockResolvedValue(null);

    await expect(service.deleteOrder('order-9', superAdmin)).rejects.toThrow(NotFoundException);
  });
});
