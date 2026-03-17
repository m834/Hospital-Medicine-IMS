import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { SearchPrescriptionsDto } from './dto/search-prescriptions.dto';
import { UpdatePrescriptionStatusDto } from './dto/update-prescription-status.dto';
import { PrescriptionStatus, PaymentMethod, PaymentStatus, Prisma, ReceiptType } from '@prisma/client';

@Injectable()
export class PrescriptionsService {
  constructor(private prisma: PrismaService) {}

  async create(createPrescriptionDto: CreatePrescriptionDto) {
    const { nrNumber, doctorId, items, ...prescriptionData } = createPrescriptionDto;

    // Verify patient exists
    const patient = await this.prisma.patient.findFirst({
      where: { nrNumber },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with NR Number ${nrNumber} not found`);
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

    // Verify all medicines exist
    const medicineIds = items.map((item) => item.medicineId);
    const medicines = await this.prisma.medicine.findMany({
      where: { id: { in: medicineIds } },
    });

    if (medicines.length !== medicineIds.length) {
      throw new BadRequestException('One or more medicines not found');
    }

    // Create prescription with items
    const prescription = await this.prisma.prescription.create({
      data: {
        hospitalId: patient.hospitalId,
        nrNumber: patient.nrNumber,
        doctorId: doctor?.id || null,
        prescriptionType: prescriptionData.prescriptionType,
        scannedImageUrl: prescriptionData.scannedImageUrl,
        notes: prescriptionData.notes,
        status: PrescriptionStatus.PENDING,
        items: {
          create: items.map((item) => ({
            medicineId: item.medicineId,
            qtyPrescribed: item.qtyPrescribed,
            dosage: item.dosage,
            frequency: item.frequency,
            duration: item.duration,
            status: 'PENDING',
          })),
        },
      },
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
      },
    });

    return prescription;
  }

  async findAll(searchDto: SearchPrescriptionsDto) {
    const { nrNumber, doctorId, status, limit = 50, page = 1 } = searchDto;

    const where: any = {};

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

      const updated = await this.prisma.$transaction(async (tx) => {
        let totalAmount = new Prisma.Decimal(0);

        for (const item of prescription.items) {
          const batch = await tx.stockBatch.findFirst({
            where: {
              hospitalId,
              pharmacyId,
              medicineId: item.medicineId,
              status: 'AVAILABLE',
              qtyAvailable: { gt: 0 },
              expiryDate: { gte: now },
            },
            orderBy: [{ expiryDate: 'asc' }, { receivedDate: 'asc' }],
          });

          if (!batch) {
            throw new BadRequestException(
              `No available stock for medicine ${item.medicineId}`,
            );
          }

          if (batch.qtyAvailable < item.qtyPrescribed) {
            throw new BadRequestException(
              `Insufficient stock for medicine ${item.medicineId}. ` +
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

        // Generate receipt number
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const lastReceipt = await tx.receipt.findFirst({
          where: { receiptNumber: { startsWith: `REC-${dateStr}` } },
          orderBy: { receiptNumber: 'desc' },
        });
        const sequence = lastReceipt
          ? parseInt(lastReceipt.receiptNumber.split('-')[2]) + 1
          : 1;
        const receiptNumber = `REC-${dateStr}-${sequence.toString().padStart(4, '0')}`;

        // Find department for receipt
        const latestVisit = await (tx as any).visit.findFirst({
          where: { patientId: patient.id, hospitalId },
          orderBy: { visitDate: 'desc' },
          select: { id: true, departmentId: true },
        });

        const doctorDepartmentId = prescription.doctorId
          ? (
              await tx.user.findUnique({
                where: { id: prescription.doctorId },
                select: { departmentId: true },
              })
            )?.departmentId
          : null;

        const fallbackDepartment = await tx.department.findFirst({
          where: { hospitalId },
          select: { id: true },
        });

        const departmentId =
          latestVisit?.departmentId || doctorDepartmentId || fallbackDepartment?.id;

        if (!departmentId) {
          throw new BadRequestException(
            'Department is required to generate pharmacy receipt',
          );
        }

        // Create pharmacy receipt
        const txAny = tx as any;
        await txAny.receipt.create({
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
      throw new NotFoundException(`Patient with NR Number ${nrNumber} not found`);
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
      throw new NotFoundException(`Patient with NR Number ${nrNumber} not found`);
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
}
