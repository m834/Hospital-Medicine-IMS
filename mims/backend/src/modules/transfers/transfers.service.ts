import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/services/cache.service';
import { CreateTransferRequestDto } from './dto/create-transfer-request.dto';
import { SearchTransferRequestDto } from './dto/search-transfer-request.dto';
import { TransferStatus, BatchStatus, UserRole } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

// Roles notified on transfer activity: hospital admins + the main pharmacy manager.
const OVERSIGHT_ROLES: UserRole[] = [UserRole.HOSPITAL_ADMIN, UserRole.MAIN_PHARMACY_MANAGER];

@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
    private notifications: NotificationsService,
  ) {}

  /**
   * Fire notifications without ever letting a delivery failure break the
   * underlying transfer operation.
   */
  private async safeNotify(fn: () => Promise<void>) {
    try {
      await fn();
    } catch (e) {
      this.logger.warn(`Transfer notification failed: ${(e as Error).message}`);
    }
  }

  async create(createDto: CreateTransferRequestDto, hospitalId: string) {
    // Validate pharmacies exist and belong to same hospital
    const [fromPharmacy, toPharmacy] = await Promise.all([
      this.prisma.pharmacy.findUnique({ where: { id: createDto.fromPharmacyId } }),
      this.prisma.pharmacy.findUnique({ where: { id: createDto.toPharmacyId } }),
    ]);

    if (!fromPharmacy || !toPharmacy) {
      throw new NotFoundException('Pharmacy not found');
    }

    if (fromPharmacy.hospitalId !== hospitalId || toPharmacy.hospitalId !== hospitalId) {
      throw new BadRequestException('Pharmacies must belong to the same hospital');
    }

    // Generate request number: TR-YYYYMMDD-XXXX
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.transferRequest.count({
      where: {
        requestNumber: {
          startsWith: `TR-${dateStr}`,
        },
      },
    });
    const requestNumber = `TR-${dateStr}-${String(count + 1).padStart(4, '0')}`;

    // Create transfer request with items
    const transferRequest = await this.prisma.transferRequest.create({
      data: {
        hospitalId,
        fromPharmacyId: createDto.fromPharmacyId,
        toPharmacyId: createDto.toPharmacyId,
        requestNumber,
        requestedBy: createDto.requestedBy,
        notes: createDto.notes,
        status: TransferStatus.PENDING,
        items: {
          create: createDto.items.map((item) => ({
            medicineId: item.medicineId,
            qtyRequested: item.qtyRequested,
            transferCategory: item.transferCategory ?? 'NORMAL',
          })),
        },
      },
      include: {
        fromPharmacy: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
          },
        },
        toPharmacy: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
          },
        },
        requester: {
          select: {
            id: true,
            fullName: true,
            email: true,
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
          },
        },
      },
    });

    // Invalidate cache
    await this.invalidateCache(hospitalId);

    // Notify oversight (admins + main pharmacy) and the supplying pharmacy that a
    // new transfer has been requested.
    await this.safeNotify(async () => {
      const payload = {
        type: 'TRANSFER_REQUESTED' as const,
        title: 'New transfer request',
        message: `${transferRequest.fromPharmacy?.name ?? 'A pharmacy'} requested transfer ${requestNumber} from ${transferRequest.toPharmacy?.name ?? 'another pharmacy'}.`,
        entityType: 'TransferRequest',
        entityId: transferRequest.id,
        link: '/dashboard/transfers',
        senderId: createDto.requestedBy,
      };
      await this.notifications.notifyRoles(hospitalId, OVERSIGHT_ROLES, payload, createDto.requestedBy);
      await this.notifications.notifyPharmacy(createDto.toPharmacyId, payload, { excludeUserId: createDto.requestedBy });
    });

    return transferRequest;
  }

  async findAll(searchDto: SearchTransferRequestDto, hospitalId?: string) {
    const {
      fromPharmacyId,
      toPharmacyId,
      pharmacyId,
      status,
      limit = 100,
      page = 1,
    } = searchDto;

    // Cache key based on search parameters
    const cacheKey = `transfers:${hospitalId || 'all'}:${JSON.stringify(searchDto)}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const where: any = {};

    if (hospitalId) {
      where.hospitalId = hospitalId;
    }

    if (pharmacyId) {
      where.OR = [{ fromPharmacyId: pharmacyId }, { toPharmacyId: pharmacyId }];
    } else {
      if (fromPharmacyId) where.fromPharmacyId = fromPharmacyId;
      if (toPharmacyId) where.toPharmacyId = toPharmacyId;
    }
    if (status) where.status = status;

    const skip = (page - 1) * limit;

    const [transfers, total] = await Promise.all([
      this.prisma.transferRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          fromPharmacy: {
            select: {
              id: true,
              name: true,
              code: true,
              type: true,
            },
          },
          toPharmacy: {
            select: {
              id: true,
              name: true,
              code: true,
              type: true,
            },
          },
          requester: {
            select: {
              id: true,
              fullName: true,
            },
          },
          approver: {
            select: {
              id: true,
              fullName: true,
            },
          },
          receiver: {
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
                  form: true,
                  strength: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.transferRequest.count({ where }),
    ]);

    const result = {
      data: transfers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache for 5 minutes (increased from 2 minutes)
    await this.cacheService.set(cacheKey, result, 5 * 60 * 1000);

    return result;
  }

  async findOne(id: string, hospitalId?: string) {
    const where: any = { id };
    
    // Only filter by hospitalId if provided
    if (hospitalId) {
      where.hospitalId = hospitalId;
    }

    const transfer = await this.prisma.transferRequest.findFirst({
      where,
      include: {
        fromPharmacy: true,
        toPharmacy: true,
        requester: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        approver: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        receiver: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        items: {
          include: {
            medicine: true,
            batchMappings: {
              include: {
                sourceBatch: true,
                destinationBatch: true,
              },
            },
          },
        },
      },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer request not found');
    }

    return transfer;
  }

  async approve(
    id: string,
    approvalData: { items: Array<{ id: string; qtyApproved: number }>; approvedBy: string },
    userId: string,
  ) {
    // Verify transfer exists and is in PENDING status
    const transfer = await this.prisma.transferRequest.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer request not found');
    }

    if (transfer.status !== TransferStatus.PENDING) {
      throw new BadRequestException('Transfer request is not in pending status');
    }

    // Update transfer request status and items
    const updatedTransfer = await this.prisma.transferRequest.update({
      where: { id },
      data: {
        status: TransferStatus.APPROVED,
        approvedBy: userId,
        approvedAt: new Date(),
        items: {
          updateMany: approvalData.items.map((item) => ({
            where: { id: item.id },
            data: { qtyApproved: item.qtyApproved },
          })),
        },
      },
      include: {
        fromPharmacy: true,
        toPharmacy: true,
        requester: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        approver: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        items: {
          include: {
            medicine: true,
          },
        },
      },
    });

    // Invalidate cache
    await this.invalidateCache(transfer.hospitalId);

    // Let the requester know their transfer was approved.
    await this.safeNotify(() =>
      this.notifications.notifyUsers([transfer.requestedBy], {
        hospitalId: transfer.hospitalId,
        type: 'TRANSFER_APPROVED',
        title: 'Transfer approved',
        message: `Your transfer request ${transfer.requestNumber} was approved.`,
        entityType: 'TransferRequest',
        entityId: transfer.id,
        link: '/dashboard/transfers',
        senderId: userId,
      }),
    );

    return updatedTransfer;
  }

  async reject(
    id: string,
    rejectionData: { rejectionReason: string; rejectedBy: string },
    userId: string,
  ) {
    // Verify transfer exists and is in PENDING status
    const transfer = await this.prisma.transferRequest.findUnique({
      where: { id },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer request not found');
    }

    if (transfer.status !== TransferStatus.PENDING) {
      throw new BadRequestException('Transfer request is not in pending status');
    }

    // Update transfer request status (use notes field for rejection reason)
    const updatedTransfer = await this.prisma.transferRequest.update({
      where: { id },
      data: {
        status: TransferStatus.REJECTED,
        notes: `REJECTED: ${rejectionData.rejectionReason}`, // Store rejection reason in notes
        approvedBy: userId, // Store rejector in approvedBy field
        approvedAt: new Date(),
      },
      include: {
        fromPharmacy: true,
        toPharmacy: true,
        requester: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        approver: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        items: {
          include: {
            medicine: true,
          },
        },
      },
    });

    // Invalidate cache
    await this.invalidateCache(transfer.hospitalId);

    // Let the requester know their transfer was rejected.
    await this.safeNotify(() =>
      this.notifications.notifyUsers([transfer.requestedBy], {
        hospitalId: transfer.hospitalId,
        type: 'TRANSFER_REJECTED',
        title: 'Transfer rejected',
        message: `Your transfer request ${transfer.requestNumber} was rejected${rejectionData.rejectionReason ? `: ${rejectionData.rejectionReason}` : ''}.`,
        entityType: 'TransferRequest',
        entityId: transfer.id,
        link: '/dashboard/transfers',
        senderId: userId,
      }),
    );

    return updatedTransfer;
  }

  async dispatch(
    id: string,
    dispatchData: {
      items: Array<{
        itemId: string;
        batches: Array<{ batchId: string; quantity: number }>;
      }>;
      dispatchedBy: string;
    },
    userId: string,
  ) {
    // Verify transfer exists and is in APPROVED status
    const transfer = await this.prisma.transferRequest.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer request not found');
    }

    if (transfer.status !== TransferStatus.APPROVED) {
      throw new BadRequestException('Transfer request must be approved before dispatching');
    }

    // Validate and process each item with batch mappings
    for (const dispatchItem of dispatchData.items) {
      const transferItem = transfer.items.find((item) => item.id === dispatchItem.itemId);
      if (!transferItem) {
        throw new BadRequestException(`Transfer item ${dispatchItem.itemId} not found`);
      }

      // Verify total dispatched quantity matches approved quantity
      const totalDispatched = dispatchItem.batches.reduce((sum, b) => sum + b.quantity, 0);
      if (totalDispatched !== transferItem.qtyApproved) {
        throw new BadRequestException(
          `Dispatched quantity (${totalDispatched}) must match approved quantity (${transferItem.qtyApproved}) for item ${dispatchItem.itemId}`
        );
      }

      // Update transfer item with dispatched quantity
      await this.prisma.transferItem.update({
        where: { id: dispatchItem.itemId },
        data: { qtyDispatched: totalDispatched },
      });

      // Create batch mappings and deduct stock
      for (const batchMapping of dispatchItem.batches) {
        // Verify batch has sufficient quantity
        const batch = await this.prisma.stockBatch.findUnique({
          where: { id: batchMapping.batchId },
        });

        if (!batch) {
          throw new NotFoundException(`Batch ${batchMapping.batchId} not found`);
        }

        // Validate that batch belongs to the TO pharmacy (provider)
        // FROM = requester, TO = provider (source of stock)
        if (batch.pharmacyId !== transfer.toPharmacyId) {
          throw new BadRequestException(
            `Batch ${batch.batchNo} does not belong to the provider pharmacy. Stock must be dispatched from the provider pharmacy.`
          );
        }

        // Validate batch category matches the requested transfer category
        if (batch.category !== transferItem.transferCategory) {
          throw new BadRequestException(
            `Batch ${batch.batchNo} is ${batch.category} but this item requires ${transferItem.transferCategory} stock`
          );
        }

        if (batch.qtyAvailable < batchMapping.quantity) {
          throw new BadRequestException(
            `Insufficient ${transferItem.transferCategory} quantity in batch ${batch.batchNo}. Available: ${batch.qtyAvailable}, Requested: ${batchMapping.quantity}`
          );
        }

        // Create transfer batch mapping
        await this.prisma.transferBatchMapping.create({
          data: {
            transferItemId: dispatchItem.itemId,
            sourceBatchId: batchMapping.batchId,
            qty: batchMapping.quantity,
          },
        });

        // Deduct from source batch
        await this.prisma.stockBatch.update({
          where: { id: batchMapping.batchId },
          data: {
            qtyAvailable: { decrement: batchMapping.quantity },
          },
        });
      }
    }

    // Update transfer status to DISPATCHED
    const updatedTransfer = await this.prisma.transferRequest.update({
      where: { id },
      data: {
        status: TransferStatus.DISPATCHED,
        dispatchedAt: new Date(),
      },
      include: {
        fromPharmacy: true,
        toPharmacy: true,
        requester: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        approver: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        items: {
          include: {
            medicine: true,
            batchMappings: {
              include: {
                sourceBatch: true,
              },
            },
          },
        },
      },
    });

    // Invalidate cache
    await this.invalidateCache(transfer.hospitalId);

    // Notify the requesting pharmacy that stock is on the way. (This is also the
    // "main pharmacy pushed to a sub-pharmacy" case → the sub-pharmacy is told.)
    await this.safeNotify(() =>
      this.notifications.notifyPharmacy(
        transfer.fromPharmacyId,
        {
          hospitalId: transfer.hospitalId,
          type: 'TRANSFER_DISPATCHED',
          title: 'Transfer dispatched',
          message: `Transfer ${transfer.requestNumber} from ${updatedTransfer.toPharmacy?.name ?? 'the supplying pharmacy'} has been dispatched and is on its way.`,
          entityType: 'TransferRequest',
          entityId: transfer.id,
          link: '/dashboard/transfers',
          senderId: userId,
        },
        { excludeUserId: userId },
      ),
    );

    return updatedTransfer;
  }

  async receive(id: string, userId: string) {
    // Get the transfer with all details
    const transfer = await this.prisma.transferRequest.findUnique({
      where: { id },
      include: {
        fromPharmacy: true,
        toPharmacy: true,
        items: {
          include: {
            medicine: true,
            batchMappings: {
              include: {
                sourceBatch: true,
              },
            },
          },
        },
      },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer request not found');
    }

    // Validate status
    if (transfer.status !== TransferStatus.DISPATCHED) {
      throw new BadRequestException(
        'Transfer must be in DISPATCHED status to be received',
      );
    }

    // Check if already received (has destination batches)
    const hasDestinationBatches = transfer.items.some(item => 
      item.batchMappings?.some(mapping => mapping.destinationBatchId)
    );

    if (hasDestinationBatches) {
      throw new BadRequestException(
        'Transfer has already been received (destination batches exist)',
      );
    }

    // Create stock batches in destination pharmacy for each mapping
    for (const item of transfer.items) {
      // Check if there are batch mappings
      if (!item.batchMappings || item.batchMappings.length === 0) {
        throw new BadRequestException(
          `No batch mappings found for item ${item.medicine.name}. Transfer must be dispatched before receiving.`,
        );
      }

      for (const mapping of item.batchMappings) {
        const sourceBatch = mapping.sourceBatch;

        // Create new stock batch in requester pharmacy (FROM pharmacy)
        // FROM = requester asking for medicines
        // TO = provider being asked to supply medicines
        const destinationBatch = await this.prisma.stockBatch.create({
          data: {
            hospitalId: transfer.hospitalId,
            medicineId: item.medicineId,
            pharmacyId: transfer.fromPharmacyId, // Stock goes to the requester (FROM pharmacy)
            batchNo: sourceBatch.batchNo,
            expiryDate: sourceBatch.expiryDate,
            manufacturer: sourceBatch.manufacturer,
            storageType: sourceBatch.storageType,
            qtyReceived: mapping.qty,
            qtyAvailable: mapping.qty,
            purchasePrice: sourceBatch.purchasePrice,
            governmentPrice: sourceBatch.governmentPrice,
            retailPrice: sourceBatch.retailPrice,
            receivedDate: new Date(),
            status: BatchStatus.AVAILABLE,
            category: sourceBatch.category, // Preserve category (NORMAL/LP) on transfer
          },
        });

        // Update the batch mapping with destination batch ID
        await this.prisma.transferBatchMapping.update({
          where: { id: mapping.id },
          data: {
            destinationBatchId: destinationBatch.id,
          },
        });

        // Update item quantity received
        await this.prisma.transferItem.update({
          where: { id: item.id },
          data: {
            qtyReceived: { increment: mapping.qty },
          },
        });
      }
    }

    // Update transfer status to RECEIVED
    const updatedTransfer = await this.prisma.transferRequest.update({
      where: { id },
      data: {
        status: TransferStatus.RECEIVED,
        receivedAt: new Date(),
        receivedBy: userId,
      },
      include: {
        fromPharmacy: true,
        toPharmacy: true,
        requester: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        approver: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        receiver: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        items: {
          include: {
            medicine: true,
            batchMappings: {
              include: {
                sourceBatch: true,
                destinationBatch: true,
              },
            },
          },
        },
      },
    });

    // Invalidate cache
    await this.invalidateCache(transfer.hospitalId);

    // Confirm receipt to oversight and the supplying pharmacy.
    await this.safeNotify(async () => {
      const payload = {
        type: 'TRANSFER_RECEIVED' as const,
        title: 'Transfer received',
        message: `${transfer.fromPharmacy?.name ?? 'The requesting pharmacy'} received transfer ${transfer.requestNumber}.`,
        entityType: 'TransferRequest',
        entityId: transfer.id,
        link: '/dashboard/transfers',
        senderId: userId,
      };
      await this.notifications.notifyRoles(transfer.hospitalId, OVERSIGHT_ROLES, payload, userId);
      await this.notifications.notifyPharmacy(transfer.toPharmacyId, payload, { excludeUserId: userId });
    });

    return updatedTransfer;
  }

  // Admin utility to fix RECEIVED transfers that don't have destination batches
  async fixReceivedTransfer(id: string, userId: string) {
    // Get the transfer with all details
    const transfer = await this.prisma.transferRequest.findUnique({
      where: { id },
      include: {
        fromPharmacy: true,
        toPharmacy: true,
        items: {
          include: {
            medicine: true,
            batchMappings: {
              include: {
                sourceBatch: true,
                destinationBatch: true,
              },
            },
          },
        },
      },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer request not found');
    }

    // Only fix if status is RECEIVED
    if (transfer.status !== TransferStatus.RECEIVED) {
      throw new BadRequestException('Transfer is not in RECEIVED status');
    }

    let batchesCreated = 0;
    let batchesDeleted = 0;

    // Process each item
    for (const item of transfer.items) {
      if (!item.batchMappings || item.batchMappings.length === 0) {
        console.warn(`No batch mappings for item ${item.medicine.name} in transfer ${transfer.requestNumber}`);
        continue;
      }

      for (const mapping of item.batchMappings) {
        const sourceBatch = mapping.sourceBatch;

        // Check if destination batch exists
        if (mapping.destinationBatch) {
          // Check if destination batch is in the WRONG pharmacy (toPharmacy instead of fromPharmacy)
          if (mapping.destinationBatch.pharmacyId === transfer.toPharmacyId) {
            console.log(`Found incorrectly placed batch ${mapping.destinationBatch.batchNo} in ${transfer.toPharmacy.name}, will delete and recreate in ${transfer.fromPharmacy.name}`);
            
            // Delete the incorrectly created batch
            await this.prisma.stockBatch.delete({
              where: { id: mapping.destinationBatch.id },
            });
            batchesDeleted++;

            // Clear the destination batch reference
            await this.prisma.transferBatchMapping.update({
              where: { id: mapping.id },
              data: { destinationBatchId: null },
            });
          } else if (mapping.destinationBatch.pharmacyId === transfer.fromPharmacyId) {
            // Batch is already in the correct pharmacy, skip
            console.log(`Batch ${mapping.destinationBatch.batchNo} already in correct pharmacy ${transfer.fromPharmacy.name}`);
            continue;
          }
        }

        // Create new stock batch in the correct pharmacy (fromPharmacy - requester)
        const destinationBatch = await this.prisma.stockBatch.create({
          data: {
            hospitalId: transfer.hospitalId,
            medicineId: item.medicineId,
            pharmacyId: transfer.fromPharmacyId, // Stock goes to the requester (FROM pharmacy)
            batchNo: sourceBatch.batchNo,
            expiryDate: sourceBatch.expiryDate,
            manufacturer: sourceBatch.manufacturer,
            storageType: sourceBatch.storageType,
            qtyReceived: mapping.qty,
            qtyAvailable: mapping.qty,
            purchasePrice: sourceBatch.purchasePrice,
            governmentPrice: sourceBatch.governmentPrice,
            retailPrice: sourceBatch.retailPrice,
            receivedDate: new Date(),
            status: BatchStatus.AVAILABLE,
          },
        });

        // Update the batch mapping with destination batch ID
        await this.prisma.transferBatchMapping.update({
          where: { id: mapping.id },
          data: {
            destinationBatchId: destinationBatch.id,
          },
        });

        batchesCreated++;
      }
    }

    return {
      message: `Successfully fixed transfer ${transfer.requestNumber}. Created ${batchesCreated} batches in ${transfer.fromPharmacy.name}${batchesDeleted > 0 ? ` and deleted ${batchesDeleted} incorrectly placed batches from ${transfer.toPharmacy.name}` : ''}.`,
      batchesCreated,
      batchesDeleted,
      transfer: await this.findOne(id),
    };
  }

  /**
   * Invalidate transfer caches for a hospital
   */
  private async invalidateCache(hospitalId: string): Promise<void> {
    await this.cacheService.deletePattern(`transfers:${hospitalId}:.*`);
    await this.cacheService.deletePattern(`transfers:all:.*`);
  }
}
