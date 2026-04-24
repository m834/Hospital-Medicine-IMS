import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TokensService } from './tokens.service';
import { PrismaService } from '@/database/prisma.service';
import { TokenStatus } from '@prisma/client';

describe('TokensService', () => {
  let service: TokensService;
  let prisma: PrismaService;

  const mockClinic = {
    id: 'clinic-1',
    name: 'Cardiology OPD',
    department: { id: 'dept-1', name: 'Cardiology' },
    doctor: { id: 'doctor-1', fullName: 'Dr. John Doe' },
  };

  const mockPatient = {
    id: 'patient-1',
    fullName: 'John Patient',
    nrNumber: 'MRN-2026-0001',
    gender: 'MALE',
  };

  const mockToken = {
    id: 'token-1',
    hospitalId: 'hospital-1',
    clinicId: 'clinic-1',
    tokenNumber: 1,
    tokenDate: new Date(),
    status: TokenStatus.WAITING,
    calledAt: null,
    visits: [{ patient: mockPatient }],
    clinic: mockClinic,
  };

  const mockPrismaService = {
    token: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    clinic: {
      findUnique: jest.fn(),
    },
    visit: {
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokensService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TokensService>(TokensService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findTodayByClinic', () => {
    it('should return today tokens with stats', async () => {
      const tokens = [
        { ...mockToken, status: TokenStatus.WAITING },
        { ...mockToken, id: 'token-2', tokenNumber: 2, status: TokenStatus.CALLED },
        { ...mockToken, id: 'token-3', tokenNumber: 3, status: TokenStatus.COMPLETED },
      ];
      mockPrismaService.token.findMany.mockResolvedValue(tokens);

      const result = await service.findTodayByClinic('clinic-1');

      expect(result.tokens).toHaveLength(3);
      expect(result.current).toBeDefined();
      expect(result.current.status).toBe(TokenStatus.CALLED);
      expect(result.stats.waiting).toBe(1);
      expect(result.stats.completed).toBe(1);
      expect(result.stats.inProgress).toBe(1);
    });

    it('should return null current if no called token', async () => {
      const tokens = [
        { ...mockToken, status: TokenStatus.WAITING },
        { ...mockToken, id: 'token-2', tokenNumber: 2, status: TokenStatus.COMPLETED },
      ];
      mockPrismaService.token.findMany.mockResolvedValue(tokens);

      const result = await service.findTodayByClinic('clinic-1');

      expect(result.current).toBeNull();
      expect(result.stats.inProgress).toBe(0);
    });

    it('should return empty arrays if no tokens', async () => {
      mockPrismaService.token.findMany.mockResolvedValue([]);

      const result = await service.findTodayByClinic('clinic-1');

      expect(result.tokens).toHaveLength(0);
      expect(result.waiting).toHaveLength(0);
      expect(result.completed).toHaveLength(0);
      expect(result.stats.total).toBe(0);
    });
  });

  describe('getCurrentToken', () => {
    it('should return the current called token', async () => {
      const calledToken = { ...mockToken, status: TokenStatus.CALLED };
      mockPrismaService.token.findFirst.mockResolvedValue(calledToken);

      const result = await service.getCurrentToken('clinic-1');

      expect(result).toEqual(calledToken);
      expect(prisma.token.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clinicId: 'clinic-1',
            status: { in: [TokenStatus.CALLED, TokenStatus.IN_PROGRESS] },
          }),
        }),
      );
    });

    it('should return null if no current token', async () => {
      mockPrismaService.token.findFirst.mockResolvedValue(null);

      const result = await service.getCurrentToken('clinic-1');

      expect(result).toBeNull();
    });
  });

  describe('getWaitingTokens', () => {
    it('should return waiting tokens ordered by number', async () => {
      const waitingTokens = [
        { ...mockToken, tokenNumber: 1 },
        { ...mockToken, id: 'token-2', tokenNumber: 2 },
        { ...mockToken, id: 'token-3', tokenNumber: 3 },
      ];
      mockPrismaService.token.findMany.mockResolvedValue(waitingTokens);

      const result = await service.getWaitingTokens('clinic-1');

      expect(result).toHaveLength(3);
      expect(prisma.token.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: TokenStatus.WAITING,
          }),
          orderBy: { tokenNumber: 'asc' },
        }),
      );
    });
  });

  describe('callToken', () => {
    it('should call a token successfully', async () => {
      const calledToken = {
        ...mockToken,
        status: TokenStatus.CALLED,
        calledAt: new Date(),
      };
      mockPrismaService.token.findUnique.mockResolvedValue(mockToken);
      mockPrismaService.token.update.mockResolvedValue(calledToken);
      mockPrismaService.visit.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.callToken('token-1');

      expect(result.status).toBe(TokenStatus.CALLED);
      expect(prisma.token.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'token-1' },
          data: expect.objectContaining({
            status: TokenStatus.CALLED,
            calledAt: expect.any(Date),
          }),
        }),
      );
      expect(prisma.visit.updateMany).toHaveBeenCalledWith({
        where: { tokenId: 'token-1' },
        data: { status: 'CALLED' },
      });
    });

    it('should throw NotFoundException if token not found', async () => {
      mockPrismaService.token.findUnique.mockResolvedValue(null);

      await expect(service.callToken('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getNextTokenNumber', () => {
    it('should return 1 if no tokens exist', async () => {
      mockPrismaService.token.findFirst.mockResolvedValue(null);

      const result = await service.getNextTokenNumber('clinic-1');

      expect(result).toBe(1);
    });

    it('should return next number after last token', async () => {
      mockPrismaService.token.findFirst.mockResolvedValue({ tokenNumber: 15 });

      const result = await service.getNextTokenNumber('clinic-1');

      expect(result).toBe(16);
    });
  });

  describe('getDisplayData', () => {
    it('should return display data for TV screens', async () => {
      mockPrismaService.clinic.findUnique.mockResolvedValue(mockClinic);
      mockPrismaService.token.findFirst.mockResolvedValue({
        ...mockToken,
        tokenNumber: 5,
        status: TokenStatus.CALLED,
      });
      mockPrismaService.token.findMany.mockResolvedValue([
        { tokenNumber: 6 },
        { tokenNumber: 7 },
        { tokenNumber: 8 },
      ]);

      const result = await service.getDisplayData('clinic-1');

      expect(result.clinic.name).toBe('Cardiology OPD');
      expect(result.currentToken).toBe(5);
      expect(result.upcomingTokens).toEqual([6, 7, 8]);
      expect(result.lastUpdated).toBeDefined();
    });

    it('should throw NotFoundException if clinic not found', async () => {
      mockPrismaService.clinic.findUnique.mockResolvedValue(null);

      await expect(service.getDisplayData('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return null currentToken if no called token', async () => {
      mockPrismaService.clinic.findUnique.mockResolvedValue(mockClinic);
      mockPrismaService.token.findFirst.mockResolvedValue(null);
      mockPrismaService.token.findMany.mockResolvedValue([]);

      const result = await service.getDisplayData('clinic-1');

      expect(result.currentToken).toBeNull();
      expect(result.upcomingTokens).toEqual([]);
    });
  });
});
