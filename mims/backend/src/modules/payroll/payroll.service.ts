import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { AttendanceStatus, LatePenaltyType, LeavePayType } from '@prisma/client';
import { UpsertPayrollSettingDto } from './dto/payroll.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class PayrollService {
  constructor(private prisma: PrismaService) {}

  private calculatePayroll(
    setting: {
      monthlySalary: Decimal;
      allowanceAmount: Decimal;
      otherDeductionAmount: Decimal;
      latePenaltyType: LatePenaltyType;
      leavePayType: LeavePayType;
    },
    counts: { present: number; absent: number; late: number; halfDay: number; onLeave: number },
    year: number,
    month: number,
  ) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthlySalary = Number(setting.monthlySalary);
    const allowanceAmount = Number(setting.allowanceAmount || 0);
    const otherDeductionAmount = Number(setting.otherDeductionAmount || 0);
    const dailyRate = daysInMonth > 0 ? monthlySalary / daysInMonth : 0;

    const absentDeduction = counts.absent * dailyRate;
    const halfDayDeduction = counts.halfDay * dailyRate * 0.5;

    let lateDeduction = 0;
    if (setting.latePenaltyType === LatePenaltyType.HALF_DAY) {
      lateDeduction = counts.late * dailyRate * 0.5;
    } else if (setting.latePenaltyType === LatePenaltyType.ABSENT) {
      lateDeduction = counts.late * dailyRate;
    }

    const leaveDeduction =
      setting.leavePayType === LeavePayType.UNPAID ? counts.onLeave * dailyRate : 0;

    const totalDeductions = absentDeduction + halfDayDeduction + lateDeduction + leaveDeduction + otherDeductionAmount;
    const grossPay = monthlySalary + allowanceAmount;
    const netPay = Math.max(0, grossPay - totalDeductions);

    return {
      monthlySalary,
      allowanceAmount: Number(allowanceAmount.toFixed(2)),
      otherDeductionAmount: Number(otherDeductionAmount.toFixed(2)),
      dailyRate: Number(dailyRate.toFixed(2)),
      deductions: {
        absent: Number(absentDeduction.toFixed(2)),
        halfDay: Number(halfDayDeduction.toFixed(2)),
        late: Number(lateDeduction.toFixed(2)),
        leave: Number(leaveDeduction.toFixed(2)),
        total: Number(totalDeductions.toFixed(2)),
      },
      netPay: Number(netPay.toFixed(2)),
      policy: {
        latePenaltyType: setting.latePenaltyType,
        leavePayType: setting.leavePayType,
      },
    };
  }

  async upsertSetting(hospitalId: string, employeeId: string, dto: UpsertPayrollSettingDto) {
    return this.prisma.payrollSetting.upsert({
      where: {
        userId: employeeId,
      },
      update: {
        monthlySalary: new Decimal(dto.monthlySalary),
        allowanceAmount: new Decimal(dto.allowanceAmount ?? 0),
        otherDeductionAmount: new Decimal(dto.otherDeductionAmount ?? 0),
        latePenaltyType: dto.latePenaltyType,
        leavePayType: dto.leavePayType,
      },
      create: {
        hospitalId,
        userId: employeeId,
        monthlySalary: new Decimal(dto.monthlySalary),
        allowanceAmount: new Decimal(dto.allowanceAmount ?? 0),
        otherDeductionAmount: new Decimal(dto.otherDeductionAmount ?? 0),
        latePenaltyType: dto.latePenaltyType,
        leavePayType: dto.leavePayType,
      },
      include: {
        user: true,
      },
    });
  }

  async getSetting(hospitalId: string, employeeId: string) {
    const setting = await this.prisma.payrollSetting.findFirst({
      where: { hospitalId, userId: employeeId },
      include: { user: true },
    });

    if (!setting) {
      throw new NotFoundException('Payroll setting not found');
    }

    return setting;
  }

  async listSettings(hospitalId: string) {
    return this.prisma.payrollSetting.findMany({
      where: { hospitalId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async runPayroll(hospitalId: string, year: number, month: number, employeeId: string) {
    const setting = await this.prisma.payrollSetting.findFirst({
      where: { hospitalId, userId: employeeId },
    });

    if (!setting) {
      throw new NotFoundException('Payroll setting not found');
    }

    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59));

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        hospitalId,
        userId: employeeId,
        attendanceDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const approvedLeaves = await this.prisma.leave.findMany({
      where: {
        hospitalId,
        userId: employeeId,
        status: 'APPROVED',
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { startDate: true, endDate: true },
    });

    const counts = {
      present: 0,
      absent: 0,
      late: 0,
      halfDay: 0,
      onLeave: 0,
    };

    records.forEach((record) => {
      switch (record.status) {
        case AttendanceStatus.PRESENT:
          counts.present += 1;
          if (record.lateByMinutes && record.lateByMinutes > 0) {
            counts.late += 1;
          }
          break;
        case AttendanceStatus.ABSENT:
          counts.absent += 1;
          break;
        case AttendanceStatus.LATE:
          counts.late += 1;
          break;
        case AttendanceStatus.HALF_DAY:
          counts.halfDay += 1;
          break;
        case AttendanceStatus.ON_LEAVE:
        case AttendanceStatus.SICK_LEAVE:
          counts.onLeave += 1;
          break;
        default:
          break;
      }
    });

    const approvedLeaveDays = approvedLeaves.reduce((total, leave) => {
      const overlapStart = leave.startDate > startDate ? leave.startDate : startDate;
      const overlapEnd = leave.endDate < endDate ? leave.endDate : endDate;
      const days =
        Math.floor(
          (Date.UTC(overlapEnd.getUTCFullYear(), overlapEnd.getUTCMonth(), overlapEnd.getUTCDate()) -
            Date.UTC(overlapStart.getUTCFullYear(), overlapStart.getUTCMonth(), overlapStart.getUTCDate())) /
            (1000 * 60 * 60 * 24),
        ) + 1;
      return total + Math.max(0, days);
    }, 0);

    counts.onLeave = Math.max(counts.onLeave, approvedLeaveDays);

    const payroll = this.calculatePayroll(setting, counts, year, month);

    return {
      employeeId,
      year,
      month,
      monthlySalary: payroll.monthlySalary,
      allowanceAmount: payroll.allowanceAmount,
      otherDeductionAmount: payroll.otherDeductionAmount,
      dailyRate: payroll.dailyRate,
      counts,
      deductions: payroll.deductions,
      netPay: payroll.netPay,
      policy: payroll.policy,
    };
  }

  async runPayrollBatch(hospitalId: string, year: number, month: number) {
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59));

    const [users, settings, records, approvedLeaves] = await Promise.all([
      this.prisma.user.findMany({
        where: { hospitalId },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          department: { select: { name: true } },
        },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.payrollSetting.findMany({
        where: { hospitalId },
      }),
      this.prisma.attendanceRecord.findMany({
        where: {
          hospitalId,
          attendanceDate: { gte: startDate, lte: endDate },
        },
        select: {
          userId: true,
          status: true,
          lateByMinutes: true,
        },
      }),
      this.prisma.leave.findMany({
        where: {
          hospitalId,
          status: 'APPROVED',
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
        select: { userId: true, startDate: true, endDate: true },
      }),
    ]);

    const settingsByUser = new Map(settings.map((setting) => [setting.userId, setting]));
    const countsByUser = new Map<
      string,
      { present: number; absent: number; late: number; halfDay: number; onLeave: number }
    >();
    const leaveDaysByUser = new Map<string, number>();

    records.forEach((record) => {
      const counts = countsByUser.get(record.userId) || {
        present: 0,
        absent: 0,
        late: 0,
        halfDay: 0,
        onLeave: 0,
      };

      switch (record.status) {
        case AttendanceStatus.PRESENT:
          counts.present += 1;
          if (record.lateByMinutes && record.lateByMinutes > 0) {
            counts.late += 1;
          }
          break;
        case AttendanceStatus.ABSENT:
          counts.absent += 1;
          break;
        case AttendanceStatus.LATE:
          counts.late += 1;
          break;
        case AttendanceStatus.HALF_DAY:
          counts.halfDay += 1;
          break;
        case AttendanceStatus.ON_LEAVE:
        case AttendanceStatus.SICK_LEAVE:
          counts.onLeave += 1;
          break;
        default:
          break;
      }

      countsByUser.set(record.userId, counts);
    });

    approvedLeaves.forEach((leave) => {
      const overlapStart = leave.startDate > startDate ? leave.startDate : startDate;
      const overlapEnd = leave.endDate < endDate ? leave.endDate : endDate;
      const days =
        Math.floor(
          (Date.UTC(overlapEnd.getUTCFullYear(), overlapEnd.getUTCMonth(), overlapEnd.getUTCDate()) -
            Date.UTC(overlapStart.getUTCFullYear(), overlapStart.getUTCMonth(), overlapStart.getUTCDate())) /
            (1000 * 60 * 60 * 24),
        ) + 1;
      const totalDays = Math.max(0, days);
      if (totalDays <= 0) return;
      leaveDaysByUser.set(leave.userId, (leaveDaysByUser.get(leave.userId) || 0) + totalDays);
    });

    return users.map((user) => {
      const counts = countsByUser.get(user.id) || {
        present: 0,
        absent: 0,
        late: 0,
        halfDay: 0,
        onLeave: 0,
      };
      const approvedLeaveDays = leaveDaysByUser.get(user.id) || 0;
      counts.onLeave = Math.max(counts.onLeave, approvedLeaveDays);
      const setting = settingsByUser.get(user.id);

      if (!setting) {
        return {
          employeeId: user.id,
          employeeName: user.fullName || user.email,
          departmentName: user.department?.name || 'Unassigned',
          role: user.role,
          counts,
          monthlySalary: 0,
          allowanceAmount: 0,
          otherDeductionAmount: 0,
          netPay: 0,
          configured: false,
        };
      }

      const payroll = this.calculatePayroll(setting, counts, year, month);

      return {
        employeeId: user.id,
        employeeName: user.fullName || user.email,
        departmentName: user.department?.name || 'Unassigned',
        role: user.role,
        counts,
        monthlySalary: payroll.monthlySalary,
        allowanceAmount: payroll.allowanceAmount,
        otherDeductionAmount: payroll.otherDeductionAmount,
        netPay: payroll.netPay,
        configured: true,
      };
    });
  }

  async isPayrollGenerated(hospitalId: string, year: number, month: number) {
    const existing = await this.prisma.payrollRecord.findFirst({
      where: { hospitalId, year, month },
      select: { id: true },
    });

    return { generated: !!existing };
  }

  async generatePayrollBatch(hospitalId: string, year: number, month: number) {
    if (month < 1 || month > 12) {
      throw new BadRequestException('Invalid month');
    }

    const existing = await this.prisma.payrollRecord.findFirst({
      where: { hospitalId, year, month },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Payroll for this month has already been generated.');
    }

    const batchData = await this.runPayrollBatch(hospitalId, year, month);

    await this.prisma.$transaction(
      batchData.map((row) =>
        this.prisma.payrollRecord.create({
          data: {
            hospitalId,
            userId: row.employeeId,
            year,
            month,
            monthlySalary: new Decimal(row.monthlySalary || 0),
            allowanceAmount: new Decimal(row.allowanceAmount || 0),
            otherDeductionAmount: new Decimal(row.otherDeductionAmount || 0),
            totalPresent: row.counts.present,
            totalAbsent: row.counts.absent,
            totalLate: row.counts.late,
            totalHalfDay: row.counts.halfDay,
            totalLeave: row.counts.onLeave,
            netPay: new Decimal(row.netPay || 0),
          },
        }),
      ),
    );

    return batchData;
  }
}
