import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateOperationDto } from './dto/create-operation.dto';
import { UpdateOperationDto } from './dto/update-operation.dto';
import { OperationQueryDto } from './dto/operation-query.dto';
import { UpdateOperationStatusDto } from './dto/update-operation-status.dto';
import { RescheduleOperationDto } from './dto/reschedule-operation.dto';
import { CreateOperationTheatreDto } from './dto/create-theatre.dto';
import { UpdateOperationTheatreDto } from './dto/update-theatre.dto';
import { OperationTheatreQueryDto } from './dto/theatre-query.dto';
import { OperationTheatreAvailabilityQueryDto } from './dto/theatre-availability-query.dto';
import {
  AdmissionStatus,
} from '@prisma/client';

enum OperationPatientType {
  OPD = 'OPD',
  IN_HOUSE = 'IN_HOUSE',
}

enum OperationStatus {
  SCHEDULED = 'SCHEDULED',
  PRE_OP = 'PRE_OP',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  POSTPONED = 'POSTPONED',
}

enum OperationTheatreStatus {
  ACTIVE = 'ACTIVE',
  MAINTENANCE = 'MAINTENANCE',
  INACTIVE = 'INACTIVE',
}

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureScheduledInFuture(scheduledAt: Date) {
    if (scheduledAt.getTime() < Date.now()) {
      throw new BadRequestException('Scheduled date/time cannot be in the past');
    }
  }

  private getOperationWindow(scheduledAt: Date, durationMinutes: number) {
    const start = new Date(scheduledAt);
    const end = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);
    return { start, end };
  }

  private async assertTheatreAvailability(
    theatreId: string,
    scheduledAt: Date,
    durationMinutes: number,
    excludeOperationId?: string,
  ) {
    const dayStart = new Date(scheduledAt);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(scheduledAt);
    dayEnd.setHours(23, 59, 59, 999);

    const prisma = this.prisma as any;
    const operations = await prisma.operation.findMany({
      where: {
        theatreId,
        status: {
          notIn: [OperationStatus.CANCELLED, OperationStatus.COMPLETED],
        },
        scheduledAt: {
          gte: dayStart,
          lte: dayEnd,
        },
        ...(excludeOperationId ? { NOT: { id: excludeOperationId } } : {}),
      },
      select: {
        id: true,
        scheduledAt: true,
        estimatedDurationMinutes: true,
      },
    });

    const { start, end } = this.getOperationWindow(scheduledAt, durationMinutes);

    const hasConflict = operations.some((operation) => {
      const opDuration = operation.estimatedDurationMinutes || 60;
      const opStart = new Date(operation.scheduledAt);
      const opEnd = new Date(opStart.getTime() + opDuration * 60 * 1000);
      return start < opEnd && end > opStart;
    });

    if (hasConflict) {
      throw new ConflictException('Selected theatre is not available at this time');
    }
  }

  async create(createDto: CreateOperationDto) {
    const {
      hospitalId,
      patientId,
      departmentId,
      surgeonId,
      theatreId,
      scheduledAt,
      patientType,
      visitId,
      admissionId,
      estimatedDurationMinutes,
    } = createDto;

    if (patientType === OperationPatientType.OPD && !visitId) {
      throw new BadRequestException('visitId is required for OPD operations');
    }

    if (patientType === OperationPatientType.IN_HOUSE && !admissionId) {
      throw new BadRequestException('admissionId is required for in-house operations');
    }

    if (patientType === OperationPatientType.OPD && admissionId) {
      throw new BadRequestException('admissionId should not be provided for OPD operations');
    }

    if (patientType === OperationPatientType.IN_HOUSE && visitId) {
      throw new BadRequestException('visitId should not be provided for in-house operations');
    }

    const scheduledDate = new Date(scheduledAt);
    this.ensureScheduledInFuture(scheduledDate);

    const [hospital, patient, department, surgeon, theatre] = await Promise.all([
      this.prisma.hospital.findUnique({ where: { id: hospitalId } }),
      this.prisma.patient.findUnique({ where: { id: patientId } }),
      this.prisma.department.findUnique({ where: { id: departmentId } }),
      this.prisma.user.findUnique({ where: { id: surgeonId } }),
      (this.prisma as any).operationTheatre.findUnique({ where: { id: theatreId } }),
    ]);

    if (!hospital) throw new NotFoundException('Hospital not found');
    if (!patient) throw new NotFoundException('Patient not found');
    if (!department) throw new NotFoundException('Department not found');
    if (!surgeon) throw new NotFoundException('Surgeon not found');
    if (!theatre) throw new NotFoundException('Operation theatre not found');

    if (surgeon.departmentId && surgeon.departmentId !== departmentId) {
      throw new BadRequestException('Surgeon does not belong to the selected department');
    }

    if (theatre.status !== OperationTheatreStatus.ACTIVE) {
      throw new BadRequestException('Operation theatre is not active');
    }

    if (theatre.hospitalId !== hospitalId) {
      throw new BadRequestException('Operation theatre does not belong to the hospital');
    }

    if (visitId) {
      const visit = await this.prisma.visit.findUnique({ where: { id: visitId } });
      if (!visit) throw new NotFoundException('Visit not found');
      if (visit.patientId !== patientId || visit.hospitalId !== hospitalId) {
        throw new BadRequestException('Visit does not belong to the patient/hospital');
      }
    }

    if (admissionId) {
      const admission = await this.prisma.admission.findUnique({
        where: { id: admissionId },
      });
      if (!admission) throw new NotFoundException('Admission not found');
      if (admission.patientId !== patientId || admission.hospitalId !== hospitalId) {
        throw new BadRequestException('Admission does not belong to the patient/hospital');
      }
      if (admission.status !== AdmissionStatus.ADMITTED) {
        throw new BadRequestException('Admission is not active');
      }
    }

    const duration = estimatedDurationMinutes ?? 60;
    await this.assertTheatreAvailability(theatreId, scheduledDate, duration);

    return (this.prisma as any).operation.create({
      data: {
        hospitalId,
        patientId,
        patientType,
        visitId,
        admissionId,
        departmentId,
        operationType: createDto.operationType,
        surgeonId,
        theatreId,
        scheduledAt: scheduledDate,
        estimatedDurationMinutes: duration,
        emergencyFlag: createDto.emergencyFlag ?? false,
        operationPrice: createDto.operationPrice ?? undefined,
        notes: createDto.notes,
        preOpNotes: createDto.preOpNotes,
      },
      include: {
        patient: {
          select: { id: true, fullName: true, nrNumber: true, gender: true, mobile: true },
        },
        surgeon: {
          select: { id: true, fullName: true },
        },
        theatre: {
          select: { id: true, name: true, code: true, status: true },
        },
        department: {
          select: { id: true, name: true, code: true },
        },
        visit: true,
        admission: true,
      },
    });
  }

  async findAll(query: OperationQueryDto) {
    const {
      hospitalId,
      patientId,
      surgeonId,
      departmentId,
      theatreId,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = query;

    const where: any = {};

    if (hospitalId) where.hospitalId = hospitalId;
    if (patientId) where.patientId = patientId;
    if (surgeonId) where.surgeonId = surgeonId;
    if (departmentId) where.departmentId = departmentId;
    if (theatreId) where.theatreId = theatreId;
    if (status) where.status = status;

    if (startDate || endDate) {
      where.scheduledAt = {};
      if (startDate) where.scheduledAt.gte = new Date(startDate);
      if (endDate) where.scheduledAt.lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [operations, total] = await Promise.all([
      (this.prisma as any).operation.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ scheduledAt: 'desc' }],
        include: {
          patient: {
            select: { id: true, fullName: true, nrNumber: true, gender: true, mobile: true },
          },
          surgeon: {
            select: { id: true, fullName: true },
          },
          theatre: {
            select: { id: true, name: true, code: true, status: true },
          },
          department: {
            select: { id: true, name: true, code: true },
          },
        },
      }),
      (this.prisma as any).operation.count({ where }),
    ]);

    return {
      data: operations,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const operation = await (this.prisma as any).operation.findUnique({
      where: { id },
      include: {
        patient: {
          select: { id: true, fullName: true, nrNumber: true, gender: true, mobile: true },
        },
        surgeon: {
          select: { id: true, fullName: true },
        },
        theatre: {
          select: { id: true, name: true, code: true, status: true },
        },
        department: {
          select: { id: true, name: true, code: true },
        },
        visit: true,
        admission: true,
      },
    });

    if (!operation) throw new NotFoundException('Operation not found');
    return operation;
  }

  async update(id: string, updateDto: UpdateOperationDto) {
    const operation = await (this.prisma as any).operation.findUnique({ where: { id } });
    if (!operation) throw new NotFoundException('Operation not found');

    const scheduledAt = updateDto.scheduledAt
      ? new Date(updateDto.scheduledAt)
      : operation.scheduledAt;
    const theatreId = updateDto.theatreId ?? operation.theatreId;
    const duration = updateDto.estimatedDurationMinutes ?? operation.estimatedDurationMinutes;

    if (updateDto.scheduledAt) {
      this.ensureScheduledInFuture(scheduledAt);
    }

    if (updateDto.surgeonId) {
      const surgeon = await this.prisma.user.findUnique({ where: { id: updateDto.surgeonId } });
      if (!surgeon) throw new NotFoundException('Surgeon not found');
      if (surgeon.departmentId && surgeon.departmentId !== operation.departmentId) {
        throw new BadRequestException('Surgeon does not belong to the selected department');
      }
    }

    if (updateDto.theatreId) {
      const theatre = await (this.prisma as any).operationTheatre.findUnique({
        where: { id: updateDto.theatreId },
      });
      if (!theatre) throw new NotFoundException('Operation theatre not found');
      if (theatre.status !== OperationTheatreStatus.ACTIVE) {
        throw new BadRequestException('Operation theatre is not active');
      }
    }

    if (updateDto.scheduledAt || updateDto.theatreId || updateDto.estimatedDurationMinutes) {
      await this.assertTheatreAvailability(theatreId, scheduledAt, duration, id);
    }

    return (this.prisma as any).operation.update({
      where: { id },
      data: {
        operationType: updateDto.operationType,
        surgeonId: updateDto.surgeonId,
        theatreId: updateDto.theatreId,
        scheduledAt: updateDto.scheduledAt ? scheduledAt : undefined,
        estimatedDurationMinutes: updateDto.estimatedDurationMinutes,
        emergencyFlag: updateDto.emergencyFlag,
        operationPrice: updateDto.operationPrice,
        notes: updateDto.notes,
        preOpNotes: updateDto.preOpNotes,
        postOpNotes: updateDto.postOpNotes,
        recoveryNotes: updateDto.recoveryNotes,
        followUpAt: updateDto.followUpAt ? new Date(updateDto.followUpAt) : undefined,
      },
      include: {
        patient: {
          select: { id: true, fullName: true, nrNumber: true, gender: true, mobile: true },
        },
        surgeon: {
          select: { id: true, fullName: true },
        },
        theatre: {
          select: { id: true, name: true, code: true, status: true },
        },
        department: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async updateStatus(id: string, statusDto: UpdateOperationStatusDto) {
    const operation = await (this.prisma as any).operation.findUnique({ where: { id } });
    if (!operation) throw new NotFoundException('Operation not found');

    const finalizedStatuses: OperationStatus[] = [
      OperationStatus.CANCELLED,
      OperationStatus.COMPLETED,
    ];

    if (finalizedStatuses.includes(operation.status)) {
      throw new BadRequestException('Operation is already finalized');
    }

    const now = new Date();
    const data: any = {
      status: statusDto.status,
      postOpNotes: statusDto.postOpNotes,
      recoveryNotes: statusDto.recoveryNotes,
      followUpAt: statusDto.followUpAt ? new Date(statusDto.followUpAt) : undefined,
    };

    if (statusDto.status === OperationStatus.IN_PROGRESS && !operation.startedAt) {
      data.startedAt = now;
    }

    if (statusDto.status === OperationStatus.COMPLETED) {
      data.completedAt = now;
    }

    if (statusDto.status === OperationStatus.CANCELLED) {
      data.cancelledAt = now;
    }

    return (this.prisma as any).operation.update({
      where: { id },
      data,
      include: {
        patient: {
          select: { id: true, fullName: true, nrNumber: true, gender: true, mobile: true },
        },
        surgeon: {
          select: { id: true, fullName: true },
        },
        theatre: {
          select: { id: true, name: true, code: true, status: true },
        },
        department: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async reschedule(id: string, rescheduleDto: RescheduleOperationDto) {
    const operation = await (this.prisma as any).operation.findUnique({ where: { id } });
    if (!operation) throw new NotFoundException('Operation not found');

    const scheduledAt = new Date(rescheduleDto.scheduledAt);
    this.ensureScheduledInFuture(scheduledAt);

    const theatreId = rescheduleDto.theatreId ?? operation.theatreId;
    const duration = rescheduleDto.estimatedDurationMinutes ?? operation.estimatedDurationMinutes;

    await this.assertTheatreAvailability(theatreId, scheduledAt, duration, id);

    return (this.prisma as any).operation.update({
      where: { id },
      data: {
        scheduledAt,
        theatreId: rescheduleDto.theatreId,
        estimatedDurationMinutes: rescheduleDto.estimatedDurationMinutes,
        status: OperationStatus.SCHEDULED,
      },
      include: {
        patient: {
          select: { id: true, fullName: true, nrNumber: true, gender: true, mobile: true },
        },
        surgeon: {
          select: { id: true, fullName: true },
        },
        theatre: {
          select: { id: true, name: true, code: true, status: true },
        },
        department: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async createTheatre(createDto: CreateOperationTheatreDto) {
    const [hospital, department] = await Promise.all([
      this.prisma.hospital.findUnique({ where: { id: createDto.hospitalId } }),
      createDto.departmentId
        ? this.prisma.department.findUnique({ where: { id: createDto.departmentId } })
        : Promise.resolve(null),
    ]);

    if (!hospital) throw new NotFoundException('Hospital not found');
    if (createDto.departmentId && !department) {
      throw new NotFoundException('Department not found');
    }

    const existing = await (this.prisma as any).operationTheatre.findFirst({
      where: {
        hospitalId: createDto.hospitalId,
        code: createDto.code,
      },
    });

    if (existing) {
      throw new ConflictException('Operation theatre code already exists');
    }

    return (this.prisma as any).operationTheatre.create({
      data: {
        hospitalId: createDto.hospitalId,
        departmentId: createDto.departmentId,
        name: createDto.name,
        code: createDto.code,
        location: createDto.location,
        status: createDto.status ?? OperationTheatreStatus.ACTIVE,
        notes: createDto.notes,
      },
    });
  }

  async findTheatres(query: OperationTheatreQueryDto) {
    const { hospitalId, departmentId, status, page = 1, limit = 20 } = query;

    const where: any = {};
    if (hospitalId) where.hospitalId = hospitalId;
    if (departmentId) where.departmentId = departmentId;
    if (status) where.status = status;

    const skip = (page - 1) * limit;

    const [theatres, total] = await Promise.all([
      (this.prisma as any).operationTheatre.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ name: 'asc' }],
      }),
      (this.prisma as any).operationTheatre.count({ where }),
    ]);

    return {
      data: theatres,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findTheatre(id: string) {
    const theatre = await (this.prisma as any).operationTheatre.findUnique({ where: { id } });
    if (!theatre) throw new NotFoundException('Operation theatre not found');
    return theatre;
  }

  async updateTheatre(id: string, updateDto: UpdateOperationTheatreDto) {
    const theatre = await (this.prisma as any).operationTheatre.findUnique({ where: { id } });
    if (!theatre) throw new NotFoundException('Operation theatre not found');

    if (updateDto.departmentId) {
      const department = await this.prisma.department.findUnique({
        where: { id: updateDto.departmentId },
      });
      if (!department) throw new NotFoundException('Department not found');
    }

    return (this.prisma as any).operationTheatre.update({
      where: { id },
      data: {
        departmentId: updateDto.departmentId,
        name: updateDto.name,
        code: updateDto.code,
        location: updateDto.location,
        status: updateDto.status,
        notes: updateDto.notes,
      },
    });
  }

  async getTheatreAvailability(query: OperationTheatreAvailabilityQueryDto) {
    const theatre = await (this.prisma as any).operationTheatre.findUnique({
      where: { id: query.theatreId },
    });
    if (!theatre) throw new NotFoundException('Operation theatre not found');

    const date = new Date(query.date);
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const operations = await (this.prisma as any).operation.findMany({
      where: {
        theatreId: query.theatreId,
        scheduledAt: {
          gte: dayStart,
          lte: dayEnd,
        },
        status: {
          notIn: [OperationStatus.CANCELLED],
        },
      },
      orderBy: [{ scheduledAt: 'asc' }],
      include: {
        patient: {
          select: { id: true, fullName: true, nrNumber: true },
        },
        surgeon: {
          select: { id: true, fullName: true },
        },
      },
    });

    return {
      theatre: {
        id: theatre.id,
        name: theatre.name,
        code: theatre.code,
        status: theatre.status,
      },
      date: query.date,
      operations,
    };
  }
}
