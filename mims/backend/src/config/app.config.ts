import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3001,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  
  // JWT Configuration
  jwtSecret: process.env.JWT_SECRET || 'mims-jwt-secret-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'mims-refresh-secret-key',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  
  // Redis Configuration
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT, 10) || 6379,
  redisPassword: process.env.REDIS_PASSWORD || '',
  
  // File Storage
  storageProvider: process.env.STORAGE_PROVIDER || 'local', // 'local' | 'minio' | 's3'
  storageEndpoint: process.env.STORAGE_ENDPOINT || 'http://localhost:9000',
  storageAccessKey: process.env.STORAGE_ACCESS_KEY || 'minioadmin',
  storageSecretKey: process.env.STORAGE_SECRET_KEY || 'minioadmin',
  storageBucket: process.env.STORAGE_BUCKET || 'mims-files',
  
  // Hospital Configuration
  hospitalTimeZone: process.env.HOSPITAL_TIMEZONE || 'UTC',
  hospitalLocale: process.env.HOSPITAL_LOCALE || 'en-US',
  
  // FIFO Configuration
  fifoAllocationEnabled: process.env.FIFO_ALLOCATION_ENABLED !== 'false',
  autoRedistributionEnabled: process.env.AUTO_REDISTRIBUTION_ENABLED !== 'false',
  redistributionIntervalMinutes: parseInt(process.env.REDISTRIBUTION_INTERVAL_MINUTES, 10) || 60,
  
  // Sync Configuration
  offlineSyncEnabled: process.env.OFFLINE_SYNC_ENABLED !== 'false',
  syncIntervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES, 10) || 15,
}));
