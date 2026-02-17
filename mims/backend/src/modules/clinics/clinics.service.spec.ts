import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ClinicsService } from './clinics.service';
import { PrismaService } from '@/database/prisma.service';
import { UserRole, ClinicStatus } from '@prisma/client';

describe('ClinicsService', () => {
  let service: ClinicsService;
  let prisma: PrismaService;

  const mockHospital = {
    id: 'hospital-1',
    name: 'Test Hospital',
  };

  const mockDepartment = {
    id: 'dept-1',
    name: 'Cardiology',
    hospitalId: 'hospital-1',
  };

  const mockDoctor = {
    id: 'doctor-1',
    fullName: 'Dr. John Doe',
    email: 'john.doe@hospital.com',
    phone: '1234567890',
    hospitalId: 'hospital-1',
    role: UserRole.DOCTOR,
  };

  const mockClinic = {
    id: 'clinic-1',
    hospitalId: 'hospital-1',
    departmentId: 'dept-1',
    doctorId: 'doctor-1',
    name: 'Cardiology OPD',
    opdFee: 500,
    availableDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
    availableFrom: '09:00',
    availableTo: '17:00',
    maxPatientsPerDay: 30,
    status: ClinicStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    hospital: mockHospital,
    department: mockDepartment,
    doctor: mockDoctor,
    _count: { visits: 10, tokens: 10 },
  };

  const mockPrismaService = {
    hospital: {
      findUnique: jest.fn(),
    },
    department: {
      findFirst: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
    clinic: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    visit: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ClinicsService>(ClinicsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      hospitalId: 'hospital-1',
      departmentId: 'dept-1',
      doctorId: 'doctor-1',
      name: 'Cardiology OPD',
      opdFee: 500,
      availableDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
      availableFrom: '09:00',
      availableTo: '17:00',
      maxPatientsPerDay: 30,
    };

    it('should create a new clinic successfully', async () => {
      mockPrismaService.hospital.findUnique.mockResolvedValue(mockHospital);
      mockPrismaService.department.findFirst.mockResolvedValue(mockDepartment);
      mockPrismaService.user.findFirst.mockResolvedValue(mockDoctor);
      mockPrismaService.clinic.findFirst.mockResolvedValue(null);
      mockPrismaService.clinic.create.mockResolvedValue(mockClinic);

      const result = await service.create(createDto);

      expect(result).toEqual(mockClinic);
      expect(prisma.clinic.create).toHaveBeenCalledWith({
        data: {
          hospitalId: createDto.hospitalId,
          departmentId: createDto.departmentId,
          doctorId: createDto.doctorId,
          name: createDto.name,
          opdFee: createDto.opdFee,
          availableDays: createDto.availableDays,
          availableFrom: createDto.availableFrom,
          availableTo: createDto.availableTo,
          maxPatientsPerDay: createDto.maxPatientsPerDay,
          status: ClinicStatus.ACTIVE,
        },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if hospital not found', async () => {
      mockPrismaService.hospital.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
      expect(prisma.hospital.findUnique).toHaveBeenCalledWith({
        where: { id: createDto.hospitalId },
      });
    });

    it('should throw NotFoundException if department not found', async () => {
      mockPrismaService.hospital.findUnique.mockResolvedValue(mockHospital);
      mockPrismaService.department.findFirst.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user is not a doctor', async () => {
      mockPrismaService.hospital.findUnique.mockResolvedValue(mockHospital);
      mockPrismaService.department.findFirst.mockResolvedValue(mockDepartment);
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if clinic already exists', async () => {
      mockPrismaService.hospital.findUnique.mockResolvedValue(mockHospital);
      mockPrismaService.department.findFirst.mockResolvedValue(mockDepartment);
      mockPrismaService.user.findFirst.mockResolvedValue(mockDoctor);
      mockPrismaService.clinic.findFirst.mockResolvedValue(mockClinic);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated clinics', async () => {
      const clinics = [mockClinic];
      mockPrismaService.clinic.findMany.mockResolvedValue(clinics);
      mockPrismaService.clinic.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(clinics);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should filter clinics by hospitalId', async () => {
      mockPrismaService.clinic.findMany.mockResolvedValue([mockClinic]);
      mockPrismaService.clinic.count.mockResolvedValue(1);

      await service.findAll({ hospitalId: 'hospital-1' });

      expect(prisma.clinic.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { hospitalId: 'hospital-1' },
        }),
      );
    });

    it('should filter clinics by status', async () => {
      mockPrismaService.clinic.findMany.mockResolvedValue([mockClinic]);
      mockPrismaService.clinic.count.mockResolvedValue(1);

      await service.findAll({ status: ClinicStatus.ACTIVE });

      expect(prisma.clinic.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: ClinicStatus.ACTIVE },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a clinic by id', async () => {
      mockPrismaService.clinic.findUnique.mockResolvedValue(mockClinic);

      const result = await service.findOne('clinic-1');

      expect(result).toEqual(mockClinic);
      expect(prisma.clinic.findUnique).toHaveBeenCalledWith({
        where: { id: 'clinic-1' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if clinic not found', async () => {
      mockPrismaService.clinic.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const updateDto = {
      name: 'Updated Cardiology OPD',
      opdFee: 600,
    };

    it('should update a clinic successfully', async () => {
      mockPrismaService.clinic.findUnique.mockResolvedValue(mockClinic);
      mockPrismaService.clinic.update.mockResolvedValue({
        ...mockClinic,
        ...updateDto,
      });

      const result = await service.update('clinic-1', updateDto);

      expect(result.name).toBe(updateDto.name);
      expect(result.opdFee).toBe(updateDto.opdFee);
    });

    it('should throw NotFoundException if clinic not found', async () => {
      mockPrismaService.clinic.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should validate doctor when updating doctorId', async () => {
      mockPrismaService.clinic.findUnique.mockResolvedValue(mockClinic);
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(
        service.update('clinic-1', { doctorId: 'invalid-doctor' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete a clinic with no visits', async () => {
      mockPrismaService.clinic.findUnique.mockResolvedValue(mockClinic);
      mockPrismaService.visit.count.mockResolvedValue(0);
      mockPrismaService.clinic.delete.mockResolvedValue(mockClinic);

      const result = await service.remove('clinic-1');

      expect(result).toEqual(mockClinic);
      expect(prisma.clinic.delete).toHaveBeenCalledWith({
        where: { id: 'clinic-1' },
      });
    });

    it('should throw BadRequestException if clinic has visits', async () => {
      mockPrismaService.clinic.findUnique.mockResolvedValue(mockClinic);
      mockPrismaService.visit.count.mockResolvedValue(5);

      await expect(service.remove('clinic-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findByDoctor', () => {
    it('should return active clinics for a doctor', async () => {
      mockPrismaService.clinic.findMany.mockResolvedValue([mockClinic]);

      const result = await service.findByDoctor('doctor-1');

      expect(result).toEqual([mockClinic]);
      expect(prisma.clinic.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { doctorId: 'doctor-1', status: ClinicStatus.ACTIVE },
        }),
      );
    });
  });

  describe('findByDepartment', () => {
    it('should return active clinics for a department', async () => {
      mockPrismaService.clinic.findMany.mockResolvedValue([mockClinic]);

      const result = await service.findByDepartment('dept-1');

      expect(result).toEqual([mockClinic]);
      expect(prisma.clinic.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { departmentId: 'dept-1', status: ClinicStatus.ACTIVE },
        }),
      );
    });
  });

  describe('findAvailable', () => {
    it('should return available clinics for today', async () => {
      mockPrismaService.clinic.findMany.mockResolvedValue([mockClinic]);

      const result = await service.findAvailable('hospital-1');

      expect(result).toEqual([mockClinic]);
      expect(prisma.clinic.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            hospitalId: 'hospital-1',
            status: ClinicStatus.ACTIVE,
            availableDays: expect.any(Object),
          }),
        }),
      );
    });

    it('should filter by department if provided', async () => {
      mockPrismaService.clinic.findMany.mockResolvedValue([mockClinic]);

      await service.findAvailable('hospital-1', 'dept-1');

      expect(prisma.clinic.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            departmentId: 'dept-1',
          }),
        }),
      );
    });
  });

  describe('getClinicStats', () => {
    it('should return clinic statistics for today', async () => {
      mockPrismaService.clinic.findUnique.mockResolvedValue(mockClinic);
      mockPrismaService.visit.count
        .mockResolvedValueOnce(15) // todayVisits
        .mockResolvedValueOnce(5) // waitingCount
        .mockResolvedValueOnce(10); // completedCount

      const result = await service.getClinicStats('clinic-1');

      expect(result.clinic).toEqual(mockClinic);
      expect(result.stats.todayVisits).toBe(15);
      expect(result.stats.waitingCount).toBe(5);
      expect(result.stats.completedCount).toBe(10);
      expect(result.stats.availableSlots).toBe(15); // 30 - 15
    });

    it('should return null availableSlots if maxPatientsPerDay not set', async () => {
      const clinicWithoutMax = { ...mockClinic, maxPatientsPerDay: null };
      mockPrismaService.clinic.findUnique.mockResolvedValue(clinicWithoutMax);
      mockPrismaService.visit.count.mockResolvedValue(10);

      const result = await service.getClinicStats('clinic-1');

      expect(result.stats.availableSlots).toBeNull();
    });
  });
});
