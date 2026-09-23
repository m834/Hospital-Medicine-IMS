import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { LabOrdersService } from './lab-orders.service';
import { PrismaService } from '../../database/prisma.service';

/**
 * Booking a lab order on a past date. The rules being pinned here are the ones
 * that keep a backdated order honest: who may do it, that it cannot reach into
 * the future, that everything dated follows the booking date rather than the
 * clock, and that it is always logged.
 */
describe('LabOrdersService.create — backdating', () => {
  let service: LabOrdersService;

  const tx = {
    labOrder: { create: jest.fn() },
    receipt: { create: jest.fn(), findFirst: jest.fn() },
    auditLog: { create: jest.fn() },
  };

  const mockPrismaService = {
    labOrder: { findFirst: jest.fn() },
    labTest: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    patient: { findFirst: jest.fn() },
    $transaction: jest.fn((fn: any) => fn(tx)),
  };

  const manager = { id: 'manager-1', role: 'REGISTRATION_STAFF_MANAGER' };
  const deskStaff = { id: 'staff-1', role: 'REGISTRATION_STAFF' };

  const dto = {
    hospitalId: '11111111-1111-1111-1111-111111111111',
    patientId: '22222222-2222-2222-2222-222222222222',
    labTestId: '33333333-3333-3333-3333-333333333333',
    orderedById: 'manager-1',
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPrismaService.labOrder.findFirst.mockResolvedValue(null);
    mockPrismaService.labTest.findUnique.mockResolvedValue({
      id: dto.labTestId,
      testName: 'CBC',
      price: 50,
      departmentId: null,
    });
    mockPrismaService.user.findUnique.mockResolvedValue({ departmentId: null });
    tx.receipt.findFirst.mockResolvedValue(null);
    tx.labOrder.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'order-1', ...data }),
    );
    tx.receipt.create.mockResolvedValue({});
    tx.auditLog.create.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [LabOrdersService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<LabOrdersService>(LabOrdersService);
  });

  const yesterday = () => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().slice(0, 10);
  };

  const stamp = (date: Date) => {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}`;
  };

  it('books the order on the requested date for a registration manager', async () => {
    await service.create({ ...dto, orderedAt: yesterday() }, manager);

    const created = tx.labOrder.create.mock.calls[0][0].data;
    const expected = new Date();
    expected.setDate(expected.getDate() - 1);

    expect(stamp(created.createdAt)).toBe(stamp(expected));
    // The DTO's own field is not a column on the row.
    expect(created.orderedAt).toBeUndefined();
  });

  it('refuses a backdate from desk staff', async () => {
    await expect(service.create({ ...dto, orderedAt: yesterday() }, deskStaff)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
  });

  it('refuses a backdate when no user is attached to the request', async () => {
    await expect(service.create({ ...dto, orderedAt: yesterday() })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses a future date even from a manager', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await expect(
      service.create({ ...dto, orderedAt: tomorrow.toISOString().slice(0, 10) }, manager),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses today when no date is asked for, and audits nothing', async () => {
    await service.create(dto, deskStaff);

    const created = tx.labOrder.create.mock.calls[0][0].data;
    expect(stamp(created.createdAt)).toBe(stamp(new Date()));
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  // Otherwise the slip carries today's number while the order sits in
  // yesterday, and the day's paperwork no longer matches the system.
  it('numbers the order and the receipt on the backdated day', async () => {
    await service.create({ ...dto, orderedAt: yesterday() }, manager);

    const expected = new Date();
    expected.setDate(expected.getDate() - 1);

    expect(tx.labOrder.create.mock.calls[0][0].data.orderNumber).toContain(`LAB-${stamp(expected)}`);
    expect(tx.receipt.create.mock.calls[0][0].data.receiptNumber).toContain(
      `REC-${stamp(expected)}`,
    );
  });

  // The revenue reports date receipts by createdAt, so a receipt left on today
  // would split one piece of work across two days.
  it('dates the receipt to the same day as its order', async () => {
    await service.create({ ...dto, orderedAt: yesterday() }, manager);

    const orderDate = tx.labOrder.create.mock.calls[0][0].data.createdAt;
    expect(tx.receipt.create.mock.calls[0][0].data.createdAt).toEqual(orderDate);
  });

  it('writes an audit entry naming the day, the entry time and the money', async () => {
    await service.create({ ...dto, orderedAt: yesterday() }, manager);

    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    const entry = tx.auditLog.create.mock.calls[0][0].data;

    expect(entry).toMatchObject({
      action: 'BACKDATE',
      module: 'Lab Orders',
      entityType: 'LabOrder',
      entityId: 'order-1',
      userId: 'manager-1',
      hospitalId: dto.hospitalId,
    });
    expect(entry.description).toContain('CBC');
    expect(entry.description).toContain('REGISTRATION_STAFF_MANAGER');
    expect(entry.afterState).toMatchObject({ amount: 50, backdatedByDays: 1, testName: 'CBC' });
    expect(entry.beforeState.requestedDate).toBe(yesterday());
  });

  // The order and its log are one unit of work: an order cannot be committed
  // without the entry that records it was backdated.
  it('writes the audit entry inside the order transaction', async () => {
    await service.create({ ...dto, orderedAt: yesterday() }, manager);

    expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    // tx is the transactional client handed to the callback, not this.prisma.
    expect(tx.auditLog.create).toHaveBeenCalled();
  });
});
