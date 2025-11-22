import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { SearchPatientsDto } from './dto/search-patients.dto';

@Injectable()
export class PatientsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate NR-Number in format: NR-YYYYMMDD-XXXX
   * Example: NR-20251120-0001
   */
  private async generateNRNumber(hospitalId: string): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const datePrefix = `${year}${month}${day}`;

    // Get count of patients registered today for this hospital
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const todayCount = await this.prisma.patient.count({
      where: {
        hospitalId,
        registeredAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const sequence = String(todayCount + 1).padStart(4, '0');
    return `NR-${datePrefix}-${sequence}`;
  }

  /**
   * Register a new patient
   */
  async create(createPatientDto: CreatePatientDto, userId: string, hospitalId: string) {
    // Verify attending doctor if provided
    if (createPatientDto.attendingDoctorId) {
      const doctor = await this.prisma.user.findFirst({
        where: {
          id: createPatientDto.attendingDoctorId,
          hospitalId,
          role: 'DOCTOR',
        },
      });

      if (!doctor) {
        throw new BadRequestException('Invalid attending doctor');
      }
    }

    // Generate NR-Number
    const nrNumber = await this.generateNRNumber(hospitalId);

    // Check for duplicate mobile in same hospital
    if (createPatientDto.mobile) {
      const existingPatient = await this.prisma.patient.findFirst({
        where: {
          hospitalId,
          mobile: createPatientDto.mobile,
        },
      });

      if (existingPatient) {
        throw new ConflictException(
          `Patient with mobile ${createPatientDto.mobile} already registered (NR-Number: ${existingPatient.nrNumber})`,
        );
      }
    }

    // Create patient
    const patient = await this.prisma.patient.create({
      data: {
        hospitalId,
        nrNumber,
        fullName: createPatientDto.fullName,
        mobile: createPatientDto.mobile,
        cnic: createPatientDto.cnic,
        dob: createPatientDto.dob ? new Date(createPatientDto.dob) : null,
        gender: createPatientDto.gender,
        address: createPatientDto.address,
        visitType: createPatientDto.visitType,
        department: createPatientDto.department,
        ward: createPatientDto.ward,
        bed: createPatientDto.bed,
        attendingDoctorId: createPatientDto.attendingDoctorId,
        registeredBy: userId,
      },
      include: {
        attendingDoctor: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        registeredByUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    return patient;
  }

  /**
   * Search and list patients with pagination
   */
  async findAll(searchDto: SearchPatientsDto, hospitalId: string) {
    const { search, nrNumber, cnic, mobile, gender, visitType, attendingDoctorId, limit = 50, page = 1, sortBy = 'registeredAt', sortOrder = 'desc' } = searchDto;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      hospitalId,
    };

    if (search) {
      where.OR = [
        { nrNumber: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search } },
        { cnic: { contains: search } },
      ];
    }

    if (nrNumber) {
      where.nrNumber = { contains: nrNumber, mode: 'insensitive' };
    }

    if (cnic) {
      where.cnic = { contains: cnic };
    }

    if (mobile) {
      where.mobile = { contains: mobile };
    }

    if (gender) {
      where.gender = gender;
    }

    if (visitType) {
      where.visitType = visitType;
    }

    if (attendingDoctorId) {
      where.attendingDoctorId = attendingDoctorId;
    }

    // Get total count
    const total = await this.prisma.patient.count({ where });

    // Get patients
    const patients = await this.prisma.patient.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        attendingDoctor: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        registeredByUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    return {
      data: patients,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find patient by ID
   */
  async findOne(id: string, hospitalId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: {
        id,
        hospitalId,
      },
      include: {
        attendingDoctor: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        registeredByUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        prescriptions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        issueTransactions: {
          orderBy: { issuedAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    return patient;
  }

  /**
   * Find patient by NR-Number
   */
  async findByNRNumber(nrNumber: string, hospitalId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: {
        nrNumber,
        hospitalId,
      },
      include: {
        attendingDoctor: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with NR-Number ${nrNumber} not found`);
    }

    return patient;
  }

  /**
   * Update patient
   */
  async update(id: string, updatePatientDto: UpdatePatientDto, hospitalId: string) {
    // Check if patient exists
    const existingPatient = await this.prisma.patient.findFirst({
      where: {
        id,
        hospitalId,
      },
    });

    if (!existingPatient) {
      throw new NotFoundException('Patient not found');
    }

    // Verify attending doctor if provided
    if (updatePatientDto.attendingDoctorId) {
      const doctor = await this.prisma.user.findFirst({
        where: {
          id: updatePatientDto.attendingDoctorId,
          hospitalId,
          role: 'DOCTOR',
        },
      });

      if (!doctor) {
        throw new BadRequestException('Invalid attending doctor');
      }
    }

    // Update patient
    const patient = await this.prisma.patient.update({
      where: { id },
      data: {
        fullName: updatePatientDto.fullName,
        mobile: updatePatientDto.mobile,
        cnic: updatePatientDto.cnic,
        dob: updatePatientDto.dob ? new Date(updatePatientDto.dob) : undefined,
        gender: updatePatientDto.gender,
        address: updatePatientDto.address,
        visitType: updatePatientDto.visitType,
        department: updatePatientDto.department,
        ward: updatePatientDto.ward,
        bed: updatePatientDto.bed,
        attendingDoctorId: updatePatientDto.attendingDoctorId,
      },
      include: {
        attendingDoctor: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    return patient;
  }

  /**
   * Delete patient (soft delete by removing from active list)
   */
  async remove(id: string, hospitalId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: {
        id,
        hospitalId,
      },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    // Check if patient has any active prescriptions or transactions
    const hasActiveRecords = await this.prisma.prescription.count({
      where: { nrNumber: patient.nrNumber },
    });

    if (hasActiveRecords > 0) {
      throw new BadRequestException('Cannot delete patient with existing prescriptions or transactions');
    }

    // Delete patient
    await this.prisma.patient.delete({
      where: { id },
    });

    return { message: 'Patient deleted successfully' };
  }

  /**
   * Get patient statistics for dashboard
   */
  async getStats(hospitalId: string) {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const [total, todayRegistrations, byVisitType, byGender] = await Promise.all([
      // Total patients
      this.prisma.patient.count({ where: { hospitalId } }),

      // Today's registrations
      this.prisma.patient.count({
        where: {
          hospitalId,
          registeredAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      }),

      // By visit type
      this.prisma.patient.groupBy({
        by: ['visitType'],
        where: { hospitalId },
        _count: true,
      }),

      // By gender
      this.prisma.patient.groupBy({
        by: ['gender'],
        where: { hospitalId },
        _count: true,
      }),
    ]);

    return {
      total,
      todayRegistrations,
      byVisitType: byVisitType.reduce((acc, item) => {
        acc[item.visitType] = item._count;
        return acc;
      }, {}),
      byGender: byGender.reduce((acc, item) => {
        acc[item.gender] = item._count;
        return acc;
      }, {}),
    };
  }
}
