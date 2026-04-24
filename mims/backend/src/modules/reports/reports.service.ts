import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaymentStatus } from '@prisma/client';
import { DailyTransactionReportDto } from './dto/daily-transaction-report.dto';
import { DateRangeReportDto } from './dto/date-range-report.dto';
import { FinancialReportPeriod, FinancialSummaryDto } from './dto/financial-summary.dto';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private getPeriodRange(period: FinancialReportPeriod, date: Date) {
    const start = new Date(date);
    const end = new Date(date);

    if (period === FinancialReportPeriod.DAILY) {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    if (period === FinancialReportPeriod.WEEKLY) {
      const day = start.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      start.setDate(start.getDate() + diffToMonday);
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime());
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    if (period === FinancialReportPeriod.MONTHLY) {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(start.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(11, 31);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  async getFinancialSummary(dto: FinancialSummaryDto) {
    const { hospitalId, period, date } = dto;
    const targetDate = new Date(date);
    const { start, end } = this.getPeriodRange(period, targetDate);

    const [incomeAgg, expenseAgg, payrollAgg] = await Promise.all([
      this.prisma.receipt.aggregate({
        where: {
          hospitalId,
          paymentStatus: PaymentStatus.PAID,
          OR: [
            { paidAt: { gte: start, lte: end } },
            { paidAt: null, createdAt: { gte: start, lte: end } },
          ],
        },
        _sum: { paidAmount: true },
      }),
      this.prisma.expenditure.aggregate({
        where: {
          hospitalId,
          date: { gte: start, lte: end },
        },
        _sum: { amount: true },
      }),
      this.prisma.payrollRecord.aggregate({
        where: {
          hospitalId,
          generatedAt: { gte: start, lte: end },
        },
        _sum: { netPay: true },
      }),
    ]);

    const income = Number(incomeAgg._sum.paidAmount || 0);
    const expenses = Number(expenseAgg._sum.amount || 0);
    const payroll = Number(payrollAgg._sum.netPay || 0);
    const profitLoss = income - (expenses + payroll);

    return {
      period,
      range: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      income,
      expenses,
      payroll,
      profitLoss,
    };
  }

  async getComprehensiveFinancialReport(dto: FinancialSummaryDto) {
    const { hospitalId, period, date } = dto;
    const targetDate = new Date(date);
    const { start, end } = this.getPeriodRange(period, targetDate);

    const [incomeByType, expenseAgg, payrollAgg, payrollRecords] = await Promise.all([
      this.prisma.receipt.groupBy({
        by: ['receiptType'],
        where: {
          hospitalId,
          paymentStatus: PaymentStatus.PAID,
          OR: [
            { paidAt: { gte: start, lte: end } },
            { paidAt: null, createdAt: { gte: start, lte: end } },
          ],
        },
        _sum: { paidAmount: true },
      }),
      this.prisma.expenditure.aggregate({
        where: {
          hospitalId,
          date: { gte: start, lte: end },
        },
        _sum: { amount: true },
      }),
      this.prisma.payrollRecord.aggregate({
        where: {
          hospitalId,
          generatedAt: { gte: start, lte: end },
        },
        _sum: { netPay: true },
      }),
      this.prisma.payrollRecord.findMany({
        where: {
          hospitalId,
          generatedAt: { gte: start, lte: end },
        },
        include: {
          user: {
            select: {
              id: true,
              department: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const incomeTotals = incomeByType.reduce<Record<string, number>>((acc, item) => {
      acc[item.receiptType] = Number(item._sum.paidAmount || 0);
      return acc;
    }, {});

    const opdIncome = incomeTotals.OPD_CONSULTATION || 0;
    const labIncome = (incomeTotals.LAB_TEST || 0) + (incomeTotals.RADIOLOGY || 0);
    const operationIncome = incomeTotals.PROCEDURE || 0;
    const roomIncome = (incomeTotals.ROOM_CHARGES || 0) + (incomeTotals.ADMISSION || 0);
    const pharmacyIncome = incomeTotals.PHARMACY || 0;
    const otherIncome = incomeTotals.OTHER || 0;

    const totalIncome =
      opdIncome +
      labIncome +
      operationIncome +
      roomIncome +
      pharmacyIncome +
      otherIncome;

    const expenses = Number(expenseAgg._sum.amount || 0);
    const payroll = Number(payrollAgg._sum.netPay || 0);

    const departmentPayroll = payrollRecords.reduce<Record<string, number>>((acc, record) => {
      const name = record.user?.department?.name || 'Unassigned';
      acc[name] = (acc[name] || 0) + Number(record.netPay || 0);
      return acc;
    }, {});

    const profitLoss = totalIncome - (expenses + payroll);

    return {
      period,
      range: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      income: {
        opd: opdIncome,
        lab: labIncome,
        operation: operationIncome,
        room: roomIncome,
        pharmacy: pharmacyIncome,
        other: otherIncome,
      },
      expenses,
      payroll,
      payrollByDepartment: departmentPayroll,
      totalIncome,
      profitLoss,
    };
  }

  /**
   * Get daily transaction summary for a pharmacy
   * Includes: opening stock, receipts (GRN/Transfers), issues, closing stock
   */
  async getDailyTransactionReport(dto: DailyTransactionReportDto) {
    const { pharmacyId, date, hospitalId } = dto;

    // Verify pharmacy exists
    const pharmacy = await this.prisma.pharmacy.findFirst({
      where: {
        id: pharmacyId,
        ...(hospitalId && { hospitalId }),
      },
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!pharmacy) {
      throw new NotFoundException('Pharmacy not found');
    }

    const reportDate = new Date(date);
    const startOfDay = new Date(reportDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(reportDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get previous day end for opening balance calculation
    const previousDayEnd = new Date(startOfDay);
    previousDayEnd.setMilliseconds(-1);

    // Opening Stock: Total available stock before start of day
    const openingStock = await this.getStockBalanceAtDate(pharmacyId, previousDayEnd);

    // Stock Received: GRNs and Transfer Receipts
    const [grnsReceived, transfersReceived] = await Promise.all([
      this.getGRNsForDay(pharmacyId, startOfDay, endOfDay),
      this.getTransfersReceivedForDay(pharmacyId, startOfDay, endOfDay),
    ]);

    // Stock Issued: Medicine dispensing to patients
    const issuesForDay = await this.getIssuesForDay(pharmacyId, startOfDay, endOfDay);

    // Stock Transferred: Transfers sent to other pharmacies
    const transfersSent = await this.getTransfersSentForDay(pharmacyId, startOfDay, endOfDay);

    // Closing Stock: Current available stock at end of day
    const closingStock = await this.getStockBalanceAtDate(pharmacyId, endOfDay);

    // Calculate totals
    const totalReceived = grnsReceived.totalValue + transfersReceived.totalValue;
    const totalIssued = issuesForDay.totalValue;
    const totalTransferred = transfersSent.totalValue;

    return {
      pharmacy: {
        id: pharmacy.id,
        name: pharmacy.name,
        type: pharmacy.type,
      },
      hospital: pharmacy.hospital,
      reportDate: date,
      summary: {
        openingBalance: openingStock.totalValue,
        openingQuantity: openingStock.totalQuantity,
        stockReceived: totalReceived,
        stockIssued: totalIssued,
        stockTransferred: totalTransferred,
        closingBalance: closingStock.totalValue,
        closingQuantity: closingStock.totalQuantity,
      },
      receipts: {
        grns: grnsReceived,
        transfersIn: transfersReceived,
      },
      issues: issuesForDay,
      transfersOut: transfersSent,
    };
  }

  /**
   * Get transaction summary for date range
   */
  async getDateRangeReport(dto: DateRangeReportDto) {
    const { pharmacyId, startDate, endDate, hospitalId } = dto;

    const pharmacy = await this.prisma.pharmacy.findFirst({
      where: {
        id: pharmacyId,
        ...(hospitalId && { hospitalId }),
      },
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!pharmacy) {
      throw new NotFoundException('Pharmacy not found');
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Get opening balance before start date
    const openingDate = new Date(start);
    openingDate.setMilliseconds(-1);
    const openingStock = await this.getStockBalanceAtDate(pharmacyId, openingDate);

    // Get all transactions in range
    const [grnsReceived, transfersReceived, issues, transfersSent] = await Promise.all([
      this.getGRNsForPeriod(pharmacyId, start, end),
      this.getTransfersReceivedForPeriod(pharmacyId, start, end),
      this.getIssuesForPeriod(pharmacyId, start, end),
      this.getTransfersSentForPeriod(pharmacyId, start, end),
    ]);

    const closingStock = await this.getStockBalanceAtDate(pharmacyId, end);

    return {
      pharmacy: {
        id: pharmacy.id,
        name: pharmacy.name,
        type: pharmacy.type,
      },
      hospital: pharmacy.hospital,
      period: {
        startDate,
        endDate,
      },
      summary: {
        openingBalance: openingStock.totalValue,
        totalReceived: grnsReceived.totalValue + transfersReceived.totalValue,
        totalIssued: issues.totalValue,
        totalTransferred: transfersSent.totalValue,
        closingBalance: closingStock.totalValue,
      },
      details: {
        grns: grnsReceived,
        transfersIn: transfersReceived,
        issues,
        transfersOut: transfersSent,
      },
    };
  }

  /**
   * Helper: Calculate stock balance at a specific date/time
   */
  private async getStockBalanceAtDate(pharmacyId: string, date: Date) {
    const batches = await this.prisma.stockBatch.findMany({
      where: {
        pharmacyId,
        createdAt: {
          lte: date,
        },
        expiryDate: {
          gte: date,
        },
      },
      include: {
        medicine: {
          select: {
            name: true,
            genericName: true,
          },
        },
      },
    });

    const totalQuantity = batches.reduce((sum, batch) => sum + batch.qtyAvailable, 0);
    const totalValue = batches.reduce((sum, batch) => {
      const unitPrice = batch.purchasePrice || 0;
      return sum + batch.qtyAvailable * Number(unitPrice);
    }, 0);

    return {
      totalQuantity,
      totalValue: Number(totalValue.toFixed(2)),
      batchCount: batches.length,
    };
  }

  /**
   * Helper: Get GRNs for a specific day
   */
  private async getGRNsForDay(pharmacyId: string, startOfDay: Date, endOfDay: Date) {
    const grns = await this.prisma.gRN.findMany({
      where: {
        pharmacyId,
        receivedDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        items: {
          include: {
            medicine: {
              select: {
                name: true,
                genericName: true,
              },
            },
            batch: {
              select: {
                purchasePrice: true,
              },
            },
          },
        },
      },
    });

    const totalValue = grns.reduce((sum, grn) => {
      const grnTotal = grn.items.reduce((itemSum, item) => {
        return itemSum + item.qtyReceived * Number(item.batch.purchasePrice || 0);
      }, 0);
      return sum + grnTotal;
    }, 0);

    const totalQuantity = grns.reduce((sum, grn) => {
      return sum + grn.items.reduce((itemSum, item) => itemSum + item.qtyReceived, 0);
    }, 0);

    return {
      count: grns.length,
      totalQuantity,
      totalValue: Number(totalValue.toFixed(2)),
      transactions: grns.map((grn) => ({
        id: grn.id,
        grnNumber: grn.grnNumber,
        receivedAt: grn.receivedDate,
        itemCount: grn.items.length,
        totalValue: grn.items
          .reduce((sum, item) => sum + item.qtyReceived * Number(item.batch.purchasePrice || 0), 0)
          .toFixed(2),
      })),
    };
  }

  /**
   * Helper: Get GRNs for a period
   */
  private async getGRNsForPeriod(pharmacyId: string, start: Date, end: Date) {
    return this.getGRNsForDay(pharmacyId, start, end);
  }

  /**
   * Helper: Get transfers received for a day
   */
  private async getTransfersReceivedForDay(
    pharmacyId: string,
    startOfDay: Date,
    endOfDay: Date,
  ) {
    const transfers = await this.prisma.transferRequest.findMany({
      where: {
        fromPharmacyId: pharmacyId, // Receiving pharmacy
        status: 'RECEIVED',
        receivedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        toPharmacy: {
          select: {
            name: true,
          },
        },
        items: {
          include: {
            medicine: {
              select: {
                name: true,
                genericName: true,
              },
            },
          },
        },
      },
    });

    const totalQuantity = transfers.reduce((sum, transfer) => {
      return sum + transfer.items.reduce((itemSum, item) => itemSum + item.qtyRequested, 0);
    }, 0);

    // Value calculation based on batch mappings
    const totalValue = 0; // Would need to join with TransferBatchMapping for accurate pricing

    return {
      count: transfers.length,
      totalQuantity,
      totalValue,
      transactions: transfers.map((transfer) => ({
        id: transfer.id,
        requestNumber: transfer.requestNumber,
        fromPharmacy: transfer.toPharmacy.name,
        receivedAt: transfer.receivedAt,
        itemCount: transfer.items.length,
      })),
    };
  }

  /**
   * Helper: Get transfers received for period
   */
  private async getTransfersReceivedForPeriod(pharmacyId: string, start: Date, end: Date) {
    return this.getTransfersReceivedForDay(pharmacyId, start, end);
  }

  /**
   * Helper: Get medicine issues for a day
   */
  private async getIssuesForDay(pharmacyId: string, startOfDay: Date, endOfDay: Date) {
    const issues = await this.prisma.issueTransaction.findMany({
      where: {
        pharmacyId,
        issuedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        patient: {
          select: {
            nrNumber: true,
            fullName: true,
          },
        },
        items: {
          include: {
            medicine: {
              select: {
                name: true,
                genericName: true,
              },
            },
          },
        },
      },
    });

    const totalQuantity = issues.reduce((sum, issue) => {
      return sum + issue.items.reduce((itemSum, item) => itemSum + item.qtyIssued, 0);
    }, 0);

    const totalValue = issues.reduce((sum, issue) => sum + Number(issue.totalAmount || 0), 0);

    return {
      count: issues.length,
      totalQuantity,
      totalValue: Number(totalValue.toFixed(2)),
      transactions: issues.map((issue) => ({
        id: issue.id,
        patient: issue.patient.fullName,
        nrNumber: issue.patient.nrNumber,
        issuedAt: issue.issuedAt,
        itemCount: issue.items.length,
        totalAmount: Number(issue.totalAmount || 0).toFixed(2),
      })),
    };
  }

  /**
   * Helper: Get issues for period
   */
  private async getIssuesForPeriod(pharmacyId: string, start: Date, end: Date) {
    return this.getIssuesForDay(pharmacyId, start, end);
  }

  /**
   * Helper: Get transfers sent for a day
   */
  private async getTransfersSentForDay(pharmacyId: string, startOfDay: Date, endOfDay: Date) {
    const transfers = await this.prisma.transferRequest.findMany({
      where: {
        toPharmacyId: pharmacyId, // Sending pharmacy
        status: 'RECEIVED',
        dispatchedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        fromPharmacy: {
          select: {
            name: true,
          },
        },
        items: {
          include: {
            medicine: {
              select: {
                name: true,
                genericName: true,
              },
            },
          },
        },
      },
    });

    const totalQuantity = transfers.reduce((sum, transfer) => {
      return sum + transfer.items.reduce((itemSum, item) => itemSum + item.qtyRequested, 0);
    }, 0);

    return {
      count: transfers.length,
      totalQuantity,
      totalValue: 0,
      transactions: transfers.map((transfer) => ({
        id: transfer.id,
        requestNumber: transfer.requestNumber,
        toPharmacy: transfer.fromPharmacy.name,
        dispatchedAt: transfer.dispatchedAt,
        itemCount: transfer.items.length,
      })),
    };
  }

  /**
   * Helper: Get transfers sent for period
   */
  private async getTransfersSentForPeriod(pharmacyId: string, start: Date, end: Date) {
    return this.getTransfersSentForDay(pharmacyId, start, end);
  }

  /**
   * DETAILED REPORTING METHODS
   * ================================================================
   */

  /**
   * Get medicine-wise opening stock balance
   * Returns detailed breakdown by medicine with all batches
   */
  async getMedicineWiseOpeningStock(pharmacyId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Opening = Closing + movements ON the day (add back issues/transfers OUT, subtract GRNs)
    // First fetch all batches for this pharmacy
    const batches = await this.prisma.stockBatch.findMany({
      where: { pharmacyId },
      include: {
        medicine: {
          select: { id: true, name: true, genericName: true, form: true, strength: true },
        },
      },
      orderBy: { medicine: { name: 'asc' } },
    });

    // Issues issued ON the day (reduced qty)
    const dayIssueItems = await this.prisma.issueItem.findMany({
      where: {
        batch: { pharmacyId },
        issueTransaction: { issuedAt: { gte: startOfDay, lte: endOfDay } },
      },
      select: { batchId: true, qtyIssued: true },
    });

    // Issues issued AFTER end of day (reduced qty, need to add back for reconstruction)
    const futureIssueItems = await this.prisma.issueItem.findMany({
      where: {
        batch: { pharmacyId },
        issueTransaction: { issuedAt: { gt: endOfDay } },
      },
      select: { batchId: true, qtyIssued: true },
    });

    // Transfers OUT received ON the day (reduced source qty)
    const dayTransfersOut = await this.prisma.transferBatchMapping.findMany({
      where: {
        sourceBatch: { pharmacyId },
        transferItem: {
          transferRequest: { status: 'RECEIVED', receivedAt: { gte: startOfDay, lte: endOfDay } },
        },
      },
      select: { sourceBatchId: true, qty: true },
    });

    // Transfers OUT received AFTER end of day (reduced qty, add back)
    const futureTransfersOut = await this.prisma.transferBatchMapping.findMany({
      where: {
        sourceBatch: { pharmacyId },
        transferItem: {
          transferRequest: { status: 'RECEIVED', receivedAt: { gt: endOfDay } },
        },
      },
      select: { sourceBatchId: true, qty: true },
    });

    // GRNs received ON the day (increased qty)
    const dayGRNItems = await this.prisma.gRNItem.findMany({
      where: {
        batch: { pharmacyId },
        grn: { receivedDate: { gte: startOfDay, lte: endOfDay } },
      },
      select: { batchId: true, qtyReceived: true },
    });

    // GRNs received AFTER end of day (increased qty, subtract to reconstruct)
    const futureGRNItems = await this.prisma.gRNItem.findMany({
      where: {
        batch: { pharmacyId },
        grn: { receivedDate: { gt: endOfDay } },
      },
      select: { batchId: true, qtyReceived: true },
    });

    // Build per-batch delta maps
    const addBack = new Map<string, number>(); // qty to add to current to reconstruct opening
    [...dayIssueItems, ...futureIssueItems].forEach((i) =>
      addBack.set(i.batchId, (addBack.get(i.batchId) || 0) + i.qtyIssued),
    );
    [...dayTransfersOut, ...futureTransfersOut].forEach((t) =>
      addBack.set(t.sourceBatchId, (addBack.get(t.sourceBatchId) || 0) + t.qty),
    );
    const subtract = new Map<string, number>(); // qty to subtract (GRNs increase current)
    [...dayGRNItems, ...futureGRNItems].forEach((g) =>
      subtract.set(g.batchId, (subtract.get(g.batchId) || 0) + g.qtyReceived),
    );

    const medicineMap = new Map<string, any>();

    batches.forEach((batch) => {
      // Only include batches that existed before the report day
      const batchReceivedBeforeDay = new Date(batch.receivedDate) < startOfDay;
      if (!batchReceivedBeforeDay) return;

      const openingQty =
        batch.qtyAvailable
        + (addBack.get(batch.id) || 0)
        - (subtract.get(batch.id) || 0);

      if (openingQty <= 0) return;

      const medId = batch.medicineId;
      if (!medicineMap.has(medId)) {
        medicineMap.set(medId, {
          medicineId: medId,
          medicineName: batch.medicine.name,
          genericName: batch.medicine.genericName,
          form: batch.medicine.form,
          strength: batch.medicine.strength,
          totalQuantity: 0,
          totalValue: 0,
          batchCount: 0,
          batches: [],
        });
      }

      const medicine = medicineMap.get(medId);
      const batchValue = openingQty * Number(batch.purchasePrice || 0);
      medicine.totalQuantity += openingQty;
      medicine.totalValue += batchValue;
      medicine.batchCount += 1;
      medicine.batches.push({
        batchId: batch.id,
        batchNo: batch.batchNo,
        expiryDate: batch.expiryDate,
        qtyAvailable: openingQty,
        purchasePrice: Number(batch.purchasePrice || 0),
        governmentPrice: Number(batch.governmentPrice || 0),
        retailPrice: Number(batch.retailPrice || 0),
        storageType: batch.storageType,
      });
    });

    return Array.from(medicineMap.values()).map((med) => ({
      ...med,
      totalValue: Number(med.totalValue.toFixed(2)),
    }));
  }

  /**
   * Get medicine-wise closing stock balance
   * Reconstructs historical qty by adding back movements that occurred after the report day.
   */
  async getMedicineWiseClosingStock(pharmacyId: string, date: Date) {
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const batches = await this.prisma.stockBatch.findMany({
      where: { pharmacyId },
      include: {
        medicine: {
          select: { id: true, name: true, genericName: true, form: true, strength: true },
        },
      },
      orderBy: { medicine: { name: 'asc' } },
    });

    // Issues issued AFTER end of day (need to add back to get closing qty)
    const futureIssueItems = await this.prisma.issueItem.findMany({
      where: {
        batch: { pharmacyId },
        issueTransaction: { issuedAt: { gt: endOfDay } },
      },
      select: { batchId: true, qtyIssued: true },
    });

    // Transfers OUT received AFTER end of day
    const futureTransfersOut = await this.prisma.transferBatchMapping.findMany({
      where: {
        sourceBatch: { pharmacyId },
        transferItem: {
          transferRequest: { status: 'RECEIVED', receivedAt: { gt: endOfDay } },
        },
      },
      select: { sourceBatchId: true, qty: true },
    });

    // GRNs received AFTER end of day (added qty, subtract to reconstruct)
    const futureGRNItems = await this.prisma.gRNItem.findMany({
      where: {
        batch: { pharmacyId },
        grn: { receivedDate: { gt: endOfDay } },
      },
      select: { batchId: true, qtyReceived: true },
    });

    const addBack = new Map<string, number>();
    futureIssueItems.forEach((i) =>
      addBack.set(i.batchId, (addBack.get(i.batchId) || 0) + i.qtyIssued),
    );
    futureTransfersOut.forEach((t) =>
      addBack.set(t.sourceBatchId, (addBack.get(t.sourceBatchId) || 0) + t.qty),
    );
    const subtract = new Map<string, number>();
    futureGRNItems.forEach((g) =>
      subtract.set(g.batchId, (subtract.get(g.batchId) || 0) + g.qtyReceived),
    );

    const medicineMap = new Map<string, any>();

    batches.forEach((batch) => {
      // Only include batches received on or before end of day
      if (new Date(batch.receivedDate) > endOfDay) return;

      const closingQty =
        batch.qtyAvailable
        + (addBack.get(batch.id) || 0)
        - (subtract.get(batch.id) || 0);

      if (closingQty <= 0) return;

      const medId = batch.medicineId;
      if (!medicineMap.has(medId)) {
        medicineMap.set(medId, {
          medicineId: medId,
          medicineName: batch.medicine.name,
          genericName: batch.medicine.genericName,
          form: batch.medicine.form,
          strength: batch.medicine.strength,
          totalQuantity: 0,
          totalValue: 0,
          batchCount: 0,
          batches: [],
        });
      }

      const medicine = medicineMap.get(medId);
      const batchValue = closingQty * Number(batch.purchasePrice || 0);
      medicine.totalQuantity += closingQty;
      medicine.totalValue += batchValue;
      medicine.batchCount += 1;
      medicine.batches.push({
        batchId: batch.id,
        batchNo: batch.batchNo,
        expiryDate: batch.expiryDate,
        qtyAvailable: closingQty,
        purchasePrice: Number(batch.purchasePrice || 0),
        governmentPrice: Number(batch.governmentPrice || 0),
        retailPrice: Number(batch.retailPrice || 0),
        storageType: batch.storageType,
      });
    });

    return Array.from(medicineMap.values()).map((med) => ({
      ...med,
      totalValue: Number(med.totalValue.toFixed(2)),
    }));
  }

  /**
   * Get detailed GRNs with item-level breakdown
   */
  async getDetailedGRNs(pharmacyId: string, startDate: Date, endDate: Date) {
    const grns = await this.prisma.gRN.findMany({
      where: {
        pharmacyId,
        receivedDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        items: {
          include: {
            medicine: true,
            batch: true,
          },
        },
        receiver: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: {
        receivedDate: 'asc',
      },
    });

    return grns.map((grn) => ({
      id: grn.id,
      grnNumber: grn.grnNumber,
      invoiceNumber: null, // Not in schema
      supplierName: null, // Not in schema - would need to join through PO
      receivedDate: grn.receivedDate,
      receivedBy: grn.receiver?.fullName || null,
      itemCount: grn.items.length,
      totalQuantity: grn.items.reduce((sum, item) => sum + item.qtyReceived, 0),
      totalValue: Number(
        grn.items
          .reduce((sum, item) => sum + item.qtyReceived * Number(item.batch.purchasePrice || 0), 0)
          .toFixed(2),
      ),
      items: grn.items.map((item) => ({
        grnItemId: item.id,
        medicineId: item.medicineId,
        medicineName: item.medicine.name,
        genericName: item.medicine.genericName,
        form: item.medicine.form,
        strength: item.medicine.strength,
        batchNo: item.batch.batchNo,
        expiryDate: item.batch.expiryDate,
        qtyReceived: item.qtyReceived,
        purchasePrice: Number(item.batch.purchasePrice || 0),
        governmentPrice: Number(item.batch.governmentPrice || 0),
        retailPrice: Number(item.batch.retailPrice || 0),
        storageType: item.batch.storageType,
        totalValue: Number((item.qtyReceived * Number(item.batch.purchasePrice || 0)).toFixed(2)),
      })),
    }));
  }

  /**
   * Get detailed issues with patient and item breakdown
   */
  async getDetailedIssues(pharmacyId: string, startDate: Date, endDate: Date) {
    const issues = await this.prisma.issueTransaction.findMany({
      where: {
        pharmacyId,
        issuedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        patient: true,
        items: {
          include: {
            medicine: true,
            batch: true,
          },
        },
        issuer: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: {
        issuedAt: 'asc',
      },
    });

    return issues.map((issue) => {
      // Calculate age from dob
      const age = issue.patient.dob
        ? Math.floor((Date.now() - issue.patient.dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : 0;

      return {
        id: issue.id,
        patientNrNumber: issue.patient.nrNumber,
        patientName: issue.patient.fullName,
        patientAge: age,
        patientGender: issue.patient.gender,
        visitType: issue.patient.visitType,
        issuedAt: issue.issuedAt,
        issuedBy: issue.issuer?.fullName || null,
        prescriptionId: issue.prescriptionId,
        itemCount: issue.items.length,
        totalQuantity: issue.items.reduce((sum, item) => sum + item.qtyIssued, 0),
        totalAmount: Number(issue.totalAmount || 0),
        items: issue.items.map((item) => ({
          issueItemId: item.id,
          medicineId: item.medicineId,
          medicineName: item.medicine.name,
          genericName: item.medicine.genericName,
          form: item.medicine.form,
          strength: item.medicine.strength,
          batchNo: item.batch.batchNo,
          expiryDate: item.batch.expiryDate,
          qtyIssued: item.qtyIssued,
          unitPrice: Number(item.unitPrice || 0),
          totalAmount: Number(item.totalPrice || 0),
        })),
      };
    });
  }

  /**
   * Get detailed transfers (both IN and OUT)
   */
  async getDetailedTransfers(
    pharmacyId: string,
    startDate: Date,
    endDate: Date,
    direction: 'IN' | 'OUT',
  ) {
    const whereClause =
      direction === 'IN'
        ? {
            toPharmacyId: pharmacyId, // This pharmacy is the receiver
            status: 'RECEIVED' as any,
            receivedAt: {
              gte: startDate,
              lte: endDate,
            },
          }
        : {
            fromPharmacyId: pharmacyId, // This pharmacy is the sender
            status: 'RECEIVED' as any,
            receivedAt: {
              gte: startDate,
              lte: endDate,
            },
          };

    const transfers = await this.prisma.transferRequest.findMany({
      where: whereClause,
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
        requester: {
          select: {
            fullName: true,
          },
        },
        approver: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: direction === 'IN' ? { receivedAt: 'asc' } : { dispatchedAt: 'asc' },
    });

    return transfers.map((transfer) => ({
      id: transfer.id,
      requestNumber: transfer.requestNumber,
      fromPharmacyId: transfer.fromPharmacyId,
      fromPharmacyName: transfer.fromPharmacy.name,
      toPharmacyId: transfer.toPharmacyId,
      toPharmacyName: transfer.toPharmacy.name,
      requestedAt: transfer.createdAt, // Use createdAt as requestedAt
      approvedAt: transfer.approvedAt,
      dispatchedAt: transfer.dispatchedAt,
      receivedAt: transfer.receivedAt,
      status: transfer.status,
      requestedBy: transfer.requester?.fullName || null,
      approvedBy: transfer.approver?.fullName || null,
      itemCount: transfer.items.length,
      totalQuantity: transfer.items.reduce((sum, item) => sum + item.qtyRequested, 0),
      items: transfer.items.map((item) => ({
        transferItemId: item.id,
        medicineId: item.medicineId,
        medicineName: item.medicine.name,
        genericName: item.medicine.genericName,
        form: item.medicine.form,
        strength: item.medicine.strength,
        qtyRequested: item.qtyRequested,
        qtyApproved: item.qtyApproved,
        batchMappings: item.batchMappings.map((mapping) => ({
          sourceBatchNo: mapping.sourceBatch.batchNo,
          sourceExpiryDate: mapping.sourceBatch.expiryDate,
          destinationBatchNo: mapping.destinationBatch ? mapping.destinationBatch.batchNo : '',
          destinationExpiryDate: mapping.destinationBatch ? mapping.destinationBatch.expiryDate : new Date(),
          qtyTransferred: mapping.qty,
        })),
      })),
    }));
  }

  /**
   * Get medicine consumption summary for period
   */
  async getMedicineConsumptionSummary(pharmacyId: string, startDate: Date, endDate: Date) {
    const issues = await this.getDetailedIssues(pharmacyId, startDate, endDate);

    const medicineMap = new Map<string, any>();

    issues.forEach((issue) => {
      issue.items.forEach((item) => {
        const medId = item.medicineId;

        if (!medicineMap.has(medId)) {
          medicineMap.set(medId, {
            medicineId: medId,
            medicineName: item.medicineName,
            genericName: item.genericName,
            form: item.form,
            strength: item.strength,
            totalQuantityIssued: 0,
            patients: new Set(),
            issueCount: 0,
            totalValue: 0,
          });
        }

        const medicine = medicineMap.get(medId);
        medicine.totalQuantityIssued += item.qtyIssued;
        medicine.patients.add(issue.patientNrNumber);
        medicine.issueCount += 1;
        medicine.totalValue += item.totalAmount;
      });
    });

    return Array.from(medicineMap.values()).map((med) => ({
      medicineId: med.medicineId,
      medicineName: med.medicineName,
      genericName: med.genericName,
      form: med.form,
      strength: med.strength,
      totalQuantityIssued: med.totalQuantityIssued,
      numberOfPatients: med.patients.size,
      numberOfIssues: med.issueCount,
      totalValue: Number(med.totalValue.toFixed(2)),
      averagePerPatient: Number((med.totalQuantityIssued / med.patients.size).toFixed(2)),
      averagePerIssue: Number((med.totalQuantityIssued / med.issueCount).toFixed(2)),
    }));
  }

  /**
   * Get comprehensive detailed daily report
   */
  async getDetailedDailyReport(pharmacyId: string, date: string, hospitalId?: string) {
    // Verify pharmacy
    const pharmacy = await this.prisma.pharmacy.findFirst({
      where: {
        id: pharmacyId,
        ...(hospitalId && { hospitalId }),
      },
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!pharmacy) {
      throw new NotFoundException('Pharmacy not found');
    }

    const reportDate = new Date(date);
    const startOfDay = new Date(reportDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(reportDate);
    endOfDay.setHours(23, 59, 59, 999);

    const previousDayEnd = new Date(startOfDay);
    previousDayEnd.setMilliseconds(-1);

    // Fetch all detailed data in parallel
    const [
      medicineWiseOpening,
      medicineWiseClosing,
      detailedGRNs,
      detailedTransfersIn,
      detailedIssues,
      detailedTransfersOut,
      medicineConsumption,
    ] = await Promise.all([
      this.getMedicineWiseOpeningStock(pharmacyId, reportDate),
      this.getMedicineWiseClosingStock(pharmacyId, reportDate),
      this.getDetailedGRNs(pharmacyId, startOfDay, endOfDay),
      this.getDetailedTransfers(pharmacyId, startOfDay, endOfDay, 'IN'),
      this.getDetailedIssues(pharmacyId, startOfDay, endOfDay),
      this.getDetailedTransfers(pharmacyId, startOfDay, endOfDay, 'OUT'),
      this.getMedicineConsumptionSummary(pharmacyId, startOfDay, endOfDay),
    ]);

    // Calculate summary totals
    const openingBalance = medicineWiseOpening.reduce((sum, med) => sum + med.totalValue, 0);
    const openingQuantity = medicineWiseOpening.reduce((sum, med) => sum + med.totalQuantity, 0);

    const closingBalance = medicineWiseClosing.reduce((sum, med) => sum + med.totalValue, 0);
    const closingQuantity = medicineWiseClosing.reduce((sum, med) => sum + med.totalQuantity, 0);

    const stockReceived = detailedGRNs.reduce((sum, grn) => sum + grn.totalValue, 0);
    const stockReceivedQuantity = detailedGRNs.reduce((sum, grn) => sum + grn.totalQuantity, 0);

    const stockIssued = detailedIssues.reduce((sum, issue) => sum + issue.totalAmount, 0);
    const stockIssuedQuantity = detailedIssues.reduce((sum, issue) => sum + issue.totalQuantity, 0);

    const stockTransferred = detailedTransfersOut.reduce((sum, transfer) => {
      // Sum value from batch mappings using source batch purchase price
      return sum + transfer.items.reduce((s: number, item: any) => {
        const qty = item.batchMappings?.reduce((bqty: number, bm: any) => bqty + (bm.qtyTransferred || 0), 0)
          ?? item.qtyApproved ?? item.qtyRequested ?? 0;
        return s + qty * (item.purchasePrice || 0);
      }, 0);
    }, 0);
    const stockTransferredQuantity = detailedTransfersOut.reduce(
      (sum, transfer) => sum + transfer.totalQuantity,
      0,
    );

    return {
      pharmacy: {
        id: pharmacy.id,
        name: pharmacy.name,
        type: pharmacy.type,
        code: pharmacy.code,
      },
      hospital: pharmacy.hospital,
      reportDate: date,
      summary: {
        openingBalance: Number(openingBalance.toFixed(2)),
        openingQuantity,
        stockReceived: Number(stockReceived.toFixed(2)),
        stockReceivedQuantity,
        stockIssued: Number(stockIssued.toFixed(2)),
        stockIssuedQuantity,
        stockTransferred: Number(stockTransferred.toFixed(2)),
        stockTransferredQuantity,
        closingBalance: Number(closingBalance.toFixed(2)),
        closingQuantity,
      },
      medicineWiseOpening,
      medicineWiseClosing,
      detailedGRNs,
      detailedTransfersIn,
      detailedIssues,
      detailedTransfersOut,
      medicineConsumption,
    };
  }
}
