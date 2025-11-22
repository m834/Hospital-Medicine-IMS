import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateIssuanceDto } from './dto/create-issuance.dto';
import { SearchIssuanceDto } from './dto/search-issuance.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class IssuanceService {
  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
  ) {}

  /**
   * Issue medicines to patient with FIFO allocation
   * Atomic transaction ensures data consistency
   */
  async create(createIssuanceDto: CreateIssuanceDto, hospitalId: string, userId: string) {
    const { nrNumber, pharmacyId, prescriptionId, priceType, items } = createIssuanceDto;

    // Verify patient exists
    const patient = await this.prisma.patient.findFirst({
      where: { nrNumber, hospitalId },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with NR Number ${nrNumber} not found`);
    }

    // Verify pharmacy exists
    const pharmacy = await this.prisma.pharmacy.findFirst({
      where: { id: pharmacyId, hospitalId },
    });

    if (!pharmacy) {
      throw new NotFoundException('Pharmacy not found');
    }

    // Verify prescription if provided
    if (prescriptionId) {
      const prescription = await this.prisma.prescription.findFirst({
        where: { id: prescriptionId, nrNumber, hospitalId },
      });

      if (!prescription) {
        throw new NotFoundException('Prescription not found');
      }
    }

    // Process each medicine item and prepare batch allocations
    const itemAllocations = await Promise.all(
      items.map(async (item) => {
        // Get FIFO batches for this medicine
        const availableBatches = await this.inventoryService.getAvailableBatchesFIFO(
          item.medicineId,
          pharmacyId,
          hospitalId,
        );

        if (availableBatches.length === 0) {
          throw new BadRequestException(
            `Medicine ${item.medicineId} has no available stock in this pharmacy`,
          );
        }

        // Calculate total available quantity
        const totalAvailable = availableBatches.reduce(
          (sum, batch) => sum + batch.qtyAvailable,
          0,
        );

        if (totalAvailable < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for medicine ${availableBatches[0].medicine.name}. ` +
              `Requested: ${item.quantity}, Available: ${totalAvailable}`,
          );
        }

        // Allocate quantity across batches using FIFO
        let remainingQty = item.quantity;
        const batchAllocations = [];

        for (const batch of availableBatches) {
          if (remainingQty <= 0) break;

          const qtyFromBatch = Math.min(batch.qtyAvailable, remainingQty);
          
          // Determine price based on priceType
          let unitPrice: Decimal;
          if (priceType === 'GOVERNMENT') {
            unitPrice = batch.governmentPrice;
          } else if (priceType === 'RETAIL') {
            unitPrice = batch.retailPrice;
          } else {
            // CUSTOM price
            unitPrice = new Decimal(item.customPrice || 0);
          }

          batchAllocations.push({
            batchId: batch.id,
            medicineId: item.medicineId,
            qtyIssued: qtyFromBatch,
            unitPrice,
            totalPrice: unitPrice.mul(qtyFromBatch),
          });

          remainingQty -= qtyFromBatch;
        }

        return batchAllocations;
      }),
    );

    // Flatten allocations
    const allAllocations = itemAllocations.flat();

    // Calculate total amount
    const totalAmount = allAllocations.reduce(
      (sum, alloc) => sum.add(alloc.totalPrice),
      new Decimal(0),
    );

    // Execute atomic transaction
    const issueTransaction = await this.prisma.$transaction(async (tx) => {
      // Create issue transaction
      const issue = await tx.issueTransaction.create({
        data: {
          hospitalId,
          pharmacyId,
          nrNumber,
          prescriptionId,
          issuedBy: userId,
          totalAmount,
          priceType,
          status: 'COMPLETED',
        },
      });

      // Create issue items and update stock batches
      for (const allocation of allAllocations) {
        // Create issue item
        await tx.issueItem.create({
          data: {
            issueId: issue.id,
            batchId: allocation.batchId,
            medicineId: allocation.medicineId,
            qtyIssued: allocation.qtyIssued,
            unitPrice: allocation.unitPrice,
            totalPrice: allocation.totalPrice,
          },
        });

        // Deduct from batch (FIFO deduction)
        const batch = await tx.stockBatch.findUnique({
          where: { id: allocation.batchId },
        });

        const newQtyAvailable = batch.qtyAvailable - allocation.qtyIssued;

        await tx.stockBatch.update({
          where: { id: allocation.batchId },
          data: {
            qtyAvailable: newQtyAvailable,
            status: newQtyAvailable === 0 ? 'DEPLETED' : batch.status,
          },
        });
      }

      return issue;
    });

    // Return full issue details
    return this.findOne(issueTransaction.id, hospitalId);
  }

  async findAll(searchDto: SearchIssuanceDto, hospitalId: string) {
    const {
      nrNumber,
      pharmacyId,
      prescriptionId,
      status,
      issuedAfter,
      issuedBefore,
      limit = 50,
      page = 1,
      sortBy = 'issuedAt',
      sortOrder = 'desc',
    } = searchDto;

    const where: any = { hospitalId };

    if (nrNumber) where.nrNumber = nrNumber;
    if (pharmacyId) where.pharmacyId = pharmacyId;
    if (prescriptionId) where.prescriptionId = prescriptionId;
    if (status) where.status = status;

    if (issuedAfter || issuedBefore) {
      where.issuedAt = {};
      if (issuedAfter) where.issuedAt.gte = new Date(issuedAfter);
      if (issuedBefore) where.issuedAt.lte = new Date(issuedBefore);
    }

    const skip = (page - 1) * limit;

    const [issues, total] = await Promise.all([
      this.prisma.issueTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          patient: {
            select: {
              nrNumber: true,
              fullName: true,
              mobile: true,
            },
          },
          pharmacy: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          issuer: {
            select: {
              id: true,
              fullName: true,
            },
          },
          items: {
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
              batch: {
                select: {
                  batchNo: true,
                  expiryDate: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.issueTransaction.count({ where }),
    ]);

    return {
      data: issues,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, hospitalId: string) {
    const issue = await this.prisma.issueTransaction.findFirst({
      where: { id, hospitalId },
      include: {
        patient: {
          select: {
            nrNumber: true,
            fullName: true,
            mobile: true,
            cnic: true,
          },
        },
        pharmacy: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        prescription: {
          select: {
            id: true,
            prescriptionType: true,
          },
        },
        issuer: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
        items: {
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
            batch: {
              select: {
                batchNo: true,
                expiryDate: true,
                manufacturer: true,
              },
            },
          },
        },
      },
    });

    if (!issue) {
      throw new NotFoundException('Issue transaction not found');
    }

    return issue;
  }

  async getStats(hospitalId: string, pharmacyId?: string) {
    const where: any = { hospitalId };
    if (pharmacyId) where.pharmacyId = pharmacyId;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalIssues, todayIssues, totalAmount, todayAmount] = await Promise.all([
      this.prisma.issueTransaction.count({ where }),
      this.prisma.issueTransaction.count({
        where: { ...where, issuedAt: { gte: today } },
      }),
      this.prisma.issueTransaction.aggregate({
        where,
        _sum: { totalAmount: true },
      }),
      this.prisma.issueTransaction.aggregate({
        where: { ...where, issuedAt: { gte: today } },
        _sum: { totalAmount: true },
      }),
    ]);

    return {
      totalIssues,
      todayIssues,
      totalAmount: totalAmount._sum.totalAmount || 0,
      todayAmount: todayAmount._sum.totalAmount || 0,
    };
  }
}
