import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateBedDto } from './dto/create-bed.dto';
import { UpdateBedDto } from './dto/update-bed.dto';
import { BedQueryDto } from './dto/bed-query.dto';
import { BedStatus, Prisma } from '@prisma/client';

@Injectable()
export class BedsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createBedDto: CreateBedDto) {
    const { hospitalId, bedNumber, dailyRate, ...rest } = createBedDto;

    // Check if bed number already exists in this hospital
    const existingBed = await this.prisma.bed.findUnique({
      where: {
        hospitalId_bedNumber: {
          hospitalId,
          bedNumber,
        },
      },
    });

    if (existingBed) {
      throw new ConflictException(
        `Bed with number ${bedNumber} already exists in this hospital`,
      );
    }

    // Validate hospital
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
    });

    if (!hospital) {
      throw new NotFoundException(`Hospital with ID ${hospitalId} not found`);
    }

    // Validate room if provided
    if (rest.roomId) {
      const room = await this.prisma.room.findUnique({
        where: { id: rest.roomId },
      });

      if (!room) {
        throw new NotFoundException(`Room with ID ${rest.roomId} not found`);
      }
    }

    return this.prisma.bed.create({
      data: {
        hospitalId,
        bedNumber,
        dailyRate: new Prisma.Decimal(dailyRate),
        ...rest,
      },
      include: {
        hospital: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
        room: { select: { id: true, roomNumber: true, roomType: true } },
      },
    });
  }

  async findAll(query: BedQueryDto) {
    const { hospitalId, departmentId, roomId, bedType, status, page = 1, limit = 20 } = query;

    const where: Prisma.BedWhereInput = {};

    if (hospitalId) where.hospitalId = hospitalId;
    if (departmentId) where.departmentId = departmentId;
    if (roomId) where.roomId = roomId;
    if (bedType) where.bedType = bedType;
    if (status) where.status = status;

    const skip = (page - 1) * limit;

    const [beds, total] = await Promise.all([
      this.prisma.bed.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ bedNumber: 'asc' }],
        include: {
          hospital: { select: { id: true, name: true, code: true } },
          department: { select: { id: true, name: true, code: true } },
          room: { select: { id: true, roomNumber: true, roomType: true } },
          admissions: {
            where: { status: 'ADMITTED' },
            select: {
              id: true,
              admissionNumber: true,
              patient: {
                select: {
                  id: true,
                  nrNumber: true,
                  fullName: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.bed.count({ where }),
    ]);

    return {
      data: beds,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const bed = await this.prisma.bed.findUnique({
      where: { id },
      include: {
        hospital: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
        room: { select: { id: true, roomNumber: true, roomType: true } },
        admissions: {
          where: { status: 'ADMITTED' },
          select: {
            id: true,
            admissionNumber: true,
            patient: {
              select: {
                id: true,
                nrNumber: true,
                fullName: true,
                gender: true,
              },
            },
            attendingDoctor: {
              select: {
                id: true,
                fullName: true,
              },
            },
            admittedAt: true,
          },
        },
      },
    });

    if (!bed) {
      throw new NotFoundException(`Bed with ID ${id} not found`);
    }

    return bed;
  }

  async update(id: string, updateBedDto: UpdateBedDto) {
    const bed = await this.prisma.bed.findUnique({ where: { id } });

    if (!bed) {
      throw new NotFoundException(`Bed with ID ${id} not found`);
    }

    // Check if updating bed number and if it conflicts
    if (updateBedDto.bedNumber && updateBedDto.bedNumber !== bed.bedNumber) {
      const existingBed = await this.prisma.bed.findUnique({
        where: {
          hospitalId_bedNumber: {
            hospitalId: bed.hospitalId,
            bedNumber: updateBedDto.bedNumber,
          },
        },
      });

      if (existingBed) {
        throw new ConflictException(
          `Bed with number ${updateBedDto.bedNumber} already exists in this hospital`,
        );
      }
    }

    const { dailyRate, ...rest } = updateBedDto;
    const data: Prisma.BedUpdateInput = { ...rest };

    if (dailyRate !== undefined) {
      data.dailyRate = new Prisma.Decimal(dailyRate);
    }

    return this.prisma.bed.update({
      where: { id },
      data,
      include: {
        hospital: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
        room: { select: { id: true, roomNumber: true, roomType: true } },
      },
    });
  }

  async remove(id: string) {
    const bed = await this.prisma.bed.findUnique({
      where: { id },
      include: {
        admissions: { where: { status: 'ADMITTED' } },
      },
    });

    if (!bed) {
      throw new NotFoundException(`Bed with ID ${id} not found`);
    }

    // Prevent deletion if there are active admissions
    if (bed.admissions.length > 0) {
      throw new BadRequestException(
        `Cannot delete bed with active admissions. Please discharge the patient first.`,
      );
    }

    return this.prisma.bed.delete({ where: { id } });
  }

  async findAvailable(hospitalId: string, roomId?: string, bedType?: string) {
    const where: Prisma.BedWhereInput = {
      hospitalId,
      status: BedStatus.AVAILABLE,
    };

    if (roomId) where.roomId = roomId;
    if (bedType) where.bedType = bedType as any;

    return this.prisma.bed.findMany({
      where,
      include: {
        room: { select: { id: true, roomNumber: true, roomType: true } },
        department: { select: { id: true, name: true, code: true } },
      },
      orderBy: { bedNumber: 'asc' },
    });
  }

  async updateStatus(id: string, status: BedStatus) {
    const bed = await this.prisma.bed.findUnique({ where: { id } });

    if (!bed) {
      throw new NotFoundException(`Bed with ID ${id} not found`);
    }

    return this.prisma.bed.update({
      where: { id },
      data: { status },
      include: {
        room: { select: { id: true, roomNumber: true } },
      },
    });
  }
}
