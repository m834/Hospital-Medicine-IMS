import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { CacheService } from '../../common/services/cache.service';
import { AnalyticsQueryDto, TimePeriod } from './dto/analytics-query.dto';

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  /**
   * Get comprehensive dashboard overview
   */
  async getDashboardOverview(query: AnalyticsQueryDto) {
    const { hospitalId, pharmacyId, period } = query;
    const { startDate, endDate } = this.getDateRange(period, query.startDate, query.endDate);

    const [
      stockValue,
      totalPatients,
      totalIssues,
      totalTransfers,
      activeAlerts,
      expiringBatches,
    ] = await Promise.all([
      this.getTotalStockValue(hospitalId, pharmacyId),
      this.getTotalPatients(hospitalId, startDate, endDate),
      this.getTotalIssuances(hospitalId, pharmacyId, startDate, endDate),
      this.getTotalTransfers(hospitalId, pharmacyId, startDate, endDate),
      this.getActiveAlerts(hospitalId, pharmacyId),
      this.getExpiringBatches(hospitalId, pharmacyId, 30),
    ]);

    return {
      period: {
        label: this.getPeriodLabel(period),
        startDate,
        endDate,
      },
      kpis: {
        stockValue,
        totalPatients,
        totalIssues,
        totalTransfers,
        activeAlerts,
        expiringBatches,
      },
    };
  }

  /**
   * Get stock trends over time
   */
  async getStockTrends(query: AnalyticsQueryDto) {
    const { hospitalId, pharmacyId, period } = query;
    const { startDate, endDate } = this.getDateRange(period, query.startDate, query.endDate);

    // Get daily stock values
    const batches = await this.prisma.stockBatch.groupBy({
      by: ['receivedDate'],
      where: {
        ...(hospitalId && { hospitalId }),
        ...(pharmacyId && { pharmacyId }),
        receivedDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        qtyReceived: true,
        qtyAvailable: true,
      },
      orderBy: {
        receivedDate: 'asc',
      },
    });

    return batches.map((batch) => ({
      date: batch.receivedDate,
      received: batch._sum.qtyReceived || 0,
      available: batch._sum.qtyAvailable || 0,
    }));
  }

  /**
   * Get medicine consumption trends
   */
  async getConsumptionTrends(query: AnalyticsQueryDto) {
    const { hospitalId, pharmacyId, period } = query;
    const { startDate, endDate } = this.getDateRange(period, query.startDate, query.endDate);

    const issues = await this.prisma.issueTransaction.findMany({
      where: {
        ...(hospitalId && { hospitalId }),
        ...(pharmacyId && { pharmacyId }),
        issuedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        items: {
          include: {
            medicine: {
              select: {
                id: true,
                name: true,
                genericName: true,
              },
            },
          },
        },
      },
    });

    // Group by date and calculate totals
    const dailyConsumption = issues.reduce((acc, issue) => {
      const date = issue.issuedAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          totalQuantity: 0,
          totalValue: 0,
          transactionCount: 0,
        };
      }
      
      acc[date].transactionCount += 1;
      acc[date].totalValue += Number(issue.totalAmount);
      acc[date].totalQuantity += issue.items.reduce((sum, item) => sum + item.qtyIssued, 0);
      
      return acc;
    }, {});

    return Object.values(dailyConsumption).sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }

  /**
   * Get top medicines by consumption
   */
  async getTopMedicines(query: AnalyticsQueryDto, limit: number = 10) {
    const { hospitalId, pharmacyId, period } = query;
    const { startDate, endDate } = this.getDateRange(period, query.startDate, query.endDate);

    // First get all issue IDs that match criteria
    const issues = await this.prisma.issueTransaction.findMany({
      where: {
        ...(hospitalId && { hospitalId }),
        ...(pharmacyId && { pharmacyId }),
        issuedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
      },
    });

    const issueIds = issues.map(issue => issue.id);

    if (issueIds.length === 0) {
      return [];
    }

    // Get all issue items for these issues
    const issueItems = await this.prisma.issueItem.findMany({
      where: {
        issueId: {
          in: issueIds,
        },
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
      },
    });

    // Group by medicine and calculate totals
    const medicineStats = issueItems.reduce((acc, item) => {
      const medId = item.medicineId;
      if (!acc[medId]) {
        acc[medId] = {
          medicineId: medId,
          name: item.medicine.name,
          genericName: item.medicine.genericName,
          form: item.medicine.form,
          totalQuantity: 0,
          totalValue: 0,
          transactionCount: 0,
        };
      }
      acc[medId].totalQuantity += item.qtyIssued;
      acc[medId].totalValue += Number(item.totalPrice);
      acc[medId].transactionCount += 1;
      return acc;
    }, {});

    // Convert to array, sort by quantity, and take top N
    return Object.values(medicineStats)
      .sort((a: any, b: any) => b.totalQuantity - a.totalQuantity)
      .slice(0, limit);
  }

  /**
   * Get pharmacy performance comparison
   */
  async getPharmacyPerformance(query: AnalyticsQueryDto) {
    const { hospitalId, period } = query;
    const { startDate, endDate } = this.getDateRange(period, query.startDate, query.endDate);

    const pharmacies = await this.prisma.pharmacy.findMany({
      where: {
        ...(hospitalId && { hospitalId }),
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        type: true,
      },
    });

    const performanceData = await Promise.all(
      pharmacies.map(async (pharmacy) => {
        const [stockValue, issues, transfers, alerts] = await Promise.all([
          this.getTotalStockValue(hospitalId, pharmacy.id),
          this.getTotalIssuances(hospitalId, pharmacy.id, startDate, endDate),
          this.getTotalTransfers(hospitalId, pharmacy.id, startDate, endDate),
          this.getActiveAlerts(hospitalId, pharmacy.id),
        ]);

        return {
          pharmacyId: pharmacy.id,
          pharmacyName: pharmacy.name,
          type: pharmacy.type,
          stockValue: stockValue.totalValue,
          stockQuantity: stockValue.totalQuantity,
          issueCount: issues.count,
          issueValue: issues.totalValue,
          transferCount: transfers.sent + transfers.received,
          activeAlerts: alerts.count,
        };
      })
    );

    return performanceData;
  }

  /**
   * Get financial overview
   */
  async getFinancialOverview(query: AnalyticsQueryDto) {
    const { hospitalId, pharmacyId, period } = query;
    const { startDate, endDate } = this.getDateRange(period, query.startDate, query.endDate);

    const [purchases, issues, stockValue] = await Promise.all([
      // Total purchases (GRNs)
      this.prisma.gRN.aggregate({
        where: {
          ...(hospitalId && { hospitalId }),
          ...(pharmacyId && { pharmacyId }),
          receivedDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: {
          id: true,
        },
      }),

      // Total issued value
      this.prisma.issueTransaction.aggregate({
        where: {
          ...(hospitalId && { hospitalId }),
          ...(pharmacyId && { pharmacyId }),
          issuedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: {
          totalAmount: true,
        },
        _count: {
          id: true,
        },
      }),

      // Current stock value
      this.getTotalStockValue(hospitalId, pharmacyId),
    ]);

    // Calculate purchase value from GRN items
    const purchaseValue = await this.prisma.gRNItem.aggregate({
      where: {
        grn: {
          ...(hospitalId && { hospitalId }),
          ...(pharmacyId && { pharmacyId }),
          receivedDate: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
      _sum: {
        qtyReceived: true,
      },
    });

    return {
      purchases: {
        count: purchases._count.id,
        totalQuantity: purchaseValue._sum.qtyReceived || 0,
      },
      issues: {
        count: issues._count.id,
        totalValue: Number(issues._sum.totalAmount || 0),
      },
      currentStock: {
        totalValue: stockValue.totalValue,
        totalQuantity: stockValue.totalQuantity,
      },
    };
  }

  /**
   * Get expiring stock analysis
   */
  async getExpiryAnalysis(query: AnalyticsQueryDto) {
    const { hospitalId, pharmacyId } = query;
    const now = new Date();

    const categories = [
      { label: 'Expired', days: 0 },
      { label: 'Expiring in 30 days', days: 30 },
      { label: 'Expiring in 90 days', days: 90 },
      { label: 'Expiring in 180 days', days: 180 },
      { label: 'Expiring beyond 180 days', days: 365 },
    ];

    const expiryData = await Promise.all(
      categories.map(async (category, index) => {
        const startDays = index === 0 ? -9999 : categories[index - 1]?.days || 0;
        const endDays = category.days;

        const batches = await this.prisma.stockBatch.aggregate({
          where: {
            ...(hospitalId && { hospitalId }),
            ...(pharmacyId && { pharmacyId }),
            status: 'AVAILABLE',
            qtyAvailable: {
              gt: 0,
            },
            expiryDate: {
              gte: new Date(now.getTime() + startDays * 24 * 60 * 60 * 1000),
              lte: new Date(now.getTime() + endDays * 24 * 60 * 60 * 1000),
            },
          },
          _sum: {
            qtyAvailable: true,
          },
          _count: {
            id: true,
          },
        });

        return {
          category: category.label,
          batchCount: batches._count.id,
          totalQuantity: batches._sum.qtyAvailable || 0,
        };
      })
    );

    return expiryData;
  }

  /**
   * Get transfer efficiency metrics
   */
  async getTransferMetrics(query: AnalyticsQueryDto) {
    const { hospitalId, pharmacyId, period } = query;
    const { startDate, endDate } = this.getDateRange(period, query.startDate, query.endDate);

    const transfers = await this.prisma.transferRequest.findMany({
      where: {
        ...(hospitalId && { hospitalId }),
        ...(pharmacyId && {
          OR: [{ fromPharmacyId: pharmacyId }, { toPharmacyId: pharmacyId }],
        }),
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        approvedAt: true,
        dispatchedAt: true,
        receivedAt: true,
      },
    });

    const statusCounts = transfers.reduce((acc, transfer) => {
      acc[transfer.status] = (acc[transfer.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate average processing times
    const completedTransfers = transfers.filter((t) => t.status === 'RECEIVED');
    const avgTimes = completedTransfers.reduce(
      (acc, transfer) => {
        if (transfer.approvedAt) {
          const approvalTime = transfer.approvedAt.getTime() - transfer.createdAt.getTime();
          acc.approvalTime += approvalTime;
          acc.approvalCount += 1;
        }
        if (transfer.dispatchedAt && transfer.approvedAt) {
          const dispatchTime = transfer.dispatchedAt.getTime() - transfer.approvedAt.getTime();
          acc.dispatchTime += dispatchTime;
          acc.dispatchCount += 1;
        }
        if (transfer.receivedAt && transfer.dispatchedAt) {
          const receiptTime = transfer.receivedAt.getTime() - transfer.dispatchedAt.getTime();
          acc.receiptTime += receiptTime;
          acc.receiptCount += 1;
        }
        if (transfer.receivedAt) {
          const totalTime = transfer.receivedAt.getTime() - transfer.createdAt.getTime();
          acc.totalTime += totalTime;
          acc.totalCount += 1;
        }
        return acc;
      },
      {
        approvalTime: 0,
        approvalCount: 0,
        dispatchTime: 0,
        dispatchCount: 0,
        receiptTime: 0,
        receiptCount: 0,
        totalTime: 0,
        totalCount: 0,
      }
    );

    return {
      statusBreakdown: statusCounts,
      totalTransfers: transfers.length,
      completionRate: ((completedTransfers.length / transfers.length) * 100).toFixed(2),
      averageTimes: {
        approval: avgTimes.approvalCount > 0 
          ? Math.round(avgTimes.approvalTime / avgTimes.approvalCount / (1000 * 60 * 60)) // hours
          : 0,
        dispatch: avgTimes.dispatchCount > 0 
          ? Math.round(avgTimes.dispatchTime / avgTimes.dispatchCount / (1000 * 60 * 60))
          : 0,
        receipt: avgTimes.receiptCount > 0 
          ? Math.round(avgTimes.receiptTime / avgTimes.receiptCount / (1000 * 60 * 60))
          : 0,
        total: avgTimes.totalCount > 0 
          ? Math.round(avgTimes.totalTime / avgTimes.totalCount / (1000 * 60 * 60 * 24)) // days
          : 0,
      },
    };
  }

  // Helper methods

  private async getTotalStockValue(hospitalId?: string, pharmacyId?: string) {
    const batches = await this.prisma.stockBatch.aggregate({
      where: {
        ...(hospitalId && { hospitalId }),
        ...(pharmacyId && { pharmacyId }),
        status: 'AVAILABLE',
        qtyAvailable: {
          gt: 0,
        },
      },
      _sum: {
        qtyAvailable: true,
      },
      _count: {
        id: true,
      },
    });

    // Calculate total value (using purchase price)
    const batchesWithPrice = await this.prisma.stockBatch.findMany({
      where: {
        ...(hospitalId && { hospitalId }),
        ...(pharmacyId && { pharmacyId }),
        status: 'AVAILABLE',
        qtyAvailable: {
          gt: 0,
        },
      },
      select: {
        qtyAvailable: true,
        purchasePrice: true,
      },
    });

    const totalValue = batchesWithPrice.reduce((sum, batch) => {
      return sum + batch.qtyAvailable * Number(batch.purchasePrice || 0);
    }, 0);

    return {
      totalQuantity: batches._sum.qtyAvailable || 0,
      totalValue: Number(totalValue.toFixed(2)),
      batchCount: batches._count.id,
    };
  }

  private async getTotalPatients(hospitalId?: string, startDate?: Date, endDate?: Date) {
    const patients = await this.prisma.patient.aggregate({
      where: {
        ...(hospitalId && { hospitalId }),
        ...(startDate &&
          endDate && {
            registeredAt: {
              gte: startDate,
              lte: endDate,
            },
          }),
      },
      _count: {
        id: true,
      },
    });

    return {
      count: patients._count.id,
    };
  }

  private async getTotalIssuances(
    hospitalId?: string,
    pharmacyId?: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const issues = await this.prisma.issueTransaction.aggregate({
      where: {
        ...(hospitalId && { hospitalId }),
        ...(pharmacyId && { pharmacyId }),
        ...(startDate &&
          endDate && {
            issuedAt: {
              gte: startDate,
              lte: endDate,
            },
          }),
      },
      _sum: {
        totalAmount: true,
      },
      _count: {
        id: true,
      },
    });

    return {
      count: issues._count.id,
      totalValue: Number(issues._sum.totalAmount || 0),
    };
  }

  private async getTotalTransfers(
    hospitalId?: string,
    pharmacyId?: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const [sent, received] = await Promise.all([
      this.prisma.transferRequest.count({
        where: {
          ...(hospitalId && { hospitalId }),
          ...(pharmacyId && { fromPharmacyId: pharmacyId }),
          ...(startDate &&
            endDate && {
              createdAt: {
                gte: startDate,
                lte: endDate,
              },
            }),
        },
      }),
      this.prisma.transferRequest.count({
        where: {
          ...(hospitalId && { hospitalId }),
          ...(pharmacyId && { toPharmacyId: pharmacyId }),
          ...(startDate &&
            endDate && {
              createdAt: {
                gte: startDate,
                lte: endDate,
              },
            }),
        },
      }),
    ]);

    return { sent, received };
  }

  private async getActiveAlerts(hospitalId?: string, pharmacyId?: string) {
    const alerts = await this.prisma.alert.aggregate({
      where: {
        ...(hospitalId && { hospitalId }),
        ...(pharmacyId && { pharmacyId }),
        status: 'ACTIVE',
      },
      _count: {
        id: true,
      },
    });

    return {
      count: alerts._count.id,
    };
  }

  private async getExpiringBatches(hospitalId: string | undefined, pharmacyId: string | undefined, daysThreshold: number) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysThreshold);

    const batches = await this.prisma.stockBatch.aggregate({
      where: {
        ...(hospitalId && { hospitalId }),
        ...(pharmacyId && { pharmacyId }),
        status: 'AVAILABLE',
        qtyAvailable: {
          gt: 0,
        },
        expiryDate: {
          lte: futureDate,
        },
      },
      _count: {
        id: true,
      },
      _sum: {
        qtyAvailable: true,
      },
    });

    return {
      count: batches._count.id,
      totalQuantity: batches._sum.qtyAvailable || 0,
    };
  }

  private getDateRange(period: TimePeriod, customStart?: string, customEnd?: string) {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (period) {
      case TimePeriod.TODAY:
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
        break;
      case TimePeriod.WEEK:
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case TimePeriod.MONTH:
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case TimePeriod.QUARTER:
        startDate = new Date(now.setMonth(now.getMonth() - 3));
        break;
      case TimePeriod.YEAR:
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      case TimePeriod.CUSTOM:
        if (customStart && customEnd) {
          startDate = new Date(customStart);
          endDate = new Date(customEnd);
        } else {
          startDate = new Date(now.setMonth(now.getMonth() - 1));
        }
        break;
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1));
    }

    return { startDate, endDate };
  }

  private getPeriodLabel(period: TimePeriod): string {
    const labels = {
      [TimePeriod.TODAY]: 'Today',
      [TimePeriod.WEEK]: 'Last 7 Days',
      [TimePeriod.MONTH]: 'Last 30 Days',
      [TimePeriod.QUARTER]: 'Last 90 Days',
      [TimePeriod.YEAR]: 'Last 365 Days',
      [TimePeriod.CUSTOM]: 'Custom Period',
    };
    return labels[period] || 'Last 30 Days';
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const stats = this.cacheService.getStats();
    return {
      ...stats,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * Get system health metrics
   */
  getSystemHealth() {
    const memoryUsage = process.memoryUsage();
    const cacheStats = this.cacheService.getStats();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`,
      },
      cache: cacheStats,
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    };
  }
}
