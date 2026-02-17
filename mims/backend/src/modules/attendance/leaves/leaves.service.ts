import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { Leave, Holiday, LeaveType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  ApplyLeaveDto,
  ProcessLeaveRequestDto,
  UpdateLeaveRequestDto,
  CancelLeaveRequestDto,
  QueryLeaveRequestsDto,
  CreateLeaveTypeDto,
  UpdateLeaveTypeDto,
  CreateHolidayDto,
  UpdateHolidayDto,
  BulkProcessLeaveDto,
  LeaveStatisticsQueryDto,
  ApprovalDecision,
} from './dto/leaves.dto';

@Injectable()
export class LeavesService {
  constructor(private prisma: PrismaService) {}

  // LEAVE REQUEST OPERATIONS

  async applyForLeave(hospitalId: string, userId: string, dto: ApplyLeaveDto): Promise<Leave> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (startDate > endDate) {
      throw new BadRequestException('End date must be after start date');
    }

    const leaveType = await this.prisma.leaveType.findFirst({
      where: { id: dto.leaveTypeId, hospitalId },
    });

    if (!leaveType) {
      throw new NotFoundException(`Leave type not found`);
    }

    const numberOfDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const overlapping = await this.prisma.leave.findFirst({
      where: {
        userId,
        hospitalId,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          { startDate: { lte: endDate } },
          { endDate: { gte: startDate } },
        ],
      },
    });

    if (overlapping) {
      throw new ConflictException('Overlapping leave request found');
    }

    return this.prisma.leave.create({
      data: {
        hospitalId,
        userId,
        leaveTypeId: dto.leaveTypeId,
        startDate,
        endDate,
        totalDays: new Decimal(numberOfDays),
        reason: dto.reason,
        attachmentPath: dto.attachmentUrl,
        status: 'PENDING',
      },
    });
  }

  async getLeaveRequestById(hospitalId: string, leaveId: string): Promise<Leave> {
    const leave = await this.prisma.leave.findFirst({
      where: {
        id: leaveId,
        hospitalId,
      },
      include: {
        leaveType: true,
        user: true,
      },
    });

    if (!leave) {
      throw new NotFoundException(`Leave request not found`);
    }

    return leave;
  }

  async queryLeaveRequests(hospitalId: string, query?: QueryLeaveRequestsDto): Promise<Leave[]> {
    const { status, leaveTypeId, fromDate, toDate, employeeId, skip = 0, take = 10 } = query || {};

    return this.prisma.leave.findMany({
      where: {
        hospitalId,
        ...(status && { status }),
        ...(leaveTypeId && { leaveTypeId }),
        ...(employeeId && { userId: employeeId }),
        ...(fromDate && toDate && {
          startDate: { gte: new Date(fromDate) },
          endDate: { lte: new Date(toDate) },
        }),
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        leaveType: true,
        user: true,
      },
    });
  }

  async updateLeaveRequest(hospitalId: string, leaveId: string, dto: UpdateLeaveRequestDto): Promise<Leave> {
    const leave = await this.getLeaveRequestById(hospitalId, leaveId);

    if (leave.status !== 'PENDING') {
      throw new BadRequestException('Cannot update non-pending leave requests');
    }

    const startDate = dto.startDate ? new Date(dto.startDate) : leave.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : leave.endDate;
    const numberOfDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    return this.prisma.leave.update({
      where: { id: leaveId },
      data: {
        ...(dto.startDate && { startDate }),
        ...(dto.endDate && { endDate }),
        ...(dto.startDate || dto.endDate) && { totalDays: new Decimal(numberOfDays) },
        ...(dto.reason && { reason: dto.reason }),
      },
    });
  }

  async processLeaveRequest(
    hospitalId: string,
    leaveId: string,
    approverUserId: string,
    dto: ProcessLeaveRequestDto,
  ): Promise<Leave> {
    const leave = await this.getLeaveRequestById(hospitalId, leaveId);

    if (leave.status !== 'PENDING') {
      throw new BadRequestException('Leave request is no longer pending');
    }

    const status = dto.decision === ApprovalDecision.APPROVED ? 'APPROVED' : 'REJECTED';

    const updated = await this.prisma.leave.update({
      where: { id: leaveId },
      data: {
        status,
        reviewedBy: approverUserId,
        reviewedDate: new Date(),
        reviewComments: dto.comments,
      },
    });

    if (status === 'APPROVED') {
      await this.createLeaveAttendanceRecords(hospitalId, leave);
    }

    return updated;
  }

  async cancelLeaveRequest(hospitalId: string, leaveId: string, dto: CancelLeaveRequestDto): Promise<Leave> {
    const leave = await this.getLeaveRequestById(hospitalId, leaveId);

    if (!['PENDING', 'APPROVED'].includes(leave.status)) {
      throw new BadRequestException('Cannot cancel rejected leave');
    }

    const updated = await this.prisma.leave.update({
      where: { id: leaveId },
      data: {
        status: 'REJECTED',
        rejectionReason: dto.reason,
        rejectedAt: new Date(),
      },
    });

    if (leave.status === 'APPROVED') {
      await this.deleteLeaveAttendanceRecords(leaveId);
    }

    return updated;
  }

  async getLeaveHistory(hospitalId: string, userId: string, query?: QueryLeaveRequestsDto): Promise<Leave[]> {
    const { status, fromDate, toDate, skip = 0, take = 10 } = query || {};

    return this.prisma.leave.findMany({
      where: {
        hospitalId,
        userId,
        ...(status && { status }),
        ...(fromDate && toDate && {
          startDate: { gte: new Date(fromDate) },
          endDate: { lte: new Date(toDate) },
        }),
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { leaveType: true },
    });
  }

  // LEAVE TYPE OPERATIONS

  async createLeaveType(hospitalId: string, dto: CreateLeaveTypeDto): Promise<LeaveType> {
    const code = dto.code || `${dto.name.replace(/\s+/g, '_').toUpperCase()}`;

    return this.prisma.leaveType.create({
      data: {
        hospitalId,
        name: dto.name,
        code: code.substring(0, 50),
        maxDaysPerYear: dto.annualAllowance,
        description: dto.description,
        requiresApproval: dto.requiresApproval ?? true,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async getLeaveType(hospitalId: string, leaveTypeId: string): Promise<LeaveType> {
    const leaveType = await this.prisma.leaveType.findFirst({
      where: { id: leaveTypeId, hospitalId },
    });

    if (!leaveType) {
      throw new NotFoundException(`Leave type not found`);
    }

    return leaveType;
  }

  async getLeaveTypes(hospitalId: string): Promise<LeaveType[]> {
    return this.prisma.leaveType.findMany({
      where: { hospitalId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateLeaveType(hospitalId: string, leaveTypeId: string, dto: UpdateLeaveTypeDto): Promise<LeaveType> {
    await this.getLeaveType(hospitalId, leaveTypeId);

    return this.prisma.leaveType.update({
      where: { id: leaveTypeId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.annualAllowance !== undefined && { maxDaysPerYear: dto.annualAllowance }),
        ...(dto.description && { description: dto.description }),
        ...(dto.requiresApproval !== undefined && { requiresApproval: dto.requiresApproval }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  // HOLIDAY OPERATIONS

  async createHoliday(hospitalId: string, dto: CreateHolidayDto): Promise<Holiday> {
    return this.prisma.holiday.create({
      data: {
        hospitalId,
        name: dto.name,
        holidayDate: new Date(dto.date),
        holidayType: 'PUBLIC',
        description: dto.description,
      },
    });
  }

  async getHoliday(hospitalId: string, holidayId: string): Promise<Holiday> {
    const holiday = await this.prisma.holiday.findFirst({
      where: { id: holidayId, hospitalId },
    });

    if (!holiday) {
      throw new NotFoundException(`Holiday not found`);
    }

    return holiday;
  }

  async getHolidays(hospitalId: string, year?: number): Promise<Holiday[]> {
    const startDate = year ? new Date(`${year}-01-01`) : new Date();
    const endDate = year ? new Date(`${year}-12-31`) : new Date(`${startDate.getFullYear() + 1}-12-31`);

    return this.prisma.holiday.findMany({
      where: {
        hospitalId,
        isActive: true,
        holidayDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { holidayDate: 'asc' },
    });
  }

  async updateHoliday(hospitalId: string, holidayId: string, dto: UpdateHolidayDto): Promise<Holiday> {
    await this.getHoliday(hospitalId, holidayId);

    return this.prisma.holiday.update({
      where: { id: holidayId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.date && { holidayDate: new Date(dto.date) }),
        ...(dto.description && { description: dto.description }),
      },
    });
  }

  async deleteHoliday(hospitalId: string, holidayId: string): Promise<Holiday> {
    await this.getHoliday(hospitalId, holidayId);

    return this.prisma.holiday.update({
      where: { id: holidayId },
      data: { isActive: false },
    });
  }

  // BULK OPERATIONS

  async bulkProcessLeaveRequests(
    hospitalId: string,
    approverUserId: string,
    dto: BulkProcessLeaveDto,
  ): Promise<any> {
    const results = [];

    for (const item of dto.items) {
      try {
        const result = await this.processLeaveRequest(hospitalId, item.leaveRequestId, approverUserId, {
          decision: dto.decision,
          comments: dto.comments,
        });

        results.push({ leaveRequestId: item.leaveRequestId, success: true, result });
      } catch (error) {
        results.push({ leaveRequestId: item.leaveRequestId, success: false, error: error.message });
      }
    }

    return {
      total: dto.items.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  // STATISTICS

  async getLeaveStatistics(hospitalId: string, query?: LeaveStatisticsQueryDto): Promise<any> {
    const year = query?.year || new Date().getFullYear();
    const startDate = query?.fromDate ? new Date(query.fromDate) : new Date(`${year}-01-01`);
    const endDate = query?.toDate ? new Date(query.toDate) : new Date(`${year}-12-31`);

    const leaves = await this.prisma.leave.findMany({
      where: {
        hospitalId,
        ...(query?.employeeId && { userId: query.employeeId }),
        startDate: { gte: startDate },
        endDate: { lte: endDate },
      },
      include: { leaveType: true, user: true },
    });

    const approved = leaves.filter((r) => r.status === 'APPROVED');
    const pending = leaves.filter((r) => r.status === 'PENDING');
    const rejected = leaves.filter((r) => r.status === 'REJECTED');

    const approvedDays = approved.reduce((sum, r) => sum + parseFloat(r.totalDays.toString()), 0);

    return {
      year,
      period: { from: startDate, to: endDate },
      total: leaves.length,
      approved: approved.length,
      pending: pending.length,
      rejected: rejected.length,
      totalApprovedDays: approvedDays,
      byType: this.groupByLeaveType(leaves),
      byStatus: { approved: approved.length, pending: pending.length, rejected: rejected.length },
    };
  }

  // HELPERS

  private async createLeaveAttendanceRecords(hospitalId: string, leave: Leave): Promise<void> {
    const currentDate = new Date(leave.startDate);

    while (currentDate <= leave.endDate) {
      const holiday = await this.prisma.holiday.findFirst({
        where: {
          hospitalId,
          holidayDate: {
            gte: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()),
            lt: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1),
          },
        },
      });

      if (!holiday) {
        await this.prisma.attendanceRecord.create({
          data: {
            hospitalId,
            userId: leave.userId,
            attendanceDate: new Date(currentDate),
            status: 'ON_LEAVE',
            isManualEntry: true,
            leaveId: leave.id,
            remarks: `Leave approved`,
          },
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  private async deleteLeaveAttendanceRecords(leaveId: string): Promise<void> {
    await this.prisma.attendanceRecord.deleteMany({
      where: { leaveId },
    });
  }

  private groupByLeaveType(leaves: any[]): any {
    const grouped = {};

    leaves.forEach((leave) => {
      const typeName = leave.leaveType.name;
      if (!grouped[typeName]) {
        grouped[typeName] = { count: 0, days: 0 };
      }
      grouped[typeName].count += 1;
      grouped[typeName].days += parseFloat(leave.totalDays.toString());
    });

    return grouped;
  }
}
