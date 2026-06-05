import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { CreateVisitDto, UpdateVisitDto, VisitQueryDto } from './dto';
import { VisitStatus, PaymentStatus, TokenStatus, ReceiptType, PaymentMethod, VisitType } from '@prisma/client';

@Injectable()
export class VisitsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate Visit Number in format: PV-YYYYMMDD-XXXX
   */
  private async generateVisitNumber(hospitalId: string): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const datePrefix = `${year}${month}${day}`;

    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const todayCount = await this.prisma.visit.count({
      where: {
        hospitalId,
        visitDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const sequence = String(todayCount + 1).padStart(4, '0');
    return `PV-${datePrefix}-${sequence}`;
  }

  /**
   * Create a new visit with token generation
   */
  async create(createVisitDto: CreateVisitDto) {
    const visitNumber = await this.generateVisitNumber(createVisitDto.hospitalId);

    // Validate patient exists
    const patient = await this.prisma.patient.findUnique({
      where: { id: createVisitDto.patientId },
    });
    if (!patient) {
      throw new NotFoundException(`Patient with ID ${createVisitDto.patientId} not found`);
    }

    if (createVisitDto.visitType === VisitType.WARD_INDOOR && !createVisitDto.wardId && !createVisitDto.bedId) {
      throw new BadRequestException('Ward or bed is required for indoor visits');
    }

    if (createVisitDto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: {
          id: createVisitDto.departmentId,
          hospitalId: createVisitDto.hospitalId,
        },
      });

      if (!department) {
        throw new BadRequestException('Invalid department');
      }
    }

    if (createVisitDto.bedId) {
      const bed = await this.prisma.bed.findFirst({
        where: {
          id: createVisitDto.bedId,
          hospitalId: createVisitDto.hospitalId,
        },
      });

      if (!bed) {
        throw new BadRequestException('Invalid bed');
      }
    }

    if (createVisitDto.attendingDoctorId) {
      const doctor = await this.prisma.user.findFirst({
        where: {
          id: createVisitDto.attendingDoctorId,
          hospitalId: createVisitDto.hospitalId,
          role: 'DOCTOR',
        },
      });

      if (!doctor) {
        throw new BadRequestException('Invalid attending doctor');
      }
    }

    if (createVisitDto.visitType !== VisitType.OPD && createVisitDto.clinicId) {
      throw new BadRequestException('clinicId is only applicable for OPD visits');
    }

    // Create a simple visit (no clinic/token) for non-OPD visits, or for OPD
    // visits registered without a clinic since visit info is optional
    if (createVisitDto.visitType !== VisitType.OPD || !createVisitDto.clinicId) {
      const prisma = this.prisma as any;
      const visit = await prisma.visit.create({
        data: {
          hospitalId: createVisitDto.hospitalId,
          patientId: createVisitDto.patientId,
          registrarId: createVisitDto.registrarId,
          visitNumber,
          visitType: createVisitDto.visitType,
          departmentId: createVisitDto.departmentId,
          wardId: createVisitDto.wardId,
          bedId: createVisitDto.bedId,
          attendingDoctorId: createVisitDto.attendingDoctorId,
          tokenNumber: 0,
          consultationFee: 0,
          chiefComplaint: createVisitDto.chiefComplaint,
          vitalSigns: createVisitDto.vitalSigns ? JSON.parse(JSON.stringify(createVisitDto.vitalSigns)) : {},
          notes: createVisitDto.notes,
          status: VisitStatus.WAITING,
          paymentStatus: PaymentStatus.UNPAID,
        },
        include: {
          patient: { select: { id: true, fullName: true, nrNumber: true, mobile: true } },
          department: { select: { id: true, name: true } },
          bed: { select: { id: true, bedNumber: true } },
          registrar: { select: { id: true, fullName: true } },
          attendingDoctor: { select: { id: true, fullName: true } },
        },
      });

      return { visit };
    }

    // At this point an OPD clinic was provided — validate it exists and is active
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: createVisitDto.clinicId },
      include: {
        hospital: true,
        department: true,
        doctor: true,
      },
    });
    if (!clinic) {
      throw new NotFoundException(`Clinic with ID ${createVisitDto.clinicId} not found`);
    }
    if (clinic.status !== 'ACTIVE') {
      throw new BadRequestException(`Clinic is not currently active`);
    }

    // Get today's date for token generation
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if max patients reached for today
    if (clinic.maxPatientsPerDay) {
      const todayVisits = await this.prisma.visit.count({
        where: {
          clinicId: clinic.id,
          visitDate: { gte: today },
        },
      });
      if (todayVisits >= clinic.maxPatientsPerDay) {
        throw new BadRequestException(
          `Maximum patients for today (${clinic.maxPatientsPerDay}) has been reached`,
        );
      }
    }

    // Generate token number for today
    const lastToken = await this.prisma.token.findFirst({
      where: {
        clinicId: clinic.id,
        tokenDate: today,
      },
      orderBy: { tokenNumber: 'desc' },
    });
    const nextTokenNumber = (lastToken?.tokenNumber || 0) + 1;

    // Create token first
    const token = await this.prisma.token.create({
      data: {
        hospitalId: clinic.hospitalId,
        clinicId: clinic.id,
        tokenNumber: nextTokenNumber,
        tokenDate: today,
        status: TokenStatus.WAITING,
      },
    });

    // Create visit with token
    const prisma = this.prisma as any;
    const visit = await prisma.visit.create({
      data: {
        hospitalId: clinic.hospitalId,
        patientId: createVisitDto.patientId,
        clinicId: clinic.id,
        tokenId: token.id,
        registrarId: createVisitDto.registrarId,
        visitNumber,
        visitType: VisitType.OPD,
        departmentId: clinic.departmentId,
        attendingDoctorId: clinic.doctorId,
        tokenNumber: nextTokenNumber,
        consultationFee: clinic.opdFee,
        chiefComplaint: createVisitDto.chiefComplaint,
        vitalSigns: createVisitDto.vitalSigns ? JSON.parse(JSON.stringify(createVisitDto.vitalSigns)) : {},
        notes: createVisitDto.notes,
        status: VisitStatus.WAITING,
        paymentStatus: PaymentStatus.UNPAID,
      },
      include: {
        patient: { select: { id: true, fullName: true, nrNumber: true, mobile: true } },
        clinic: {
          include: {
            department: { select: { id: true, name: true } },
            doctor: { select: { id: true, fullName: true } },
          },
        },
        token: true,
        registrar: { select: { id: true, fullName: true } },
      },
    });

    await this.generateReceipt(visit.id, createVisitDto.registrarId);

    return {
      visit,
      token: {
        tokenNumber: nextTokenNumber,
        date: today,
        clinic: clinic.name,
        doctor: clinic.doctor.fullName,
        department: clinic.department.name,
        fee: Number(clinic.opdFee),
      },
    };
  }

  /**
   * Get all visits with filters
   */
  async findAll(query: VisitQueryDto) {
    const {
      hospitalId,
      clinicId,
      patientId,
      consultantId,
      visitType,
      departmentId,
      attendingDoctorId,
      status,
      paymentStatus,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = query;

    const where: any = {};
    if (hospitalId) where.hospitalId = hospitalId;
    if (clinicId) where.clinicId = clinicId;
    if (patientId) where.patientId = patientId;
    if (consultantId) where.consultantId = consultantId;
    if (visitType) where.visitType = visitType;
    if (departmentId) where.departmentId = departmentId;
    if (attendingDoctorId) where.attendingDoctorId = attendingDoctorId;
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (startDate || endDate) {
      where.visitDate = {};
      if (startDate) where.visitDate.gte = new Date(startDate);
      if (endDate) where.visitDate.lte = new Date(endDate);
    }

    const prisma = this.prisma as any;
    const [visits, total] = await Promise.all([
      prisma.visit.findMany({
        where,
        include: {
          patient: { select: { id: true, fullName: true, nrNumber: true } },
          clinic: {
            select: {
              id: true,
              name: true,
              opdFee: true,
              department: { select: { id: true, name: true } },
              doctor: { select: { id: true, fullName: true } },
            },
          },
          department: { select: { id: true, name: true } },
          bed: {
            select: {
              id: true,
              bedNumber: true,
              bedType: true,
              dailyRate: true,
              room: {
                select: {
                  id: true,
                  roomNumber: true,
                  roomType: true,
                  dailyRate: true,
                },
              },
            },
          },
          registrar: { select: { id: true, fullName: true } },
          consultant: { select: { id: true, fullName: true } },
        },
        orderBy: { visitDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.visit.count({ where }),
    ]);

    return {
      data: visits,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single visit by ID
   */
  async findOne(id: string) {
    let visit = await this.prisma.visit.findUnique({
      where: { id },
      include: {
        patient: true,
        clinic: {
          include: {
            department: true,
            doctor: { select: { id: true, fullName: true, email: true, phone: true } },
          },
        },
        token: true,
        registrar: { select: { id: true, fullName: true } },
        consultant: { select: { id: true, fullName: true } },
        referrals: {
          include: {
            toDepartment: { select: { id: true, name: true } },
          },
        },
        receipts: true,
      },
    });

    if (!visit) {
      visit = await this.prisma.visit.findFirst({
        where: { tokenId: id },
        include: {
          patient: true,
          clinic: {
            include: {
              department: true,
              doctor: { select: { id: true, fullName: true, email: true, phone: true } },
            },
          },
          token: true,
          registrar: { select: { id: true, fullName: true } },
          consultant: { select: { id: true, fullName: true } },
          referrals: {
            include: {
              toDepartment: { select: { id: true, name: true } },
            },
          },
          receipts: true,
        },
      });
    }

    if (!visit) {
      throw new NotFoundException(`Visit with ID ${id} not found`);
    }

    return visit;
  }

  /**
   * Update a visit (consultation)
   */
  async update(id: string, updateVisitDto: UpdateVisitDto, consultantId?: string) {
    // Ensure visit exists
    const visit = await this.findOne(id);

    const data: any = { ...updateVisitDto };

    // If consultant is updating, set consultantId and consultedAt
    if (consultantId && !data.consultantId) {
      data.consultantId = consultantId;
      data.consultedAt = new Date();
    }

    return this.prisma.visit.update({
      where: { id: visit.id },
      data,
      include: {
        patient: { select: { id: true, fullName: true, nrNumber: true } },
        clinic: {
          include: {
            department: { select: { id: true, name: true } },
            doctor: { select: { id: true, fullName: true } },
          },
        },
        consultant: { select: { id: true, fullName: true } },
      },
    });
  }

  /**
   * Cancel a visit
   */
  async cancel(id: string) {
    const visit = await this.findOne(id);

    if (visit.status === VisitStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed visit');
    }

    // Update visit and token status
    await this.prisma.$transaction([
      this.prisma.visit.update({
        where: { id: visit.id },
        data: { status: VisitStatus.CANCELLED },
      }),
      ...(visit.tokenId
        ? [
            this.prisma.token.update({
              where: { id: visit.tokenId },
              data: { status: TokenStatus.CANCELLED },
            }),
          ]
        : []),
    ]);

    return { message: 'Visit cancelled successfully' };
  }

  /**
   * Mark visit as complete
   */
  async complete(id: string) {
    const visit = await this.findOne(id);

    if (visit.status === VisitStatus.COMPLETED) {
      throw new BadRequestException('Visit is already completed');
    }
    if (visit.status === VisitStatus.CANCELLED) {
      throw new BadRequestException('Cannot complete a cancelled visit');
    }

    // Update visit and token status
    await this.prisma.$transaction([
      this.prisma.visit.update({
        where: { id: visit.id },
        data: {
          status: VisitStatus.COMPLETED,
          completedAt: new Date(),
        },
      }),
      ...(visit.tokenId
        ? [
            this.prisma.token.update({
              where: { id: visit.tokenId },
              data: { status: TokenStatus.COMPLETED },
            }),
          ]
        : []),
    ]);

    return { message: 'Visit completed successfully' };
  }

  /**
   * Call next patient (update token status)
   */
  async callNext(clinicId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the next waiting token
    const nextToken = await this.prisma.token.findFirst({
      where: {
        clinicId,
        tokenDate: today,
        status: TokenStatus.WAITING,
      },
      orderBy: { tokenNumber: 'asc' },
      include: {
        visits: {
          include: {
            patient: { select: { id: true, fullName: true, nrNumber: true } },
          },
        },
      },
    });

    if (!nextToken) {
      throw new NotFoundException('No waiting patients in queue');
    }

    // Update token and visit status
    await this.prisma.$transaction([
      this.prisma.token.update({
        where: { id: nextToken.id },
        data: {
          status: TokenStatus.CALLED,
          calledAt: new Date(),
        },
      }),
      ...nextToken.visits.map((visit) =>
        this.prisma.visit.update({
          where: { id: visit.id },
          data: { status: VisitStatus.CALLED },
        }),
      ),
    ]);

    return {
      token: nextToken,
      patient: nextToken.visits[0]?.patient,
      message: `Token ${nextToken.tokenNumber} called`,
    };
  }

  /**
   * Start consultation
   */
  async startConsultation(id: string, consultantId: string) {
    const visit = await this.findOne(id);

    if (visit.status === VisitStatus.COMPLETED) {
      throw new BadRequestException('Visit is already completed');
    }

    // Update visit and token status
    await this.prisma.$transaction([
      this.prisma.visit.update({
        where: { id },
        data: {
          status: VisitStatus.IN_PROGRESS,
          consultantId,
          consultedAt: new Date(),
        },
      }),
      ...(visit.tokenId
        ? [
            this.prisma.token.update({
              where: { id: visit.tokenId },
              data: { status: TokenStatus.IN_PROGRESS },
            }),
          ]
        : []),
    ]);

    return this.findOne(id);
  }

  /**
   * Get today's visits for a clinic (queue)
   */
  async findTodayByClinic(clinicId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.prisma.visit.findMany({
      where: {
        clinicId,
        visitDate: { gte: today, lt: tomorrow },
      },
      include: {
        patient: { select: { id: true, fullName: true, nrNumber: true, gender: true } },
        token: true,
      },
      orderBy: { tokenNumber: 'asc' },
    });
  }

  /**
   * Get patient visit history
   */
  async findByPatient(patientId: string, limit = 10) {
    return this.prisma.visit.findMany({
      where: { patientId },
      include: {
        clinic: {
          include: {
            department: { select: { id: true, name: true } },
            doctor: { select: { id: true, fullName: true } },
          },
        },
        consultant: { select: { id: true, fullName: true } },
      },
      orderBy: { visitDate: 'desc' },
      take: limit,
    });
  }

  /**
   * Generate receipt for visit
   */
  async generateReceipt(id: string, generatedById: string) {
    const visit = await this.findOne(id);

    // Check if receipt already exists
    const existingReceipt = await this.prisma.receipt.findFirst({
      where: { visitId: id },
    });
    if (existingReceipt) {
      return existingReceipt;
    }

    // Generate receipt number
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const lastReceipt = await this.prisma.receipt.findFirst({
      where: {
        receiptNumber: { startsWith: `REC-${dateStr}` },
      },
      orderBy: { receiptNumber: 'desc' },
    });
    const sequence = lastReceipt
      ? parseInt(lastReceipt.receiptNumber.split('-')[2]) + 1
      : 1;
    const receiptNumber = `REC-${dateStr}-${sequence.toString().padStart(4, '0')}`;

    // Create receipt
    const prisma = this.prisma as any;
    const receipt = await prisma.receipt.create({
      data: {
        hospitalId: visit.hospitalId,
        patientId: visit.patientId,
        visitId: visit.id,
        departmentId: visit.clinic.department.id,
        generatedById,
        receiptNumber,
        receiptType: ReceiptType.OPD_CONSULTATION,
        description: `OPD Consultation - ${visit.clinic.name}`,
        amount: visit.consultationFee,
        totalAmount: visit.consultationFee,
        paidAmount: 0,
        paymentMethod: PaymentMethod.CASH,
        paymentStatus: PaymentStatus.UNPAID,
      },
    });

    return receipt;
  }

  /**
   * Mark visit as paid
   */
  async markAsPaid(id: string, paymentMethod: PaymentMethod = PaymentMethod.CASH) {
    const visit = await this.findOne(id);

    // Update visit payment status
    await this.prisma.visit.update({
      where: { id },
      data: { paymentStatus: PaymentStatus.PAID },
    });

    // Update receipt if exists
    const receipt = await this.prisma.receipt.findFirst({
      where: { visitId: id },
    });
    if (receipt) {
      await this.prisma.receipt.update({
        where: { id: receipt.id },
        data: {
          paymentStatus: PaymentStatus.PAID,
          paymentMethod,
          paidAt: new Date(),
        },
      });
    }

    return { message: 'Payment recorded successfully' };
  }
}
