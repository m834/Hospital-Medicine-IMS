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
import { AdmissionStatus, BedStatus, RoomStatus, Prisma, ReceiptType, PaymentStatus, PaymentMethod } from '@prisma/client';

@Injectable()
export class AdmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateAdmissionNumber(
    hospitalId: string,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const prefix = `ADM-${year}${month}${day}`;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const sequence = Math.floor(1000 + Math.random() * 9000);
      const admissionNumber = `${prefix}-${sequence}`;

      const existing = await db.admission.findUnique({
        where: { admissionNumber },
        select: { id: true },
      });

      if (!existing) {
        return admissionNumber;
      }
    }

    throw new ConflictException('Unable to generate unique admission number');
  }

  /**
   * Admit a patient and occupy their bed.
   *
   * tx: run inside the caller's transaction — indoor registration saves the
   * patient, the visit and the admission together. Without it the admission
   * gets a transaction of its own, retried on an admission-number collision.
   */
  async create(createAdmissionDto: CreateAdmissionDto, tx?: Prisma.TransactionClient) {
    if (tx) return this.createWithin(tx, createAdmissionDto);

    const maxAttempts = 3;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        return await this.prisma.$transaction((t) => this.createWithin(t, createAdmissionDto));
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          attempt < maxAttempts - 1
        ) {
          continue;
        }
        throw error;
      }
    }
  }

  private async createWithin(tx: Prisma.TransactionClient, createAdmissionDto: CreateAdmissionDto) {
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
        tx.hospital.findUnique({ where: { id: hospitalId } }),
        tx.patient.findUnique({ where: { id: patientId } }),
        tx.department.findUnique({ where: { id: departmentId } }),
        tx.user.findUnique({ where: { id: attendingDoctorId } }),
        tx.user.findUnique({ where: { id: admittingUserId } }),
      ]);

    if (!hospital) throw new NotFoundException('Hospital not found');
    if (!patient) throw new NotFoundException('Patient not found');
    if (!department) throw new NotFoundException('Department not found');
    if (!attendingDoctor) throw new NotFoundException('Attending doctor not found');
    if (!admittingUser) throw new NotFoundException('Admitting user not found');

    // Check if patient already has an active admission
    const activeAdmission = await tx.admission.findFirst({
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

    let roomCharges = new Prisma.Decimal(0);
    let bedCharges = new Prisma.Decimal(0);

    // A room is judged by its beds, not by a room-wide flag: a ward with a
    // free bed takes the next patient. Only a room taken out of service is
    // refused outright.
    if (roomId) {
      const room = await tx.room.findUnique({ where: { id: roomId } });
      if (!room || room.hospitalId !== hospitalId) throw new NotFoundException('Room not found');
      if (room.status === RoomStatus.MAINTENANCE || room.status === RoomStatus.RESERVED) {
        throw new BadRequestException(`Selected room is ${room.status.toLowerCase()}`);
      }
      roomCharges = room.dailyRate;
    }

    if (bedId) {
      const bed = await tx.bed.findUnique({ where: { id: bedId } });
      if (!bed || bed.hospitalId !== hospitalId) throw new NotFoundException('Bed not found');
      if (roomId && bed.roomId !== roomId) {
        throw new BadRequestException('Selected bed is not in the selected room');
      }
      if (bed.status !== BedStatus.AVAILABLE) {
        throw new BadRequestException('Selected bed is not available');
      }
      bedCharges = bed.dailyRate;
    }

    const admissionNumber = await this.generateAdmissionNumber(hospitalId, tx);

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

    if (bedId) await this.occupyBed(tx, bedId);
    if (roomId) await this.syncRoomStatus(tx, roomId);

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
  }

  /**
   * Take a bed, only if it is still free. Checked and written in one
   * statement, so two desks admitting into the same bed at the same moment
   * cannot both have it — the second is refused and its transaction undone.
   */
  private async occupyBed(tx: Prisma.TransactionClient, bedId: string) {
    const taken = await tx.bed.updateMany({
      where: { id: bedId, status: BedStatus.AVAILABLE },
      data: { status: BedStatus.OCCUPIED },
    });

    if (taken.count !== 1) {
      throw new ConflictException(
        'Selected bed was just taken by another admission. Please choose another bed.',
      );
    }
  }

  /** Give a bed back once its patient has left it. */
  private async releaseBed(tx: Prisma.TransactionClient, bedId: string) {
    await tx.bed.updateMany({
      where: { id: bedId, status: BedStatus.OCCUPIED },
      data: { status: BedStatus.AVAILABLE },
    });
  }

  /**
   * Set a room's status from its beds: occupied when every bed is taken,
   * available while any bed is free. A room with no beds of its own follows
   * its active admissions. A room an admin took out of service (maintenance,
   * reserved) is left as it is.
   */
  private async syncRoomStatus(tx: Prisma.TransactionClient, roomId: string) {
    const room = await tx.room.findUnique({
      where: { id: roomId },
      select: { status: true },
    });
    if (!room) return;
    if (room.status !== RoomStatus.AVAILABLE && room.status !== RoomStatus.OCCUPIED) return;

    const [totalBeds, freeBeds] = await Promise.all([
      tx.bed.count({ where: { roomId } }),
      tx.bed.count({ where: { roomId, status: BedStatus.AVAILABLE } }),
    ]);

    const full =
      totalBeds > 0
        ? freeBeds === 0
        : (await tx.admission.count({
            where: { roomId, status: AdmissionStatus.ADMITTED },
          })) > 0;

    const status = full ? RoomStatus.OCCUPIED : RoomStatus.AVAILABLE;
    if (status !== room.status) {
      await tx.room.update({ where: { id: roomId }, data: { status } });
    }
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

    const targetRoomId = roomId ?? admission.roomId;
    const roomsToSync = new Set<string>(
      [admission.roomId, targetRoomId].filter((id): id is string => !!id),
    );

    return this.prisma.$transaction(async (tx) => {
      // Handle bed change
      if (bedId && bedId !== admission.bedId) {
        const newBed = await tx.bed.findUnique({ where: { id: bedId } });
        if (!newBed || newBed.hospitalId !== admission.hospitalId) {
          throw new NotFoundException('New bed not found');
        }
        if (targetRoomId && newBed.roomId !== targetRoomId) {
          throw new BadRequestException('New bed is not in the selected room');
        }
        if (newBed.status !== BedStatus.AVAILABLE) {
          throw new BadRequestException('New bed is not available');
        }
        if (newBed.roomId) roomsToSync.add(newBed.roomId);

        // Take the new bed before freeing the old one, so a refusal leaves
        // the patient where they were.
        await this.occupyBed(tx, bedId);
        if (admission.bedId) await this.releaseBed(tx, admission.bedId);
      }

      // Update admission
      const updated = await tx.admission.update({
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

      // Every room the patient left or entered follows its beds.
      for (const id of roomsToSync) await this.syncRoomStatus(tx, id);

      return updated;
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

    const { dischargingUserId, dischargedAt, dischargeSummary, diagnosisOnDischarge, estimatedTotal } =
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

      const receiptTotal = typeof estimatedTotal === 'number' && !Number.isNaN(estimatedTotal)
        ? new Prisma.Decimal(estimatedTotal)
        : totalCharges;

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

      // Release the bed; the room is free again only once its last bed is.
      if (admission.bedId) await this.releaseBed(tx, admission.bedId);
      if (admission.roomId) await this.syncRoomStatus(tx, admission.roomId);

      const receiptNumber = await this.generateReceiptNumber(tx);

      const receiptNotes = JSON.stringify({
        roomCharges: roomCharges.toString(),
        operationCharges: operationCharges.toString(),
        labCharges: labCharges.toString(),
        pharmacyCharges: pharmacyCharges.toString(),
        opdCharges: opdCharges.toString(),
        calculatedTotal: totalCharges.toString(),
        estimatedTotal: receiptTotal.toString(),
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
          amount: receiptTotal,
          discount: new Prisma.Decimal(0),
          tax: new Prisma.Decimal(0),
          totalAmount: receiptTotal,
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
