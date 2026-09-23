import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateLabOrderDto } from './dto/create-lab-order.dto';
import { UpdateLabOrderDto } from './dto/update-lab-order.dto';
import { CollectSampleDto } from './dto/collect-sample.dto';
import { EnterResultDto } from './dto/enter-result.dto';
import { ApproveResultDto } from './dto/approve-result.dto';
import { LabOrderStatus, TestPriority, ReceiptType, PaymentStatus, PaymentMethod, Prisma } from '@prisma/client';
import { isUuid, mrnFilter } from '../../common/utils/mrn.util';

/**
 * Roles allowed to print a lab slip more than once. Everyone else gets the one
 * print the slip is worth: it drops into a slot on a pre-printed A4 lab form,
 * so a second copy burns a form and puts a duplicate slip into circulation.
 */
const SLIP_REPRINT_ROLES = new Set<string>([
  'MASTER_ADMIN',
  'SUPER_ADMIN',
  'HOSPITAL_ADMIN',
  'REGISTRATION_STAFF_MANAGER',
]);

/**
 * Roles whose lab order lists show only their own orders. A registration staff
 * member works one desk: the list is their own day's work, not the whole
 * hospital's. Everyone else — admins, managers, lab staff, doctors — sees all
 * of it, so the lab can still work the full queue.
 */
const SELF_SCOPED_LIST_ROLES = new Set<string>(['REGISTRATION_STAFF']);

/**
 * Roles allowed to book a lab order on a past date. A backdated order moves
 * money into a day that has already been reported on, so it is the same short
 * list trusted with a slip reprint — the desk staff who enter the day's work
 * cannot change which day it lands in.
 */
const BACKDATE_ROLES = new Set<string>([
  'MASTER_ADMIN',
  'SUPER_ADMIN',
  'HOSPITAL_ADMIN',
  'REGISTRATION_STAFF_MANAGER',
]);

/** Bucket for lab tests whose category was left blank in the catalogue. */
const UNCATEGORISED_LAB_TEST = 'Uncategorised';

/** Money is summed as floats, so trim the drift before it reaches the client. */
const round2 = (value: number) => Math.round(value * 100) / 100;

/** One test line in the revenue report: a test at one price. */
interface LabRevenueTestRow {
  testName: string;
  unitPrice: number;
  quantity: number;
  total: number;
}

/** One staff member and how many tests they created in the range. */
interface LabRevenueResourceRow {
  resourceId: string;
  resourceName: string;
  role: string | null;
  tests: number;
}

@Injectable()
export class LabOrdersService {
  constructor(private prisma: PrismaService) {}

