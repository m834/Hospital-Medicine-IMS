import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * Global test setup and utilities for integration tests
 */

export class TestSetup {
  private static app: INestApplication;
  private static moduleFixture: TestingModule;

  /**
   * Initialize test application
   */
  static async initializeApp(): Promise<INestApplication> {
    if (this.app) {
      return this.app;
    }

    this.moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    this.app = this.moduleFixture.createNestApplication();

    // Apply same pipes as production
    this.app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await this.app.init();
    return this.app;
  }

  /**
   * Close test application
   */
  static async closeApp(): Promise<void> {
    if (this.app) {
      await this.app.close();
      this.app = null;
    }
  }

  /**
   * Get test application
   */
  static getApp(): INestApplication {
    if (!this.app) {
      throw new Error('Application not initialized. Call initializeApp() first.');
    }
    return this.app;
  }

  /**
   * Get test configuration
   */
  static getTestConfig() {
    return {
      authToken: process.env.TEST_JWT_TOKEN || 'test-token',
      approverToken: process.env.TEST_APPROVER_TOKEN || 'approver-token',
      hospitalId: process.env.TEST_HOSPITAL_ID || 'hospital-001',
      baseUrl: process.env.TEST_BASE_URL || '/api/v1',
    };
  }

  /**
   * Generate random employee ID for testing
   */
  static generateEmployeeId(): string {
    return 'emp-' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Generate random device serial number for testing
   */
  static generateDeviceSerial(): string {
    return 'TEST-' + Date.now();
  }

  /**
   * Get tomorrow's date in YYYY-MM-DD format
   */
  static getTomorrowDate(): string {
    const tomorrow = new Date(Date.now() + 86400000);
    return tomorrow.toISOString().split('T')[0];
  }

  /**
   * Get today's date in YYYY-MM-DD format
   */
  static getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Get date X days from now
   */
  static getDateInDays(days: number): string {
    const date = new Date(Date.now() + days * 86400000);
    return date.toISOString().split('T')[0];
  }

  /**
   * Get ISO timestamp
   */
  static getISOTimestamp(): string {
    return new Date().toISOString();
  }
}
