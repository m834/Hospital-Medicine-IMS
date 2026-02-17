import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { TokenQueryDto } from './dto';
import { TokenStatus } from '@prisma/client';

@Injectable()
export class TokensService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get today's tokens for a clinic
   */
  async findTodayByClinic(clinicId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tokens = await this.prisma.token.findMany({
      where: {
        clinicId,
        tokenDate: today,
      },
      include: {
        visits: {
          include: {
            patient: {
              select: {
                id: true,
                fullName: true,
                nrNumber: true,
                gender: true,
              },
            },
          },
        },
        clinic: {
          select: {
            id: true,
            name: true,
            doctor: { select: { id: true, fullName: true } },
          },
        },
      },
      orderBy: { tokenNumber: 'asc' },
    });

    // Get current called token
    const currentToken = tokens.find(
      (t) => t.status === TokenStatus.CALLED || t.status === TokenStatus.IN_PROGRESS,
    );

    // Get waiting tokens
    const waitingTokens = tokens.filter((t) => t.status === TokenStatus.WAITING);

    // Get completed tokens
    const completedTokens = tokens.filter((t) => t.status === TokenStatus.COMPLETED);

    return {
      tokens,
      current: currentToken || null,
      waiting: waitingTokens,
      completed: completedTokens,
      stats: {
        total: tokens.length,
        waiting: waitingTokens.length,
        completed: completedTokens.length,
        inProgress: currentToken ? 1 : 0,
      },
    };
  }

  /**
   * Get current token for a clinic
   */
  async getCurrentToken(clinicId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentToken = await this.prisma.token.findFirst({
      where: {
        clinicId,
        tokenDate: today,
        status: { in: [TokenStatus.CALLED, TokenStatus.IN_PROGRESS] },
      },
      include: {
        visits: {
          include: {
            patient: {
              select: {
                id: true,
                fullName: true,
                nrNumber: true,
              },
            },
          },
        },
        clinic: {
          select: {
            id: true,
            name: true,
            doctor: { select: { id: true, fullName: true } },
            department: { select: { id: true, name: true } },
          },
        },
      },
    });

    return currentToken;
  }

  /**
   * Get waiting tokens for a clinic
   */
  async getWaitingTokens(clinicId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.prisma.token.findMany({
      where: {
        clinicId,
        tokenDate: today,
        status: TokenStatus.WAITING,
      },
      include: {
        visits: {
          include: {
            patient: {
              select: {
                id: true,
                fullName: true,
                nrNumber: true,
              },
            },
          },
        },
      },
      orderBy: { tokenNumber: 'asc' },
    });
  }

  /**
   * Call a specific token
   */
  async callToken(id: string) {
    const token = await this.prisma.token.findUnique({
      where: { id },
      include: {
        visits: {
          include: {
            patient: { select: { id: true, fullName: true, nrNumber: true } },
          },
        },
      },
    });

    if (!token) {
      throw new NotFoundException(`Token with ID ${id} not found`);
    }

    // Update token status
    const updatedToken = await this.prisma.token.update({
      where: { id },
      data: {
        status: TokenStatus.CALLED,
        calledAt: new Date(),
      },
      include: {
        visits: {
          include: {
            patient: { select: { id: true, fullName: true, nrNumber: true } },
          },
        },
        clinic: {
          include: {
            department: { select: { id: true, name: true } },
            doctor: { select: { id: true, fullName: true } },
          },
        },
      },
    });

    // Update associated visit status
    await this.prisma.visit.updateMany({
      where: { tokenId: id },
      data: { status: 'CALLED' },
    });

    return updatedToken;
  }

  /**
   * Get next token number for a clinic
   */
  async getNextTokenNumber(clinicId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastToken = await this.prisma.token.findFirst({
      where: {
        clinicId,
        tokenDate: today,
      },
      orderBy: { tokenNumber: 'desc' },
    });

    return (lastToken?.tokenNumber || 0) + 1;
  }

  /**
   * Get token display data (for TV/display screens)
   */
  async getDisplayData(clinicId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      include: {
        department: { select: { id: true, name: true } },
        doctor: { select: { id: true, fullName: true } },
      },
    });

    if (!clinic) {
      throw new NotFoundException(`Clinic with ID ${clinicId} not found`);
    }

    // Get current token
    const currentToken = await this.prisma.token.findFirst({
      where: {
        clinicId,
        tokenDate: today,
        status: { in: [TokenStatus.CALLED, TokenStatus.IN_PROGRESS] },
      },
      orderBy: { calledAt: 'desc' },
    });

    // Get upcoming tokens
    const upcomingTokens = await this.prisma.token.findMany({
      where: {
        clinicId,
        tokenDate: today,
        status: TokenStatus.WAITING,
      },
      orderBy: { tokenNumber: 'asc' },
      take: 5,
    });

    return {
      clinic: {
        id: clinic.id,
        name: clinic.name,
        department: clinic.department.name,
        doctor: clinic.doctor.fullName,
      },
      currentToken: currentToken?.tokenNumber || null,
      upcomingTokens: upcomingTokens.map((t) => t.tokenNumber),
      lastUpdated: new Date(),
    };
  }
}
