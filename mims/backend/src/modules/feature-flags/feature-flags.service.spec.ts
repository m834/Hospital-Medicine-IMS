import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../common/services/redis.service';

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;
  let prisma: any;
  let redis: any;

  const mockFlag = {
    id: 'flag-1',
    hospitalId: 'hospital-1',
    key: 'test_feature',
    enabled: true,
    description: 'Test feature',
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockGlobalFlag = {
    ...mockFlag,
    id: 'flag-global',
    hospitalId: null,
    key: 'global_feature',
  };

  beforeEach(async () => {
    const mockPrismaService = {
      featureFlag: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<FeatureFlagsService>(FeatureFlagsService);
    prisma = module.get(PrismaService);
    redis = module.get(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new feature flag', async () => {
      const dto = {
        hospitalId: 'hospital-1',
        key: 'test_feature',
        enabled: true,
        description: 'Test feature',
      };

      prisma.featureFlag.create.mockResolvedValue(mockFlag);
      redis.del.mockResolvedValue(1);

      const result = await service.create(dto);

      expect(result).toEqual(mockFlag);
      expect(prisma.featureFlag.create).toHaveBeenCalledWith({
        data: {
          hospitalId: dto.hospitalId,
          key: dto.key,
          enabled: dto.enabled,
          description: dto.description,
          metadata: null,
        },
      });
      expect(redis.del).toHaveBeenCalled();
    });

    it('should create a global flag when hospitalId is not provided', async () => {
      const dto = {
        key: 'global_feature',
        enabled: false,
        description: 'Global feature',
      };

      prisma.featureFlag.create.mockResolvedValue(mockGlobalFlag);
      redis.del.mockResolvedValue(1);

      const result = await service.create(dto);

      expect(result.hospitalId).toBeNull();
      expect(prisma.featureFlag.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          hospitalId: null,
        }),
      });
    });
  });

  describe('findAll', () => {
    it('should return all flags when no hospitalId is provided', async () => {
      const flags = [mockFlag, mockGlobalFlag];
      prisma.featureFlag.findMany.mockResolvedValue(flags);

      const result = await service.findAll();

      expect(result).toEqual(flags);
      expect(prisma.featureFlag.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { key: 'asc' },
      });
    });

    it('should return hospital-specific and global flags when hospitalId is provided', async () => {
      const flags = [mockFlag, mockGlobalFlag];
      prisma.featureFlag.findMany.mockResolvedValue(flags);

      const result = await service.findAll('hospital-1');

      expect(result).toEqual(flags);
      expect(prisma.featureFlag.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { hospitalId: 'hospital-1' },
            { hospitalId: null },
          ],
        },
        orderBy: { key: 'asc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a feature flag by id', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue(mockFlag);

      const result = await service.findOne('flag-1');

      expect(result).toEqual(mockFlag);
      expect(prisma.featureFlag.findUnique).toHaveBeenCalledWith({
        where: { id: 'flag-1' },
      });
    });

    it('should throw NotFoundException when flag does not exist', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a feature flag', async () => {
      const dto = {
        enabled: false,
        description: 'Updated description',
      };

      const updatedFlag = { ...mockFlag, ...dto };

      prisma.featureFlag.findUnique.mockResolvedValue(mockFlag);
      prisma.featureFlag.update.mockResolvedValue(updatedFlag);
      redis.del.mockResolvedValue(1);

      const result = await service.update('flag-1', dto);

      expect(result).toEqual(updatedFlag);
      expect(prisma.featureFlag.update).toHaveBeenCalledWith({
        where: { id: 'flag-1' },
        data: {
          enabled: false,
          description: 'Updated description',
          metadata: mockFlag.metadata,
        },
      });
      expect(redis.del).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete a feature flag', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue(mockFlag);
      prisma.featureFlag.delete.mockResolvedValue(mockFlag);
      redis.del.mockResolvedValue(1);

      await service.remove('flag-1');

      expect(prisma.featureFlag.delete).toHaveBeenCalledWith({
        where: { id: 'flag-1' },
      });
      expect(redis.del).toHaveBeenCalled();
    });
  });

  describe('isEnabled', () => {
    it('should return cached value if available', async () => {
      redis.get.mockResolvedValue(true);

      const result = await service.isEnabled('test_feature', 'hospital-1');

      expect(result).toBe(true);
      expect(redis.get).toHaveBeenCalledWith('feature_flag:test_feature:hospital-1');
      expect(prisma.featureFlag.findUnique).not.toHaveBeenCalled();
    });

    it('should check hospital-specific flag first', async () => {
      redis.get.mockResolvedValue(null);
      prisma.featureFlag.findUnique.mockResolvedValueOnce(mockFlag);
      redis.set.mockResolvedValue('OK');

      const result = await service.isEnabled('test_feature', 'hospital-1');

      expect(result).toBe(true);
      expect(prisma.featureFlag.findUnique).toHaveBeenCalledWith({
        where: {
          hospitalId_key: {
            hospitalId: 'hospital-1',
            key: 'test_feature',
          },
        },
      });
      expect(redis.set).toHaveBeenCalledWith(
        'feature_flag:test_feature:hospital-1',
        true,
        300,
      );
    });

    it('should fall back to global flag if hospital-specific flag not found', async () => {
      redis.get.mockResolvedValue(null);
      prisma.featureFlag.findUnique
        .mockResolvedValueOnce(null) // Hospital-specific not found
        .mockResolvedValueOnce(mockGlobalFlag); // Global found
      redis.set.mockResolvedValue('OK');

      const result = await service.isEnabled('global_feature', 'hospital-1');

      expect(result).toBe(true);
      expect(prisma.featureFlag.findUnique).toHaveBeenCalledTimes(2);
      expect(prisma.featureFlag.findUnique).toHaveBeenNthCalledWith(1, {
        where: {
          hospitalId_key: {
            hospitalId: 'hospital-1',
            key: 'global_feature',
          },
        },
      });
      expect(prisma.featureFlag.findUnique).toHaveBeenNthCalledWith(2, {
        where: {
          hospitalId_key: {
            hospitalId: null,
            key: 'global_feature',
          },
        },
      });
    });

    it('should return false if no flag is found', async () => {
      redis.get.mockResolvedValue(null);
      prisma.featureFlag.findUnique.mockResolvedValue(null);
      redis.set.mockResolvedValue('OK');

      const result = await service.isEnabled('non_existent', 'hospital-1');

      expect(result).toBe(false);
      expect(redis.set).toHaveBeenCalledWith(
        'feature_flag:non_existent:hospital-1',
        false,
        300,
      );
    });

    it('should return false if flag exists but is disabled', async () => {
      const disabledFlag = { ...mockFlag, enabled: false };
      redis.get.mockResolvedValue(null);
      prisma.featureFlag.findUnique.mockResolvedValue(disabledFlag);
      redis.set.mockResolvedValue('OK');

      const result = await service.isEnabled('test_feature', 'hospital-1');

      expect(result).toBe(false);
    });

    it('should check global flag when no hospitalId is provided', async () => {
      redis.get.mockResolvedValue(null);
      prisma.featureFlag.findUnique.mockResolvedValue(mockGlobalFlag);
      redis.set.mockResolvedValue('OK');

      const result = await service.isEnabled('global_feature');

      expect(result).toBe(true);
      expect(prisma.featureFlag.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.featureFlag.findUnique).toHaveBeenCalledWith({
        where: {
          hospitalId_key: {
            hospitalId: null,
            key: 'global_feature',
          },
        },
      });
    });

    it('should cache the result with correct TTL', async () => {
      redis.get.mockResolvedValue(null);
      prisma.featureFlag.findUnique.mockResolvedValue(mockFlag);
      redis.set.mockResolvedValue('OK');

      await service.isEnabled('test_feature', 'hospital-1');

      expect(redis.set).toHaveBeenCalledWith(
        'feature_flag:test_feature:hospital-1',
        true,
        300, // 5 minutes
      );
    });

    it('should prioritize hospital-specific flag over global flag', async () => {
      const hospitalFlag = { ...mockFlag, enabled: false };
      const globalFlag = { ...mockGlobalFlag, enabled: true };

      redis.get.mockResolvedValue(null);
      prisma.featureFlag.findUnique.mockResolvedValueOnce(hospitalFlag);
      redis.set.mockResolvedValue('OK');

      const result = await service.isEnabled('test_feature', 'hospital-1');

      expect(result).toBe(false); // Hospital-specific takes precedence
      expect(prisma.featureFlag.findUnique).toHaveBeenCalledTimes(1); // Only checked hospital-specific
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate both hospital-specific and global cache on create', async () => {
      const dto = {
        hospitalId: 'hospital-1',
        key: 'test_feature',
        enabled: true,
        description: 'Test',
      };

      prisma.featureFlag.create.mockResolvedValue(mockFlag);
      redis.del.mockResolvedValue(1);

      await service.create(dto);

      expect(redis.del).toHaveBeenCalledTimes(2);
    });

    it('should invalidate both hospital-specific and global cache on update', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue(mockFlag);
      prisma.featureFlag.update.mockResolvedValue(mockFlag);
      redis.del.mockResolvedValue(1);

      await service.update('flag-1', { enabled: false });

      expect(redis.del).toHaveBeenCalledTimes(2);
    });

    it('should invalidate both hospital-specific and global cache on delete', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue(mockFlag);
      prisma.featureFlag.delete.mockResolvedValue(mockFlag);
      redis.del.mockResolvedValue(1);

      await service.remove('flag-1');

      expect(redis.del).toHaveBeenCalledTimes(2);
    });
  });
});
