import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreatePharmacyDto, UpdatePharmacyDto } from './dto';
import { PharmacyStatus } from '@prisma/client';

@Injectable()
export class PharmaciesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPharmacyDto: CreatePharmacyDto, createdByUserId: string, userHospitalId: string) {
    // Verify hospital exists
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: createPharmacyDto.hospitalId },
    });

    if (!hospital) {
      throw new NotFoundException('Hospital not found');
    }

    // Check if code already exists for this hospital
    const existingPharmacy = await this.prisma.pharmacy.findUnique({
      where: {
        hospitalId_code: {
          hospitalId: createPharmacyDto.hospitalId,
          code: createPharmacyDto.code,
        },
      },
    });

    if (existingPharmacy) {
      throw new ConflictException(
        `Pharmacy with code '${createPharmacyDto.code}' already exists in this hospital`,
      );
    }

    // Create pharmacy
    const pharmacy = await this.prisma.pharmacy.create({
      data: {
        name: createPharmacyDto.name,
        code: createPharmacyDto.code,
        type: createPharmacyDto.type,
        locationWard: createPharmacyDto.locationWard,
        hospitalId: createPharmacyDto.hospitalId,
        status: PharmacyStatus.ACTIVE,
      },
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        hospitalId: userHospitalId,
        userId: createdByUserId,
        action: 'CREATE',
        entityType: 'Pharmacy',
        entityId: pharmacy.id,
        afterState: pharmacy,
      },
    });

    return pharmacy;
  }

  async findAll(hospitalId?: string, type?: string) {
    const where: any = {};

    if (hospitalId) {
      where.hospitalId = hospitalId;
    }

    if (type) {
      where.type = type;
    }

    return this.prisma.pharmacy.findMany({
      where,
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        users: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
          where: {
            role: {
              in: ['MAIN_PHARMACY_MANAGER', 'SUB_PHARMACY_MANAGER'],
            },
          },
          take: 1,
        },
        _count: {
          select: {
            stockBatches: true,
            users: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string, userHospitalId?: string) {
    const pharmacy = await this.prisma.pharmacy.findUnique({
      where: { id },
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        users: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            phone: true,
          },
        },
        _count: {
          select: {
            stockBatches: true,
            purchaseOrders: true,
            transfersFrom: true,
            transfersTo: true,
          },
        },
      },
    });

    if (!pharmacy) {
      throw new NotFoundException('Pharmacy not found');
    }

    // Hospital context validation
    if (userHospitalId && pharmacy.hospitalId !== userHospitalId) {
      throw new ForbiddenException('Access denied to this pharmacy');
    }

    return pharmacy;
  }

  async update(
    id: string,
    updatePharmacyDto: UpdatePharmacyDto,
    updatedByUserId: string,
    userHospitalId: string,
  ) {
    const pharmacy = await this.findOne(id, userHospitalId);

    // If updating code, check for uniqueness
    if (updatePharmacyDto.code && updatePharmacyDto.code !== pharmacy.code) {
      const existingPharmacy = await this.prisma.pharmacy.findUnique({
        where: {
          hospitalId_code: {
            hospitalId: pharmacy.hospitalId,
            code: updatePharmacyDto.code,
          },
        },
      });

      if (existingPharmacy) {
        throw new ConflictException(
          `Pharmacy with code '${updatePharmacyDto.code}' already exists in this hospital`,
        );
      }
    }

    const updatedPharmacy = await this.prisma.pharmacy.update({
      where: { id },
      data: updatePharmacyDto,
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        hospitalId: userHospitalId,
        userId: updatedByUserId,
        action: 'UPDATE',
        entityType: 'Pharmacy',
        entityId: id,
        beforeState: pharmacy,
        afterState: updatedPharmacy,
      },
    });

    return updatedPharmacy;
  }

  async remove(id: string, deletedByUserId: string, userHospitalId: string) {
    const pharmacy = await this.findOne(id, userHospitalId);

    // Soft delete - set status to INACTIVE
    const updatedPharmacy = await this.prisma.pharmacy.update({
      where: { id },
      data: { status: PharmacyStatus.INACTIVE },
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        hospitalId: userHospitalId,
        userId: deletedByUserId,
        action: 'DELETE',
        entityType: 'Pharmacy',
        entityId: id,
        beforeState: pharmacy,
        afterState: updatedPharmacy,
      },
    });

    return updatedPharmacy;
  }

  async getStats(hospitalId: string) {
    const [total, main, sub, active, inactive] = await Promise.all([
      this.prisma.pharmacy.count({
        where: { hospitalId },
      }),
      this.prisma.pharmacy.count({
        where: { hospitalId, type: 'MAIN' },
      }),
      this.prisma.pharmacy.count({
        where: { hospitalId, type: 'SUB' },
      }),
      this.prisma.pharmacy.count({
        where: { hospitalId, status: PharmacyStatus.ACTIVE },
      }),
      this.prisma.pharmacy.count({
        where: { hospitalId, status: PharmacyStatus.INACTIVE },
      }),
    ]);

    return {
      total,
      main,
      sub,
      active,
      inactive,
    };
  }
}
