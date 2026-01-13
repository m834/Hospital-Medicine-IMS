import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { RedisService } from './redis.service';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private cache = new Map<string, CacheEntry<any>>();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(
    @Inject(forwardRef(() => RedisService))
    private readonly redis: RedisService,
  ) {}

  /**
   * Get cached data (tries Redis first, falls back to in-memory)
   */
  async get<T>(key: string): Promise<T | null> {
    // Try Redis first
    const redisValue = await this.redis.get<T>(key);
    if (redisValue !== null) {
      this.cacheHits++;
      this.logger.debug(`Redis cache hit for key: ${key}`);
      return redisValue;
    }

    // Fallback to in-memory cache
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.cacheMisses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.cacheMisses++;
      this.logger.debug(`Cache expired for key: ${key}`);
      return null;
    }

    this.cacheHits++;
    this.logger.debug(`In-memory cache hit for key: ${key}`);
    return entry.data;
  }

  /**
   * Set cache data with optional TTL in milliseconds
   * Stores in both Redis and in-memory for redundancy
   */
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    const ttlMs = ttl || this.defaultTTL;
    const ttlSeconds = Math.floor(ttlMs / 1000);

    // Store in Redis
    await this.redis.set(key, data, ttlSeconds);

    // Also store in-memory as fallback
    const expiresAt = Date.now() + ttlMs;
    this.cache.set(key, { data, expiresAt });
    
    this.logger.debug(`Cache set for key: ${key}, expires in ${ttlMs}ms`);
  }

  /**
   * Delete specific cache entry (both Redis and in-memory)
   */
  async delete(key: string): Promise<boolean> {
    await this.redis.del(key);
    const result = this.cache.delete(key);
    if (result) {
      this.logger.debug(`Cache deleted for key: ${key}`);
    }
    return result;
  }

  /**
   * Clear all cache entries matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    let count = 0;
    const regex = new RegExp(pattern);
    
    // Delete from in-memory cache
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        await this.redis.del(key);
        this.cache.delete(key);
        count++;
      }
    }
    
    if (count > 0) {
      this.logger.debug(`Deleted ${count} cache entries matching pattern: ${pattern}`);
    }
    return count;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.logger.debug('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.cacheHits + this.cacheMisses > 0
      ? (this.cacheHits / (this.cacheHits + this.cacheMisses) * 100).toFixed(2)
      : 0;

    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: `${hitRate}%`,
    };
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    let count = 0;
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        count++;
      }
    }
    
    if (count > 0) {
      this.logger.debug(`Cleaned up ${count} expired cache entries`);
    }
    return count;
  }
}
