import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateAdmissionDto } from './dto/create-admission.dto';
import { UpdateAdmissionDto } from './dto/update-admission.dto';
import { DischargeAdmissionDto } from './dto/discharge-admission.dto';
import { AdmissionQueryDto } from './dto/admission-query.dto';
import { AdmissionStatus, BedStatus, Prisma, ReceiptType, PaymentStatus, PaymentMethod } from '@prisma/client';

@Injectable()
export class AdmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateAdmissionNumber(hospitalId: string): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const prefix = `ADM-${year}${month}${day}`;

    // Get the last admission number for today
    const lastAdmission = await this.prisma.admission.findFirst({
      where: {
        hospitalId,
        admissionNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    let sequence = 1;
    if (lastAdmission) {
      const lastSequence = parseInt(lastAdmission.admissionNumber.split('-')[3]);
      sequence = lastSequence + 1;
    }

    return `${prefix}-${String(sequence).padStart(4, '0')}`;
  }

  async create(createAdmissionDto: CreateAdmissionDto) {
    const {
      hospitalId,
      patientId,
      visitId,
      departmentId,
      roomId,
      bedId,
      attendingDoctorId,
      admittingUserId,
      ...rest
    } = createAdmissionDto;

    // Validate entities exist
    const [hospital, patient, department, attendingDoctor, admittingUser] =
      await Promise.all([
        this.prisma.hospital.findUnique({ where: { id: hospitalId } }),
        this.prisma.patient.findUnique({ where: { id: patientId } }),
        this.prisma.department.findUnique({ where: { id: departmentId } }),
        this.prisma.user.findUnique({ where: { id: attendingDoctorId } }),
        this.prisma.user.findUnique({ where: { id: admittingUserId } }),
      ]);

    if (!hospital) throw new NotFoundException('Hospital not found');
    if (!patient) throw new NotFoundException('Patient not found');
    if (!department) throw new NotFoundException('Department not found');
    if (!attendingDoctor) throw new NotFoundException('Attending doctor not found');
    if (!admittingUser) throw new NotFoundException('Admitting user not found');

    // Check if patient already has an active admission
    const activeAdmission = await this.prisma.admission.findFirst({
      where: {
        patientId,
        status: AdmissionStatus.ADMITTED,
      },
    });

    if (activeAdmission) {
      throw new ConflictException(
        'Patient already has an active admission. Please discharge the patient first.',
      );
    }

    let room = null;
    let bed = null;
    let roomCharges = new Prisma.Decimal(0);
    let bedCharges = new Prisma.Decimal(0);

    // Validate and assign room if provided
    if (roomId) {
      room = await this.prisma.room.findUnique({ where: { id: roomId } });
      if (!room) throw new NotFoundException('Room not found');
      if (room.status !== 'AVAILABLE') {
        throw new BadRequestException('Selected room is not available');
      }
      roomCharges = room.dailyRate;
    }

    // Validate and assign bed if provided
    if (bedId) {
      bed = await this.prisma.bed.findUnique({ where: { id: bedId } });
      if (!bed) throw new NotFoundException('Bed not found');
      if (bed.status !== BedStatus.AVAILABLE) {
        throw new BadRequestException('Selected bed is not available');
      }
      bedCharges = bed.dailyRate;
    }

    // Generate admission number
    const admissionNumber = await this.generateAdmissionNumber(hospitalId);

    // Create admission in a transaction
    const admission = await this.prisma.$transaction(async (tx) => {
      // Create admission
      const newAdmission = await tx.admission.create({
        data: {
          hospitalId,
          patientId,
          visitId,
          departmentId,
          roomId,
          bedId,
          attendingDoctorId,
          admittingUserId,
          admissionNumber,
          ...rest,
        },
        include: {
          patient: {
            select: {
              id: true,
              nrNumber: true,
              fullName: true,
              gender: true,
              mobile: true,
            },
          },
          department: {
            select: { id: true, name: true, code: true },
          },
          room: {
            select: { id: true, roomNumber: true, roomType: true, dailyRate: true },
          },
          bed: {
            select: { id: true, bedNumber: true, bedType: true, dailyRate: true },
          },
          attendingDoctor: {
            select: { id: true, fullName: true },
          },
          admittingUser: {
            select: { id: true, fullName: true },
          },
        },
      });

      // Update bed status to OCCUPIED if assigned
      if (bedId) {
        await tx.bed.update({
          where: { id: bedId },
          data: { status: BedStatus.OCCUPIED },
        });
      }

      // Update room status to OCCUPIED if assigned and all beds are occupied
      if (roomId) {
        await tx.room.update({
          where: { id: roomId },
          data: { status: 'OCCUPIED' },
        });
      }

      // Create first daily charge entry
      await tx.dailyCharge.create({
        data: {
          hospitalId,
          admissionId: newAdmission.id,
          chargeDate: new Date(),
          roomCharges,
          bedCharges,
          totalCharges: new Prisma.Decimal(roomCharges).plus(bedCharges),
        },
      });

      return newAdmission;
    });

    return admission;
  }

  async findAll(query: AdmissionQueryDto) {
    const {
      hospitalId,
      patientId,
      departmentId,
      roomId,
      bedId,
      admissionType,
      status,
      admittedFrom,
      admittedTo,
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.AdmissionWhereInput = {};

    if (hospitalId) where.hospitalId = hospitalId;
    if (patientId) where.patientId = patientId;
    if (departmentId) where.departmentId = departmentId;
    if (roomId) where.roomId = roomId;
    if (bedId) where.bedId = bedId;
    if (admissionType) where.admissionType = admissionType;
    if (status) where.status = status;

    if (admittedFrom || admittedTo) {
      where.admittedAt = {};
      if (admittedFrom) where.admittedAt.gte = new Date(admittedFrom);
      if (admittedTo) where.admittedAt.lte = new Date(admittedTo);
    }

    const skip = (page - 1) * limit;

    const [admissions, total] = await Promise.all([
      this.prisma.admission.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ admittedAt: 'desc' }],
        include: {
          patient: {
            select: {
              id: true,
              nrNumber: true,
              fullName: true,
              gender: true,
              mobile: true,
            },
          },
          department: {
            select: { id: true, name: true, code: true },
          },
          room: {
            select: { id: true, roomNumber: true, roomType: true },
          },
          bed: {
            select: { id: true, bedNumber: true, bedType: true },
          },
          attendingDoctor: {
            select: { id: true, fullName: true },
          },
        },
      }),
      this.prisma.admission.count({ where }),
    ]);

    return {
      data: admissions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const admission = await this.prisma.admission.findUnique({
      where: { id },
      include: {
        patient: true,
        visit: true,
        department: true,
        room: true,
        bed: true,
        attendingDoctor: {
          select: { id: true, fullName: true, role: true },
        },
        admittingUser: {
          select: { id: true, fullName: true },
        },
        dischargingUser: {
          select: { id: true, fullName: true },
        },
        dailyCharges: {
          orderBy: { chargeDate: 'desc' },
        },
      },
    });

    if (!admission) {
      throw new NotFoundException(`Admission with ID ${id} not found`);
    }

    // Calculate total charges
    const totalCharges = admission.dailyCharges.reduce(
      (sum, charge) => sum.plus(charge.totalCharges),
      new Prisma.Decimal(0),
    );

    // Calculate duration
    const admittedDate = new Date(admission.admittedAt);
    const endDate = admission.dischargedAt
      ? new Date(admission.dischargedAt)
      : new Date();
    const durationDays = Math.ceil(
      (endDate.getTime() - admittedDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      ...admission,
      totalCharges: totalCharges.toString(),
      durationDays,
    };
  }

  async update(id: string, updateAdmissionDto: UpdateAdmissionDto) {
    const admission = await this.prisma.admission.findUnique({
      where: { id },
      include: { bed: true, room: true },
    });

    if (!admission) {
      throw new NotFoundException(`Admission with ID ${id} not found`);
    }

    if (admission.status !== AdmissionStatus.ADMITTED) {
      throw new BadRequestException(
        'Cannot update admission that is not in ADMITTED status',
      );
    }

    const { bedId, roomId, ...rest } = updateAdmissionDto;

    return this.prisma.$transaction(async (tx) => {
      // Handle bed change
      if (bedId && bedId !== admission.bedId) {
        // Release old bed
        if (admission.bedId) {
          await tx.bed.update({
            where: { id: admission.bedId },
            data: { status: BedStatus.AVAILABLE },
          });
        }

        // Occupy new bed
        const newBed = await tx.bed.findUnique({ where: { id: bedId } });
        if (!newBed) throw new NotFoundException('New bed not found');
        if (newBed.status !== BedStatus.AVAILABLE) {
          throw new BadRequestException('New bed is not available');
        }

        await tx.bed.update({
          where: { id: bedId },
          data: { status: BedStatus.OCCUPIED },
        });
      }

      // Update admission
      return tx.admission.update({
        where: { id },
        data: {
          bedId,
          roomId,
          ...rest,
        },
        include: {
          patient: true,
          department: true,
          room: true,
          bed: true,
          attendingDoctor: {
            select: { id: true, fullName: true },
          },
        },
      });
    });
  }

  async discharge(id: string, dischargeDto: DischargeAdmissionDto) {
    const admission = await this.prisma.admission.findUnique({
      where: { id },
      include: { bed: true, room: true, dailyCharges: true, patient: true, department: true },
    });

    if (!admission) {
      throw new NotFoundException(`Admission with ID ${id} not found`);
    }

    if (admission.status !== AdmissionStatus.ADMITTED) {
      throw new BadRequestException('Admission is already discharged or cancelled');
    }

    const { dischargingUserId, dischargedAt, dischargeSummary, diagnosisOnDischarge } =
      dischargeDto;

    // Validate discharging user
    const dischargingUser = await this.prisma.user.findUnique({
      where: { id: dischargingUserId },
    });

    if (!dischargingUser) {
      throw new NotFoundException('Discharging user not found');
    }

    const dischargeDate = new Date(dischargedAt);

    const roomCharges = admission.dailyCharges.length
      ? admission.dailyCharges.reduce(
          (sum, charge) => sum.plus(charge.totalCharges),
          new Prisma.Decimal(0),
        )
      : this.calculateRoomCharges(admission, dischargeDate);

    return this.prisma.$transaction(async (tx) => {
      const [operationCharges, labCharges, pharmacyCharges, opdCharges] = await Promise.all([
        this.sumOperationCharges(tx, admission.id),
        this.sumLabCharges(tx, admission.patientId, admission.admittedAt, dischargeDate),
        this.sumPharmacyCharges(tx, admission.patient.nrNumber, admission.admittedAt, dischargeDate),
        this.sumOpdCharges(tx, admission.visitId),
      ]);

      const totalCharges = roomCharges
        .plus(operationCharges)
        .plus(labCharges)
        .plus(pharmacyCharges)
        .plus(opdCharges);

      // Update admission
      const dischargedAdmission = await tx.admission.update({
        where: { id },
        data: {
          status: AdmissionStatus.DISCHARGED,
          dischargedAt: dischargeDate,
          dischargingUserId,
          dischargeSummary,
          diagnosisOnDischarge,
        },
        include: {
          patient: true,
          department: true,
          room: true,
          bed: true,
          attendingDoctor: {
            select: { id: true, fullName: true },
          },
          dischargingUser: {
            select: { id: true, fullName: true },
          },
          dailyCharges: true,
        },
      });

      // Release bed
      if (admission.bedId) {
        await tx.bed.update({
          where: { id: admission.bedId },
          data: { status: BedStatus.AVAILABLE },
        });
      }

      // Update room status
      if (admission.roomId) {
        await tx.room.update({
          where: { id: admission.roomId },
          data: { status: 'AVAILABLE' },
        });
      }

      const receiptNumber = await this.generateReceiptNumber(tx);

      const receiptNotes = JSON.stringify({
        roomCharges: roomCharges.toString(),
        operationCharges: operationCharges.toString(),
        labCharges: labCharges.toString(),
        pharmacyCharges: pharmacyCharges.toString(),
        opdCharges: opdCharges.toString(),
      });

      const receipt = await tx.receipt.create({
        data: {
          hospitalId: admission.hospitalId,
          patientId: admission.patientId,
          visitId: admission.visitId || undefined,
          departmentId: admission.departmentId,
          generatedById: dischargingUserId,
          receiptNumber,
          receiptType: ReceiptType.ADMISSION,
          description: `Final bill for admission ${admission.admissionNumber}`,
          amount: totalCharges,
          discount: new Prisma.Decimal(0),
          tax: new Prisma.Decimal(0),
          totalAmount: totalCharges,
          paidAmount: new Prisma.Decimal(0),
          paymentMethod: PaymentMethod.CASH,
          paymentStatus: PaymentStatus.UNPAID,
          notes: receiptNotes,
        },
      });

      return {
        ...dischargedAdmission,
        totalCharges: totalCharges.toString(),
        receipt,
      };
    });
  }

  async getActiveAdmissions(hospitalId: string) {
    return this.prisma.admission.findMany({
      where: {
        hospitalId,
        status: AdmissionStatus.ADMITTED,
      },
      include: {
        patient: {
          select: {
            id: true,
            nrNumber: true,
            fullName: true,
            gender: true,
          },
        },
        department: {
          select: { id: true, name: true, code: true },
        },
        room: {
          select: { id: true, roomNumber: true, roomType: true },
        },
        bed: {
          select: { id: true, bedNumber: true },
        },
        attendingDoctor: {
          select: { id: true, fullName: true },
        },
      },
      orderBy: { admittedAt: 'asc' },
    });
  }

  private calculateRoomCharges(admission: any, dischargeDate: Date) {
    const rate = admission.bed?.dailyRate || admission.room?.dailyRate || new Prisma.Decimal(0);
    const admittedAt = new Date(admission.admittedAt);
    const diffMs = Math.max(dischargeDate.getTime() - admittedAt.getTime(), 0);
    const days = Math.max(Math.ceil(diffMs / (1000 * 60 * 60 * 24)), 1);
    return new Prisma.Decimal(rate).mul(days);
  }

  private async sumOperationCharges(tx: Prisma.TransactionClient, admissionId: string) {
    const operations = await (tx as any).operation.findMany({
      where: { admissionId, status: { not: 'CANCELLED' } },
      select: { operationPrice: true },
    });
    return operations.reduce(
      (sum: Prisma.Decimal, operation: any) =>
        operation.operationPrice ? sum.plus(operation.operationPrice) : sum,
      new Prisma.Decimal(0),
    );
  }

  private async sumLabCharges(
    tx: Prisma.TransactionClient,
    patientId: string,
    admittedAt: Date,
    dischargedAt: Date,
  ) {
    const labOrders = await tx.labOrder.findMany({
      where: {
        patientId,
        status: { not: 'CANCELLED' },
        createdAt: { gte: admittedAt, lte: dischargedAt },
      },
      include: { labTest: { select: { price: true } } },
    });

    return labOrders.reduce(
      (sum, order) => (order.labTest?.price ? sum.plus(order.labTest.price) : sum),
      new Prisma.Decimal(0),
    );
  }

  private async sumPharmacyCharges(
    tx: Prisma.TransactionClient,
    nrNumber: string,
    admittedAt: Date,
    dischargedAt: Date,
  ) {
    const issueTransactions = await tx.issueTransaction.findMany({
      where: {
        nrNumber,
        issuedAt: { gte: admittedAt, lte: dischargedAt },
      },
      select: { totalAmount: true },
    });

    return issueTransactions.reduce(
      (sum, issue) => sum.plus(issue.totalAmount),
      new Prisma.Decimal(0),
    );
  }

  private async sumOpdCharges(tx: Prisma.TransactionClient, visitId?: string | null) {
    if (!visitId) {
      return new Prisma.Decimal(0);
    }
    const visit = await tx.visit.findUnique({
      where: { id: visitId },
      select: { consultationFee: true },
    });
    return new Prisma.Decimal(visit?.consultationFee || 0);
  }

  private async generateReceiptNumber(tx: Prisma.TransactionClient) {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    const lastReceipt = await tx.receipt.findFirst({
      where: { receiptNumber: { startsWith: `REC-${dateStr}` } },
      orderBy: { receiptNumber: 'desc' },
    });

    const sequence = lastReceipt
      ? parseInt(lastReceipt.receiptNumber.split('-')[2]) + 1
      : 1;

    return `REC-${dateStr}-${sequence.toString().padStart(4, '0')}`;
  }
}
