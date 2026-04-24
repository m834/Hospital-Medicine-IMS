import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ReceiptsService } from './receipts.service';
import { PrismaService } from '@/database/prisma.service';
import { PaymentStatus, PaymentMethod, ReceiptType } from '@prisma/client';

describe('ReceiptsService', () => {
  let service: ReceiptsService;
  let prisma: PrismaService;

  const mockPatient = {
    id: 'patient-1',
    fullName: 'John Patient',
    nrNumber: 'MRN-2026-0001',
  };

  const mockHospital = {
    id: 'hospital-1',
    name: 'Test Hospital',
  };

  const mockDepartment = {
    id: 'dept-1',
    name: 'Cardiology',
  };

  const mockGeneratedBy = {
    id: 'staff-1',
    fullName: 'Staff Member',
    email: 'staff@hospital.com',
  };

  const mockReceipt = {
    id: 'receipt-1',
    hospitalId: 'hospital-1',
    patientId: 'patient-1',
    visitId: 'visit-1',
    departmentId: 'dept-1',
    generatedById: 'staff-1',
    receiptNumber: 'REC-20260119-0001',
    receiptType: ReceiptType.OPD_CONSULTATION,
    description: 'Consultation fee',
    amount: 500,
    discount: 0,
    tax: 0,
    totalAmount: 500,
    paymentMethod: PaymentMethod.CASH,
    paymentStatus: PaymentStatus.UNPAID,
    createdAt: new Date(),
    updatedAt: new Date(),
    hospital: mockHospital,
    patient: mockPatient,
    department: mockDepartment,
    generatedBy: mockGeneratedBy,
  };

  const mockPrismaService = {
    patient: {
      findUnique: jest.fn(),
    },
    receipt: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiptsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ReceiptsService>(ReceiptsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      hospitalId: 'hospital-1',
      patientId: 'patient-1',
      visitId: 'visit-1',
      departmentId: 'dept-1',
      generatedById: 'staff-1',
      receiptType: ReceiptType.OPD_CONSULTATION,
      description: 'Consultation fee',
      amount: 500,
    };

    it('should create a new receipt successfully', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockPrismaService.receipt.findFirst.mockResolvedValue(null);
      mockPrismaService.receipt.create.mockResolvedValue(mockReceipt);

      const result = await service.create(createDto);

      expect(result).toEqual(mockReceipt);
      expect(result.receiptNumber).toMatch(/^REC-\d{8}-\d{4}$/);
      expect(prisma.receipt.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if patient not found', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should calculate total amount correctly', async () => {
      const dtoWithDiscountAndTax = {
        ...createDto,
        amount: 500,
        discount: 50,
        tax: 25,
      };
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockPrismaService.receipt.findFirst.mockResolvedValue(null);
      mockPrismaService.receipt.create.mockImplementation(({ data }) => ({
        ...mockReceipt,
        ...data,
        totalAmount: data.totalAmount,
      }));

      const result = await service.create(dtoWithDiscountAndTax);

      // totalAmount = amount - discount + tax = 500 - 50 + 25 = 475
      expect(prisma.receipt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalAmount: 475,
          }),
        }),
      );
    });

    it('should increment receipt number from last receipt', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockPrismaService.receipt.findFirst.mockResolvedValue({
        receiptNumber: 'REC-20260119-0010',
      });
      mockPrismaService.receipt.create.mockResolvedValue({
        ...mockReceipt,
        receiptNumber: 'REC-20260119-0011',
      });

      const result = await service.create(createDto);

      expect(prisma.receipt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            receiptNumber: expect.stringMatching(/^REC-\d{8}-0011$/),
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated receipts', async () => {
      mockPrismaService.receipt.findMany.mockResolvedValue([mockReceipt]);
      mockPrismaService.receipt.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual([mockReceipt]);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should filter by paymentStatus', async () => {
      mockPrismaService.receipt.findMany.mockResolvedValue([mockReceipt]);
      mockPrismaService.receipt.count.mockResolvedValue(1);

      await service.findAll({ paymentStatus: PaymentStatus.PAID });

      expect(prisma.receipt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            paymentStatus: PaymentStatus.PAID,
          }),
        }),
      );
    });

    it('should filter by receiptType', async () => {
      mockPrismaService.receipt.findMany.mockResolvedValue([mockReceipt]);
      mockPrismaService.receipt.count.mockResolvedValue(1);

      await service.findAll({ receiptType: ReceiptType.OPD_CONSULTATION });

      expect(prisma.receipt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            receiptType: ReceiptType.OPD_CONSULTATION,
          }),
        }),
      );
    });

    it('should filter by date range', async () => {
      mockPrismaService.receipt.findMany.mockResolvedValue([mockReceipt]);
      mockPrismaService.receipt.count.mockResolvedValue(1);

      await service.findAll({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      expect(prisma.receipt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a receipt by id', async () => {
      mockPrismaService.receipt.findUnique.mockResolvedValue(mockReceipt);

      const result = await service.findOne('receipt-1');

      expect(result).toEqual(mockReceipt);
    });

    it('should throw NotFoundException if receipt not found', async () => {
      mockPrismaService.receipt.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByReceiptNumber', () => {
    it('should return a receipt by number', async () => {
      mockPrismaService.receipt.findUnique.mockResolvedValue(mockReceipt);

      const result = await service.findByReceiptNumber('REC-20260119-0001');

      expect(result).toEqual(mockReceipt);
    });

    it('should throw NotFoundException if receipt not found', async () => {
      mockPrismaService.receipt.findUnique.mockResolvedValue(null);

      await expect(
        service.findByReceiptNumber('REC-INVALID'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByPatient', () => {
    it('should return receipts for a patient', async () => {
      mockPrismaService.receipt.findMany.mockResolvedValue([mockReceipt]);

      const result = await service.findByPatient('patient-1', 10);

      expect(result).toEqual([mockReceipt]);
      expect(prisma.receipt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { patientId: 'patient-1' },
          take: 10,
        }),
      );
    });
  });

  describe('markAsPaid', () => {
    it('should mark receipt as paid', async () => {
      mockPrismaService.receipt.findUnique.mockResolvedValue(mockReceipt);
      mockPrismaService.receipt.update.mockResolvedValue({
        ...mockReceipt,
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: PaymentMethod.CASH,
      });

      const result = await service.markAsPaid('receipt-1', PaymentMethod.CASH);

      expect(result.paymentStatus).toBe(PaymentStatus.PAID);
      expect(prisma.receipt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'receipt-1' },
          data: expect.objectContaining({
            paymentStatus: PaymentStatus.PAID,
          }),
        }),
      );
    });

    it('should throw NotFoundException if receipt not found', async () => {
      mockPrismaService.receipt.findUnique.mockResolvedValue(null);

      await expect(
        service.markAsPaid('non-existent', PaymentMethod.CASH),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('refund', () => {
    it('should refund a receipt', async () => {
      mockPrismaService.receipt.findUnique.mockResolvedValue(mockReceipt);
      mockPrismaService.receipt.update.mockResolvedValue({
        ...mockReceipt,
        paymentStatus: PaymentStatus.REFUNDED,
      });

      const result = await service.refund('receipt-1', 'Patient requested refund');

      expect(result.paymentStatus).toBe(PaymentStatus.REFUNDED);
    });
  });

  describe('getPrintData', () => {
    it('should return formatted print data', async () => {
      const fullReceipt = {
        ...mockReceipt,
        hospital: { ...mockHospital, address: '123 Hospital St', phone: '555-1234', email: 'test@hospital.com' },
      };
      mockPrismaService.receipt.findUnique.mockResolvedValue(fullReceipt);

      const result = await service.getPrintData('receipt-1');

      expect(result).toBeDefined();
      expect(result.format.receiptNumber).toBe(mockReceipt.receiptNumber);
    });

    it('should throw NotFoundException if receipt not found', async () => {
      mockPrismaService.receipt.findUnique.mockResolvedValue(null);

      await expect(service.getPrintData('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getDailyRevenue', () => {
    it('should return daily revenue summary', async () => {
      const receipts = [
        { ...mockReceipt, totalAmount: 500, department: mockDepartment, receiptType: ReceiptType.OPD_CONSULTATION },
        { ...mockReceipt, id: 'receipt-2', totalAmount: 300, department: mockDepartment, receiptType: ReceiptType.PHARMACY },
      ];
      mockPrismaService.receipt.findMany.mockResolvedValue(receipts);

      const result = await service.getDailyRevenue('hospital-1');

      expect(result).toBeDefined();
      expect(result.receiptCount).toBe(2);
      expect(prisma.receipt.findMany).toHaveBeenCalled();
    });
  });
});
