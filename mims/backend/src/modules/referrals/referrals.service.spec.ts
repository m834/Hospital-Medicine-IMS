import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { PrismaService } from '@/database/prisma.service';
import { ReferralStatus, ReferralPriority, ReferralType } from '@prisma/client';

describe('ReferralsService', () => {
  let service: ReferralsService;
  let prisma: PrismaService;

  const mockPatient = {
    id: 'patient-1',
    fullName: 'John Patient',
    nrNumber: 'NR-2026-0001',
  };

  const mockVisit = {
    id: 'visit-1',
    patient: mockPatient,
    clinic: { id: 'clinic-1', name: 'Cardiology OPD' },
  };

  const mockFromDepartment = {
    id: 'dept-1',
    name: 'Cardiology',
  };

  const mockToDepartment = {
    id: 'dept-2',
    name: 'Neurology',
  };

  const mockReferrer = {
    id: 'doctor-1',
    fullName: 'Dr. John Doe',
    email: 'john.doe@hospital.com',
  };

  const mockReferral = {
    id: 'referral-1',
    hospitalId: 'hospital-1',
    visitId: 'visit-1',
    fromDepartmentId: 'dept-1',
    toDepartmentId: 'dept-2',
    referrerId: 'doctor-1',
    referralType: ReferralType.SPECIALIST_CONSULTATION,
    priority: ReferralPriority.NORMAL,
    reason: 'Neurological evaluation needed',
    notes: 'Patient complains of headaches',
    status: ReferralStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
    visit: mockVisit,
    fromDepartment: mockFromDepartment,
    toDepartment: mockToDepartment,
    referrer: mockReferrer,
  };

  const mockPrismaService = {
    visit: {
      findUnique: jest.fn(),
    },
    department: {
      findUnique: jest.fn(),
    },
    referral: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ReferralsService>(ReferralsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      hospitalId: 'hospital-1',
      visitId: 'visit-1',
      fromDepartmentId: 'dept-1',
      toDepartmentId: 'dept-2',
      referrerId: 'doctor-1',
      referralType: ReferralType.SPECIALIST_CONSULTATION,
      priority: ReferralPriority.URGENT,
      reason: 'Neurological evaluation needed',
    };

    it('should create a new referral successfully', async () => {
      mockPrismaService.visit.findUnique.mockResolvedValue(mockVisit);
      mockPrismaService.department.findUnique
        .mockResolvedValueOnce(mockFromDepartment)
        .mockResolvedValueOnce(mockToDepartment);
      mockPrismaService.referral.create.mockResolvedValue(mockReferral);

      const result = await service.create(createDto);

      expect(result).toEqual(mockReferral);
      expect(prisma.referral.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hospitalId: createDto.hospitalId,
            visitId: createDto.visitId,
            status: ReferralStatus.PENDING,
          }),
        }),
      );
    });

    it('should throw NotFoundException if visit not found', async () => {
      mockPrismaService.visit.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if source department not found', async () => {
      mockPrismaService.visit.findUnique.mockResolvedValue(mockVisit);
      mockPrismaService.department.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockToDepartment);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if target department not found', async () => {
      mockPrismaService.visit.findUnique.mockResolvedValue(mockVisit);
      mockPrismaService.department.findUnique
        .mockResolvedValueOnce(mockFromDepartment)
        .mockResolvedValueOnce(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for same department referral', async () => {
      const sameDeptDto = { ...createDto, toDepartmentId: 'dept-1' };
      mockPrismaService.visit.findUnique.mockResolvedValue(mockVisit);
      mockPrismaService.department.findUnique.mockResolvedValue(mockFromDepartment);

      await expect(service.create(sameDeptDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated referrals', async () => {
      mockPrismaService.referral.findMany.mockResolvedValue([mockReferral]);
      mockPrismaService.referral.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual([mockReferral]);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should filter by status', async () => {
      mockPrismaService.referral.findMany.mockResolvedValue([mockReferral]);
      mockPrismaService.referral.count.mockResolvedValue(1);

      await service.findAll({ status: ReferralStatus.PENDING });

      expect(prisma.referral.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: ReferralStatus.PENDING }),
        }),
      );
    });

    it('should filter by priority', async () => {
      mockPrismaService.referral.findMany.mockResolvedValue([mockReferral]);
      mockPrismaService.referral.count.mockResolvedValue(1);

      await service.findAll({ priority: ReferralPriority.URGENT });

      expect(prisma.referral.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ priority: ReferralPriority.URGENT }),
        }),
      );
    });

    it('should filter by toDepartmentId', async () => {
      mockPrismaService.referral.findMany.mockResolvedValue([mockReferral]);
      mockPrismaService.referral.count.mockResolvedValue(1);

      await service.findAll({ toDepartmentId: 'dept-2' });

      expect(prisma.referral.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ toDepartmentId: 'dept-2' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a referral by id', async () => {
      mockPrismaService.referral.findUnique.mockResolvedValue(mockReferral);

      const result = await service.findOne('referral-1');

      expect(result).toEqual(mockReferral);
    });

    it('should throw NotFoundException if referral not found', async () => {
      mockPrismaService.referral.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const updateDto = {
      priority: ReferralPriority.URGENT,
      notes: 'Updated notes',
    };

    it('should update a referral', async () => {
      mockPrismaService.referral.findUnique.mockResolvedValue(mockReferral);
      mockPrismaService.referral.update.mockResolvedValue({
        ...mockReferral,
        ...updateDto,
      });

      const result = await service.update('referral-1', updateDto);

      expect(result.priority).toBe(ReferralPriority.URGENT);
    });

    it('should throw NotFoundException if referral not found', async () => {
      mockPrismaService.referral.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent', updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('accept', () => {
    it('should accept a pending referral', async () => {
      mockPrismaService.referral.findUnique.mockResolvedValue(mockReferral);
      mockPrismaService.referral.update.mockResolvedValue({
        ...mockReferral,
        status: ReferralStatus.ACCEPTED,
      });

      const result = await service.accept('referral-1');

      expect(result.status).toBe(ReferralStatus.ACCEPTED);
      expect(prisma.referral.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ReferralStatus.ACCEPTED,
          }),
        }),
      );
    });

    it('should throw BadRequestException if not in PENDING status', async () => {
      mockPrismaService.referral.findUnique.mockResolvedValue({
        ...mockReferral,
        status: ReferralStatus.COMPLETED,
      });

      await expect(service.accept('referral-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('startWork', () => {
    it('should start work on accepted referral', async () => {
      mockPrismaService.referral.findUnique.mockResolvedValue({
        ...mockReferral,
        status: ReferralStatus.ACCEPTED,
      });
      mockPrismaService.referral.update.mockResolvedValue({
        ...mockReferral,
        status: ReferralStatus.IN_PROGRESS,
      });

      const result = await service.startWork('referral-1');

      expect(result.status).toBe(ReferralStatus.IN_PROGRESS);
    });

    it('should throw BadRequestException if not in ACCEPTED status', async () => {
      mockPrismaService.referral.findUnique.mockResolvedValue(mockReferral);

      await expect(service.startWork('referral-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('complete', () => {
    it('should complete an in-progress referral', async () => {
      mockPrismaService.referral.findUnique.mockResolvedValue({
        ...mockReferral,
        status: ReferralStatus.IN_PROGRESS,
      });
      mockPrismaService.referral.update.mockResolvedValue({
        ...mockReferral,
        status: ReferralStatus.COMPLETED,
      });

      const result = await service.complete('referral-1', 'Completed notes');

      expect(result.status).toBe(ReferralStatus.COMPLETED);
    });

    it('should throw BadRequestException if not in IN_PROGRESS status', async () => {
      mockPrismaService.referral.findUnique.mockResolvedValue(mockReferral);

      await expect(service.complete('referral-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancel', () => {
    it('should cancel a pending referral', async () => {
      mockPrismaService.referral.findUnique.mockResolvedValue(mockReferral);
      mockPrismaService.referral.update.mockResolvedValue({
        ...mockReferral,
        status: ReferralStatus.CANCELLED,
      });

      const result = await service.cancel('referral-1', 'Cancelled by patient');

      expect(result.status).toBe(ReferralStatus.CANCELLED);
    });

    it('should throw BadRequestException if already completed', async () => {
      mockPrismaService.referral.findUnique.mockResolvedValue({
        ...mockReferral,
        status: ReferralStatus.COMPLETED,
      });

      await expect(service.cancel('referral-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findPendingByDepartment', () => {
    it('should return pending referrals for department', async () => {
      mockPrismaService.referral.findMany.mockResolvedValue([mockReferral]);

      const result = await service.findPendingByDepartment('dept-2');

      expect(result).toEqual([mockReferral]);
      expect(prisma.referral.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            toDepartmentId: 'dept-2',
            status: ReferralStatus.PENDING,
          }),
        }),
      );
    });
  });

  describe('findByReferrer', () => {
    it('should return referrals made by a doctor', async () => {
      mockPrismaService.referral.findMany.mockResolvedValue([mockReferral]);

      const result = await service.findByReferrer('doctor-1');

      expect(result).toEqual([mockReferral]);
      expect(prisma.referral.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { referrerId: 'doctor-1' },
        }),
      );
    });
  });

  describe('getStats', () => {
    it('should return referral statistics', async () => {
      mockPrismaService.referral.count
        .mockResolvedValueOnce(3) // pending
        .mockResolvedValueOnce(2) // accepted
        .mockResolvedValueOnce(2) // inProgress
        .mockResolvedValueOnce(4) // completed
        .mockResolvedValueOnce(1); // cancelled

      const result = await service.getStats('hospital-1');

      expect(result).toEqual({
        pending: 3,
        accepted: 2,
        inProgress: 2,
        completed: 4,
        cancelled: 1,
        total: 12, // 3+2+2+4+1
      });
    });

    it('should filter stats by department', async () => {
      mockPrismaService.referral.count.mockResolvedValue(5);

      await service.getStats('hospital-1', 'dept-1');

      expect(prisma.referral.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { fromDepartmentId: 'dept-1' },
              { toDepartmentId: 'dept-1' },
            ]),
          }),
        }),
      );
    });
  });
});
