import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@/database/prisma.service';
import { AttendanceStatus, UserStatus } from '@prisma/client';

@Injectable()
export class AttendanceAutoAbsentService {
  private readonly logger = new Logger(AttendanceAutoAbsentService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Run every 30 minutes to mark absences after shift end time
  @Cron('*/30 * * * *')
  async markAbsentEmployees(): Promise<void> {
    const now = new Date();

    const hospitals = await this.prisma.hospital.findMany({
      select: { id: true },
    });

    for (const hospital of hospitals) {
      await this.processHospital(hospital.id, now);
    }
  }

  private async processHospital(hospitalId: string, now: Date): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: {
        hospitalId,
        status: UserStatus.ACTIVE,
      },
      select: { id: true },
    });

    if (users.length === 0) return;

    const activeShift = await this.prisma.shift.findFirst({
      where: { hospitalId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    for (const user of users) {
      const shiftAssignment = await this.prisma.employeeShift.findFirst({
        where: {
          hospitalId,
          userId: user.id,
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
        },
        orderBy: { effectiveFrom: 'desc' },
        include: { shift: true },
      });

      const shift = shiftAssignment?.shift || activeShift;
      if (!shift) continue;

      const shiftWindow = this.getShiftWindow(shift.startTime, shift.endTime, shift.isNightShift, now);
      if (!shiftWindow.shouldMark) continue;

      const attendanceDate = shiftWindow.attendanceDate;

      const existingRecord = await this.prisma.attendanceRecord.findFirst({
        where: {
          hospitalId,
          userId: user.id,
          attendanceDate,
        },
        select: { id: true },
      });

      if (existingRecord) continue;

      const onLeave = await this.prisma.leave.findFirst({
        where: {
          hospitalId,
          userId: user.id,
          status: 'APPROVED',
          startDate: { lte: attendanceDate },
          endDate: { gte: attendanceDate },
        },
        select: { id: true },
      });

      if (onLeave) continue;

      await this.prisma.attendanceRecord.create({
        data: {
          hospitalId,
          userId: user.id,
          attendanceDate,
          status: AttendanceStatus.ABSENT,
          isManualEntry: false,
          remarks: 'Auto-marked absent (no biometric/manual entry)',
          shiftId: shift.id,
        },
      });
    }
  }

  private getShiftWindow(
    startTime: string,
    endTime: string,
    isNightShift: boolean,
    now: Date,
  ): { attendanceDate: Date; shouldMark: boolean } {
    const start = this.applyTime(new Date(now), startTime);
    let end = this.applyTime(new Date(now), endTime);

    if (isNightShift || end <= start) {
      end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    }

    // If night shift and current time is before start, shift started yesterday
    if ((isNightShift || end <= start) && now < start) {
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
    }

    const graceMinutes = 0;
    const cutoff = new Date(end.getTime() + graceMinutes * 60 * 1000);

    return {
      attendanceDate: new Date(start.setHours(0, 0, 0, 0)),
      shouldMark: now >= cutoff,
    };
  }

  private applyTime(base: Date, time: string): Date {
    const [hour, minute] = time.split(':').map((v) => parseInt(v, 10));
    const result = new Date(base);
    result.setHours(hour || 0, minute || 0, 0, 0);
    return result;
  }
}
