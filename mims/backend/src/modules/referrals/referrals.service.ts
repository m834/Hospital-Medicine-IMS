import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { CreateReferralDto, UpdateReferralDto, ReferralQueryDto } from './dto';
import { ReferralStatus, ReferralPriority } from '@prisma/client';

@Injectable()
export class ReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new referral
   */
  async create(createReferralDto: CreateReferralDto) {
    // Validate visit exists
    const visit = await this.prisma.visit.findUnique({
      where: { id: createReferralDto.visitId },
    });
    if (!visit) {
      throw new NotFoundException(
        `Visit with ID ${createReferralDto.visitId} not found`,
      );
    }

    // Validate departments exist
    const [fromDept, toDept] = await Promise.all([
      this.prisma.department.findUnique({
        where: { id: createReferralDto.fromDepartmentId },
      }),
      this.prisma.department.findUnique({
        where: { id: createReferralDto.toDepartmentId },
      }),
    ]);

    if (!fromDept) {
      throw new NotFoundException(
        `Source department with ID ${createReferralDto.fromDepartmentId} not found`,
      );
    }
    if (!toDept) {
      throw new NotFoundException(
        `Target department with ID ${createReferralDto.toDepartmentId} not found`,
      );
    }

    // Cannot refer to same department
    if (createReferralDto.fromDepartmentId === createReferralDto.toDepartmentId) {
      throw new BadRequestException(
        'Cannot create referral to the same department',
      );
    }

    // Create referral
    return this.prisma.referral.create({
      data: {
        hospitalId: createReferralDto.hospitalId,
        visitId: createReferralDto.visitId,
        fromDepartmentId: createReferralDto.fromDepartmentId,
        toDepartmentId: createReferralDto.toDepartmentId,
        referrerId: createReferralDto.referrerId,
        referralType: createReferralDto.referralType,
        priority: createReferralDto.priority || ReferralPriority.NORMAL,
        reason: createReferralDto.reason,
        notes: createReferralDto.notes,
        status: ReferralStatus.PENDING,
      },
      include: {
        visit: {
          include: {
            patient: { select: { id: true, fullName: true, nrNumber: true } },
          },
        },
        fromDepartment: { select: { id: true, name: true } },
        toDepartment: { select: { id: true, name: true } },
        referrer: { select: { id: true, fullName: true } },
      },
    });
  }

  /**
   * Get all referrals with filters
   */
  async findAll(query: ReferralQueryDto) {
    const {
      hospitalId,
      visitId,
      fromDepartmentId,
      toDepartmentId,
      referralType,
      status,
      priority,
      page = 1,
      limit = 10,
    } = query;

    const where: any = {};
    if (hospitalId) where.hospitalId = hospitalId;
    if (visitId) where.visitId = visitId;
    if (fromDepartmentId) where.fromDepartmentId = fromDepartmentId;
    if (toDepartmentId) where.toDepartmentId = toDepartmentId;
    if (referralType) where.referralType = referralType;
    if (status) where.status = status;
    if (priority) where.priority = priority;

    const [referrals, total] = await Promise.all([
      this.prisma.referral.findMany({
        where,
        include: {
          visit: {
            include: {
              patient: { select: { id: true, fullName: true, nrNumber: true } },
              clinic: { select: { id: true, name: true } },
            },
          },
          fromDepartment: { select: { id: true, name: true } },
          toDepartment: { select: { id: true, name: true } },
          referrer: { select: { id: true, fullName: true } },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.referral.count({ where }),
    ]);

    return {
      data: referrals,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single referral by ID
   */
  async findOne(id: string) {
    const referral = await this.prisma.referral.findUnique({
      where: { id },
      include: {
        visit: {
          include: {
            patient: true,
            clinic: {
              include: {
                doctor: { select: { id: true, fullName: true } },
              },
            },
          },
        },
        fromDepartment: true,
        toDepartment: true,
        referrer: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!referral) {
      throw new NotFoundException(`Referral with ID ${id} not found`);
    }

    return referral;
  }

  /**
   * Update referral
   */
  async update(id: string, updateReferralDto: UpdateReferralDto) {
    await this.findOne(id);

    return this.prisma.referral.update({
      where: { id },
      data: updateReferralDto,
      include: {
        visit: {
          include: {
            patient: { select: { id: true, fullName: true, nrNumber: true } },
          },
        },
        fromDepartment: { select: { id: true, name: true } },
        toDepartment: { select: { id: true, name: true } },
        referrer: { select: { id: true, fullName: true } },
      },
    });
  }

  /**
   * Accept a referral
   */
  async accept(id: string) {
    const referral = await this.findOne(id);

    if (referral.status !== ReferralStatus.PENDING) {
      throw new BadRequestException(
        `Referral is not in PENDING status. Current status: ${referral.status}`,
      );
    }

    return this.prisma.referral.update({
      where: { id },
      data: {
        status: ReferralStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
      include: {
        visit: {
          include: {
            patient: { select: { id: true, fullName: true, nrNumber: true } },
          },
        },
        fromDepartment: { select: { id: true, name: true } },
        toDepartment: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Start working on a referral
   */
  async startWork(id: string) {
    const referral = await this.findOne(id);

    if (referral.status !== ReferralStatus.ACCEPTED) {
      throw new BadRequestException(
        `Referral must be ACCEPTED before starting work. Current status: ${referral.status}`,
      );
    }

    return this.prisma.referral.update({
      where: { id },
      data: {
        status: ReferralStatus.IN_PROGRESS,
      },
    });
  }

  /**
   * Complete a referral
   */
  async complete(id: string, notes?: string) {
    const referral = await this.findOne(id);

    if (
      referral.status !== ReferralStatus.ACCEPTED &&
      referral.status !== ReferralStatus.IN_PROGRESS
    ) {
      throw new BadRequestException(
        `Referral must be ACCEPTED or IN_PROGRESS to complete. Current status: ${referral.status}`,
      );
    }

    return this.prisma.referral.update({
      where: { id },
      data: {
        status: ReferralStatus.COMPLETED,
        completedAt: new Date(),
        notes: notes || referral.notes,
      },
    });
  }

  /**
   * Cancel a referral
   */
  async cancel(id: string, reason?: string) {
    const referral = await this.findOne(id);

    if (referral.status === ReferralStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed referral');
    }

    return this.prisma.referral.update({
      where: { id },
      data: {
        status: ReferralStatus.CANCELLED,
        notes: reason ? `Cancelled: ${reason}` : referral.notes,
      },
    });
  }

  /**
   * Get pending referrals for a department
   */
  async findPendingByDepartment(departmentId: string) {
    return this.prisma.referral.findMany({
      where: {
        toDepartmentId: departmentId,
        status: ReferralStatus.PENDING,
      },
      include: {
        visit: {
          include: {
            patient: { select: { id: true, fullName: true, nrNumber: true } },
            clinic: { select: { id: true, name: true } },
          },
        },
        fromDepartment: { select: { id: true, name: true } },
        referrer: { select: { id: true, fullName: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Get referrals made by a doctor
   */
  async findByReferrer(referrerId: string) {
    return this.prisma.referral.findMany({
      where: { referrerId },
      include: {
        visit: {
          include: {
            patient: { select: { id: true, fullName: true, nrNumber: true } },
          },
        },
        toDepartment: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get referral statistics
   */
  async getStats(hospitalId: string, departmentId?: string) {
    const where: any = { hospitalId };
    if (departmentId) {
      where.OR = [
        { fromDepartmentId: departmentId },
        { toDepartmentId: departmentId },
      ];
    }

    const [pending, accepted, inProgress, completed, cancelled] =
      await Promise.all([
        this.prisma.referral.count({
          where: { ...where, status: ReferralStatus.PENDING },
        }),
        this.prisma.referral.count({
          where: { ...where, status: ReferralStatus.ACCEPTED },
        }),
        this.prisma.referral.count({
          where: { ...where, status: ReferralStatus.IN_PROGRESS },
        }),
        this.prisma.referral.count({
          where: { ...where, status: ReferralStatus.COMPLETED },
        }),
        this.prisma.referral.count({
          where: { ...where, status: ReferralStatus.CANCELLED },
        }),
      ]);

    return {
      pending,
      accepted,
      inProgress,
      completed,
      cancelled,
      total: pending + accepted + inProgress + completed + cancelled,
    };
  }
}
