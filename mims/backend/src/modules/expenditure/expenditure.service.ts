import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { CreateExpenditureDto, UpdateExpenditureDto, ExpenditureFilterDto } from './dto/expenditure.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ExpenditureService {
  constructor(private prisma: PrismaService) {}

  async create(hospitalId: string, userId: string, dto: CreateExpenditureDto) {
    return this.prisma.expenditure.create({
      data: {
        hospital: {
          connect: { id: hospitalId },
        },
        creator: {
          connect: { id: userId },
        },
        date: new Date(dto.date),
        type: dto.type,
        amount: new Decimal(dto.amount),
        description: dto.description,
      },
      include: {
        creator: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });
  }

  async findAll(hospitalId: string, filter?: ExpenditureFilterDto) {
    const where: any = { hospitalId };

    if (filter?.startDate || filter?.endDate) {
      where.date = {};
      if (filter.startDate) where.date.gte = new Date(filter.startDate);
      if (filter.endDate) where.date.lte = new Date(filter.endDate);
    }

    if (filter?.type) {
      where.type = filter.type;
    }

    return this.prisma.expenditure.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(id: string, hospitalId: string) {
    return this.prisma.expenditure.findFirst({
      where: { id, hospitalId },
      include: {
        creator: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });
  }

  async update(id: string, hospitalId: string, dto: UpdateExpenditureDto) {
    const data: any = {};
    if (dto.date) data.date = new Date(dto.date);
    if (dto.type) data.type = dto.type;
    if (dto.amount !== undefined) data.amount = new Decimal(dto.amount);
    if (dto.description !== undefined) data.description = dto.description;

    return this.prisma.expenditure.update({
      where: { id, hospitalId },
      data,
      include: {
        creator: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });
  }

  async remove(id: string, hospitalId: string) {
    return this.prisma.expenditure.delete({
      where: { id, hospitalId },
    });
  }

  async getDailyTotal(hospitalId: string, date: string) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await this.prisma.expenditure.aggregate({
      where: {
        hospitalId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      _sum: {
        amount: true,
      },
    });

    return {
      date,
      total: result._sum.amount || new Decimal(0),
    };
  }

  async getMonthlyTotal(hospitalId: string, year: number, month: number) {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const result = await this.prisma.expenditure.aggregate({
      where: {
        hospitalId,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      _sum: {
        amount: true,
      },
    });

    return {
      year,
      month,
      total: result._sum.amount || new Decimal(0),
    };
  }

  async getYearlyTotal(hospitalId: string, year: number) {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const result = await this.prisma.expenditure.aggregate({
      where: {
        hospitalId,
        date: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
      _sum: {
        amount: true,
      },
    });

    return {
      year,
      total: result._sum.amount || new Decimal(0),
    };
  }

  async getTotalsByPeriod(hospitalId: string, date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    const dateStr = targetDate.toISOString().split('T')[0];

    const [daily, monthly, yearly] = await Promise.all([
      this.getDailyTotal(hospitalId, dateStr),
      this.getMonthlyTotal(hospitalId, year, month),
      this.getYearlyTotal(hospitalId, year),
    ]);

    return { daily, monthly, yearly };
  }
}
