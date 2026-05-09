import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/services/cache.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { SearchPrescriptionsDto } from './dto/search-prescriptions.dto';
import { UpdatePrescriptionStatusDto } from './dto/update-prescription-status.dto';
import { AddPrescriptionMedicineDto } from './dto/add-prescription-medicine.dto';
import { CreatePrescriptionDispatchDto } from './dto/create-prescription-dispatch.dto';
import { PrescriptionStatus, PaymentMethod, PaymentStatus, Prisma, ReceiptType } from '@prisma/client';

@Injectable()
export class PrescriptionsService {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  async create(
    createPrescriptionDto: CreatePrescriptionDto,
    user?: { id?: string; hospitalId?: string; pharmacyId?: string },
  ) {
    const { nrNumber, doctorId, items, autoIssue, visitId: dtoVisitId, prescriptionMedicines, ...prescriptionData } = createPrescriptionDto;

    // Verify patient exists
    const patient = await this.prisma.patient.findFirst({
      where: { nrNumber },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with MRN ${nrNumber} not found`);
    }

    // Verify doctor exists (if provided)
    let doctor = null;
    if (doctorId) {
      doctor = await this.prisma.user.findFirst({
        where: {
          id: doctorId,
          role: 'DOCTOR',
        },
      });

      if (!doctor) {
        throw new NotFoundException(`Doctor with ID ${doctorId} not found`);
      }
    }

    // Verify all medicines exist (only applies to the legacy items flow)
    if (items && items.length > 0) {
      const medicineIds = items.map((item) => item.medicineId);
      const foundMedicines = await this.prisma.medicine.findMany({
        where: { id: { in: medicineIds } },
      });
      if (foundMedicines.length !== medicineIds.length) {
        throw new BadRequestException('One or more medicines not found');
      }
    }

    const hospitalId = patient.hospitalId;
    const now = new Date();

    // Resolve pharmacyId for auto-issue: use the issuing pharmacist's own pharmacy
    let pharmacyId = user?.pharmacyId;
    if (autoIssue && !pharmacyId && hospitalId) {
      const mainPharmacy = await this.prisma.pharmacy.findFirst({
        where: { hospitalId, type: 'MAIN', status: 'ACTIVE' },
        select: { id: true },
      });
      pharmacyId = mainPharmacy?.id;
    }

    if (autoIssue && !pharmacyId) {
      throw new BadRequestException('Pharmacy context is required to issue a prescription');
    }

    if (autoIssue) {
      // Create prescription + deduct inventory in a single atomic transaction
      const prescription = await this.prisma.$transaction(async (tx) => {
        // Create prescription and items directly as ISSUED
        const created = await tx.prescription.create({
          data: {
            hospitalId,
            nrNumber: patient.nrNumber,
            doctorId: doctor?.id || null,
            prescriptionType: prescriptionData.prescriptionType,
            scannedImageUrl: prescriptionData.scannedImageUrl,
            notes: prescriptionData.notes,
            status: PrescriptionStatus.ISSUED,
            items: {
              create: items.map((item) => ({
                medicineId: item.medicineId,
                qtyPrescribed: item.qtyPrescribed,
                dosage: item.dosage,
                frequency: item.frequency,
                duration: item.duration,
                status: 'ISSUED',
                transferCategory: item.transferCategory ?? 'NORMAL',
              })),
            },
          },
          include: {
            patient: { select: { id: true, nrNumber: true, fullName: true, gender: true, mobile: true } },
            doctor: { select: { id: true, fullName: true, email: true } },
            items: { include: { medicine: { select: { id: true, name: true, genericName: true, strength: true, form: true } } } },
          },
        });

        // Deduct stock from the issuing pharmacist's inventory
        let totalAmount = new Prisma.Decimal(0);
        for (const item of created.items) {
          const category = (item as any).transferCategory ?? 'NORMAL';
          const batch = await tx.stockBatch.findFirst({
            where: {
              hospitalId,
              pharmacyId,
              medicineId: item.medicine.id,
              status: 'AVAILABLE',
              qtyAvailable: { gt: 0 },
              expiryDate: { gte: now },
              category,
            },
            orderBy: [{ expiryDate: 'asc' }, { receivedDate: 'asc' }],
          });

          if (!batch) {
            throw new BadRequestException(
              `No available ${category} stock for medicine: ${item.medicine.name}`,
            );
          }

          const qtyPrescribed = (item as any).qtyPrescribed as number;
          if (batch.qtyAvailable < qtyPrescribed) {
            throw new BadRequestException(
              `Insufficient ${category} stock for ${item.medicine.name}. Requested: ${qtyPrescribed}, Available: ${batch.qtyAvailable}`,
            );
          }

          const newQty = batch.qtyAvailable - qtyPrescribed;
          await tx.stockBatch.update({
            where: { id: batch.id },
            data: { qtyAvailable: newQty, status: newQty === 0 ? 'DEPLETED' : batch.status },
          });

          totalAmount = totalAmount.add(batch.retailPrice.mul(qtyPrescribed));
        }

        return { prescription: created, totalAmount };
      });

      // Invalidate inventory cache (non-blocking)
      try {
        await this.cacheService.deletePattern(`inventory:${hospitalId}:.*`);
        await this.cacheService.deletePattern(`inventory:all:.*`);
      } catch {}

      // Create pharmacy receipt (non-blocking)
      try {
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const lastReceipt = await this.prisma.receipt.findFirst({
          where: { receiptNumber: { startsWith: `REC-${dateStr}` } },
          orderBy: { receiptNumber: 'desc' },
        });
        const sequence = lastReceipt ? parseInt(lastReceipt.receiptNumber.split('-')[2]) + 1 : 1;
        const receiptNumber = `REC-${dateStr}-${sequence.toString().padStart(4, '0')}`;

        const latestVisit = await (this.prisma as any).visit.findFirst({
          where: { patientId: patient.id, hospitalId },
          orderBy: { visitDate: 'desc' },
          select: { id: true, departmentId: true },
        });

        const doctorDepartmentId = doctor?.id
          ? (await this.prisma.user.findUnique({ where: { id: doctor.id }, select: { departmentId: true } }))?.departmentId
          : null;

        const fallbackDept = await this.prisma.department.findFirst({ where: { hospitalId }, select: { id: true } });
        const departmentId = latestVisit?.departmentId || doctorDepartmentId || fallbackDept?.id;

        if (departmentId) {
          await (this.prisma as any).receipt.create({
            data: {
              hospitalId,
              patientId: patient.id,
              visitId: latestVisit?.id || undefined,
              departmentId,
              generatedById: user?.id || doctor?.id || patient.attendingDoctorId,
              receiptNumber,
              receiptType: ReceiptType.PHARMACY,
              description: `Prescription Issued - ${prescription.prescription.id.slice(0, 8)}`,
              amount: prescription.totalAmount,
              totalAmount: prescription.totalAmount,
              paidAmount: new Prisma.Decimal(0),
              paymentMethod: PaymentMethod.CASH,
              paymentStatus: PaymentStatus.UNPAID,
              notes: JSON.stringify({ prescriptionId: prescription.prescription.id }),
            },
          });
        }
      } catch (receiptError) {
        console.error('Failed to create pharmacy receipt (non-fatal):', receiptError);
      }

      return prescription.prescription;
    }

    // New flow: prescriptionMedicines present → ACTIVE prescription linked to visit
    if (prescriptionMedicines && prescriptionMedicines.length > 0) {
      // Auto-detect latest visit if not provided
      let resolvedVisitId = dtoVisitId ?? null;
      if (!resolvedVisitId) {
        const latestVisit = await this.prisma.visit.findFirst({
          where: { patientId: patient.id, hospitalId },
          orderBy: { visitDate: 'desc' },
          select: { id: true },
        });
        resolvedVisitId = latestVisit?.id ?? null;
      }

      const prescription = await this.prisma.prescription.create({
        data: {
          hospitalId,
          nrNumber: patient.nrNumber,
          doctorId: doctor?.id || user?.id || null,
          visitId: resolvedVisitId,
          prescriptionType: prescriptionData.prescriptionType ?? 'E_PRESCRIPTION',
          scannedImageUrl: prescriptionData.scannedImageUrl,
          notes: prescriptionData.notes,
          status: PrescriptionStatus.ACTIVE,
          medicines: {
            create: prescriptionMedicines.map((m) => ({
              medicineId: m.medicineId,
              dosage: m.dosage,
              instructions: m.instructions,
              category: m.category ?? 'NORMAL',
              addedBy: user?.id || doctor?.id || '',
            })),
          },
        },
        include: {
          patient: { select: { id: true, nrNumber: true, fullName: true, gender: true, mobile: true } },
          doctor: { select: { id: true, fullName: true, email: true } },
          visit: { select: { id: true, visitDate: true, visitNumber: true, visitType: true } },
          medicines: { include: { medicine: { select: { id: true, name: true, genericName: true, strength: true, form: true } } } },
        },
      });

      return prescription;
    }

    // Legacy flow: items array → PENDING prescription (backward compat)
    const prescription = await this.prisma.prescription.create({
      data: {
        hospitalId,
        nrNumber: patient.nrNumber,
        doctorId: doctor?.id || null,
        prescriptionType: prescriptionData.prescriptionType,
        scannedImageUrl: prescriptionData.scannedImageUrl,
        notes: prescriptionData.notes,
        status: PrescriptionStatus.PENDING,
        items: {
          create: (items ?? []).map((item) => ({
            medicineId: item.medicineId,
            qtyPrescribed: item.qtyPrescribed,
            dosage: item.dosage,
            frequency: item.frequency,
            duration: item.duration,
            status: 'PENDING',
            transferCategory: item.transferCategory ?? 'NORMAL',
          })),
        },
      },
      include: {
        patient: { select: { id: true, nrNumber: true, fullName: true, gender: true, mobile: true } },
        doctor: { select: { id: true, fullName: true, email: true } },
        items: { include: { medicine: { select: { id: true, name: true, genericName: true, strength: true, form: true } } } },
      },
    });

    return prescription;
  }

  async findAll(searchDto: SearchPrescriptionsDto) {
    const { hospitalId, nrNumber, doctorId, status, limit = 50, page = 1 } = searchDto;

    const where: any = {};

    if (hospitalId) {
      where.hospitalId = hospitalId;
    }

    if (nrNumber) {
      where.nrNumber = {
        contains: nrNumber,
        mode: 'insensitive',
      };
    }

    if (doctorId) {
      where.doctorId = doctorId;
    }

    if (status) {
      where.status = status as PrescriptionStatus;
    }

    const [prescriptions, total] = await Promise.all([
      this.prisma.prescription.findMany({
        where,
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
          doctor: {
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
                  strength: true,
                  form: true,
                },
              },
            },
          },
          medicines: { select: { id: true } },
          visit: { select: { id: true, visitDate: true, visitNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.prescription.count({ where }),
    ]);

    return {
      data: prescriptions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            nrNumber: true,
            fullName: true,
            gender: true,
            dob: true,
            mobile: true,
            cnic: true,
            address: true,
            visitType: true,
            department: true,
            ward: true,
            bed: true,
            attendingDoctorId: true,
          },
        },
        doctor: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        items: {
          include: {
            medicine: {
              select: { id: true, name: true, genericName: true, strength: true, form: true },
            },
          },
        },
        medicines: {
          include: {
            medicine: { select: { id: true, name: true, genericName: true, strength: true, form: true } },
            addedByUser: { select: { id: true, fullName: true } },
          },
          orderBy: { addedAt: 'asc' },
        },
        dispatches: {
          include: {
            dispatcher: { select: { id: true, fullName: true } },
            items: {
              include: {
                prescriptionMedicine: {
                  include: { medicine: { select: { id: true, name: true, strength: true, form: true } } },
                },
              },
            },
          },
          orderBy: { dispatchedAt: 'desc' },
        },
        visit: { select: { id: true, visitDate: true, visitNumber: true, visitType: true } },
      },
    });

    if (!prescription) {
      throw new NotFoundException(`Prescription with ID ${id} not found`);
    }

    return prescription;
  }

  async updateStatus(
    id: string,
    updateStatusDto: UpdatePrescriptionStatusDto,
    user?: { id?: string; hospitalId?: string; pharmacyId?: string },
  ) {
    // Verify prescription exists
    const prescription = await this.prisma.prescription.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!prescription) {
      throw new NotFoundException(`Prescription with ID ${id} not found`);
    }

    // Validate status transition
    const { status } = updateStatusDto;
    const currentStatus = prescription.status;

    // Define allowed status transitions (based on actual schema enums)
    const allowedTransitions: Record<string, PrescriptionStatus[]> = {
      PENDING: [PrescriptionStatus.ISSUED, PrescriptionStatus.CANCELLED],
      ISSUED: [],
      PARTIALLY_ISSUED: [PrescriptionStatus.ISSUED, PrescriptionStatus.CANCELLED],
      CANCELLED: [],
    };

    const statusEnum = status as PrescriptionStatus;
    if (!allowedTransitions[currentStatus]?.includes(statusEnum)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${status}`,
      );
    }

    if (statusEnum === PrescriptionStatus.ISSUED) {
      const now = new Date();
      const hospitalId = prescription.hospitalId || user?.hospitalId;

      let pharmacyId = user?.pharmacyId;
      if (!pharmacyId && hospitalId) {
        const mainPharmacy = await this.prisma.pharmacy.findFirst({
          where: { hospitalId, type: 'MAIN', status: 'ACTIVE' },
          select: { id: true },
        });
        pharmacyId = mainPharmacy?.id;
      }

      if (!hospitalId || !pharmacyId) {
        throw new BadRequestException(
          'Pharmacy context is required to issue a prescription',
        );
      }

      // Get patient for receipt
      const patient = await this.prisma.patient.findFirst({
        where: { nrNumber: prescription.nrNumber },
      });

      if (!patient) {
        throw new NotFoundException('Patient not found');
      }

      // Step 1: Deduct stock and update prescription status in a single transaction
      let totalAmount = new Prisma.Decimal(0);

      const updated = await this.prisma.$transaction(async (tx) => {
        for (const item of prescription.items) {
          const category = (item as any).transferCategory ?? 'NORMAL';
          const batch = await tx.stockBatch.findFirst({
            where: {
              hospitalId,
              pharmacyId,
              medicineId: item.medicineId,
              status: 'AVAILABLE',
              qtyAvailable: { gt: 0 },
              expiryDate: { gte: now },
              category,
            },
            orderBy: [{ expiryDate: 'asc' }, { receivedDate: 'asc' }],
          });

          if (!batch) {
            throw new BadRequestException(
              `No available ${category} stock for medicine ${item.medicineId}`,
            );
          }

          if (batch.qtyAvailable < item.qtyPrescribed) {
            throw new BadRequestException(
              `Insufficient ${category} stock for medicine ${item.medicineId}. ` +
                `Requested: ${item.qtyPrescribed}, Available: ${batch.qtyAvailable}`,
            );
          }

          const newQtyAvailable = batch.qtyAvailable - item.qtyPrescribed;

          await tx.stockBatch.update({
            where: { id: batch.id },
            data: {
              qtyAvailable: newQtyAvailable,
              status: newQtyAvailable === 0 ? 'DEPLETED' : batch.status,
            },
          });

          await tx.prescriptionItem.update({
            where: { id: item.id },
            data: { status: 'ISSUED' },
          });

          // Calculate cost using retail price from the batch
          const itemCost = batch.retailPrice.mul(item.qtyPrescribed);
          totalAmount = totalAmount.add(itemCost);
        }

        return tx.prescription.update({
          where: { id },
          data: { status: statusEnum },
          include: {
            patient: {
              select: {
                id: true,
                nrNumber: true,
                fullName: true,
              },
            },
            doctor: {
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
                    strength: true,
                    form: true,
                  },
                },
              },
            },
          },
        });
      });

      // Step 2: Invalidate inventory cache so the UI reflects the deducted stock immediately
      try {
        await this.cacheService.deletePattern(`inventory:${hospitalId}:.*`);
        await this.cacheService.deletePattern(`inventory:all:.*`);
      } catch (cacheError) {
        // Non-fatal — cache will expire on its own
      }

      // Step 3: Attempt to create a pharmacy receipt (non-blocking — stock is already deducted)
      try {
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const lastReceipt = await this.prisma.receipt.findFirst({
          where: { receiptNumber: { startsWith: `REC-${dateStr}` } },
          orderBy: { receiptNumber: 'desc' },
        });
        const sequence = lastReceipt
          ? parseInt(lastReceipt.receiptNumber.split('-')[2]) + 1
          : 1;
        const receiptNumber = `REC-${dateStr}-${sequence.toString().padStart(4, '0')}`;

        const latestVisit = await (this.prisma as any).visit.findFirst({
          where: { patientId: patient.id, hospitalId },
          orderBy: { visitDate: 'desc' },
          select: { id: true, departmentId: true },
        });

        const doctorDepartmentId = prescription.doctorId
          ? (
              await this.prisma.user.findUnique({
                where: { id: prescription.doctorId },
                select: { departmentId: true },
              })
            )?.departmentId
          : null;

        const fallbackDepartment = await this.prisma.department.findFirst({
          where: { hospitalId },
          select: { id: true },
        });

        const departmentId =
          latestVisit?.departmentId || doctorDepartmentId || fallbackDepartment?.id;

        if (departmentId) {
          const prismaAny = this.prisma as any;
          await prismaAny.receipt.create({
            data: {
              hospitalId,
              patientId: patient.id,
              visitId: latestVisit?.id || undefined,
              departmentId,
              generatedById: user?.id || prescription.doctorId || patient.attendingDoctorId,
              receiptNumber,
              receiptType: ReceiptType.PHARMACY,
              description: `Prescription Issued - ${id.slice(0, 8)}`,
              amount: totalAmount,
              totalAmount: totalAmount,
              paidAmount: new Prisma.Decimal(0),
              paymentMethod: PaymentMethod.CASH,
              paymentStatus: PaymentStatus.UNPAID,
              notes: JSON.stringify({ prescriptionId: id }),
            },
          });
        }
      } catch (receiptError) {
        // Receipt creation failure must not block the successful stock deduction
        console.error('Failed to create pharmacy receipt (non-fatal):', receiptError);
      }

      return updated;
    }

    // Update status
    const updated = await this.prisma.prescription.update({
      where: { id },
      data: { status: statusEnum },
      include: {
        patient: {
          select: {
            id: true,
            nrNumber: true,
            fullName: true,
          },
        },
        doctor: {
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
                strength: true,
                form: true,
              },
            },
          },
        },
      },
    });

    return updated;
  }

  async getByPatient(nrNumber: string) {
    // Verify patient exists
    const patient = await this.prisma.patient.findFirst({
      where: { nrNumber },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with MRN ${nrNumber} not found`);
    }

    const prescriptions = await this.prisma.prescription.findMany({
      where: { nrNumber: patient.nrNumber },
      include: {
        doctor: {
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
                strength: true,
                form: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return prescriptions;
  }

  async getActivePrescriptions(nrNumber: string) {
    // Get prescriptions that are PENDING or PARTIALLY_ISSUED (not fully dispensed yet)
    const patient = await this.prisma.patient.findFirst({
      where: { nrNumber },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with MRN ${nrNumber} not found`);
    }

    const prescriptions = await this.prisma.prescription.findMany({
      where: {
        nrNumber: patient.nrNumber,
        status: {
          in: [PrescriptionStatus.PENDING, PrescriptionStatus.PARTIALLY_ISSUED],
        },
      },
      include: {
        doctor: {
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
                strength: true,
                form: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return prescriptions;
  }

  async addMedicine(
    prescriptionId: string,
    dto: AddPrescriptionMedicineDto,
    userId: string,
  ) {
    const prescription = await this.prisma.prescription.findUnique({ where: { id: prescriptionId } });
    if (!prescription) throw new NotFoundException('Prescription not found');
    if (prescription.status !== PrescriptionStatus.ACTIVE) {
      throw new BadRequestException('Can only add medicines to an active prescription');
    }

    const medicine = await this.prisma.medicine.findUnique({ where: { id: dto.medicineId } });
    if (!medicine) throw new NotFoundException('Medicine not found');

    return this.prisma.prescriptionMedicine.create({
      data: {
        prescriptionId,
        medicineId: dto.medicineId,
        dosage: dto.dosage,
        instructions: dto.instructions,
        category: dto.category ?? 'NORMAL',
        addedBy: userId,
      },
      include: {
        medicine: { select: { id: true, name: true, genericName: true, strength: true, form: true } },
        addedByUser: { select: { id: true, fullName: true } },
      },
    });
  }

  async dispatchRound(
    prescriptionId: string,
    dto: CreatePrescriptionDispatchDto,
    user: { id: string; hospitalId: string; pharmacyId: string },
  ) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: { medicines: true },
    });

    if (!prescription) throw new NotFoundException('Prescription not found');
    if (prescription.status !== PrescriptionStatus.ACTIVE) {
      throw new BadRequestException('Prescription is not active');
    }
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('No medicines selected for dispatch');
    }

    const now = new Date();
    const results: Array<{
      prescriptionMedicineId: string;
      medicineName?: string;
      success: boolean;
      quantityDispatched?: number;
      error?: string;
    }> = [];

    // Pre-validate all items before touching stock
    const validItems: Array<{ pm: (typeof prescription.medicines)[0]; qty: number }> = [];
    for (const dispatchItem of dto.items) {
      const pm = prescription.medicines.find((m) => m.id === dispatchItem.prescriptionMedicineId);
      if (!pm) {
        results.push({ prescriptionMedicineId: dispatchItem.prescriptionMedicineId, success: false, error: 'Medicine not found on this prescription' });
        continue;
      }

      const batch = await this.prisma.stockBatch.findFirst({
        where: {
          hospitalId: user.hospitalId,
          pharmacyId: user.pharmacyId,
          medicineId: pm.medicineId,
          status: 'AVAILABLE',
          qtyAvailable: { gte: dispatchItem.quantityDispatched },
          expiryDate: { gte: now },
          category: pm.category,
        },
        orderBy: [{ expiryDate: 'asc' }, { receivedDate: 'asc' }],
      });

      if (!batch) {
        // Check if any stock exists at all (to give a better error message)
        const anyBatch = await this.prisma.stockBatch.findFirst({
          where: {
            hospitalId: user.hospitalId,
            pharmacyId: user.pharmacyId,
            medicineId: pm.medicineId,
            status: 'AVAILABLE',
            qtyAvailable: { gt: 0 },
            expiryDate: { gte: now },
            category: pm.category,
          },
        });
        const available = anyBatch?.qtyAvailable ?? 0;
        results.push({
          prescriptionMedicineId: dispatchItem.prescriptionMedicineId,
          success: false,
          error: `Insufficient ${pm.category} stock. Available: ${available}, Requested: ${dispatchItem.quantityDispatched}`,
        });
        continue;
      }

      validItems.push({ pm, qty: dispatchItem.quantityDispatched });
    }

    if (validItems.length === 0) {
      return { dispatch: null, results };
    }

    // Create dispatch record
    const dispatch = await this.prisma.prescriptionDispatch.create({
      data: {
        prescriptionId,
        visitId: prescription.visitId,
        dispatchedBy: user.id,
        notes: dto.notes,
      },
    });

    // Deduct stock and create dispatch items for valid items
    for (const { pm, qty } of validItems) {
      const batch = await this.prisma.stockBatch.findFirst({
        where: {
          hospitalId: user.hospitalId,
          pharmacyId: user.pharmacyId,
          medicineId: pm.medicineId,
          status: 'AVAILABLE',
          qtyAvailable: { gte: qty },
          expiryDate: { gte: now },
          category: pm.category,
        },
        orderBy: [{ expiryDate: 'asc' }, { receivedDate: 'asc' }],
      });

      if (!batch) {
        results.push({ prescriptionMedicineId: pm.id, success: false, error: 'Stock changed during dispatch' });
        continue;
      }

      await this.prisma.stockBatch.update({
        where: { id: batch.id },
        data: {
          qtyAvailable: { decrement: qty },
          status: batch.qtyAvailable - qty === 0 ? 'DEPLETED' : batch.status,
        },
      });

      await this.prisma.prescriptionDispatchItem.create({
        data: {
          dispatchId: dispatch.id,
          prescriptionMedicineId: pm.id,
          quantityDispatched: qty,
        },
      });

      results.push({ prescriptionMedicineId: pm.id, success: true, quantityDispatched: qty });
    }

    // Invalidate inventory cache
    try {
      await this.cacheService.deletePattern(`inventory:${user.hospitalId}:.*`);
    } catch {}

    const fullDispatch = await this.prisma.prescriptionDispatch.findUnique({
      where: { id: dispatch.id },
      include: {
        dispatcher: { select: { id: true, fullName: true } },
        items: {
          include: {
            prescriptionMedicine: {
              include: { medicine: { select: { id: true, name: true, strength: true, form: true } } },
            },
          },
        },
      },
    });

    return { dispatch: fullDispatch, results };
  }

  async completePrescription(prescriptionId: string) {
    const prescription = await this.prisma.prescription.findUnique({ where: { id: prescriptionId } });
    if (!prescription) throw new NotFoundException('Prescription not found');
    if (prescription.status !== PrescriptionStatus.ACTIVE) {
      throw new BadRequestException('Only active prescriptions can be completed');
    }

    return this.prisma.prescription.update({
      where: { id: prescriptionId },
      data: { status: PrescriptionStatus.COMPLETED },
      select: { id: true, status: true },
    });
  }
}
