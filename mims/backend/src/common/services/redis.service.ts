import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService implements OnModuleInit {
  private readonly logger = new Logger(RedisService.name);
  private client: any; // Redis client (optional dependency)
  private isConnected = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    try {
      // Try to import redis (optional dependency)
      const redis = await import('redis');
      
      const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
      
      this.client = redis.createClient({
        url: redisUrl,
      });

      this.client.on('error', (err: Error) => {
        this.logger.error('Redis connection error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        this.logger.log('Redis connected successfully');
        this.isConnected = true;
      });

      await this.client.connect();
    } catch (error) {
      this.logger.warn('Redis not available, using in-memory cache fallback');
      this.isConnected = false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      const stringValue = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, stringValue);
      } else {
        await this.client.set(key, stringValue);
      }
    } catch (error) {
      this.logger.error(`Redis SET error for key ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error(`Redis DEL error for key ${key}:`, error);
    }
  }

  async deletePattern(pattern: string): Promise<number> {
    if (!this.isConnected || !this.client) {
      return 0;
    }

    try {
      // Convert glob-style pattern (e.g. "inventory:abc:.*") to Redis KEYS glob
      // Redis uses * ? [] globs, not regex — replace .* with *
      const redisGlob = pattern.replace(/\.\*/g, '*');
      const keys: string[] = await this.client.keys(redisGlob);
      if (keys.length === 0) return 0;

      await Promise.all(keys.map((key) => this.client.del(key)));
      return keys.length;
    } catch (error) {
      this.logger.error(`Redis KEYS/DEL error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  async flushAll(): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      await this.client.flushAll();
      this.logger.log('Redis cache flushed');
    } catch (error) {
      this.logger.error('Redis FLUSHALL error:', error);
    }
  }
}
