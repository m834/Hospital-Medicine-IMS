import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/services/cache.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { SearchPrescriptionsDto } from './dto/search-prescriptions.dto';
import { AddPrescriptionMedicineDto } from './dto/add-prescription-medicine.dto';
import { CreatePrescriptionDispatchDto } from './dto/create-prescription-dispatch.dto';
import { PrescriptionStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { mrnFilter } from '../../common/utils/mrn.util';

@Injectable()
export class PrescriptionsService {
  private readonly logger = new Logger(PrescriptionsService.name);

  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  async create(
    createPrescriptionDto: CreatePrescriptionDto,
    user?: { id?: string; hospitalId?: string; pharmacyId?: string },
  ) {
    const { nrNumber, doctorId, visitId: dtoVisitId, prescriptionMedicines, ...rest } = createPrescriptionDto;

    const patient = await this.prisma.patient.findFirst({ where: { nrNumber: mrnFilter(nrNumber) } });
    if (!patient) throw new NotFoundException(`Patient with MRN ${nrNumber} not found`);

    let doctorRecord = null;
    if (doctorId) {
      doctorRecord = await this.prisma.user.findFirst({ where: { id: doctorId, role: 'DOCTOR' } });
      if (!doctorRecord) throw new NotFoundException(`Doctor with ID ${doctorId} not found`);
    }

    const hospitalId = patient.hospitalId;

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

    // When a pharmacy user creates the prescription we dispense the first dose
    // immediately (deducting stock). Non-pharmacy creators (e.g. a doctor with
    // no pharmacyId) just record the prescription without touching inventory.
    const pharmacyId = user?.pharmacyId ?? null;
    const now = new Date();

    const prescriptionId = await this.prisma.$transaction(async (tx) => {
      const created = await tx.prescription.create({
        data: {
          hospitalId,
          pharmacyId,
          nrNumber: patient.nrNumber,
          doctorId: doctorRecord?.id ?? user?.id ?? null,
          createdBy: user?.id ?? null,
          visitId: resolvedVisitId,
          prescriptionType: rest.prescriptionType ?? 'E_PRESCRIPTION',
          scannedImageUrl: rest.scannedImageUrl,
          notes: rest.notes,
          status: PrescriptionStatus.ACTIVE,
        },
      });

      let dispatchRecord: { id: string } | null = null;

      for (const m of prescriptionMedicines) {
        const category = m.category ?? 'NORMAL';
        const pm = await tx.prescriptionMedicine.create({
          data: {
            prescriptionId: created.id,
            medicineId: m.medicineId,
            dosage: m.dosage,
            dosageFrequency: m.dosageFrequency ?? null,
            quantity: m.quantity ?? null,
            instructions: m.instructions,
            category,
            addedBy: user?.id ?? '',
          },
        });

        // Dispense the first dose only when we have both a pharmacy context
        // and a quantity to dispense.
        const qty = m.quantity ?? 0;
        if (!pharmacyId || qty <= 0) continue;

        const batches = await tx.stockBatch.findMany({
          where: {
            hospitalId,
            pharmacyId,
            medicineId: m.medicineId,
            status: 'AVAILABLE',
            qtyAvailable: { gt: 0 },
            expiryDate: { gt: now },
            category,
          },
          orderBy: [{ expiryDate: 'asc' }, { receivedDate: 'asc' }],
        });

        const totalAvailable = batches.reduce((sum, b) => sum + b.qtyAvailable, 0);
        if (totalAvailable < qty) {
          const med = await tx.medicine.findUnique({ where: { id: m.medicineId }, select: { name: true } });
          throw new BadRequestException(
            `Insufficient ${category} stock for ${med?.name ?? 'medicine'}. Available: ${totalAvailable}, requested: ${qty}`,
          );
        }

        if (!dispatchRecord) {
          dispatchRecord = await tx.prescriptionDispatch.create({
            data: {
              prescriptionId: created.id,
              visitId: resolvedVisitId,
              dispatchedBy: user?.id ?? '',
              notes: 'First dose dispensed at creation',
            },
          });
        }

        // FEFO deduction across batches
        let remaining = qty;
        for (const batch of batches) {
          if (remaining <= 0) break;
          const take = Math.min(batch.qtyAvailable, remaining);
          await tx.stockBatch.update({
            where: { id: batch.id },
            data: {
              qtyAvailable: { decrement: take },
              status: batch.qtyAvailable - take === 0 ? 'DEPLETED' : batch.status,
            },
          });
          remaining -= take;
        }

        await tx.prescriptionDispatchItem.create({
          data: {
            dispatchId: dispatchRecord.id,
            prescriptionMedicineId: pm.id,
            quantityDispatched: qty,
          },
        });
      }

      return created.id;
    });

    if (pharmacyId) {
      try {
        await this.cacheService.deletePattern(`inventory:${hospitalId}:.*`);
      } catch {}
    }

    return this.findOne(prescriptionId);
  }

  async findAll(
    searchDto: SearchPrescriptionsDto,
    user?: { hospitalId?: string; pharmacyId?: string; role?: string },
  ) {
    const { hospitalId, nrNumber, doctorId, status, limit = 50, page = 1 } = searchDto;

    const where: any = {};
    if (hospitalId) where.hospitalId = hospitalId;
    else if (user?.hospitalId) where.hospitalId = user.hospitalId;
    if (nrNumber) where.nrNumber = { contains: nrNumber, mode: 'insensitive' };
    if (doctorId) where.doctorId = doctorId;
    if (status) where.status = status as PrescriptionStatus;

    // Pharmacy scoping: SUB pharmacies see only their own prescriptions.
    // MAIN pharmacies (and admins with no pharmacy) see all in the hospital.
    if (user?.pharmacyId) {
      const pharmacy = await this.prisma.pharmacy.findUnique({
        where: { id: user.pharmacyId },
        select: { type: true },
      });
      if (pharmacy?.type === 'SUB') {
        where.pharmacyId = user.pharmacyId;
      }
    }

    const [prescriptions, total] = await Promise.all([
      this.prisma.prescription.findMany({
        where,
        include: {
          patient: { select: { id: true, nrNumber: true, fullName: true, gender: true, mobile: true } },
          doctor: { select: { id: true, fullName: true, email: true } },
          creator: { select: { id: true, fullName: true, role: true } },
          pharmacy: { select: { id: true, name: true, type: true } },
          medicines: { select: { id: true } },
          visit: { select: { id: true, visitDate: true, visitNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.prescription.count({ where }),
    ]);

    return { data: prescriptions, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, pharmacyId?: string) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true, nrNumber: true, fullName: true, gender: true,
            dob: true, mobile: true, cnic: true, address: true,
            visitType: true, department: true, ward: true, bed: true, attendingDoctorId: true,
          },
        },
        doctor: { select: { id: true, fullName: true, email: true } },
        creator: { select: { id: true, fullName: true, role: true } },
        pharmacy: { select: { id: true, name: true, type: true } },
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

    if (!prescription) throw new NotFoundException(`Prescription with ID ${id} not found`);

    if (pharmacyId && prescription.medicines.length > 0) {
      const now = new Date();
      const medicineIds = [...new Set(prescription.medicines.map((m) => m.medicineId))];

      const stockAgg = await this.prisma.stockBatch.groupBy({
        by: ['medicineId', 'category'],
        where: {
          hospitalId: prescription.hospitalId,
          pharmacyId,
          medicineId: { in: medicineIds },
          status: 'AVAILABLE',
          expiryDate: { gte: now },
        },
        _sum: { qtyAvailable: true },
      });

      const stockMap = new Map(
        stockAgg.map((s) => [`${s.medicineId}:${s.category}`, s._sum.qtyAvailable ?? 0]),
      );

      const enriched = {
        ...prescription,
        medicines: prescription.medicines.map((m) => ({
          ...m,
          availableQty: stockMap.get(`${m.medicineId}:${m.category}`) ?? 0,
        })),
      };
      return enriched;
    }

    return prescription;
  }

  async getByPatient(nrNumber: string) {
    const patient = await this.prisma.patient.findFirst({ where: { nrNumber: mrnFilter(nrNumber) } });
    if (!patient) throw new NotFoundException(`Patient with MRN ${nrNumber} not found`);

    return this.prisma.prescription.findMany({
      where: { nrNumber: patient.nrNumber },
      include: {
        doctor: { select: { id: true, fullName: true, email: true } },
        medicines: {
          include: {
            medicine: { select: { id: true, name: true, genericName: true, strength: true, form: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getActivePrescriptions(nrNumber: string) {
    const patient = await this.prisma.patient.findFirst({ where: { nrNumber: mrnFilter(nrNumber) } });
    if (!patient) throw new NotFoundException(`Patient with MRN ${nrNumber} not found`);

    return this.prisma.prescription.findMany({
      where: { nrNumber: patient.nrNumber, status: PrescriptionStatus.ACTIVE },
      include: {
        doctor: { select: { id: true, fullName: true, email: true } },
        medicines: {
          include: {
            medicine: { select: { id: true, name: true, genericName: true, strength: true, form: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addMedicine(prescriptionId: string, dto: AddPrescriptionMedicineDto, userId: string) {
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
        dosageFrequency: dto.dosageFrequency ?? null,
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
      success: boolean;
      quantityDispatched?: number;
      error?: string;
    }> = [];

    // Pre-validate all items before touching stock
    const validItems: Array<{ pm: (typeof prescription.medicines)[0]; qty: number }> = [];
    for (const dispatchItem of dto.items) {
      const pm = prescription.medicines.find((m) => m.id === dispatchItem.prescriptionMedicineId);
      if (!pm) {
        results.push({
          prescriptionMedicineId: dispatchItem.prescriptionMedicineId,
          success: false,
          error: 'Medicine not found on this prescription',
        });
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

    let dispatch: any;
    try {
      dispatch = await this.prisma.$transaction(async (tx) => {
        const dispatchRecord = await tx.prescriptionDispatch.create({
          data: {
            prescriptionId,
            visitId: prescription.visitId ?? null,
            dispatchedBy: user.id,
            notes: dto.notes ?? null,
          },
        });

        for (const { pm, qty } of validItems) {
          const batch = await tx.stockBatch.findFirst({
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
            results.push({
              prescriptionMedicineId: pm.id,
              success: false,
              error: 'Stock changed during dispatch',
            });
            continue;
          }

          await tx.stockBatch.update({
            where: { id: batch.id },
            data: {
              qtyAvailable: { decrement: qty },
              status: batch.qtyAvailable - qty === 0 ? 'DEPLETED' : batch.status,
            },
          });

          await tx.prescriptionDispatchItem.create({
            data: {
              dispatchId: dispatchRecord.id,
              prescriptionMedicineId: pm.id,
              quantityDispatched: qty,
            },
          });

          results.push({ prescriptionMedicineId: pm.id, success: true, quantityDispatched: qty });
        }

        return dispatchRecord;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.error(`Dispatch DB error [${err.code}]: ${err.message}`, err.meta);
        throw new BadRequestException(`Dispatch failed: ${err.message} (code: ${err.code})`);
      }
      if (err instanceof Prisma.PrismaClientValidationError) {
        this.logger.error('Dispatch validation error:', err.message);
        throw new BadRequestException(`Dispatch validation failed: ${err.message}`);
      }
      this.logger.error('Unexpected dispatch error:', err);
      throw new InternalServerErrorException('Dispatch failed unexpectedly');
    }

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
