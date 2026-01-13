import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateFeatureFlagDto } from './dto/create-feature-flag.dto';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';
import { FeatureFlagDto } from './dto/feature-flag.dto';
import { RedisService } from '../../common/services/redis.service';

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);
  private readonly CACHE_PREFIX = 'feature_flag:';
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /**
   * Create a new feature flag
   */
  async create(dto: CreateFeatureFlagDto): Promise<FeatureFlagDto> {
    const flag = await this.prisma.featureFlag.create({
      data: {
        hospitalId: dto.hospitalId || null,
        key: dto.key,
        enabled: dto.enabled,
        description: dto.description,
        metadata: dto.metadata || null,
      },
    });

    // Invalidate cache
    await this.invalidateCache(dto.key, dto.hospitalId);

    this.logger.log(`Feature flag created: ${dto.key} (enabled: ${dto.enabled})`);
    return flag as FeatureFlagDto;
  }

  /**
   * Get all feature flags (optionally filtered by hospitalId)
   */
  async findAll(hospitalId?: string): Promise<FeatureFlagDto[]> {
    const flags = await this.prisma.featureFlag.findMany({
      where: hospitalId
        ? {
            OR: [
              { hospitalId: hospitalId }, // Hospital-specific
              { hospitalId: null },       // Global flags
            ],
          }
        : undefined,
      orderBy: { key: 'asc' },
    });

    return flags as FeatureFlagDto[];
  }

  /**
   * Get a single feature flag by ID
   */
  async findOne(id: string): Promise<FeatureFlagDto> {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { id },
    });

    if (!flag) {
      throw new NotFoundException(`Feature flag with ID ${id} not found`);
    }

    return flag as FeatureFlagDto;
  }

  /**
   * Update a feature flag
   */
  async update(id: string, dto: UpdateFeatureFlagDto): Promise<FeatureFlagDto> {
    const existingFlag = await this.findOne(id);

    const updated = await this.prisma.featureFlag.update({
      where: { id },
      data: {
        enabled: dto.enabled !== undefined ? dto.enabled : existingFlag.enabled,
        description: dto.description !== undefined ? dto.description : existingFlag.description,
        metadata: dto.metadata !== undefined ? dto.metadata : existingFlag.metadata,
      },
    });

    // Invalidate cache
    await this.invalidateCache(existingFlag.key, existingFlag.hospitalId);

    this.logger.log(`Feature flag updated: ${existingFlag.key} (enabled: ${updated.enabled})`);
    return updated as FeatureFlagDto;
  }

  /**
   * Delete a feature flag
   */
  async remove(id: string): Promise<void> {
    const flag = await this.findOne(id);

    await this.prisma.featureFlag.delete({
      where: { id },
    });

    // Invalidate cache
    await this.invalidateCache(flag.key, flag.hospitalId);

    this.logger.log(`Feature flag deleted: ${flag.key}`);
  }

  /**
   * Check if a feature is enabled for a given hospital
   * - Hospital-specific flag overrides global flag
   * - Cached for performance
   */
  async isEnabled(key: string, hospitalId?: string): Promise<boolean> {
    const cacheKey = this.getCacheKey(key, hospitalId);

    // Try cache first
    const cached = await this.redis.get<boolean>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Query database
    let flag = null;

    if (hospitalId) {
      // Check hospital-specific flag first
      flag = await this.prisma.featureFlag.findUnique({
        where: {
          hospitalId_key: {
            hospitalId: hospitalId,
            key: key,
          },
        },
      });
    }

    // Fall back to global flag if no hospital-specific flag found
    if (!flag) {
      flag = await this.prisma.featureFlag.findUnique({
        where: {
          hospitalId_key: {
            hospitalId: null,
            key: key,
          },
        },
      });
    }

    const enabled = flag?.enabled ?? false;

    // Cache the result
    await this.redis.set(cacheKey, enabled, this.CACHE_TTL);

    return enabled;
  }

  /**
   * Get cache key
   */
  private getCacheKey(key: string, hospitalId?: string): string {
    return `${this.CACHE_PREFIX}${key}:${hospitalId || 'global'}`;
  }

  /**
   * Invalidate cache for a feature flag
   */
  private async invalidateCache(key: string, hospitalId?: string | null): Promise<void> {
    const keys = [
      this.getCacheKey(key, hospitalId || undefined),
      this.getCacheKey(key, undefined), // Also invalidate global
    ];

    await Promise.all(keys.map((k) => this.redis.del(k)));
    this.logger.debug(`Cache invalidated for feature flag: ${key}`);
  }
}
