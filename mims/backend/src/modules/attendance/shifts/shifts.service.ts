import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { Shift, EmployeeShift } from '@prisma/client';
import {
  CreateShiftDto,
  UpdateShiftDto,
  AssignShiftToEmployeeDto,
  BulkAssignShiftDto,
  QueryShiftsDto,
  QueryEmployeeShiftsDto,
  ShiftRotationDto,
  CheckShiftConflictDto,
  RemoveEmployeeShiftDto,
} from './dto/shifts.dto';

@Injectable()
export class ShiftsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new shift
   */
  async createShift(hospitalId: string, dto: CreateShiftDto): Promise<Shift> {
    // Generate unique code from shift name
    const code = `${dto.name.replace(/\s+/g, '_').toUpperCase()}_${Date.now()}`;

    return this.prisma.shift.create({
      data: {
        hospitalId,
        name: dto.name,
        code: code.substring(0, 50),
        startTime: `${dto.startTime.toString().padStart(2, '0')}:${(dto.startMinute || 0).toString().padStart(2, '0')}`,
        endTime: `${dto.endTime.toString().padStart(2, '0')}:${(dto.endMinute || 0).toString().padStart(2, '0')}`,
        breakDurationMinutes: dto.breakDurationMinutes || 0,
        gracePeriodMinutes: dto.gracePeriodMinutes || 15,
        isActive: dto.isActive ?? true,
        description: dto.description,
      },
    });
  }

  /**
   * Get shift by ID
   */
  async getShiftById(hospitalId: string, shiftId: string): Promise<Shift> {
    const shift = await this.prisma.shift.findFirst({
      where: {
        id: shiftId,
        hospitalId,
      },
    });

    if (!shift) {
      throw new NotFoundException(`Shift ${shiftId} not found`);
    }

    return shift;
  }

  /**
   * Get all shifts for hospital
   */
  async getShifts(hospitalId: string, query?: QueryShiftsDto): Promise<Shift[]> {
    const { isActive, skip = 0, take = 10 } = query || {};

    return this.prisma.shift.findMany({
      where: {
        hospitalId,
        ...(isActive !== undefined && { isActive }),
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update shift
   */
  async updateShift(
    hospitalId: string,
    shiftId: string,
    dto: UpdateShiftDto,
  ): Promise<Shift> {
    await this.getShiftById(hospitalId, shiftId);

    return this.prisma.shift.update({
      where: { id: shiftId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.startTime !== undefined && {
          startTime: `${dto.startTime.toString().padStart(2, '0')}:${(dto.startMinute || 0).toString().padStart(2, '0')}`,
        }),
        ...(dto.endTime !== undefined && {
          endTime: `${dto.endTime.toString().padStart(2, '0')}:${(dto.endMinute || 0).toString().padStart(2, '0')}`,
        }),
        ...(dto.breakDurationMinutes !== undefined && {
          breakDurationMinutes: dto.breakDurationMinutes,
        }),
        ...(dto.gracePeriodMinutes !== undefined && {
          gracePeriodMinutes: dto.gracePeriodMinutes,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.description && { description: dto.description }),
      },
    });
  }

  /**
   * Delete/deactivate shift
   */
  async deleteShift(hospitalId: string, shiftId: string): Promise<Shift> {
    await this.getShiftById(hospitalId, shiftId);

    return this.prisma.shift.update({
      where: { id: shiftId },
      data: { isActive: false },
    });
  }

  /**
   * Assign shift to employee
   */
  async assignShiftToEmployee(
    hospitalId: string,
    dto: AssignShiftToEmployeeDto,
  ): Promise<EmployeeShift> {
    // Verify employee exists
    const employee = await this.prisma.user.findUnique({
      where: { id: dto.employeeId },
    });

    if (!employee || employee.hospitalId !== hospitalId) {
      throw new NotFoundException(`Employee ${dto.employeeId} not found`);
    }

    // Verify shift exists
    await this.getShiftById(hospitalId, dto.shiftId);

    // Get current user ID from context (this would need to be passed from controller)
    const userId = employee.id; // Use employee as the assignor for now

    // Check for conflicts
    const conflict = await this.checkShiftConflict(hospitalId, {
      employeeId: dto.employeeId,
      shiftId: dto.shiftId,
      startDate: dto.effectiveFrom,
      endDate: dto.effectiveTo,
    });

    if (conflict.hasConflict) {
      throw new ConflictException(`Shift conflict detected: ${conflict.reason}`);
    }

    return this.prisma.employeeShift.create({
      data: {
        hospitalId,
        userId: dto.employeeId,
        shiftId: dto.shiftId,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        assignmentReason: dto.notes,
        assignedBy: userId,
        isPermanent: !dto.effectiveTo, // If no end date, it's permanent
      },
    });
  }

  /**
   * Bulk assign shift to multiple employees
   */
  async bulkAssignShift(
    hospitalId: string,
    dto: BulkAssignShiftDto,
  ): Promise<any> {
    const results = [];

    for (const employeeId of dto.employeeIds) {
      try {
        const assignment = await this.assignShiftToEmployee(hospitalId, {
          employeeId,
          shiftId: dto.shiftId,
          effectiveFrom: dto.effectiveFrom,
          effectiveTo: dto.effectiveTo,
        });

        results.push({ employeeId, success: true, assignment });
      } catch (error) {
        results.push({ employeeId, success: false, error: error.message });
      }
    }

    return {
      total: dto.employeeIds.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  /**
   * Get employee's current shift
   */
  async getEmployeeCurrentShift(
    hospitalId: string,
    employeeId: string,
  ): Promise<EmployeeShift | null> {
    const now = new Date();

    return this.prisma.employeeShift.findFirst({
      where: {
        userId: employeeId,
        hospitalId,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      include: { shift: true },
    });
  }

  /**
   * Get employee shift history
   * OPTIMIZED: Uses cursor pagination
   */
  async getEmployeeShiftHistory(
    hospitalId: string,
    employeeId: string,
    query?: QueryEmployeeShiftsDto & { cursor?: string },
  ): Promise<EmployeeShift[]> {
    const { startDate, endDate, skip = 0, take = 10, cursor } = query || {};

    const where: any = {
      userId: employeeId,
      hospitalId,
      ...(startDate &&
        endDate && {
          effectiveFrom: { gte: new Date(startDate) },
          effectiveTo: { lte: new Date(endDate) },
        }),
    };

    // OPTIMIZATION: Cursor-based pagination
    if (cursor) {
      where.effectiveFrom = {
        ...where.effectiveFrom,
        lt: new Date(cursor),
      };
    }

    return this.prisma.employeeShift.findMany({
      where,
      skip: cursor ? 0 : skip,
      take,
      orderBy: { effectiveFrom: 'desc' },
      include: { shift: true },
    });
  }

  /**
   * Remove shift assignment from employee
   */
  async removeEmployeeShift(
    hospitalId: string,
    assignmentId: string,
    dto: RemoveEmployeeShiftDto,
  ): Promise<EmployeeShift> {
    const assignment = await this.prisma.employeeShift.findFirst({
      where: {
        id: assignmentId,
        hospitalId,
      },
    });

    if (!assignment) {
      throw new NotFoundException(`Shift assignment ${assignmentId} not found`);
    }

    return this.prisma.employeeShift.update({
      where: { id: assignmentId },
      data: {
        effectiveTo: dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date(),
        assignmentReason: dto.reason ? `Removed: ${dto.reason}` : 'Removed',
      },
    });
  }

  /**
   * Check for shift conflicts
   */
  async checkShiftConflict(
    hospitalId: string,
    dto: CheckShiftConflictDto,
  ): Promise<{ hasConflict: boolean; reason?: string }> {
    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;

    // Check for overlapping shifts
    const overlapping = await this.prisma.employeeShift.findFirst({
      where: {
        userId: dto.employeeId,
        hospitalId,
        NOT: {
          shiftId: dto.shiftId,
        },
        effectiveFrom: { lte: endDate || startDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: startDate } },
        ],
      },
    });

    if (overlapping) {
      return {
        hasConflict: true,
        reason: `Employee already assigned to another shift during this period`,
      };
    }

    return { hasConflict: false };
  }

  /**
   * Get shift roster for department on specific date
   */
  async getShiftRoster(
    hospitalId: string,
    departmentId: string,
    date: string,
  ): Promise<any[]> {
    const queryDate = new Date(date);

    return this.prisma.employeeShift.findMany({
      where: {
        hospitalId,
        user: { departmentId },
        effectiveFrom: { lte: queryDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: queryDate } }],
      },
      include: {
        user: true,
        shift: true,
      },
    });
  }

  /**
   * Create shift rotation for employees
   */
  async createShiftRotation(
    hospitalId: string,
    dto: ShiftRotationDto,
  ): Promise<any> {
    const results = [];
    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);

    for (let i = 0; i < dto.employeeIds.length; i++) {
      const employeeId = dto.employeeIds[i];
      let currentDate = new Date(startDate);
      let shiftIndex = 0;

      try {
        while (currentDate <= endDate) {
          const shiftId = dto.shiftIds[shiftIndex % dto.shiftIds.length];

          await this.assignShiftToEmployee(hospitalId, {
            employeeId,
            shiftId,
            effectiveFrom: currentDate.toISOString(),
            effectiveTo: new Date(currentDate.getTime() + dto.rotationIntervalDays * 24 * 60 * 60 * 1000).toISOString(),
            notes: `Rotation shift ${shiftIndex + 1}/${dto.shiftIds.length}`,
          });

          currentDate = new Date(currentDate.getTime() + dto.rotationIntervalDays * 24 * 60 * 60 * 1000);
          shiftIndex++;
        }

        results.push({ employeeId, success: true });
      } catch (error) {
        results.push({ employeeId, success: false, error: error.message });
      }
    }

    return {
      rotationPattern: dto.shiftIds.length,
      rotationInterval: dto.rotationIntervalDays,
      employees: dto.employeeIds.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  /**
   * Get shift statistics
   */
  async getShiftStatistics(hospitalId: string): Promise<any> {
    const shifts = await this.prisma.shift.findMany({
      where: { hospitalId },
    });

    const employeeShifts = await this.prisma.employeeShift.findMany({
      where: { hospitalId },
    });

    return {
      totalShifts: shifts.length,
      activeShifts: shifts.filter((s) => s.isActive).length,
      inactiveShifts: shifts.filter((s) => !s.isActive).length,
      totalAssignments: employeeShifts.length,
      shiftDetails: shifts.map((s) => ({
        id: s.id,
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        employeeCount: employeeShifts.filter((e) => e.shiftId === s.id).length,
      })),
    };
  }
}
