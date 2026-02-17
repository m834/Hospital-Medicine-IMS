import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { CreateReceiptDto, ReceiptQueryDto } from './dto';
import { PaymentStatus, PaymentMethod } from '@prisma/client';

@Injectable()
export class ReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate receipt number
   */
  private async generateReceiptNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    const lastReceipt = await this.prisma.receipt.findFirst({
      where: {
        receiptNumber: { startsWith: `REC-${dateStr}` },
      },
      orderBy: { receiptNumber: 'desc' },
    });

    const sequence = lastReceipt
      ? parseInt(lastReceipt.receiptNumber.split('-')[2]) + 1
      : 1;

    return `REC-${dateStr}-${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Create a new receipt
   */
  async create(createReceiptDto: CreateReceiptDto) {
    // Validate patient exists
    const patient = await this.prisma.patient.findUnique({
      where: { id: createReceiptDto.patientId },
    });
    if (!patient) {
      throw new NotFoundException(
        `Patient with ID ${createReceiptDto.patientId} not found`,
      );
    }

    // Generate receipt number
    const receiptNumber = await this.generateReceiptNumber();

    // Calculate total amount
    const amount = createReceiptDto.amount;
    const discount = createReceiptDto.discount || 0;
    const tax = createReceiptDto.tax || 0;
    const totalAmount = amount - discount + tax;

    const normalizedPaidAmount = Math.max(createReceiptDto.paidAmount ?? 0, 0);
    const resolvedPaymentStatus = this.resolvePaymentStatus(normalizedPaidAmount, totalAmount);

    // Create receipt
    return this.prisma.receipt.create({
      data: {
        hospitalId: createReceiptDto.hospitalId,
        patientId: createReceiptDto.patientId,
        visitId: createReceiptDto.visitId,
        departmentId: createReceiptDto.departmentId,
        generatedById: createReceiptDto.generatedById,
        receiptNumber,
        receiptType: createReceiptDto.receiptType,
        description: createReceiptDto.description,
        amount,
        discount,
        tax,
        totalAmount,
        paidAmount: normalizedPaidAmount,
        paymentMethod: createReceiptDto.paymentMethod || PaymentMethod.CASH,
        paymentStatus: createReceiptDto.paymentStatus || resolvedPaymentStatus,
        paidAt: normalizedPaidAmount > 0 ? new Date() : undefined,
        notes: createReceiptDto.notes,
      },
      include: {
        hospital: { select: { id: true, name: true } },
        patient: { select: { id: true, fullName: true, nrNumber: true } },
        department: { select: { id: true, name: true } },
        generatedBy: { select: { id: true, fullName: true } },
      },
    });
  }

  /**
   * Get all receipts with filters
   */
  async findAll(query: ReceiptQueryDto) {
    const {
      hospitalId,
      patientId,
      departmentId,
      receiptType,
      paymentStatus,
      paymentMethod,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = query;

    const where: any = {};
    if (hospitalId) where.hospitalId = hospitalId;
    if (patientId) where.patientId = patientId;
    if (departmentId) where.departmentId = departmentId;
    if (receiptType) where.receiptType = receiptType;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (paymentMethod) where.paymentMethod = paymentMethod;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [receipts, total] = await Promise.all([
      this.prisma.receipt.findMany({
        where,
        include: {
          hospital: { select: { id: true, name: true } },
          patient: { select: { id: true, fullName: true, nrNumber: true } },
          department: { select: { id: true, name: true } },
          generatedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.receipt.count({ where }),
    ]);

    return {
      data: receipts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single receipt by ID
   */
  async findOne(id: string) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id },
      include: {
        hospital: true,
        patient: true,
        visit: {
          include: {
            clinic: {
              include: {
                doctor: { select: { id: true, fullName: true } },
              },
            },
          },
        },
        department: true,
        generatedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!receipt) {
      throw new NotFoundException(`Receipt with ID ${id} not found`);
    }

    return receipt;
  }

  /**
   * Get receipt by number
   */
  async findByReceiptNumber(receiptNumber: string) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { receiptNumber },
      include: {
        hospital: true,
        patient: true,
        department: true,
        generatedBy: { select: { id: true, fullName: true } },
      },
    });

    if (!receipt) {
      throw new NotFoundException(
        `Receipt with number ${receiptNumber} not found`,
      );
    }

    return receipt;
  }

  /**
   * Get receipts by patient
   */
  async findByPatient(patientId: string, limit = 10) {
    return this.prisma.receipt.findMany({
      where: { patientId },
      include: {
        department: { select: { id: true, name: true } },
        generatedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Mark receipt as paid
   */
  async markAsPaid(id: string, paymentMethod: PaymentMethod = PaymentMethod.CASH) {
    const receipt = await this.findOne(id);

    return this.prisma.receipt.update({
      where: { id },
      data: {
        paymentStatus: PaymentStatus.PAID,
        paymentMethod,
        paidAmount: receipt.totalAmount,
        paidAt: new Date(),
      },
      include: {
        patient: { select: { id: true, fullName: true, nrNumber: true } },
        department: { select: { id: true, name: true } },
      },
    });
  }

  async updatePayment(id: string, paidAmount: number, paymentMethod?: PaymentMethod) {
    const receipt = await this.findOne(id);
    const normalizedPaidAmount = Math.max(paidAmount, 0);
    const paymentStatus = this.resolvePaymentStatus(normalizedPaidAmount, Number(receipt.totalAmount));

    return this.prisma.receipt.update({
      where: { id },
      data: {
        paidAmount: normalizedPaidAmount,
        paymentStatus,
        paymentMethod: paymentMethod || receipt.paymentMethod,
        paidAt: normalizedPaidAmount > 0 ? new Date() : null,
      },
      include: {
        patient: { select: { id: true, fullName: true, nrNumber: true } },
        department: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Mark receipt as refunded
   */
  async refund(id: string, reason?: string) {
    const receipt = await this.findOne(id);

    return this.prisma.receipt.update({
      where: { id },
      data: {
        paymentStatus: PaymentStatus.REFUNDED,
        notes: reason ? `Refunded: ${reason}` : receipt.notes,
      },
    });
  }

  /**
   * Get receipt data for printing/PDF
   */
  async getPrintData(id: string) {
    const receipt = await this.findOne(id);

    return {
      receipt,
      printDate: new Date(),
      format: {
        receiptNumber: receipt.receiptNumber,
        date: receipt.createdAt,
        patient: {
          name: receipt.patient.fullName,
          nrNumber: receipt.patient.nrNumber,
          mobile: receipt.patient.mobile,
        },
        hospital: {
          name: receipt.hospital.name,
          address: receipt.hospital.address,
          phone: receipt.hospital.phone,
          email: receipt.hospital.email,
        },
        department: receipt.department.name,
        type: receipt.receiptType,
        description: receipt.description,
        amount: Number(receipt.amount),
        discount: Number(receipt.discount),
        tax: Number(receipt.tax),
        totalAmount: Number(receipt.totalAmount),
        paymentMethod: receipt.paymentMethod,
        paymentStatus: receipt.paymentStatus,
        paidAt: receipt.paidAt,
        generatedBy: receipt.generatedBy.fullName,
      },
    };
  }

  /**
   * Get daily revenue summary
   */
  async getDailyRevenue(hospitalId: string, date?: Date) {
    const targetDate = date || new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const receipts = await this.prisma.receipt.findMany({
      where: {
        hospitalId,
        createdAt: { gte: targetDate, lt: nextDate },
        paymentStatus: PaymentStatus.PAID,
      },
      include: {
        department: { select: { id: true, name: true } },
      },
    });

    // Group by department
    const byDepartment: Record<string, { name: string; total: number; count: number }> = {};
    receipts.forEach((r) => {
      const deptId = r.department.id;
      if (!byDepartment[deptId]) {
        byDepartment[deptId] = { name: r.department.name, total: 0, count: 0 };
      }
      byDepartment[deptId].total += Number(r.totalAmount);
      byDepartment[deptId].count += 1;
    });

    // Group by receipt type
    const byType: Record<string, number> = {};
    receipts.forEach((r) => {
      byType[r.receiptType] = (byType[r.receiptType] || 0) + Number(r.totalAmount);
    });

    const total = receipts.reduce((sum, r) => sum + Number(r.totalAmount), 0);

    return {
      date: targetDate,
      total,
      receiptCount: receipts.length,
      byDepartment: Object.entries(byDepartment).map(([id, data]) => ({
        departmentId: id,
        ...data,
      })),
      byType,
    };
  }

  private resolvePaymentStatus(paidAmount: number, totalAmount: number) {
    if (paidAmount <= 0) {
      return PaymentStatus.UNPAID;
    }
    if (paidAmount >= totalAmount) {
      return PaymentStatus.PAID;
    }
    return PaymentStatus.PARTIALLY_PAID;
  }
}
