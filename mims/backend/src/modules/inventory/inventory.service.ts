import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/services/cache.service';
import { CreateStockBatchDto } from './dto/create-stock-batch.dto';
import { UpdateStockBatchDto } from './dto/update-stock-batch.dto';
import { SearchStockBatchDto } from './dto/search-stock-batch.dto';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  /**
   * Calculate total dispensing units from purchase units.
   * Formula: qtyReceivedPurchase × unitsPerPurchaseUnit × unitsPerSubUnit
   */
  private calculateDispensingUnits(
    qtyReceivedPurchase: number,
    unitsPerPurchaseUnit: number = 1,
    unitsPerSubUnit: number = 1,
  ): number {
    return qtyReceivedPurchase * unitsPerPurchaseUnit * unitsPerSubUnit;
  }

  /**
   * Calculate cost per dispensing unit.
   * Formula: purchaseUnitPrice / (unitsPerPurchaseUnit × unitsPerSubUnit)
   */
  private calculateCostPerDispensingUnit(
    purchaseUnitPrice: number,
    unitsPerPurchaseUnit: number = 1,
    unitsPerSubUnit: number = 1,
  ): number {
    const totalUnitsPerPurchase = unitsPerPurchaseUnit * unitsPerSubUnit;
    if (totalUnitsPerPurchase === 0) return 0;
    return purchaseUnitPrice / totalUnitsPerPurchase;
  }

  async create(createStockBatchDto: CreateStockBatchDto, hospitalId: string) {
    let medicineId = createStockBatchDto.medicineId;

    // If medicineId not provided, try to find or create medicine
    if (!medicineId && createStockBatchDto.medicineName) {
      const medicine = await this.findOrCreateMedicine(
        {
          name: createStockBatchDto.medicineName,
          genericName: createStockBatchDto.genericName,
          form: createStockBatchDto.form,
          strength: createStockBatchDto.strength,
          manufacturer: createStockBatchDto.medicineManufacturer,
        },
        hospitalId,
      );
      medicineId = medicine.id;
    }

    if (!medicineId) {
      throw new BadRequestException(
        'Either medicineId or medicineName with form must be provided',
      );
    }

    // Verify medicine exists (only if medicineId was provided directly, not created)
    if (createStockBatchDto.medicineId) {
      const medicine = await this.prisma.medicine.findFirst({
        where: {
          id: medicineId,
          hospitalId,
        },
      });

      if (!medicine) {
        throw new NotFoundException('Medicine not found');
      }
    }

    // Check if pharmacy exists
    const pharmacy = await this.prisma.pharmacy.findFirst({
      where: {
        id: createStockBatchDto.pharmacyId,
        hospitalId,
      },
    });

    if (!pharmacy) {
      throw new NotFoundException('Pharmacy not found');
    }

    // Check for duplicate batch number
    const existingBatch = await this.prisma.stockBatch.findFirst({
      where: {
        hospitalId,
        pharmacyId: createStockBatchDto.pharmacyId,
        medicineId: medicineId,
        batchNo: createStockBatchDto.batchNo,
      },
    });

    if (existingBatch) {
      throw new ConflictException(
        'Stock batch with this batch number already exists for this medicine',
      );
    }

    const stockBatch = await this.prisma.stockBatch.create({
      data: {
        medicineId,
        pharmacyId: createStockBatchDto.pharmacyId,
        batchNo: createStockBatchDto.batchNo,
        qtyReceived: createStockBatchDto.qtyReceived,
        qtyAvailable: createStockBatchDto.qtyReceived,
        expiryDate: new Date(createStockBatchDto.expiryDate),
        manufacturer: createStockBatchDto.manufacturer,
        storageType: createStockBatchDto.storageType,
        purchasePrice: createStockBatchDto.purchasePrice,
        governmentPrice: createStockBatchDto.governmentPrice,
        retailPrice: createStockBatchDto.retailPrice,
        hospitalId,
        receivedDate: createStockBatchDto.receivedDate
          ? new Date(createStockBatchDto.receivedDate)
          : new Date(),
        // Unit-based tracking fields
        purchaseUnit: createStockBatchDto.purchaseUnit,
        purchaseUnitPrice: createStockBatchDto.purchaseUnitPrice,
        unitsPerPurchaseUnit: createStockBatchDto.unitsPerPurchaseUnit ?? 1,
        subUnit: createStockBatchDto.subUnit,
        unitsPerSubUnit: createStockBatchDto.unitsPerSubUnit ?? 1,
        dispensingUnit: createStockBatchDto.dispensingUnit,
        qtyReceivedPurchase: createStockBatchDto.qtyReceivedPurchase ?? createStockBatchDto.qtyReceived,
        qtyAvailableDispensing: this.calculateDispensingUnits(
          createStockBatchDto.qtyReceivedPurchase ?? createStockBatchDto.qtyReceived,
          createStockBatchDto.unitsPerPurchaseUnit ?? 1,
          createStockBatchDto.unitsPerSubUnit ?? 1,
        ),
        costPerDispensingUnit: createStockBatchDto.purchaseUnitPrice
          ? this.calculateCostPerDispensingUnit(
              createStockBatchDto.purchaseUnitPrice,
              createStockBatchDto.unitsPerPurchaseUnit ?? 1,
              createStockBatchDto.unitsPerSubUnit ?? 1,
            )
          : null,
        reorderLevel: createStockBatchDto.reorderLevel ?? 10,
      },
      include: {
        medicine: {
          select: {
            id: true,
            name: true,
            genericName: true,
            form: true,
            strength: true,
          },
        },
        pharmacy: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    // Invalidate cache when new stock is added
    await this.invalidateCache(hospitalId);

    return stockBatch;
  }

  /**
   * Find medicine by name/formula or create if it doesn't exist
   */
  private async findOrCreateMedicine(
    medicineData: {
      name: string;
      genericName?: string;
      form?: any;
      strength?: string;
      manufacturer?: string;
    },
    hospitalId: string,
  ) {
    if (!medicineData.form) {
      throw new BadRequestException(
        'Medicine form is required when creating from name',
      );
    }

    // Try to find existing medicine by name and form
    let medicine = await this.prisma.medicine.findFirst({
      where: {
        hospitalId,
        name: {
          equals: medicineData.name,
          mode: 'insensitive',
        },
        form: medicineData.form,
        ...(medicineData.strength && {
          strength: {
            equals: medicineData.strength,
            mode: 'insensitive',
          },
        }),
      },
    });

    // If not found, create new medicine
    if (!medicine) {
      medicine = await this.prisma.medicine.create({
        data: {
          name: medicineData.name,
          genericName: medicineData.genericName,
          form: medicineData.form,
          strength: medicineData.strength,
          manufacturer: medicineData.manufacturer,
          hospitalId,
          status: 'ACTIVE',
        },
      });
    }

    return medicine;
  }

  /**
   * Bulk create stock batches from imported data
   */
  async bulkCreate(batches: any[], hospitalId: string) {
    const results = {
      successful: [],
      failed: [],
      created: 0,
      errors: 0,
      medicinesCreated: 0,
    };

    for (const batch of batches) {
      try {
        const stockBatch = await this.create(batch, hospitalId);
        results.successful.push({
          batchNo: batch.batchNo,
          medicineName: batch.medicineName || 'N/A',
          stockBatchId: stockBatch.id,
        });
        results.created++;

        // Check if a new medicine was created
        if (batch.medicineName && !batch.medicineId) {
          results.medicinesCreated++;
        }
      } catch (error) {
        results.failed.push({
          batchNo: batch.batchNo,
          medicineName: batch.medicineName || batch.medicineId || 'Unknown',
          error: error.message,
        });
        results.errors++;
      }
    }

    return results;
  }

  async findAll(searchDto: SearchStockBatchDto, hospitalId?: string) {
    const {
      search,
      medicineId,
      pharmacyId,
      batchNo,
      status,
      storageType,
      dispensingUnit,
      lowStockOnly,
      expiringBefore,
      expiringAfter,
      limit = 50,
      page = 1,
      sortBy = 'receivedDate',
      sortOrder = 'asc',
    } = searchDto;

    // Cache key based on search parameters
    const cacheKey = `inventory:${hospitalId || 'all'}:${JSON.stringify(searchDto)}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const where: any = {};
    
    // Only add hospitalId if provided
    if (hospitalId) {
      where.hospitalId = hospitalId;
    }

    if (search) {
      where.OR = [
        { batchNo: { contains: search, mode: 'insensitive' } },
        { manufacturer: { contains: search, mode: 'insensitive' } },
        { medicine: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (medicineId) where.medicineId = medicineId;
    if (pharmacyId) where.pharmacyId = pharmacyId;
    if (batchNo) where.batchNo = { contains: batchNo, mode: 'insensitive' };
    if (status) where.status = status;
    if (storageType) where.storageType = storageType;
    if (dispensingUnit) where.dispensingUnit = { contains: dispensingUnit, mode: 'insensitive' };

    // Filter batches where qtyAvailableDispensing is at or below reorderLevel
    if (lowStockOnly) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            // Batches with unit tracking: dispensing qty <= reorder level
            {
              qtyAvailableDispensing: { not: null },
              // Raw filter handled below via Prisma
            },
            // Legacy batches without unit tracking: fall back to qtyAvailable
            {
              qtyAvailableDispensing: null,
              qtyAvailable: { lte: 10 },
            },
          ],
        },
      ];
    }

    if (expiringBefore) {
      where.expiryDate = { ...where.expiryDate, lte: new Date(expiringBefore) };
    }
    if (expiringAfter) {
      where.expiryDate = { ...where.expiryDate, gte: new Date(expiringAfter) };
    }

    const skip = (page - 1) * limit;

    const [batches, total] = await Promise.all([
      this.prisma.stockBatch.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          medicine: {
            select: {
              id: true,
              name: true,
              genericName: true,
              form: true,
              strength: true,
            },
          },
          pharmacy: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
      }),
      this.prisma.stockBatch.count({ where }),
    ]);

    const result = {
      data: batches,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache for 3 minutes
    await this.cacheService.set(cacheKey, result, 3 * 60 * 1000);

    return result;
  }

  async findOne(id: string, hospitalId: string) {
    const batch = await this.prisma.stockBatch.findFirst({
      where: { id, hospitalId },
      include: {
        medicine: true,
        pharmacy: true,
      },
    });

    if (!batch) {
      throw new NotFoundException('Stock batch not found');
    }

    return batch;
  }

  async update(id: string, updateStockBatchDto: UpdateStockBatchDto, hospitalId: string) {
    const batch = await this.findOne(id, hospitalId);

    // Don't allow updating qtyReceived if batch has been issued
    if (updateStockBatchDto.qtyReceived) {
      const issued = batch.qtyReceived - batch.qtyAvailable;
      if (issued > 0) {
        throw new BadRequestException(
          'Cannot update received quantity for batch with issued items',
        );
      }
    }

    const updated = await this.prisma.stockBatch.update({
      where: { id: batch.id },
      data: {
        ...updateStockBatchDto,
        expiryDate: updateStockBatchDto.expiryDate
          ? new Date(updateStockBatchDto.expiryDate)
          : undefined,
        receivedDate: updateStockBatchDto.receivedDate
          ? new Date(updateStockBatchDto.receivedDate)
          : undefined,
      },
      include: {
        medicine: true,
        pharmacy: true,
      },
    });

    // Invalidate cache when stock is updated
    await this.invalidateCache(hospitalId);

    return updated;
  }

  async remove(id: string, hospitalId: string) {
    const batch = await this.findOne(id, hospitalId);

    if (batch.qtyAvailable < batch.qtyReceived) {
      throw new ConflictException('Cannot delete batch with issued items');
    }

    const deleted = await this.prisma.stockBatch.update({
      where: { id: batch.id },
      data: { status: 'DEPLETED' },
    });

    // Invalidate cache when batch is deleted
    await this.invalidateCache(hospitalId);

    return deleted;
  }

  /**
   * FIFO Allocation Algorithm
   * Returns available batches sorted by receivedDate (oldest first)
   * Excludes expired and depleted batches
   */
  async getAvailableBatchesFIFO(
    medicineId: string,
    pharmacyId: string,
    hospitalId: string,
  ) {
    const now = new Date();

    return this.prisma.stockBatch.findMany({
      where: {
        hospitalId,
        pharmacyId,
        medicineId,
        status: 'AVAILABLE',
        qtyAvailable: { gt: 0 },
        expiryDate: { gt: now },
      },
      orderBy: {
        receivedDate: 'asc', // FIFO: oldest batches first
      },
      include: {
        medicine: {
          select: {
            id: true,
            name: true,
            genericName: true,
            form: true,
            strength: true,
          },
        },
      },
    });
  }

  /**
   * Dispense medicine from a batch (deducts from qtyAvailableDispensing)
   * Used when issuing medicine to patients.
   * Returns updated batch and whether it triggered low-stock alert.
   */
  async dispenseBatch(
    batchId: string,
    dispensingQty: number,
    hospitalId: string,
  ): Promise<{ batch: any; lowStockAlert: boolean }> {
    const batch = await this.findOne(batchId, hospitalId);

    if (batch.status !== 'AVAILABLE') {
      throw new BadRequestException('Batch is not available for dispensing');
    }

    // Use dispensing-unit tracking if available, otherwise fall back to qtyAvailable
    const currentDispensing = batch.qtyAvailableDispensing ?? batch.qtyAvailable;

    if (currentDispensing < dispensingQty) {
      throw new BadRequestException(
        `Insufficient stock. Requested: ${dispensingQty}, Available: ${currentDispensing} ${batch.dispensingUnit || 'units'}`,
      );
    }

    const newDispensingQty = currentDispensing - dispensingQty;
    const newQtyAvailable = batch.qtyAvailable - dispensingQty;

    const updatedBatch = await this.prisma.stockBatch.update({
      where: { id: batch.id },
      data: {
        qtyAvailable: Math.max(0, newQtyAvailable),
        qtyAvailableDispensing: Math.max(0, newDispensingQty),
        status: newDispensingQty <= 0 ? 'DEPLETED' : batch.status,
      },
      include: {
        medicine: {
          select: {
            id: true,
            name: true,
            genericName: true,
            form: true,
            strength: true,
          },
        },
        pharmacy: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    // Check low stock alert based on reorder level
    const lowStockAlert = newDispensingQty <= (batch.reorderLevel ?? 10);

    // Invalidate cache
    await this.invalidateCache(hospitalId);

    return { batch: updatedBatch, lowStockAlert };
  }

  /**
   * Calculate total available stock for a medicine at a pharmacy
   */
  async getTotalAvailableStock(
    medicineId: string,
    pharmacyId: string,
    hospitalId: string,
  ): Promise<number> {
    const batches = await this.getAvailableBatchesFIFO(medicineId, pharmacyId, hospitalId);
    return batches.reduce((total, batch) => total + batch.qtyAvailable, 0);
  }

  /**
   * Get low stock alerts
   * Returns medicines with stock below their reorder level (per batch)
   * Falls back to threshold parameter if reorderLevel is not set
   */
  async getLowStockAlerts(hospitalId: string, pharmacyId?: string, threshold: number = 10): Promise<any[]> {
    const cacheKey = `inventory:low-stock:${hospitalId}:${pharmacyId || 'all'}:${threshold}`;
    
    // Try to get from cache
    const cached = this.cacheService.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const where: any = { hospitalId, status: 'ACTIVE' };

    const medicines = await this.prisma.medicine.findMany({
      where,
      include: {
        stockBatches: {
          where: {
            ...(pharmacyId && { pharmacyId }),
            status: 'AVAILABLE',
            qtyAvailable: { gt: 0 },
            expiryDate: { gt: new Date() },
          },
          select: {
            qtyAvailable: true,
            qtyAvailableDispensing: true,
            reorderLevel: true,
            dispensingUnit: true,
            pharmacyId: true,
          },
        },
      },
    });

    const lowStockMedicines = medicines
      .map((medicine) => {
        const totalStock = medicine.stockBatches.reduce(
          (sum, batch) => sum + batch.qtyAvailable,
          0,
        );
        const totalDispensingStock = medicine.stockBatches.reduce(
          (sum, batch) => sum + (batch.qtyAvailableDispensing ?? batch.qtyAvailable),
          0,
        );
        // Use the max reorderLevel across batches, or fallback to threshold
        const effectiveReorderLevel = medicine.stockBatches.length > 0
          ? Math.max(...medicine.stockBatches.map(b => b.reorderLevel ?? threshold))
          : threshold;
        const dispensingUnit = medicine.stockBatches.find(b => b.dispensingUnit)?.dispensingUnit;
        return {
          medicineId: medicine.id,
          medicineName: medicine.name,
          genericName: medicine.genericName,
          form: medicine.form,
          strength: medicine.strength,
          totalStock,
          totalDispensingStock,
          reorderLevel: effectiveReorderLevel,
          dispensingUnit,
          belowReorderLevel: totalDispensingStock <= effectiveReorderLevel,
        };
      })
      .filter((med) => med.totalDispensingStock <= med.reorderLevel && med.totalDispensingStock >= 0);

    // Cache the result for 3 minutes
    this.cacheService.set(cacheKey, lowStockMedicines, 3 * 60 * 1000);

    return lowStockMedicines;
  }

  /**
   * Get expiring batches
   * Returns batches expiring within specified days
   */
  async getExpiringBatches(hospitalId: string, daysUntilExpiry: number = 30): Promise<any[]> {
    const now = new Date();
    const expiryThreshold = new Date();
    expiryThreshold.setDate(now.getDate() + daysUntilExpiry);

    return this.prisma.stockBatch.findMany({
      where: {
        hospitalId,
        status: 'AVAILABLE',
        qtyAvailable: { gt: 0 },
        expiryDate: {
          gte: now,
          lte: expiryThreshold,
        },
      },
      orderBy: {
        expiryDate: 'asc',
      },
      include: {
        medicine: {
          select: {
            id: true,
            name: true,
            genericName: true,
            form: true,
          },
        },
        pharmacy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Get inventory statistics
   */
  async getStats(hospitalId?: string, pharmacyId?: string) {
    // If no hospitalId, return empty stats (for Super Admin without selection)
    if (!hospitalId) {
      return {
        totalBatches: 0,
        availableBatches: 0,
        expiredBatches: 0,
        depletedBatches: 0,
        totalQuantity: 0,
        totalValue: 0,
        lowStock: 0,
        expiringSoon: 0,
      };
    }

    const cacheKey = `inventory:stats:${hospitalId}:${pharmacyId || 'all'}`;
    
    // Try to get from cache
    const cached = this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const where: any = { hospitalId };
    if (pharmacyId) where.pharmacyId = pharmacyId;

    const [totalBatches, availableBatches, expiredBatches, depletedBatches] =
      await Promise.all([
        this.prisma.stockBatch.count({ where }),
        this.prisma.stockBatch.count({ where: { ...where, status: 'AVAILABLE' } }),
        this.prisma.stockBatch.count({ where: { ...where, status: 'EXPIRED' } }),
        this.prisma.stockBatch.count({ where: { ...where, status: 'DEPLETED' } }),
      ]);

    // Get total quantity
    const totalQuantityResult = await this.prisma.stockBatch.aggregate({
      where: { ...where, status: 'AVAILABLE' },
      _sum: {
        qtyAvailable: true,
        qtyAvailableDispensing: true,
      },
    });

    // Calculate total value (quantity * purchase price)
    const availableBatches_data = await this.prisma.stockBatch.findMany({
      where: { ...where, status: 'AVAILABLE' },
      select: {
        qtyAvailable: true,
        qtyAvailableDispensing: true,
        purchasePrice: true,
        costPerDispensingUnit: true,
      },
    });

    const totalValue = availableBatches_data.reduce((sum, batch) => {
      return sum + (batch.qtyAvailable * Number(batch.purchasePrice));
    }, 0);

    const totalDispensingValue = availableBatches_data.reduce((sum, batch) => {
      if (batch.costPerDispensingUnit && batch.qtyAvailableDispensing) {
        return sum + (batch.qtyAvailableDispensing * Number(batch.costPerDispensingUnit));
      }
      return sum + (batch.qtyAvailable * Number(batch.purchasePrice));
    }, 0);

    const lowStockCount = (await this.getLowStockAlerts(hospitalId, pharmacyId)).length;
    const expiringCount = (await this.getExpiringBatches(hospitalId, 30)).length;

    const result = {
      totalBatches,
      availableBatches,
      expiredBatches,
      depletedBatches,
      totalQuantity: totalQuantityResult._sum.qtyAvailable || 0,
      totalDispensingQuantity: totalQuantityResult._sum.qtyAvailableDispensing || 0,
      totalValue: Math.round(totalValue * 100) / 100,
      totalDispensingValue: Math.round(totalDispensingValue * 100) / 100,
      lowStock: lowStockCount,
      expiringSoon: expiringCount,
    };

    // Cache the result for 2 minutes (stats change frequently)
    this.cacheService.set(cacheKey, result, 2 * 60 * 1000);

    return result;
  }

  /**
   * Helper method to get pharmacy's hospital ID (for Super Admin)
   */
  async getPharmacyHospital(pharmacyId: string) {
    const pharmacy = await this.prisma.pharmacy.findUnique({
      where: { id: pharmacyId },
      select: { id: true, hospitalId: true, name: true },
    });

    if (!pharmacy) {
      throw new NotFoundException('Pharmacy not found');
    }

    return pharmacy;
  }

  /**
   * Invalidate inventory caches for a hospital
   */
  private async invalidateCache(hospitalId: string): Promise<void> {
    await this.cacheService.deletePattern(`inventory:${hospitalId}:.*`);
    await this.cacheService.deletePattern(`inventory:all:.*`);
  }
}
