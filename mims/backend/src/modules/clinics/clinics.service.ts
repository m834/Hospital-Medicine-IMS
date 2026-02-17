import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { CreateClinicDto, UpdateClinicDto, ClinicQueryDto } from './dto';
import { UserRole, ClinicStatus } from '@prisma/client';

@Injectable()
export class ClinicsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new clinic
   */
  async create(createClinicDto: CreateClinicDto) {
    // Validate hospital exists
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: createClinicDto.hospitalId },
    });
    if (!hospital) {
      throw new NotFoundException(
        `Hospital with ID ${createClinicDto.hospitalId} not found`,
      );
    }

    // Validate department exists and belongs to hospital
    const department = await this.prisma.department.findFirst({
      where: {
        id: createClinicDto.departmentId,
        hospitalId: createClinicDto.hospitalId,
      },
    });
    if (!department) {
      throw new NotFoundException(
        `Department with ID ${createClinicDto.departmentId} not found in this hospital`,
      );
    }

    // Validate doctor exists, belongs to hospital, and has DOCTOR role
    const doctor = await this.prisma.user.findFirst({
      where: {
        id: createClinicDto.doctorId,
        hospitalId: createClinicDto.hospitalId,
        role: UserRole.DOCTOR,
      },
    });
    if (!doctor) {
      throw new BadRequestException(
        `User with ID ${createClinicDto.doctorId} is not a valid doctor in this hospital`,
      );
    }

    // Check for duplicate clinic
    const existingClinic = await this.prisma.clinic.findFirst({
      where: {
        hospitalId: createClinicDto.hospitalId,
        departmentId: createClinicDto.departmentId,
        doctorId: createClinicDto.doctorId,
        name: createClinicDto.name,
      },
    });
    if (existingClinic) {
      throw new ConflictException(
        `A clinic with the same name already exists for this doctor in this department`,
      );
    }

    // Create clinic
    return this.prisma.clinic.create({
      data: {
        hospitalId: createClinicDto.hospitalId,
        departmentId: createClinicDto.departmentId,
        doctorId: createClinicDto.doctorId,
        name: createClinicDto.name,
        opdFee: createClinicDto.opdFee,
        availableDays: createClinicDto.availableDays || [],
        availableFrom: createClinicDto.availableFrom,
        availableTo: createClinicDto.availableTo,
        maxPatientsPerDay: createClinicDto.maxPatientsPerDay,
        status: createClinicDto.status || ClinicStatus.ACTIVE,
      },
      include: {
        hospital: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        doctor: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  /**
   * Get all clinics with filters
   */
  async findAll(query: ClinicQueryDto) {
    const { hospitalId, departmentId, doctorId, status, page = 1, limit = 10 } = query;

    const where: any = {};
    if (hospitalId) where.hospitalId = hospitalId;
    if (departmentId) where.departmentId = departmentId;
    if (doctorId) where.doctorId = doctorId;
    if (status) where.status = status;

    const [clinics, total] = await Promise.all([
      this.prisma.clinic.findMany({
        where,
        include: {
          hospital: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          doctor: { select: { id: true, fullName: true, email: true } },
          _count: {
            select: {
              visits: true,
              tokens: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.clinic.count({ where }),
    ]);

    return {
      data: clinics,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single clinic by ID
   */
  async findOne(id: string) {
    const clinic = await this.prisma.clinic.findUnique({
      where: { id },
      include: {
        hospital: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        doctor: { select: { id: true, fullName: true, email: true, phone: true } },
        _count: {
          select: {
            visits: true,
            tokens: true,
          },
        },
      },
    });

    if (!clinic) {
      throw new NotFoundException(`Clinic with ID ${id} not found`);
    }

    return clinic;
  }

  /**
   * Update a clinic
   */
  async update(id: string, updateClinicDto: UpdateClinicDto) {
    // Ensure clinic exists
    await this.findOne(id);

    // If updating doctor, validate new doctor
    if (updateClinicDto.doctorId) {
      const doctor = await this.prisma.user.findFirst({
        where: {
          id: updateClinicDto.doctorId,
          role: UserRole.DOCTOR,
        },
      });
      if (!doctor) {
        throw new BadRequestException(
          `User with ID ${updateClinicDto.doctorId} is not a valid doctor`,
        );
      }
    }

    return this.prisma.clinic.update({
      where: { id },
      data: updateClinicDto,
      include: {
        hospital: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        doctor: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  /**
   * Delete a clinic
   */
  async remove(id: string) {
    // Ensure clinic exists
    await this.findOne(id);

    // Check if clinic has any visits
    const visitsCount = await this.prisma.visit.count({
      where: { clinicId: id },
    });
    if (visitsCount > 0) {
      throw new BadRequestException(
        `Cannot delete clinic with existing visits. Consider setting status to INACTIVE instead.`,
      );
    }

    return this.prisma.clinic.delete({
      where: { id },
    });
  }

  /**
   * Get clinics by doctor
   */
  async findByDoctor(doctorId: string) {
    return this.prisma.clinic.findMany({
      where: {
        doctorId,
        status: ClinicStatus.ACTIVE,
      },
      include: {
        hospital: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        _count: {
          select: {
            visits: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get clinics by department
   */
  async findByDepartment(departmentId: string) {
    return this.prisma.clinic.findMany({
      where: {
        departmentId,
        status: ClinicStatus.ACTIVE,
      },
      include: {
        doctor: { select: { id: true, fullName: true, email: true } },
        _count: {
          select: {
            visits: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get available clinics (for OPD registration)
   */
  async findAvailable(hospitalId: string, departmentId?: string) {
    const today = new Date();
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const dayOfWeek = days[today.getDay()];

    const where: any = {
      hospitalId,
      status: ClinicStatus.ACTIVE,
    };

    if (departmentId) {
      where.departmentId = departmentId;
    }

    // Filter clinics available today
    where.availableDays = { has: dayOfWeek };

    return this.prisma.clinic.findMany({
      where,
      include: {
        department: { select: { id: true, name: true } },
        doctor: { select: { id: true, fullName: true } },
      },
      orderBy: [
        { department: { name: 'asc' } },
        { name: 'asc' },
      ],
    });
  }

  /**
   * Get today's statistics for a clinic
   */
  async getClinicStats(id: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const clinic = await this.findOne(id);

    const [todayVisits, waitingCount, completedCount] = await Promise.all([
      this.prisma.visit.count({
        where: {
          clinicId: id,
          visitDate: { gte: today, lt: tomorrow },
        },
      }),
      this.prisma.visit.count({
        where: {
          clinicId: id,
          visitDate: { gte: today, lt: tomorrow },
          status: 'WAITING',
        },
      }),
      this.prisma.visit.count({
        where: {
          clinicId: id,
          visitDate: { gte: today, lt: tomorrow },
          status: 'COMPLETED',
        },
      }),
    ]);

    return {
      clinic,
      stats: {
        todayVisits,
        waitingCount,
        completedCount,
        availableSlots: clinic.maxPatientsPerDay
          ? Math.max(0, clinic.maxPatientsPerDay - todayVisits)
          : null,
      },
    };
  }

  /**
   * Get doctors for a hospital (for clinic creation)
   */
  async getDoctors(hospitalId: string) {
    return this.prisma.user.findMany({
      where: {
        hospitalId,
        role: UserRole.DOCTOR,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        fullName: true,
        email: true,
      },
      orderBy: { fullName: 'asc' },
    });
  }
}
