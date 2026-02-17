import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { OperationsService } from './operations.service';
import { PrismaService } from '@/database/prisma.service';
import { AdmissionStatus } from '@prisma/client';

describe('OperationsService', () => {
  let service: OperationsService;
  let prisma: any;

  const hospitalId = 'hospital-1';
  const departmentId = 'dept-1';
  const patientId = 'patient-1';
  const surgeonId = 'surgeon-1';
  const theatreId = 'theatre-1';
  const visitId = 'visit-1';
  const admissionId = 'admission-1';

  const mockHospital = { id: hospitalId };
  const mockDepartment = { id: departmentId };
  const mockPatient = { id: patientId, hospitalId };
  const mockSurgeon = { id: surgeonId, departmentId };
  const mockTheatre = {
    id: theatreId,
    hospitalId,
    status: 'ACTIVE',
  };
  const mockVisit = { id: visitId, patientId, hospitalId };
  const mockAdmission = {
    id: admissionId,
    patientId,
    hospitalId,
    status: AdmissionStatus.ADMITTED,
  };

  const mockOperation = {
    id: 'operation-1',
    hospitalId,
    patientId,
    patientType: 'OPD',
    visitId,
    admissionId: null,
    departmentId,
    operationType: 'Appendectomy',
    surgeonId,
    theatreId,
    scheduledAt: new Date('2026-02-06T10:00:00Z'),
    estimatedDurationMinutes: 60,
    emergencyFlag: false,
    status: 'SCHEDULED',
    notes: null,
    preOpNotes: null,
    postOpNotes: null,
    recoveryNotes: null,
    followUpAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    hospital: {
      findUnique: jest.fn(),
    },
    patient: {
      findUnique: jest.fn(),
    },
    department: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    operationTheatre: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    visit: {
      findUnique: jest.fn(),
    },
    admission: {
      findUnique: jest.fn(),
    },
    operation: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OperationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<OperationsService>(OperationsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      hospitalId,
      patientId,
      patientType: 'OPD',
      visitId,
      departmentId,
      operationType: 'Appendectomy',
      surgeonId,
      theatreId,
      scheduledAt: '2026-02-06T10:00:00Z',
      estimatedDurationMinutes: 60,
      emergencyFlag: false,
    };

    it('should create operation successfully', async () => {
      mockPrismaService.hospital.findUnique.mockResolvedValue(mockHospital);
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
      mockPrismaService.user.findUnique.mockResolvedValue(mockSurgeon);
      mockPrismaService.operationTheatre.findUnique.mockResolvedValue(mockTheatre);
      mockPrismaService.visit.findUnique.mockResolvedValue(mockVisit);
      mockPrismaService.operation.findMany.mockResolvedValue([]);
      mockPrismaService.operation.create.mockResolvedValue(mockOperation);

      const result = await service.create(createDto);

      expect(result).toEqual(mockOperation);
      expect(prisma.operation.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException when visitId is missing for OPD', async () => {
      await expect(
        service.create({
          ...createDto,
          visitId: undefined,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when theatre has scheduling conflict', async () => {
      mockPrismaService.hospital.findUnique.mockResolvedValue(mockHospital);
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
      mockPrismaService.user.findUnique.mockResolvedValue(mockSurgeon);
      mockPrismaService.operationTheatre.findUnique.mockResolvedValue(mockTheatre);
      mockPrismaService.visit.findUnique.mockResolvedValue(mockVisit);
      mockPrismaService.operation.findMany.mockResolvedValue([
        {
          id: 'operation-2',
          scheduledAt: new Date('2026-02-06T10:30:00Z'),
          estimatedDurationMinutes: 60,
        },
      ]);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated operations', async () => {
      mockPrismaService.operation.findMany.mockResolvedValue([mockOperation]);
      mockPrismaService.operation.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual([mockOperation]);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 10, totalPages: 1 });
    });
  });

  describe('findOne', () => {
    it('should return operation by id', async () => {
      mockPrismaService.operation.findUnique.mockResolvedValue(mockOperation);

      const result = await service.findOne('operation-1');

      expect(result).toEqual(mockOperation);
    });

    it('should throw NotFoundException if operation not found', async () => {
      mockPrismaService.operation.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should update operation status', async () => {
      mockPrismaService.operation.findUnique.mockResolvedValue(mockOperation);
      mockPrismaService.operation.update.mockResolvedValue({
        ...mockOperation,
        status: 'IN_PROGRESS',
      });

      const result = await service.updateStatus('operation-1', {
        status: 'IN_PROGRESS',
      });

      expect(result.status).toBe('IN_PROGRESS');
    });

    it('should throw BadRequestException if operation finalized', async () => {
      mockPrismaService.operation.findUnique.mockResolvedValue({
        ...mockOperation,
        status: 'COMPLETED',
      });

      await expect(
        service.updateStatus('operation-1', {
          status: 'CANCELLED',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reschedule', () => {
    it('should reschedule operation', async () => {
      mockPrismaService.operation.findUnique.mockResolvedValue(mockOperation);
      mockPrismaService.operation.findMany.mockResolvedValue([]);
      mockPrismaService.operation.update.mockResolvedValue({
        ...mockOperation,
        scheduledAt: new Date('2026-02-07T10:00:00Z'),
      });

      const result = await service.reschedule('operation-1', {
        scheduledAt: '2026-02-07T10:00:00Z',
      });

      expect(result.scheduledAt).toEqual(new Date('2026-02-07T10:00:00Z'));
    });
  });

  describe('createTheatre', () => {
    it('should create theatre', async () => {
      mockPrismaService.hospital.findUnique.mockResolvedValue(mockHospital);
      mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
      mockPrismaService.operationTheatre.findFirst.mockResolvedValue(null);
      mockPrismaService.operationTheatre.create.mockResolvedValue(mockTheatre);

      const result = await service.createTheatre({
        hospitalId,
        departmentId,
        name: 'Main OT',
        code: 'OT-1',
      });

      expect(result).toEqual(mockTheatre);
    });

    it('should throw ConflictException if code exists', async () => {
      mockPrismaService.hospital.findUnique.mockResolvedValue(mockHospital);
      mockPrismaService.operationTheatre.findFirst.mockResolvedValue(mockTheatre);

      await expect(
        service.createTheatre({
          hospitalId,
          name: 'Main OT',
          code: 'OT-1',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getTheatreAvailability', () => {
    it('should return theatre availability for date', async () => {
      mockPrismaService.operationTheatre.findUnique.mockResolvedValue(mockTheatre);
      mockPrismaService.operation.findMany.mockResolvedValue([mockOperation]);

      const result = await service.getTheatreAvailability({
        theatreId,
        date: '2026-02-06',
      });

      expect(result.theatre.id).toBe(theatreId);
      expect(result.operations).toEqual([mockOperation]);
    });
  });

  describe('create (in-house)', () => {
    const createDto = {
      hospitalId,
      patientId,
      patientType: 'IN_HOUSE',
      admissionId,
      departmentId,
      operationType: 'Hip Replacement',
      surgeonId,
      theatreId,
      scheduledAt: '2026-02-06T10:00:00Z',
      estimatedDurationMinutes: 120,
      emergencyFlag: true,
    };

    it('should require admissionId for in-house operation', async () => {
      await expect(
        service.create({
          ...createDto,
          admissionId: undefined,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate admission status', async () => {
      mockPrismaService.hospital.findUnique.mockResolvedValue(mockHospital);
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
      mockPrismaService.user.findUnique.mockResolvedValue(mockSurgeon);
      mockPrismaService.operationTheatre.findUnique.mockResolvedValue(mockTheatre);
      mockPrismaService.admission.findUnique.mockResolvedValue({
        ...mockAdmission,
        status: AdmissionStatus.DISCHARGED,
      });

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });
  });
});
