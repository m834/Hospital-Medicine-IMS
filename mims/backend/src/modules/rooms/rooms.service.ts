import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomQueryDto } from './dto/room-query.dto';
import { RoomStatus, Prisma } from '@prisma/client';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createRoomDto: CreateRoomDto) {
    const { hospitalId, roomNumber, dailyRate, ...rest } = createRoomDto;

    // Check if room number already exists in this hospital
    const existingRoom = await this.prisma.room.findUnique({
      where: {
        hospitalId_roomNumber: {
          hospitalId,
          roomNumber,
        },
      },
    });

    if (existingRoom) {
      throw new ConflictException(
        `Room with number ${roomNumber} already exists in this hospital`,
      );
    }

    // Validate hospital exists
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
    });

    if (!hospital) {
      throw new NotFoundException(`Hospital with ID ${hospitalId} not found`);
    }

    // Validate department if provided
    if (rest.departmentId) {
      const department = await this.prisma.department.findUnique({
        where: { id: rest.departmentId },
      });

      if (!department) {
        throw new NotFoundException(
          `Department with ID ${rest.departmentId} not found`,
        );
      }
    }

    return this.prisma.room.create({
      data: {
        hospitalId,
        roomNumber,
        dailyRate: new Prisma.Decimal(dailyRate),
        ...rest,
      },
      include: {
        hospital: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
        beds: {
          select: { id: true, bedNumber: true, status: true },
        },
      },
    });
  }

  async findAll(query: RoomQueryDto) {
    const {
      hospitalId,
      departmentId,
      roomType,
      status,
      floor,
      building,
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.RoomWhereInput = {};

    if (hospitalId) where.hospitalId = hospitalId;
    if (departmentId) where.departmentId = departmentId;
    if (roomType) where.roomType = roomType;
    if (status) where.status = status;
    if (floor) where.floor = floor;
    if (building) where.building = { contains: building, mode: 'insensitive' };

    const skip = (page - 1) * limit;

    const [rooms, total] = await Promise.all([
      this.prisma.room.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ roomNumber: 'asc' }],
        include: {
          hospital: { select: { id: true, name: true, code: true } },
          department: { select: { id: true, name: true, code: true } },
          beds: {
            select: {
              id: true,
              bedNumber: true,
              status: true,
            },
          },
          _count: {
            select: {
              beds: true,
              admissions: { where: { status: 'ADMITTED' } },
            },
          },
        },
      }),
      this.prisma.room.count({ where }),
    ]);

    return {
      data: rooms,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        hospital: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
        beds: {
          select: {
            id: true,
            bedNumber: true,
            bedType: true,
            status: true,
            dailyRate: true,
          },
          orderBy: { bedNumber: 'asc' },
        },
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
            attendingDoctor: {
              select: {
                id: true,
                fullName: true,
              },
            },
            admittedAt: true,
          },
        },
        _count: {
          select: {
            beds: true,
            admissions: { where: { status: 'ADMITTED' } },
          },
        },
      },
    });

    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    return room;
  }

  async update(id: string, updateRoomDto: UpdateRoomDto) {
    const room = await this.prisma.room.findUnique({ where: { id } });

    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    // Check if updating room number and if it conflicts
    if (updateRoomDto.roomNumber && updateRoomDto.roomNumber !== room.roomNumber) {
      const existingRoom = await this.prisma.room.findUnique({
        where: {
          hospitalId_roomNumber: {
            hospitalId: room.hospitalId,
            roomNumber: updateRoomDto.roomNumber,
          },
        },
      });

      if (existingRoom) {
        throw new ConflictException(
          `Room with number ${updateRoomDto.roomNumber} already exists in this hospital`,
        );
      }
    }

    const { dailyRate, ...rest } = updateRoomDto;
    const data: Prisma.RoomUpdateInput = { ...rest };

    if (dailyRate !== undefined) {
      data.dailyRate = new Prisma.Decimal(dailyRate);
    }

    return this.prisma.room.update({
      where: { id },
      data,
      include: {
        hospital: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
        beds: {
          select: { id: true, bedNumber: true, status: true },
        },
      },
    });
  }

  async remove(id: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        admissions: { where: { status: 'ADMITTED' } },
      },
    });

    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    // Prevent deletion if there are active admissions
    if (room.admissions.length > 0) {
      throw new BadRequestException(
        `Cannot delete room with active admissions. Please discharge all patients first.`,
      );
    }

    return this.prisma.room.delete({ where: { id } });
  }

  async findAvailable(hospitalId: string, roomType?: string) {
    const where: Prisma.RoomWhereInput = {
      hospitalId,
      status: RoomStatus.AVAILABLE,
    };

    if (roomType) {
      where.roomType = roomType as any;
    }

    return this.prisma.room.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, code: true } },
        beds: {
          where: { status: 'AVAILABLE' },
          select: {
            id: true,
            bedNumber: true,
            bedType: true,
            dailyRate: true,
          },
        },
      },
      orderBy: { roomNumber: 'asc' },
    });
  }

  async getOccupancyStats(hospitalId: string) {
    const rooms = await this.prisma.room.findMany({
      where: { hospitalId },
      include: {
        beds: true,
        admissions: {
          where: { status: 'ADMITTED' },
        },
      },
    });

    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter((r) => r.admissions.length > 0).length;
    const totalBeds = rooms.reduce((sum, r) => sum + r.beds.length, 0);
    const occupiedBeds = rooms.reduce((sum, r) => sum + r.admissions.length, 0);

    const roomsByType = rooms.reduce(
      (acc, room) => {
        const type = room.roomType;
        if (!acc[type]) {
          acc[type] = { total: 0, occupied: 0 };
        }
        acc[type].total += 1;
        if (room.admissions.length > 0) {
          acc[type].occupied += 1;
        }
        return acc;
      },
      {} as Record<string, { total: number; occupied: number }>,
    );

    return {
      totalRooms,
      occupiedRooms,
      availableRooms: totalRooms - occupiedRooms,
      roomOccupancyRate:
        totalRooms > 0 ? ((occupiedRooms / totalRooms) * 100).toFixed(2) : '0.00',
      totalBeds,
      occupiedBeds,
      availableBeds: totalBeds - occupiedBeds,
      bedOccupancyRate:
        totalBeds > 0 ? ((occupiedBeds / totalBeds) * 100).toFixed(2) : '0.00',
      roomsByType,
    };
  }
}
