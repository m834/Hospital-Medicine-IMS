import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/services/cache.service';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { SearchMedicinesDto } from './dto/search-medicines.dto';

@Injectable()
export class MedicinesService {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  async create(createMedicineDto: CreateMedicineDto, hospitalId?: string) {
    // Require hospitalId for creation
    if (!hospitalId) {
      throw new ConflictException('Hospital ID is required to create a medicine');
    }

    // Check for duplicate medicine
    const existing = await this.prisma.medicine.findFirst({
      where: {
        hospitalId,
        name: createMedicineDto.name,
        genericName: createMedicineDto.genericName,
        strength: createMedicineDto.strength,
      },
    });

    if (existing) {
      throw new ConflictException(
        'Medicine with same name, generic name, and strength already exists',
      );
    }

    const medicine = await this.prisma.medicine.create({
      data: {
        ...createMedicineDto,
        hospitalId,
        status: 'ACTIVE',
      },
    });

    // Invalidate all medicine caches for this hospital
    await this.cacheService.deletePattern(`medicines:${hospitalId}:.*`);

    return medicine;
  }

  async findAll(searchDto: SearchMedicinesDto, hospitalId?: string) {
    const {
      search,
      name,
      genericName,
      form,
      manufacturer,
      status,
      limit = 50,
      page = 1,
      sortBy = 'name',
      sortOrder = 'asc',
    } = searchDto;

    // Generate cache key based on search parameters
    const cacheKey = `medicines:${hospitalId || 'all'}:${JSON.stringify(searchDto)}`;
    
    // Try to get from cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const where: any = {};

    // Filter by hospital if provided (Super Admin can view all)
    if (hospitalId) {
      where.hospitalId = hospitalId;
    }

    // Global search across name, generic, manufacturer
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { genericName: { contains: search, mode: 'insensitive' } },
        { manufacturer: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Specific field searches
    if (name) {
      where.name = { contains: name, mode: 'insensitive' };
    }
    if (genericName) {
      where.genericName = { contains: genericName, mode: 'insensitive' };
    }
    if (form) {
      where.form = form;
    }
    if (manufacturer) {
      where.manufacturer = { contains: manufacturer, mode: 'insensitive' };
    }
    if (status) {
      where.status = status;
    }

    const skip = (page - 1) * limit;

    const [medicines, total] = await Promise.all([
      this.prisma.medicine.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: {
              stockBatches: true,
              prescriptionItems: true,
            },
          },
        },
      }),
      this.prisma.medicine.count({ where }),
    ]);

    const result = {
      data: medicines,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache the result for 5 minutes
    await this.cacheService.set(cacheKey, result, 5 * 60 * 1000);

    return result;
  }

  async findOne(id: string, hospitalId?: string) {
    const where: any = { id };
    
    // Filter by hospital if provided
    if (hospitalId) {
      where.hospitalId = hospitalId;
    }

    const medicine = await this.prisma.medicine.findFirst({
      where,
      include: {
        stockBatches: {
          where: {
            status: 'AVAILABLE',
            expiryDate: {
              gte: new Date(),
            },
          },
          select: {
            id: true,
            batchNo: true,
            qtyAvailable: true,
            expiryDate: true,
            receivedDate: true,
          },
          orderBy: {
            receivedDate: 'asc', // FIFO
          },
        },
        _count: {
          select: {
            prescriptionItems: true,
            issueItems: true,
          },
        },
      },
    });

    if (!medicine) {
      throw new NotFoundException('Medicine not found');
    }

    return medicine;
  }

  async update(id: string, updateMedicineDto: UpdateMedicineDto, hospitalId?: string) {
    const medicine = await this.findOne(id, hospitalId);

    const updated = await this.prisma.medicine.update({
      where: { id: medicine.id },
      data: updateMedicineDto,
    });

    // Invalidate all medicine caches for this hospital
    if (medicine.hospitalId) {
      await this.cacheService.deletePattern(`medicines:${medicine.hospitalId}:.*`);
    }
    await this.cacheService.deletePattern(`medicines:all:.*`);

    return updated;
  }

  async remove(id: string, hospitalId?: string) {
    const medicine = await this.findOne(id, hospitalId);

    // Check if medicine has active stock
    const hasStock = await this.prisma.stockBatch.count({
      where: {
        medicineId: id,
        status: 'AVAILABLE',
        qtyAvailable: { gt: 0 },
      },
    });

    if (hasStock > 0) {
      throw new ConflictException('Cannot delete medicine with active stock batches');
    }

    const discontinued = await this.prisma.medicine.update({
      where: { id: medicine.id },
      data: { status: 'DISCONTINUED' },
    });

    // Invalidate all medicine caches for this hospital
    if (medicine.hospitalId) {
      await this.cacheService.deletePattern(`medicines:${medicine.hospitalId}:.*`);
    }
    await this.cacheService.deletePattern(`medicines:all:.*`);

    return discontinued;
  }

  async getStats(hospitalId?: string) {
    const cacheKey = `medicines:stats:${hospitalId || 'all'}`;
    
    // Try to get from cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const where: any = {};
    if (hospitalId) {
      where.hospitalId = hospitalId;
    }

    const [total, active, byForm] = await Promise.all([
      this.prisma.medicine.count({ where }),
      this.prisma.medicine.count({ where: { ...where, status: 'ACTIVE' } }),
      this.prisma.medicine.groupBy({
        by: ['form'],
        where: { ...where, status: 'ACTIVE' },
        _count: true,
      }),
    ]);

    const result = {
      total,
      active,
      discontinued: total - active,
      byForm: byForm.reduce((acc, item) => {
        acc[item.form] = item._count;
        return acc;
      }, {}),
    };

    // Cache the result for 5 minutes
    await this.cacheService.set(cacheKey, result, 5 * 60 * 1000);

    return result;
  }
}
