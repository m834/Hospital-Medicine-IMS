import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ],
      // PERFORMANCE OPTIMIZATION: Connection pooling configuration
      // These settings are passed to the DATABASE_URL connection string
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    // Log slow queries in development
    if (process.env.NODE_ENV === 'development') {
      // @ts-ignore
      this.$on('query', (e) => {
        if (e.duration > 1000) {
          this.logger.warn(`⚠️ Slow query (${e.duration}ms): ${e.query}`);
        } else {
          this.logger.debug(`Query: ${e.query} (${e.duration}ms)`);
        }
      });
    }
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Database connected successfully');
      this.logger.log(`📊 Connection pool: See DATABASE_URL for pool settings`);
    } catch (error) {
      this.logger.error('❌ Database connection failed', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /**
   * Enable Row-Level Security (RLS) for multi-tenancy
   * This should be called after authentication to set the hospital context
   */
  async enableRLS(hospitalId: string) {
    await this.$executeRaw`SELECT set_config('app.current_hospital_id', ${hospitalId}, true)`;
  }

  /**
   * Clean database (for testing purposes only)
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }

    const models = Reflect.ownKeys(this).filter(
      (key) => typeof key === 'string' && key[0] !== '_' && key[0] !== '$',
    );

    return Promise.all(
      models.map((modelKey) => {
        // @ts-ignore
        if (this[modelKey]?.deleteMany) {
          // @ts-ignore
          return this[modelKey].deleteMany();
        }
      }),
    );
  }
}
