import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { VisitsService } from './visits.service';
import { PrismaService } from '@/database/prisma.service';
import { VisitStatus, PaymentStatus, TokenStatus, PaymentMethod, VisitType } from '@prisma/client';

describe('VisitsService', () => {
  let service: VisitsService;
  let prisma: PrismaService;

  const mockPatient = {
    id: 'patient-1',
    fullName: 'John Patient',
    nrNumber: 'MRN-2026-0001',
    mobile: '1234567890',
  };

  const mockDoctor = {
    id: 'doctor-1',
    fullName: 'Dr. John Doe',
    email: 'john.doe@hospital.com',
  };

  const mockDepartment = {
    id: 'dept-1',
    name: 'Cardiology',
  };

  const mockClinic = {
    id: 'clinic-1',
    hospitalId: 'hospital-1',
    departmentId: 'dept-1',
    doctorId: 'doctor-1',
    name: 'Cardiology OPD',
    opdFee: 500,
    maxPatientsPerDay: 30,
    status: 'ACTIVE',
    hospital: { id: 'hospital-1', name: 'Test Hospital' },
    department: mockDepartment,
    doctor: mockDoctor,
  };

  const mockToken = {
    id: 'token-1',
    hospitalId: 'hospital-1',
    clinicId: 'clinic-1',
    tokenNumber: 1,
    tokenDate: new Date(),
    status: TokenStatus.WAITING,
  };

  const mockVisit = {
    id: 'visit-1',
    hospitalId: 'hospital-1',
    patientId: 'patient-1',
    clinicId: 'clinic-1',
    tokenId: 'token-1',
    registrarId: 'registrar-1',
    tokenNumber: 1,
    consultationFee: 500,
    status: VisitStatus.WAITING,
    paymentStatus: PaymentStatus.UNPAID,
    visitDate: new Date(),
    patient: mockPatient,
    clinic: mockClinic,
    token: mockToken,
    registrar: { id: 'registrar-1', fullName: 'Registrar' },
  };

  const mockPrismaService = {
    clinic: {
      findUnique: jest.fn(),
    },
    department: {
      findFirst: jest.fn(),
    },
    bed: {
      findFirst: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
    patient: {
      findUnique: jest.fn(),
    },
    visit: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    token: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    receipt: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((arg) => {
      // Handle both array pattern and callback pattern
      if (Array.isArray(arg)) {
        return Promise.resolve(arg);
      }
      return arg(mockPrismaService);
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisitsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<VisitsService>(VisitsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      hospitalId: 'hospital-1',
      clinicId: 'clinic-1',
      patientId: 'patient-1',
      registrarId: 'registrar-1',
      visitType: VisitType.OPD,
      chiefComplaint: 'Chest pain',
      vitalSigns: {
        bloodPressureSystolic: '120',
        bloodPressureDiastolic: '80',
        pulse: '72',
        temperature: '98.6',
      },
    };

    it('should create a new visit with token', async () => {
      mockPrismaService.clinic.findUnique.mockResolvedValue(mockClinic);
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockPrismaService.visit.count.mockResolvedValue(5);
      mockPrismaService.token.findFirst.mockResolvedValue(null);
      mockPrismaService.token.create.mockResolvedValue(mockToken);
      mockPrismaService.visit.create.mockResolvedValue(mockVisit);

      const result = await service.create(createDto);

      expect(result.visit).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.token.tokenNumber).toBe(1);
      expect(prisma.token.create).toHaveBeenCalled();
      expect(prisma.visit.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if clinic not found', async () => {
      mockPrismaService.clinic.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if clinic is inactive', async () => {
      mockPrismaService.clinic.findUnique.mockResolvedValue({
        ...mockClinic,
        status: 'INACTIVE',
      });

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if patient not found', async () => {
      mockPrismaService.clinic.findUnique.mockResolvedValue(mockClinic);
      mockPrismaService.patient.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if max patients reached', async () => {
      mockPrismaService.clinic.findUnique.mockResolvedValue(mockClinic);
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockPrismaService.visit.count.mockResolvedValue(30); // Max reached

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if OPD visit missing clinicId', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);

      await expect(
        service.create({
          ...createDto,
          clinicId: undefined,
          visitType: VisitType.OPD,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create a non-OPD visit without token', async () => {
      const nonOpdDto = {
        hospitalId: 'hospital-1',
        patientId: 'patient-1',
        registrarId: 'registrar-1',
        visitType: VisitType.WARD_INDOOR,
        departmentId: 'dept-1',
        bedId: 'bed-1',
        attendingDoctorId: 'doctor-1',
      };

      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockPrismaService.department.findFirst.mockResolvedValue(mockDepartment);
      mockPrismaService.bed.findFirst.mockResolvedValue({ id: 'bed-1', bedNumber: 'B-12' });
      mockPrismaService.user.findFirst.mockResolvedValue(mockDoctor);
      mockPrismaService.visit.count.mockResolvedValue(1);
      mockPrismaService.visit.create.mockResolvedValue({
        ...mockVisit,
        clinicId: null,
        tokenId: null,
        tokenNumber: null,
      });

      const result = await service.create(nonOpdDto as any);

      expect(result.visit).toBeDefined();
      expect(prisma.visit.create).toHaveBeenCalled();
    });

    it('should increment token number from last token', async () => {
      mockPrismaService.clinic.findUnique.mockResolvedValue(mockClinic);
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockPrismaService.visit.count.mockResolvedValue(5);
      mockPrismaService.token.findFirst.mockResolvedValue({ tokenNumber: 10 });
      mockPrismaService.token.create.mockResolvedValue({ ...mockToken, tokenNumber: 11 });
      mockPrismaService.visit.create.mockResolvedValue({ ...mockVisit, tokenNumber: 11 });

      const result = await service.create(createDto);

      expect(result.token.tokenNumber).toBe(11);
    });
  });

  describe('findAll', () => {
    it('should return paginated visits', async () => {
      mockPrismaService.visit.findMany.mockResolvedValue([mockVisit]);
      mockPrismaService.visit.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual([mockVisit]);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should filter visits by status', async () => {
      mockPrismaService.visit.findMany.mockResolvedValue([mockVisit]);
      mockPrismaService.visit.count.mockResolvedValue(1);

      await service.findAll({ status: VisitStatus.WAITING });

      expect(prisma.visit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: VisitStatus.WAITING }),
        }),
      );
    });

    it('should filter visits by visitType', async () => {
      mockPrismaService.visit.findMany.mockResolvedValue([mockVisit]);
      mockPrismaService.visit.count.mockResolvedValue(1);

      await service.findAll({ visitType: VisitType.OPD });

      expect(prisma.visit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ visitType: VisitType.OPD }),
        }),
      );
    });

    it('should filter visits by date range', async () => {
      mockPrismaService.visit.findMany.mockResolvedValue([mockVisit]);
      mockPrismaService.visit.count.mockResolvedValue(1);

      await service.findAll({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      expect(prisma.visit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            visitDate: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a visit by id', async () => {
      mockPrismaService.visit.findUnique.mockResolvedValue(mockVisit);

      const result = await service.findOne('visit-1');

      expect(result).toEqual(mockVisit);
    });

    it('should throw NotFoundException if visit not found', async () => {
      mockPrismaService.visit.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const updateDto = {
      diagnosis: 'Hypertension',
      treatmentPlan: 'Medication and diet control',
    };

    it('should update a visit', async () => {
      mockPrismaService.visit.findUnique.mockResolvedValue(mockVisit);
      mockPrismaService.visit.update.mockResolvedValue({
        ...mockVisit,
        ...updateDto,
      });

      const result = await service.update('visit-1', updateDto, 'doctor-1');

      expect(result.diagnosis).toBe(updateDto.diagnosis);
    });

    it('should throw NotFoundException if visit not found', async () => {
      mockPrismaService.visit.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent', updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('complete', () => {
    it('should mark visit as complete', async () => {
      const completedVisit = { ...mockVisit, status: VisitStatus.COMPLETED };
      mockPrismaService.visit.findUnique.mockResolvedValue(mockVisit);
      mockPrismaService.visit.update.mockResolvedValue(completedVisit);
      mockPrismaService.token.update.mockResolvedValue({
        ...mockToken,
        status: TokenStatus.COMPLETED,
      });

      const result = await service.complete('visit-1');

      expect(prisma.visit.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'visit-1' },
          data: expect.objectContaining({
            status: VisitStatus.COMPLETED,
          }),
        }),
      );
    });
  });

  describe('cancel', () => {
    it('should cancel a visit', async () => {
      const cancelledVisit = { ...mockVisit, status: VisitStatus.CANCELLED };
      mockPrismaService.visit.findUnique.mockResolvedValue(mockVisit);
      mockPrismaService.visit.update.mockResolvedValue(cancelledVisit);
      mockPrismaService.token.update.mockResolvedValue({
        ...mockToken,
        status: TokenStatus.CANCELLED,
      });

      const result = await service.cancel('visit-1');

      expect(prisma.visit.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException if visit already completed', async () => {
      mockPrismaService.visit.findUnique.mockResolvedValue({
        ...mockVisit,
        status: VisitStatus.COMPLETED,
      });

      await expect(service.cancel('visit-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('callNext', () => {
    it('should call the next waiting token', async () => {
      const waitingToken = {
        ...mockToken,
        id: 'token-1',
        status: TokenStatus.WAITING,
        visits: [{ id: 'visit-1', patient: mockPatient }],
      };
      mockPrismaService.token.findFirst.mockResolvedValue(waitingToken);
      mockPrismaService.$transaction.mockResolvedValue([{}, {}]);

      const result = await service.callNext('clinic-1');

      expect(result.token).toBeDefined();
      expect(result.message).toContain('called');
    });

    it('should throw NotFoundException if no waiting tokens', async () => {
      mockPrismaService.token.findFirst.mockResolvedValue(null);

      await expect(service.callNext('clinic-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findTodayByClinic', () => {
    it('should return today visits for a clinic', async () => {
      mockPrismaService.visit.findMany.mockResolvedValue([mockVisit]);

      const result = await service.findTodayByClinic('clinic-1');

      expect(result).toEqual([mockVisit]);
      expect(prisma.visit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clinicId: 'clinic-1',
            visitDate: expect.any(Object),
          }),
        }),
      );
    });
  });

  describe('findByPatient', () => {
    it('should return patient visit history', async () => {
      mockPrismaService.visit.findMany.mockResolvedValue([mockVisit]);

      const result = await service.findByPatient('patient-1', 10);

      expect(result).toEqual([mockVisit]);
      expect(prisma.visit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { patientId: 'patient-1' },
          take: 10,
        }),
      );
    });
  });

  describe('generateReceipt', () => {
    it('should generate a receipt for a visit', async () => {
      const mockReceiptCreated = {
        id: 'receipt-1',
        receiptNumber: 'REC-20260119-0001',
        totalAmount: 500,
      };
      mockPrismaService.visit.findUnique.mockResolvedValue({
        ...mockVisit,
        clinic: {
          ...mockClinic,
          department: mockDepartment,
        },
      });
      mockPrismaService.receipt.findFirst.mockResolvedValueOnce(null); // No existing receipt
      mockPrismaService.receipt.findFirst.mockResolvedValueOnce(null); // No last receipt
      mockPrismaService.receipt.create.mockResolvedValue(mockReceiptCreated);

      const result = await service.generateReceipt('visit-1', 'staff-1');

      expect(result.receiptNumber).toBeDefined();
      expect(prisma.receipt.create).toHaveBeenCalled();
    });

    it('should return existing receipt if already exists', async () => {
      const existingReceipt = {
        id: 'receipt-1',
        receiptNumber: 'REC-001',
      };
      mockPrismaService.visit.findUnique.mockResolvedValue(mockVisit);
      mockPrismaService.receipt.findFirst.mockResolvedValue(existingReceipt);

      const result = await service.generateReceipt('visit-1', 'staff-1');

      expect(result).toEqual(existingReceipt);
      expect(prisma.receipt.create).not.toHaveBeenCalled();
    });
  });

  describe('markAsPaid', () => {
    it('should mark visit as paid', async () => {
      const receipt = { id: 'receipt-1', paymentStatus: PaymentStatus.UNPAID };
      mockPrismaService.visit.findUnique.mockResolvedValue(mockVisit);
      mockPrismaService.visit.update.mockResolvedValue({
        ...mockVisit,
        paymentStatus: PaymentStatus.PAID,
      });
      mockPrismaService.receipt.findFirst.mockResolvedValue(receipt);
      mockPrismaService.receipt.update.mockResolvedValue({
        ...receipt,
        paymentStatus: PaymentStatus.PAID,
      });

      const result = await service.markAsPaid('visit-1', PaymentMethod.CASH);

      expect(prisma.visit.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentStatus: PaymentStatus.PAID,
          }),
        }),
      );
    });
  });
});