  /**
   * The day a number is stamped with, read in local time.
   *
   * Deliberately not toISOString(): that is UTC, and at the desk in Quetta
   * (UTC+5) an order booked before 5am would carry the previous day's number.
   */
  private localDateStamp(when: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${when.getFullYear()}${p(when.getMonth() + 1)}${p(when.getDate())}`;
  }

  /**
   * When the order is booked: now, unless a permitted role asked for a past
   * date.
   *
   * A backdated order is given the current time of day on that date, so orders
   * entered together stay in the sequence they were entered in rather than all
   * landing on midnight.
   */
  private resolveOrderDate(orderedAt: string | undefined, user?: { role: string }): Date {
    if (!orderedAt) return new Date();

    if (!user || !BACKDATE_ROLES.has(user.role)) {
      throw new ForbiddenException(
        'Only a registration manager or an admin may book a lab order on a past date',
      );
    }

    const requested = new Date(orderedAt);
    if (Number.isNaN(requested.getTime())) {
      throw new BadRequestException('orderedAt must be a valid date');
    }

    const now = new Date();
    const booked = new Date(requested);
    booked.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());

    // A future date would put work — and its money — in a day that has not
    // happened, which no report could reconcile.
    if (booked > now) {
      throw new BadRequestException('A lab order cannot be booked on a future date');
    }

    return booked;
  }

  async create(createLabOrderDto: CreateLabOrderDto, user?: { id: string; role: string }) {
    // When the order is booked. Everything derived from a date below reads
    // this, not the clock, so a backdated order is internally consistent.
    const enteredAt = new Date();
    const orderedAt = this.resolveOrderDate(createLabOrderDto.orderedAt, user);

    // Resolve patient ID - can be UUID or MRN
    let patientId = createLabOrderDto.patientId;
    
    // Anything that isn't a UUID is an MRN — either the full "MRN-YYYYMMDD-482913"
    // or the short code "482913" staff actually see. Resolve it to a UUID.
    if (!isUuid(patientId)) {
      const patient = await this.prisma.patient.findFirst({
        where: { nrNumber: mrnFilter(patientId) },
      });

      if (!patient) {
        throw new NotFoundException(`Patient with MRN ${patientId} not found`);
      }
      
      patientId = patient.id;
    }

    // Generate order number: LAB-YYYYMMDD-XXXX, on the day the order is booked
    const dateStr = this.localDateStamp(orderedAt);
    
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


    const labOrder = await this.prisma.$transaction(async (tx) => {
      // orderedAt is the DTO's name for the booking date; the column is
      // createdAt, so it never reaches the row as an unknown field.
      const { orderedAt: _orderedAt, ...orderData } = createLabOrderDto;

      const order = await tx.labOrder.create({
        data: {
          ...orderData,
          patientId, // Use resolved UUID
          orderNumber,
          priority: createLabOrderDto.priority || TestPriority.ROUTINE,
          status: LabOrderStatus.PENDING,
          createdAt: orderedAt,
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

      const receiptNumber = await this.generateReceiptNumber(tx, orderedAt);

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
          // Same day as its order: the revenue reports date receipts by
          // createdAt, so a backdated order whose receipt landed today would
          // split one piece of work across two days.
          createdAt: orderedAt,
          notes: JSON.stringify({ labOrderId: order.id, labTestId: labTest.id }),
        },
      });

      // A backdated order moves money into a day that may already have been
      // reported on, so it is logged in the same transaction that creates it:
      // the order and its audit entry are committed together or not at all.
      // The audit log is readable only by MASTER_ADMIN, SUPER_ADMIN and
      // HOSPITAL_ADMIN (see AuditLogController), so a registration role can
      // record a backdate but cannot review or hide one.
      if (createLabOrderDto.orderedAt) {
        await tx.auditLog.create({
          data: {
            hospitalId: createLabOrderDto.hospitalId,
            userId: user?.id ?? createLabOrderDto.orderedById,
            action: 'BACKDATE',
            module: 'Lab Orders',
            entityType: 'LabOrder',
            entityId: order.id,
            description:
              `Created lab order ${orderNumber} (${labTest.testName}) backdated to ` +
              `${this.localDateStamp(orderedAt)} — entered ${enteredAt.toISOString()} ` +
              `by ${user?.role ?? 'unknown role'}, receipt ${receiptNumber}, ` +
              `amount ${Number(labTest.price || 0)}`,
            beforeState: {
              enteredAt: enteredAt.toISOString(),
              requestedDate: createLabOrderDto.orderedAt,
            },
            afterState: {
              orderNumber,
              receiptNumber,
              createdAt: orderedAt.toISOString(),
              patientId,
              labTestId: labTest.id,
              testName: labTest.testName,
              amount: Number(labTest.price || 0),
              orderedById: createLabOrderDto.orderedById,
              backdatedByDays: Math.round(
                (enteredAt.getTime() - orderedAt.getTime()) / 86_400_000,
              ),
            },
          },
        });
      }

      return order;
    });

    return labOrder;
  }

  private async generateReceiptNumber(tx: Prisma.TransactionClient, when: Date) {
    const dateStr = this.localDateStamp(when);

    const lastReceipt = await tx.receipt.findFirst({
      where: { receiptNumber: { startsWith: `REC-${dateStr}` } },
      orderBy: { receiptNumber: 'desc' },
    });

    const sequence = lastReceipt
      ? parseInt(lastReceipt.receiptNumber.split('-')[2]) + 1
      : 1;

    return `REC-${dateStr}-${sequence.toString().padStart(4, '0')}`;
  }

  async findAll(
    hospitalId: string,
    filters?: {
      patientId?: string;
      visitId?: string;
      status?: LabOrderStatus;
      priority?: TestPriority;
      orderedById?: string;
      startDate?: Date;
      endDate?: Date;
    },
    user?: { id: string; role: string },
  ) {
    // Who the list belongs to is settled by the token, never by the query
    // string: a self-scoped role is pinned to its own orders whatever it asks
    // for, and only the roles that see everything may name another user.
    const orderedById =
      user && SELF_SCOPED_LIST_ROLES.has(user.role)
        ? user.id
        : filters?.orderedById;

    return this.prisma.labOrder.findMany({
      where: {
        hospitalId,
        ...(orderedById && { orderedById }),
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

  /**
   * Count a slip as printed, refusing a second print to anyone but a manager or
   * an admin. Called before the browser opens its print dialog, so a cancelled
   * dialog still counts — the alternative is trusting the client to report back
   * after the fact, which cannot be enforced.
   *
   * All-or-nothing: an order of six tests either prints all six slips or none,
   * so a partial refusal never leaves the desk holding half a set.
   */
  async recordSlipPrints(
    orderIds: string[],
    user: { id: string; role: string; hospitalId?: string | null },
  ) {
    if (!orderIds?.length) {
      throw new BadRequestException('No lab orders given to print');
    }

    const ids = Array.from(new Set(orderIds));
    const orders = await this.prisma.labOrder.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        hospitalId: true,
        orderNumber: true,
        slipPrintCount: true,
        labTest: { select: { testName: true } },
      },
    });

    if (orders.length !== ids.length) {
      const found = new Set(orders.map((o) => o.id));
      throw new NotFoundException(
        `Lab order(s) not found: ${ids.filter((id) => !found.has(id)).join(', ')}`,
      );
    }

    // A user tied to a hospital only ever prints that hospital's slips. Master
    // and super admins carry no hospitalId and are not scoped.
    if (user.hospitalId && orders.some((o) => o.hospitalId !== user.hospitalId)) {
      throw new ForbiddenException(
        'This lab slip belongs to another hospital',
      );
    }

    const alreadyPrinted = orders.filter((o) => o.slipPrintCount > 0);
    if (alreadyPrinted.length && !SLIP_REPRINT_ROLES.has(user.role)) {
      throw new ForbiddenException(
        `Slip ${alreadyPrinted
          .map((o) => o.orderNumber)
          .join(', ')} has already been printed. Only a registration staff manager, hospital admin or super admin can print it again.`,
      );
    }

    const printedAt = new Date();

    await this.prisma.$transaction([
      this.prisma.labOrder.updateMany({
        where: { id: { in: ids } },
        data: {
          slipPrintCount: { increment: 1 },
          slipLastPrintedAt: printedAt,
        },
      }),
      ...orders.map((order) =>
        this.prisma.auditLog.create({
          data: {
            hospitalId: order.hospitalId,
            userId: user.id,
            action: order.slipPrintCount > 0 ? 'REPRINT' : 'PRINT',
            module: 'Lab Orders',
            entityType: 'LabOrder',
            entityId: order.id,
            description:
              order.slipPrintCount > 0
                ? `Reprinted lab slip ${order.orderNumber} (${order.labTest?.testName}) - print #${order.slipPrintCount + 1}`
                : `Printed lab slip ${order.orderNumber} (${order.labTest?.testName})`,
            beforeState: { slipPrintCount: order.slipPrintCount },
            afterState: {
              slipPrintCount: order.slipPrintCount + 1,
              slipLastPrintedAt: printedAt,
            },
          },
        }),
      ),
    ]);

    return orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      slipPrintCount: order.slipPrintCount + 1,
      slipLastPrintedAt: printedAt,
    }));
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

  /**
   * Lab revenue for a date range, grouped by test category.
   *
   * Every lab order in the range counts — one order is one slip is one receipt,
   * so no status filter: revenue is raised when the slip is created, not when
   * the result is approved. Quantity is therefore a count of orders; there is
   * no quantity column on a lab order.
   *
   * The unit price comes from the receipt raised with the order, so a test
   * repriced since it was ordered still reports what was actually charged. A
   * test ordered at two different prices inside one range lands on two rows,
   * which keeps Quantity x Test Price = Total Price true on every line. Orders
   * with no receipt fall back to the catalogue price.
   */
  async getRevenueReport(
    hospitalId: string,
    startDate?: Date,
    endDate?: Date,
    user?: { id: string; role: string },
  ) {
    // Same rule as the order list: a self-scoped role reports on its own work
    // whatever it asks for.
    const orderedById =
      user && SELF_SCOPED_LIST_ROLES.has(user.role) ? user.id : undefined;

    // The dates arrive as plain days (2026-09-21), which parse to midnight —
    // without widening, an end date would cut the day off before the desk had
    // opened. Same normalisation the registration report uses.
    let dateRange: { createdAt?: { gte: Date; lte: Date } } = {};
    if (startDate && endDate) {
      const from = new Date(startDate);
      const to = new Date(endDate);
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);

      if (from > to) {
        throw new BadRequestException('startDate must be on or before endDate');
      }

      dateRange = { createdAt: { gte: from, lte: to } };
    }

    const [orders, receipts] = await Promise.all([
      this.prisma.labOrder.findMany({
        where: { hospitalId, ...(orderedById && { orderedById }), ...dateRange },
        select: {
          id: true,
          orderedById: true,
          labTest: { select: { testName: true, testCategory: true, price: true } },
          orderedBy: { select: { id: true, fullName: true, role: true } },
        },
      }),
      this.prisma.receipt.findMany({
        where: { hospitalId, receiptType: ReceiptType.LAB_TEST, ...dateRange },
        select: { totalAmount: true, notes: true },
      }),
    ]);

    // The receipt carries its lab order id in notes; that is the only link
    // between the two rows.
    const chargedByOrderId = new Map<string, number>();
    for (const receipt of receipts) {
      const labOrderId = this.readLabOrderId(receipt.notes);
      if (labOrderId) chargedByOrderId.set(labOrderId, Number(receipt.totalAmount || 0));
    }

    // category -> "test name @ unit price" -> row
    const categories = new Map<string, Map<string, LabRevenueTestRow>>();
    const resources = new Map<string, LabRevenueResourceRow>();

    for (const order of orders) {
      const category = order.labTest.testCategory?.trim() || UNCATEGORISED_LAB_TEST;
      const testName = order.labTest.testName;
      const unitPrice = chargedByOrderId.get(order.id) ?? Number(order.labTest.price || 0);

      let byTest = categories.get(category);
      if (!byTest) {
        byTest = new Map<string, LabRevenueTestRow>();
        categories.set(category, byTest);
      }

      const key = `${testName}@${unitPrice}`;
      const row = byTest.get(key) ?? { testName, unitPrice, quantity: 0, total: 0 };
      row.quantity += 1;
      row.total = round2(row.total + unitPrice);
      byTest.set(key, row);

      const resource = resources.get(order.orderedById) ?? {
        resourceId: order.orderedById,
        resourceName: order.orderedBy?.fullName ?? 'Unknown user',
        role: order.orderedBy?.role ?? null,
        tests: 0,
      };
      resource.tests += 1;
      resources.set(order.orderedById, resource);
    }

    const categoryRows = [...categories.entries()]
      .map(([category, byTest]) => {
        const tests = [...byTest.values()].sort(
          (a, b) => b.total - a.total || a.testName.localeCompare(b.testName),
        );

        return {
          category,
          tests,
          quantity: tests.reduce((sum, test) => sum + test.quantity, 0),
          subtotal: round2(tests.reduce((sum, test) => sum + test.total, 0)),
        };
      })
      .sort((a, b) => b.subtotal - a.subtotal || a.category.localeCompare(b.category));

    return {
      range: {
        start: startDate ? startDate.toISOString() : null,
        end: endDate ? endDate.toISOString() : null,
      },
      categories: categoryRows,
      grandTotal: round2(categoryRows.reduce((sum, row) => sum + row.subtotal, 0)),
      totalQuantity: categoryRows.reduce((sum, row) => sum + row.quantity, 0),
      resources: [...resources.values()].sort(
        (a, b) => b.tests - a.tests || a.resourceName.localeCompare(b.resourceName),
      ),
    };
  }

  /** The lab order id a LAB_TEST receipt was raised for, or null. */
  private readLabOrderId(notes: string | null): string | null {
    if (!notes) return null;

    try {
      const parsed = JSON.parse(notes);
      return typeof parsed?.labOrderId === 'string' ? parsed.labOrderId : null;
    } catch {
      return null;
    }
  }

}
