import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateLabOrderDto } from './dto/create-lab-order.dto';
import { UpdateLabOrderDto } from './dto/update-lab-order.dto';
import { CollectSampleDto } from './dto/collect-sample.dto';
import { EnterResultDto } from './dto/enter-result.dto';
import { ApproveResultDto } from './dto/approve-result.dto';
import { LabOrderStatus, TestPriority, ReceiptType, PaymentStatus, PaymentMethod, Prisma } from '@prisma/client';

@Injectable()
export class LabOrdersService {
  constructor(private prisma: PrismaService) {}

  async create(createLabOrderDto: CreateLabOrderDto) {
    // Resolve patient ID - can be UUID or MRN
    let patientId = createLabOrderDto.patientId;
    
    // If patientId looks like an MRN (starts with "MRN-"), resolve it to UUID
    if (patientId.startsWith('MRN-') || patientId.startsWith('NR-')) {
      const patient = await this.prisma.patient.findUnique({
        where: { nrNumber: patientId },
      });
      
      if (!patient) {
        throw new NotFoundException(`Patient with MRN ${patientId} not found`);
      }
      
      patientId = patient.id;
    }

    // Generate order number: LAB-YYYYMMDD-XXXX
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    
    const lastOrder = await this.prisma.labOrder.findFirst({
      where: {
        hospitalId: createLabOrderDto.hospitalId,
        orderNumber: {
          startsWith: `LAB-${dateStr}`,
        },
      },
      orderBy: { orderNumber: 'desc' },
    });

    let sequence = 1;
    if (lastOrder) {
      const lastSeq = parseInt(lastOrder.orderNumber.split('-')[2]);
      sequence = lastSeq + 1;
    }

    const orderNumber = `LAB-${dateStr}-${sequence.toString().padStart(4, '0')}`;

    // Get test price for receipt
    const labTest = await this.prisma.labTest.findUnique({
      where: { id: createLabOrderDto.labTestId },
    });

    if (!labTest) {
      throw new NotFoundException('Lab test not found');
    }

    const visit = createLabOrderDto.visitId
      ? await (this.prisma as any).visit.findUnique({
          where: { id: createLabOrderDto.visitId },
          select: { id: true, departmentId: true },
        })
      : null;

    const orderedBy = await this.prisma.user.findUnique({
      where: { id: createLabOrderDto.orderedById },
      select: { departmentId: true },
    });

    const departmentId =
      labTest.departmentId || (visit as any)?.departmentId || orderedBy?.departmentId || null;

    if (!departmentId) {
      throw new BadRequestException('Department is required to generate lab receipt');
    }

    const labOrder = await this.prisma.$transaction(async (tx) => {
      const order = await tx.labOrder.create({
        data: {
          ...createLabOrderDto,
          patientId, // Use resolved UUID
          orderNumber,
          priority: createLabOrderDto.priority || TestPriority.ROUTINE,
          status: LabOrderStatus.PENDING,
        },
        include: {
          hospital: { select: { id: true, name: true } },
          patient: {
            select: {
              id: true,
              nrNumber: true,
              fullName: true,
              mobile: true,
            },
          },
          visit: { select: { id: true, tokenNumber: true } },
          labTest: {
            select: {
              id: true,
              testCode: true,
              testName: true,
              testCategory: true,
              price: true,
              turnaroundTime: true,
            },
          },
          orderedBy: {
            select: {
              id: true,
              fullName: true,
              role: true,
            },
          },
        },
      });

      const receiptNumber = await this.generateReceiptNumber(tx);

      const txAny = tx as any;
      await txAny.receipt.create({
        data: {
          hospitalId: createLabOrderDto.hospitalId,
          patientId,
          visitId: createLabOrderDto.visitId || undefined,
          departmentId,
          generatedById: createLabOrderDto.orderedById,
          receiptNumber,
          receiptType: ReceiptType.LAB_TEST,
          description: `Lab Test - ${labTest.testName}`,
          amount: new Prisma.Decimal(labTest.price || 0),
          totalAmount: new Prisma.Decimal(labTest.price || 0),
          paidAmount: new Prisma.Decimal(0),
          paymentMethod: PaymentMethod.CASH,
          paymentStatus: PaymentStatus.UNPAID,
          notes: JSON.stringify({ labOrderId: order.id, labTestId: labTest.id }),
        },
      });

      return order;
    });

    return labOrder;
  }

