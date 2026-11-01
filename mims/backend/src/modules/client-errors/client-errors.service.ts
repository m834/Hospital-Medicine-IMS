import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';
import { CreateClientErrorDto } from './dto/create-client-error.dto';
import { ClientErrorQueryDto } from './dto/client-error-query.dto';

/** Longest text kept per field; anything longer is cut, never refused. */
const MAX_LENGTH = {
  message: 2000,
  stack: 8000,
  route: 500,
  apiUrl: 1000,
  apiMethod: 10,
  appVersion: 50,
  machineId: 100,
  userAgent: 500,
} as const;

const cut = (value: string | undefined, max: number) =>
  value ? value.slice(0, max) : undefined;

export interface ClientErrorReporter {
  userId?: string | null;
  hospitalId?: string | null;
  ipAddress?: string | null;
}

@Injectable()
export class ClientErrorsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Store one report. Who sent it comes from the token (when there is one)
   * and the connection, never from the body, so a report cannot be filed
   * under someone else.
   */
  async record(dto: CreateClientErrorDto, reporter: ClientErrorReporter) {
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : undefined;

    await this.prisma.clientErrorLog.create({
      data: {
        kind: dto.kind,
        message: cut(dto.message, MAX_LENGTH.message) || '(no message)',
        stack: cut(dto.stack, MAX_LENGTH.stack),
        route: cut(dto.route, MAX_LENGTH.route),
        apiUrl: cut(dto.apiUrl, MAX_LENGTH.apiUrl),
        apiMethod: cut(dto.apiMethod?.toUpperCase(), MAX_LENGTH.apiMethod),
        apiStatus: dto.apiStatus,
        appVersion: cut(dto.appVersion, MAX_LENGTH.appVersion),
        machineId: cut(dto.machineId, MAX_LENGTH.machineId),
        userAgent: cut(dto.userAgent, MAX_LENGTH.userAgent),
        occurredAt: occurredAt && !isNaN(occurredAt.getTime()) ? occurredAt : undefined,
        userId: reporter.userId ?? undefined,
        hospitalId: reporter.hospitalId ?? undefined,
        ipAddress: reporter.ipAddress ?? undefined,
      },
    });
  }

  /** Newest first, filtered, one page at a time. */
  async findAll(query: ClientErrorQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 100;

    const where: Prisma.ClientErrorLogWhereInput = {
      ...(query.machineId && { machineId: query.machineId }),
      ...(query.kind && { kind: query.kind }),
      ...(query.hospitalId && { hospitalId: query.hospitalId }),
      ...(query.userId && { userId: query.userId }),
      ...((query.from || query.to) && {
        createdAt: {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to && { lte: new Date(query.to) }),
        },
      }),
      ...(query.search && {
        OR: [
          { message: { contains: query.search, mode: 'insensitive' } },
          { route: { contains: query.search, mode: 'insensitive' } },
          { apiUrl: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.clientErrorLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.clientErrorLog.count({ where }),
    ]);

    return { data, total, page, limit };
  }
}
