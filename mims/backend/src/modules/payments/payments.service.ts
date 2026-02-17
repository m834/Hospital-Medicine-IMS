import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPatientSummary(patientId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, nrNumber: true, fullName: true, hospitalId: true },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const [admissions, visits, operations, labOrders, issueTransactions, receipts] =
      await Promise.all([
        this.prisma.admission.findMany({
          where: { patientId },
          include: {
            bed: { select: { dailyRate: true } },
            room: { select: { dailyRate: true } },
            dailyCharges: true,
          },
        }),
        this.prisma.visit.findMany({
          where: { patientId },
          select: { id: true, consultationFee: true, visitDate: true },
        }),
        (this.prisma as any).operation.findMany({
          where: { patientId, status: { not: 'CANCELLED' } },
          select: { operationPrice: true },
        }),
        this.prisma.labOrder.findMany({
          where: { patientId, status: { not: 'CANCELLED' } },
          include: { labTest: { select: { price: true } } },
        }),
        this.prisma.issueTransaction.findMany({
          where: { nrNumber: patient.nrNumber },
          select: { totalAmount: true },
        }),
        this.prisma.receipt.findMany({
          where: { patientId },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

    const roomCharges = this.sumRoomCharges(admissions);
    const consultationCharges = this.sumConsultationCharges(visits);
    const operationCharges = this.sumDecimals(
      operations.map((op: any) => op.operationPrice),
    );
    const labCharges = this.sumDecimals(
      labOrders.map((order) => order.labTest?.price),
    );
    const pharmacyCharges = this.sumDecimals(
      issueTransactions.map((issue) => issue.totalAmount),
    );

    const totalCharges = roomCharges
      .plus(consultationCharges)
      .plus(operationCharges)
      .plus(labCharges)
      .plus(pharmacyCharges);

    return {
      patient,
      breakdown: {
        roomCharges: roomCharges.toNumber(),
        consultationCharges: consultationCharges.toNumber(),
        operationCharges: operationCharges.toNumber(),
        labCharges: labCharges.toNumber(),
        pharmacyCharges: pharmacyCharges.toNumber(),
        total: totalCharges.toNumber(),
      },
      receipts,
    };
  }

  async getVisitSummary(visitId: string) {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        patient: { select: { id: true, nrNumber: true, fullName: true } },
      },
    });

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }

    const visitDate = new Date(visit.visitDate);
    const dayStart = new Date(visitDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(visitDate);
    dayEnd.setHours(23, 59, 59, 999);

    const [operations, labOrders, issueTransactions, receipts] = await Promise.all([
      (this.prisma as any).operation.findMany({
        where: { visitId, status: { not: 'CANCELLED' } },
        select: { operationPrice: true },
      }),
      this.prisma.labOrder.findMany({
        where: { visitId, status: { not: 'CANCELLED' } },
        include: { labTest: { select: { price: true } } },
      }),
      this.prisma.issueTransaction.findMany({
        where: {
          nrNumber: visit.patient.nrNumber,
          issuedAt: { gte: dayStart, lte: dayEnd },
        },
        select: { totalAmount: true },
      }),
      this.prisma.receipt.findMany({
        where: { visitId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const consultationCharges = new Prisma.Decimal(visit.consultationFee || 0);
    const operationCharges = this.sumDecimals(
      operations.map((op: any) => op.operationPrice),
    );
    const labCharges = this.sumDecimals(
      labOrders.map((order) => order.labTest?.price),
    );
    const pharmacyCharges = this.sumDecimals(
      issueTransactions.map((issue) => issue.totalAmount),
    );

    const totalCharges = consultationCharges
      .plus(operationCharges)
      .plus(labCharges)
      .plus(pharmacyCharges);

    return {
      visit,
      breakdown: {
        consultationCharges: consultationCharges.toNumber(),
        operationCharges: operationCharges.toNumber(),
        labCharges: labCharges.toNumber(),
        pharmacyCharges: pharmacyCharges.toNumber(),
        total: totalCharges.toNumber(),
      },
      receipts,
    };
  }

  private sumRoomCharges(admissions: Array<any>) {
    return admissions.reduce((sum, admission) => {
      if (admission.dailyCharges?.length) {
        const dailyTotal = this.sumDecimals(
          admission.dailyCharges.map((charge: any) => charge.totalCharges),
        );
        return sum.plus(dailyTotal);
      }

      const rate =
        admission.bed?.dailyRate || admission.room?.dailyRate || new Prisma.Decimal(0);
      const admittedAt = new Date(admission.admittedAt);
      const dischargedAt = admission.dischargedAt
        ? new Date(admission.dischargedAt)
        : new Date();
      const diffMs = Math.max(dischargedAt.getTime() - admittedAt.getTime(), 0);
      const days = Math.max(Math.ceil(diffMs / (1000 * 60 * 60 * 24)), 1);

      return sum.plus(new Prisma.Decimal(rate).mul(days));
    }, new Prisma.Decimal(0));
  }

  private sumConsultationCharges(visits: Array<any>) {
    return visits.reduce((sum, visit) => {
      return sum.plus(new Prisma.Decimal(visit.consultationFee || 0));
    }, new Prisma.Decimal(0));
  }

  private sumDecimals(values: Array<Prisma.Decimal | number | null | undefined>) {
    return values.reduce<Prisma.Decimal>((sum, value) => {
      if (value === null || value === undefined) {
        return sum;
      }
      return sum.plus(new Prisma.Decimal(value));
    }, new Prisma.Decimal(0));
  }
}
