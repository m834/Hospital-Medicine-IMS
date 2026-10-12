import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LabOrdersService } from './lab-orders.service';
import { PrismaService } from '@/database/prisma.service';

/**
 * New Order books every test for a patient in one request: one order and one
 * receipt per test, all in one transaction, retried with fresh numbers when
 * another desk took the same number first.
 */
describe('LabOrdersService booking several tests at once', () => {
  let service: LabOrdersService;

  const labTest = (id: string, name: string, price: number) => ({
    id,
    hospitalId: 'hospital-1',
    testName: name,
    price,
    departmentId: null,
  });

  const tx: any = {
    labOrder: { findFirst: jest.fn(), create: jest.fn() },
    receipt: { findFirst: jest.fn(), create: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  const prisma: any = {
    patient: { findFirst: jest.fn() },
    labTest: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    visit: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };

  const dto = {
    hospitalId: 'hospital-1',
    patientId: '11111111-1111-4111-8111-111111111111',
    orderedById: 'user-1',
    clinicalNotes: 'fasting',
    tests: [
      { labTestId: 'test-cbc', priority: 'ROUTINE' as any },
      { labTestId: 'test-lft', priority: 'URGENT' as any },
    ],
  };
  const desk = { id: 'user-1', role: 'REGISTRATION_STAFF' };
  const manager = { id: 'user-2', role: 'REGISTRATION_STAFF_MANAGER' };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((fn: (t: any) => any) => fn(tx));
    prisma.labTest.findMany.mockResolvedValue([
      labTest('test-cbc', 'Complete Blood Count', 300),
      labTest('test-lft', 'Liver Function Test', 450),
    ]);
    prisma.user.findUnique.mockResolvedValue({ departmentId: 'dept-lab' });
    tx.labOrder.findFirst.mockResolvedValue({ orderNumber: 'LAB-20261008-0007' });
    tx.receipt.findFirst.mockResolvedValue({ receiptNumber: 'REC-20261008-0041' });
    tx.labOrder.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: `order-${data.orderNumber}`, ...data }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [LabOrdersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(LabOrdersService);
  });

  it('books every test, each with its own receipt, in one transaction', async () => {
    const orders = await service.createBatch(dto, desk);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(orders).toHaveLength(2);
    expect(tx.labOrder.create).toHaveBeenCalledTimes(2);
    expect(tx.receipt.create).toHaveBeenCalledTimes(2);
  });

  it('numbers the orders one after another from the day’s last order', async () => {
    const orders = await service.createBatch(dto, desk);

    expect(orders.map((o: any) => o.orderNumber)).toEqual([
      expect.stringMatching(/^LAB-\d{8}-0008$/),
      expect.stringMatching(/^LAB-\d{8}-0009$/),
    ]);
  });

  it('keeps each test’s own priority and price', async () => {
    await service.createBatch(dto, desk);

    expect(tx.labOrder.create.mock.calls.map(([a]: any) => [a.data.labTestId, a.data.priority])).toEqual([
      ['test-cbc', 'ROUTINE'],
      ['test-lft', 'URGENT'],
    ]);
    expect(tx.receipt.create.mock.calls.map(([a]: any) => Number(a.data.totalAmount))).toEqual([300, 450]);
    // Each receipt names its own order, which revenue and delete rely on.
    const secondOrderNumber = tx.labOrder.create.mock.calls[1][0].data.orderNumber;
    expect(JSON.parse(tx.receipt.create.mock.calls[1][0].data.notes).labOrderId).toBe(
      `order-${secondOrderNumber}`,
    );
  });

  it('retries with fresh numbers when another desk took the same one', async () => {
    const clash = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });
    prisma.$transaction
      .mockImplementationOnce(() => Promise.reject(clash))
      .mockImplementation((fn: (t: any) => any) => fn(tx));

    await expect(service.createBatch(dto, desk)).resolves.toHaveLength(2);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('gives up after three clashes rather than looping', async () => {
    const clash = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });
    prisma.$transaction.mockRejectedValue(clash);

    await expect(service.createBatch(dto, desk)).rejects.toBe(clash);
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it('refuses the same test twice', async () => {
    await expect(
      service.createBatch({ ...dto, tests: [dto.tests[0], dto.tests[0]] }, desk),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses an unknown test before saving anything', async () => {
    prisma.labTest.findMany.mockResolvedValue([labTest('test-cbc', 'Complete Blood Count', 300)]);

    await expect(service.createBatch(dto, desk)).rejects.toThrow(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses a test from another hospital', async () => {
    prisma.labTest.findMany.mockResolvedValue([
      labTest('test-cbc', 'Complete Blood Count', 300),
      { ...labTest('test-lft', 'Liver Function Test', 450), hospitalId: 'hospital-2' },
    ]);

    await expect(service.createBatch(dto, desk)).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('resolves a patient given by MRN', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'patient-9' });

    await service.createBatch({ ...dto, patientId: '482913' }, desk);

    expect(tx.labOrder.create.mock.calls[0][0].data.patientId).toBe('patient-9');
  });

  describe('backdating, same rules as a single order', () => {
    const yesterday = () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().slice(0, 10);
    };

    it('refuses a backdate from desk staff', async () => {
      await expect(service.createBatch({ ...dto, orderedAt: yesterday() }, desk)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('lets a manager backdate, auditing every test', async () => {
      await service.createBatch({ ...dto, orderedAt: yesterday() }, manager);

      expect(tx.auditLog.create).toHaveBeenCalledTimes(2);
      expect(tx.auditLog.create.mock.calls[0][0].data.action).toBe('BACKDATE');
    });

    it('audits nothing when booked today', async () => {
      await service.createBatch(dto, desk);

      expect(tx.auditLog.create).not.toHaveBeenCalled();
    });
  });
});

describe('CreateLabOrderBatchDto', () => {
  // Mirrors the global ValidationPipe: whitelist + forbidNonWhitelisted + transform.
  const { plainToInstance } = require('class-transformer');
  const { validate } = require('class-validator');
  const { CreateLabOrderBatchDto } = require('./dto/create-lab-order-batch.dto');

  const check = async (body: object) =>
    validate(plainToInstance(CreateLabOrderBatchDto, body), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

  const body = {
    hospitalId: '11111111-1111-4111-8111-111111111111',
    patientId: '22222222-2222-4222-8222-222222222222',
    orderedById: '33333333-3333-4333-8333-333333333333',
    clinicalNotes: '',
    tests: [
      { labTestId: '44444444-4444-4444-8444-444444444444', priority: 'ROUTINE' },
      { labTestId: '55555555-5555-4555-8555-555555555555', priority: 'STAT' },
    ],
  };

  it('accepts what New Order sends', async () => {
    expect(await check(body)).toHaveLength(0);
  });

  it('accepts a manager’s backdate', async () => {
    expect(await check({ ...body, orderedAt: '2026-10-07' })).toHaveLength(0);
  });

  it('rejects an order with no tests', async () => {
    expect((await check({ ...body, tests: [] })).length).toBeGreaterThan(0);
  });

  it('rejects a bad test id or priority inside the list', async () => {
    expect((await check({ ...body, tests: [{ labTestId: 'x', priority: 'ROUTINE' }] })).length).toBeGreaterThan(0);
    expect((await check({ ...body, tests: [{ ...body.tests[0], priority: 'SOON' }] })).length).toBeGreaterThan(0);
  });

  it('rejects an unknown field, as the server does', async () => {
    expect((await check({ ...body, price: 0 })).length).toBeGreaterThan(0);
  });
});