  private async generateReceiptNumber(tx: Prisma.TransactionClient) {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    const lastReceipt = await tx.receipt.findFirst({
      where: { receiptNumber: { startsWith: `REC-${dateStr}` } },
      orderBy: { receiptNumber: 'desc' },
    });

    const sequence = lastReceipt
      ? parseInt(lastReceipt.receiptNumber.split('-')[2]) + 1
      : 1;

    return `REC-${dateStr}-${sequence.toString().padStart(4, '0')}`;
  }

  async findAll(hospitalId: string, filters?: {
    patientId?: string;
    visitId?: string;
    status?: LabOrderStatus;
    priority?: TestPriority;
    startDate?: Date;
    endDate?: Date;
  }) {
    return this.prisma.labOrder.findMany({
      where: {
        hospitalId,
        ...(filters?.patientId && { patientId: filters.patientId }),
        ...(filters?.visitId && { visitId: filters.visitId }),
        ...(filters?.status && { status: filters.status }),
        ...(filters?.priority && { priority: filters.priority }),
        ...(filters?.startDate && filters?.endDate && {
          createdAt: {
            gte: filters.startDate,
            lte: filters.endDate,
          },
        }),
      },
      include: {
        patient: { 
          select: { 
            id: true, 
            nrNumber: true, 
            fullName: true,
          } 
        },
        labTest: { 
          select: { 
            testCode: true,
            testName: true, 
            testCategory: true,
          } 
        },
        orderedBy: { 
          select: { 
            fullName: true,
            role: true,
          } 
        },
      },
      orderBy: [
        { priority: 'desc' }, // STAT first, then URGENT, then ROUTINE
        { createdAt: 'desc' },
      ],
    });
  }

  async findOne(id: string) {
    const labOrder = await this.prisma.labOrder.findUnique({
      where: { id },
      include: {
        hospital: { select: { id: true, name: true } },
        patient: { 
          select: { 
            id: true, 
            nrNumber: true, 
            fullName: true,
            mobile: true,
            gender: true,
            dob: true,
          } 
        },
        visit: { 
          select: { 
            id: true, 
            tokenNumber: true,
            visitDate: true,
          } 
        },
        labTest: { 
          select: { 
            id: true, 
            testCode: true,
            testName: true, 
            testCategory: true,
            price: true,
            turnaroundTime: true,
            requirements: true,
            normalRange: true,
          } 
        },
        orderedBy: { 
          select: { 
            id: true, 
            fullName: true,
            role: true,
          } 
        },
        sampleCollectedBy: { 
          select: { 
            fullName: true,
          } 
        },
        resultsEnteredBy: { 
          select: { 
            fullName: true,
          } 
        },
        resultsApprovedBy: { 
          select: { 
            fullName: true,
          } 
        },
      },
    });

    if (!labOrder) {
      throw new NotFoundException(`Lab order with ID ${id} not found`);
    }

    return labOrder;
  }

