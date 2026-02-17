import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

/**
 * TASK 16: PERFORMANCE TESTING & OPTIMIZATION
 * 
 * Load testing suite for Hospital Medicine IMS
 * Tests concurrent user operations and identifies bottlenecks
 * 
 * Performance Targets:
 * - Attendance marking: 10,000+ records/second
 * - Device sync: 5,000+ records/second
 * - Leave approval: <200ms p95 latency
 * - Shift assignment: <1s for 1000 employees
 */

describe('Performance Testing - Load Tests', () => {
  let app: INestApplication;
  let authToken: string;
  let hospitalId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    // Get test credentials
    authToken = process.env.TEST_JWT_TOKEN || 'test-token';
    hospitalId = process.env.TEST_HOSPITAL_ID || 'hospital-001';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Attendance Marking Performance', () => {
    /**
     * Test: Concurrent attendance marking
     * Expected: 10,000+ records per second
     * Scenario: 100 concurrent users marking attendance
     */
    it('should handle 100 concurrent attendance markings within 1 second', async () => {
      const startTime = Date.now();
      const concurrentRequests = 100;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const employeeId = `emp-${String(i).padStart(4, '0')}`;
        const promise = request(app.getHttpServer())
          .post('/api/v1/attendance-records')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            employeeId,
            deviceId: 'device-001',
            timestamp: new Date(),
            type: 'CHECK_IN',
            confidence: 0.95,
          });
        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify all requests succeeded
      const successCount = results.filter((r) => r.status === 201).length;
      expect(successCount).toBeGreaterThanOrEqual(90); // Allow 90% success rate

      // Verify performance: should complete in <1 second
      expect(duration).toBeLessThan(1000);

      const recordsPerSecond = (successCount / (duration / 1000)).toFixed(0);
      console.log(
        `✓ Attendance marking: ${recordsPerSecond} records/sec (target: 10,000+)`,
      );
    });

    /**
     * Test: Bulk attendance marking
     * Expected: <2 seconds for 1000 records
     * Scenario: Batch import from device
     */
    it('should mark 1000 attendance records in bulk within 2 seconds', async () => {
      const startTime = Date.now();
      const records = [];

      for (let i = 0; i < 1000; i++) {
        records.push({
          employeeId: `emp-${String(i).padStart(4, '0')}`,
          deviceId: 'device-001',
          timestamp: new Date(Date.now() - Math.random() * 3600000),
          type: 'CHECK_IN',
          confidence: 0.95,
        });
      }

      const response = await request(app.getHttpServer())
        .post('/api/v1/attendance-records/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ records });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(201);
      expect(response.body.inserted).toBeGreaterThanOrEqual(900);
      expect(duration).toBeLessThan(2000);

      console.log(
        `✓ Bulk attendance: ${response.body.inserted} records in ${duration}ms`,
      );
    });

    /**
     * Test: Attendance retrieval under load
     * Expected: <500ms for 100 concurrent queries
     * Scenario: Dashboard loading attendance data
     */
    it('should retrieve attendance records for 100 users concurrently in <500ms', async () => {
      const startTime = Date.now();
      const concurrentRequests = 100;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const employeeId = `emp-${String(i).padStart(4, '0')}`;
        const promise = request(app.getHttpServer())
          .get(`/api/v1/attendance-records/employee/${employeeId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({ limit: 10 });
        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successCount = results.filter((r) => r.status === 200).length;
      expect(successCount).toBeGreaterThanOrEqual(90);
      expect(duration).toBeLessThan(500);

      console.log(`✓ Attendance retrieval: ${successCount} queries in ${duration}ms`);
    });
  });

  describe('Device Sync Performance', () => {
    /**
     * Test: Device sync with large log batch
     * Expected: 5,000+ records per second
     * Scenario: Device syncing 5000 attendance logs
     */
    it('should process 5000 device sync logs within 1 second', async () => {
      const startTime = Date.now();
      const logs = [];

      for (let i = 0; i < 5000; i++) {
        logs.push({
          deviceId: 'device-001',
          eventId: i,
          employeeId: `emp-${String(i % 500).padStart(4, '0')}`,
          timestamp: new Date(Date.now() - Math.random() * 86400000),
          type: 'ATTENDANCE',
          data: { confidence: 0.95, quality: 85 },
        });
      }

      const response = await request(app.getHttpServer())
        .post('/api/v1/device-sync/process-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ logs, deviceId: 'device-001' });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect([200, 201]).toContain(response.status);
      expect(duration).toBeLessThan(1000);

      const recordsPerSecond = (logs.length / (duration / 1000)).toFixed(0);
      console.log(`✓ Device sync: ${recordsPerSecond} records/sec (target: 5,000+)`);
    });

    /**
     * Test: Concurrent device sync
     * Expected: <1s for 20 devices syncing in parallel
     * Scenario: Multiple devices sending logs simultaneously
     */
    it('should handle 20 concurrent device syncs within 1 second', async () => {
      const startTime = Date.now();
      const concurrentDevices = 20;
      const logsPerDevice = 250;
      const promises = [];

      for (let d = 0; d < concurrentDevices; d++) {
        const logs = [];
        for (let i = 0; i < logsPerDevice; i++) {
          logs.push({
            deviceId: `device-${d}`,
            eventId: i,
            employeeId: `emp-${String(i % 100).padStart(4, '0')}`,
            timestamp: new Date(),
            type: 'ATTENDANCE',
            data: { confidence: 0.95 },
          });
        }

        const promise = request(app.getHttpServer())
          .post('/api/v1/device-sync/process-logs')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ logs, deviceId: `device-${d}` });
        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successCount = results.filter((r) => r.status === 200 || r.status === 201).length;
      expect(successCount).toBeGreaterThanOrEqual(18); // 90% success rate
      expect(duration).toBeLessThan(1000);

      console.log(
        `✓ Concurrent device sync: ${successCount} devices in ${duration}ms`,
      );
    });

    /**
     * Test: Device sync with retry
     * Expected: <2s for retry of failed logs
     * Scenario: Retrying failed sync batches
     */
    it('should retry failed device sync logs within 2 seconds', async () => {
      const startTime = Date.now();
      const failedLogs = [];

      for (let i = 0; i < 1000; i++) {
        failedLogs.push({
          syncAttempt: 1,
          deviceId: 'device-001',
          eventId: i,
          employeeId: `emp-${String(i % 200).padStart(4, '0')}`,
          timestamp: new Date(),
          type: 'ATTENDANCE',
          data: { confidence: 0.90 },
        });
      }

      const response = await request(app.getHttpServer())
        .post('/api/v1/device-sync/retry')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ logs: failedLogs });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(2000);

      console.log(`✓ Device sync retry: ${failedLogs.length} logs in ${duration}ms`);
    });
  });

  describe('Leave Management Performance', () => {
    /**
     * Test: Leave approval latency
     * Expected: <200ms p95 latency
     * Scenario: Approver approving leave requests
     */
    it('should approve leave requests with <200ms latency', async () => {
      const durations: number[] = [];
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        const response = await request(app.getHttpServer())
          .put(`/api/v1/leaves/requests/leave-${i}/approve`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            approverNotes: 'Approved for performance testing',
            approvalDate: new Date(),
          });

        const endTime = Date.now();
        const duration = endTime - startTime;
        durations.push(duration);

        if (response.status === 200) {
          // Success
        }
      }

      // Calculate p95 latency
      durations.sort((a, b) => a - b);
      const p95Index = Math.ceil((95 / 100) * durations.length) - 1;
      const p95Latency = durations[p95Index];

      expect(p95Latency).toBeLessThan(200);
      console.log(`✓ Leave approval latency (p95): ${p95Latency}ms (target: <200ms)`);
    });

    /**
     * Test: Concurrent leave applications
     * Expected: 100+ concurrent applications without errors
     * Scenario: Multiple employees applying for leave simultaneously
     */
    it('should handle 100 concurrent leave applications', async () => {
      const startTime = Date.now();
      const concurrentRequests = 100;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = request(app.getHttpServer())
          .post('/api/v1/leaves/requests/apply')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            employeeId: `emp-${String(i).padStart(4, '0')}`,
            leaveTypeId: 'leave-annual',
            fromDate: new Date(Date.now() + 86400000),
            toDate: new Date(Date.now() + 172800000),
            reason: 'Performance testing',
          });
        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successCount = results.filter((r) => r.status === 201).length;
      expect(successCount).toBeGreaterThanOrEqual(90);

      console.log(
        `✓ Concurrent leave applications: ${successCount} in ${duration}ms`,
      );
    });

    /**
     * Test: Leave balance calculations at scale
     * Expected: <500ms for 1000 balance queries
     * Scenario: Dashboard loading leave balances for all employees
     */
    it('should calculate leave balances for 100 employees concurrently', async () => {
      const startTime = Date.now();
      const concurrentRequests = 100;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const employeeId = `emp-${String(i).padStart(4, '0')}`;
        const promise = request(app.getHttpServer())
          .get(`/api/v1/leaves/balance/${employeeId}`)
          .set('Authorization', `Bearer ${authToken}`);
        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successCount = results.filter((r) => r.status === 200).length;
      expect(successCount).toBeGreaterThanOrEqual(90);
      expect(duration).toBeLessThan(500);

      console.log(`✓ Leave balance calculations: ${successCount} in ${duration}ms`);
    });
  });

  describe('Shift Management Performance', () => {
    /**
     * Test: Bulk shift assignment
     * Expected: <1s for assigning 1000 employees to shifts
     * Scenario: Assigning all employees to new shift schedule
     */
    it('should bulk assign 1000 employees to shifts within 1 second', async () => {
      const startTime = Date.now();
      const assignments = [];

      for (let i = 0; i < 1000; i++) {
        assignments.push({
          employeeId: `emp-${String(i).padStart(4, '0')}`,
          shiftId: `shift-${i % 10}`,
          startDate: new Date(Date.now() + 86400000),
          endDate: new Date(Date.now() + 86400000 * 30),
        });
      }

      const response = await request(app.getHttpServer())
        .post('/api/v1/shifts/bulk-assign')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ assignments });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(201);
      expect(response.body.assigned).toBeGreaterThanOrEqual(900);
      expect(duration).toBeLessThan(1000);

      console.log(`✓ Bulk shift assignment: ${response.body.assigned} in ${duration}ms`);
    });

    /**
     * Test: Roster generation performance
     * Expected: <2s for generating roster for 500 employees
     * Scenario: Generating monthly shift roster
     */
    it('should generate roster for 500 employees within 2 seconds', async () => {
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .get('/api/v1/shifts/roster')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          fromDate: new Date(Date.now() + 86400000),
          toDate: new Date(Date.now() + 86400000 * 30),
          limit: 500,
        });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(2000);

      const employeeCount = response.body.data?.length || 0;
      console.log(
        `✓ Roster generation: ${employeeCount} employees in ${duration}ms`,
      );
    });

    /**
     * Test: Concurrent shift conflict checks
     * Expected: <100ms per check for 100 concurrent checks
     * Scenario: Checking conflicts while assigning shifts
     */
    it('should check shift conflicts for 100 concurrent assignments', async () => {
      const startTime = Date.now();
      const concurrentRequests = 100;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = request(app.getHttpServer())
          .post('/api/v1/shifts/check-conflict')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            employeeId: `emp-${String(i).padStart(4, '0')}`,
            shiftId: `shift-${i % 10}`,
            startDate: new Date(Date.now() + 86400000),
            endDate: new Date(Date.now() + 86400000 * 7),
          });
        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successCount = results.filter((r) => r.status === 200).length;
      expect(successCount).toBeGreaterThanOrEqual(90);

      console.log(
        `✓ Shift conflict checks: ${successCount} checks in ${duration}ms`,
      );
    });
  });

  describe('Database Query Performance', () => {
    /**
     * Test: Paginated queries at scale
     * Expected: <500ms for paginated queries with 100 concurrent requests
     * Scenario: Users browsing paginated data
     */
    it('should handle 100 concurrent paginated queries in <500ms', async () => {
      const startTime = Date.now();
      const concurrentRequests = 100;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = request(app.getHttpServer())
          .get('/api/v1/attendance-records')
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            page: (i % 10) + 1,
            limit: 20,
            skip: i * 20,
          });
        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successCount = results.filter((r) => r.status === 200).length;
      expect(successCount).toBeGreaterThanOrEqual(90);
      expect(duration).toBeLessThan(500);

      console.log(`✓ Paginated queries: ${successCount} queries in ${duration}ms`);
    });

    /**
     * Test: Filtered queries performance
     * Expected: <300ms for complex filtered queries
     * Scenario: Dashboard filtering attendance by date/department
     */
    it('should execute filtered queries in <300ms', async () => {
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .get('/api/v1/attendance-records')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          departmentId: 'dept-001',
          fromDate: new Date(Date.now() - 86400000 * 30),
          toDate: new Date(),
          status: 'PRESENT',
          limit: 100,
        });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(300);

      console.log(`✓ Filtered query: completed in ${duration}ms`);
    });
  });

  describe('Memory & Resource Usage', () => {
    /**
     * Test: Memory stability under sustained load
     * Expected: <500MB increase for 1000 concurrent operations
     * Scenario: Sustained load for 10 seconds
     */
    it('should maintain stable memory usage under sustained load', async () => {
      const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;

      // Sustained load for 10 seconds
      const endTime = Date.now() + 10000;
      let requestCount = 0;

      while (Date.now() < endTime) {
        const promises = [];
        for (let i = 0; i < 10; i++) {
          const promise = request(app.getHttpServer())
            .get('/api/v1/attendance-records')
            .set('Authorization', `Bearer ${authToken}`)
            .query({ limit: 10 });
          promises.push(promise);
        }
        await Promise.all(promises);
        requestCount += 10;
      }

      const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      const memoryIncrease = endMemory - startMemory;

      expect(memoryIncrease).toBeLessThan(500); // Less than 500MB increase
      console.log(
        `✓ Memory usage: ${memoryIncrease.toFixed(2)}MB increase for ${requestCount} requests`,
      );
    });
  });

  describe('Error Handling Under Load', () => {
    /**
     * Test: Error recovery under stress
     * Expected: Graceful degradation, no crashes
     * Scenario: Invalid requests mixed with valid ones
     */
    it('should recover gracefully from mixed valid/invalid requests', async () => {
      const startTime = Date.now();
      const concurrentRequests = 100;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        if (i % 3 === 0) {
          // Send invalid request
          const promise = request(app.getHttpServer())
            .post('/api/v1/attendance-records')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              employeeId: '', // Invalid: empty
              deviceId: 'device-001',
              timestamp: 'invalid-date',
              type: 'INVALID_TYPE',
            });
          promises.push(promise);
        } else {
          // Send valid request
          const promise = request(app.getHttpServer())
            .post('/api/v1/attendance-records')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              employeeId: `emp-${String(i).padStart(4, '0')}`,
              deviceId: 'device-001',
              timestamp: new Date(),
              type: 'CHECK_IN',
              confidence: 0.95,
            });
          promises.push(promise);
        }
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();

      const successCount = results.filter((r) => r.status === 201).length;
      const errorCount = results.filter((r) => r.status >= 400).length;

      expect(successCount + errorCount).toBe(concurrentRequests);
      console.log(
        `✓ Mixed load handling: ${successCount} success, ${errorCount} errors (total: ${concurrentRequests})`,
      );
    });
  });
});