  async findByPatient(patientId: string) {
    return this.prisma.labOrder.findMany({
      where: { patientId },
      include: {
        labTest: { 
          select: { 
            testCode: true,
            testName: true, 
            testCategory: true,
          } 
        },
        orderedBy: { 
          select: { 
            fullName: true,
          } 
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingOrders(hospitalId: string) {
    return this.prisma.labOrder.findMany({
      where: {
        hospitalId,
        status: LabOrderStatus.PENDING,
      },
      include: {
        patient: { 
          select: { 
            nrNumber: true, 
            fullName: true,
          } 
        },
        labTest: { 
          select: { 
            testName: true, 
            testCategory: true,
          } 
        },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });
  }

  async collectSample(id: string, collectSampleDto: CollectSampleDto) {
    const order = await this.findOne(id);

    if (order.status !== LabOrderStatus.PENDING) {
      throw new BadRequestException(
        `Cannot collect sample for order in ${order.status} status`,
      );
    }

    return this.prisma.labOrder.update({
      where: { id },
      data: {
        status: LabOrderStatus.SAMPLE_COLLECTED,
        sampleCollectedAt: new Date(),
        sampleCollectedById: collectSampleDto.sampleCollectedById,
        sampleType: collectSampleDto.sampleType,
        sampleNotes: collectSampleDto.sampleNotes,
        version: { increment: 1 },
      },
      include: {
        patient: { select: { fullName: true } },
        labTest: { select: { testName: true } },
      },
    });
  }

  async enterResult(id: string, enterResultDto: EnterResultDto) {
    const order = await this.findOne(id);

    if (order.status !== LabOrderStatus.SAMPLE_COLLECTED && 
        order.status !== LabOrderStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Cannot enter result for order in ${order.status} status`,
      );
    }

    return this.prisma.labOrder.update({
      where: { id },
      data: {
        status: LabOrderStatus.COMPLETED,
        resultsEnteredAt: new Date(),
        resultsEnteredById: enterResultDto.resultsEnteredById,
        results: enterResultDto.results,
        resultNotes: enterResultDto.resultNotes,
        resultFiles: enterResultDto.resultFiles,
        version: { increment: 1 },
      },
      include: {
        patient: { select: { fullName: true } },
        labTest: { select: { testName: true } },
      },
    });
  }

  async approveResult(id: string, approveResultDto: ApproveResultDto) {
    const order = await this.findOne(id);

    if (order.status !== LabOrderStatus.COMPLETED) {
      throw new BadRequestException(
        `Cannot approve result for order in ${order.status} status`,
      );
    }

    if (!order.results) {
      throw new BadRequestException('No results entered for this order');
    }

    return this.prisma.labOrder.update({
      where: { id },
      data: {
        status: LabOrderStatus.APPROVED,
        resultsApprovedAt: new Date(),
        resultsApprovedById: approveResultDto.resultsApprovedById,
        approvalNotes: approveResultDto.approvalNotes,
        version: { increment: 1 },
      },
      include: {
        patient: { select: { fullName: true } },
        labTest: { select: { testName: true } },
        resultsApprovedBy: { select: { fullName: true } },
      },
    });
  }

  async updatePaymentStatus(id: string, paymentStatus: string, amountPaid: number) {
    await this.findOne(id);

    return this.prisma.labOrder.update({
      where: { id },
      data: { 
        paymentStatus,
        amountPaid,
        version: { increment: 1 },
      },
    });
  }

  async update(id: string, updateLabOrderDto: UpdateLabOrderDto) {
    await this.findOne(id);

    return this.prisma.labOrder.update({
      where: { id },
      data: {
        ...updateLabOrderDto,
        version: { increment: 1 },
      },
      include: {
        patient: { select: { fullName: true } },
        labTest: { select: { testName: true } },
      },
    });
  }

  async cancelOrder(id: string) {
    const order = await this.findOne(id);

    if (order.status === LabOrderStatus.APPROVED) {
      throw new BadRequestException('Cannot cancel approved order');
    }

    return this.prisma.labOrder.update({
      where: { id },
      data: { 
        status: LabOrderStatus.CANCELLED,
        version: { increment: 1 },
      },
    });
  }

  async getStatistics(hospitalId: string, startDate?: Date, endDate?: Date) {
    const where = {
      hospitalId,
      ...(startDate && endDate && {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      }),
    };

    const [
      total,
      pending,
      sampleCollected,
      inProgress,
      completed,
      approved,
      cancelled,
      byPriority,
      byCategory,
    ] = await Promise.all([
      this.prisma.labOrder.count({ where }),
      this.prisma.labOrder.count({ where: { ...where, status: LabOrderStatus.PENDING } }),
      this.prisma.labOrder.count({ where: { ...where, status: LabOrderStatus.SAMPLE_COLLECTED } }),
      this.prisma.labOrder.count({ where: { ...where, status: LabOrderStatus.IN_PROGRESS } }),
      this.prisma.labOrder.count({ where: { ...where, status: LabOrderStatus.COMPLETED } }),
      this.prisma.labOrder.count({ where: { ...where, status: LabOrderStatus.APPROVED } }),
      this.prisma.labOrder.count({ where: { ...where, status: LabOrderStatus.CANCELLED } }),
      this.prisma.labOrder.groupBy({
        by: ['priority'],
        where,
        _count: { priority: true },
      }),
      this.prisma.labOrder.groupBy({
        by: ['labTestId'],
        where,
        _count: { labTestId: true },
        orderBy: { _count: { labTestId: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      total,
      byStatus: {
        pending,
        sampleCollected,
        inProgress,
        completed,
        approved,
        cancelled,
      },
      byPriority: byPriority.map(p => ({
        priority: p.priority,
        count: p._count.priority,
      })),
      topTests: byCategory,
    };
  }
}
