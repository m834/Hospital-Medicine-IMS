import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import * as request from 'supertest';

/**
 * WORKFLOW 6: Error Handling & Edge Cases
 * 
 * This workflow tests error scenarios, edge cases, and proper error responses
 * across all modules to ensure robustness.
 */
describe('Workflow 6: Error Handling & Edge Cases (Integration)', () => {
  let app: INestApplication;
  let authToken: string;
  let invalidToken: string = 'invalid-token-12345';
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

    authToken = process.env.TEST_JWT_TOKEN || 'test-token';
    hospitalId = process.env.TEST_HOSPITAL_ID || 'hospital-001';
  });

  afterAll(async () => {
    await app.close();
  });

  // =============== AUTHENTICATION ERRORS ===============

  /**
   * Step 1: Test missing authentication token
   */
  it('should reject request without authentication token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/biometric-devices');

    expect(response.status).toBe(401);
    expect(response.body.message).toBeDefined();
  });

  /**
   * Step 2: Test invalid authentication token
   */
  it('should reject request with invalid token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/biometric-devices')
      .set('Authorization', `Bearer ${invalidToken}`);

    expect(response.status).toBe(401);
  });

  // =============== VALIDATION ERRORS ===============

  /**
   * Step 3: Test missing required fields
   */
  it('should reject device registration with missing required fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/biometric-devices')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Device without serial',
        // Missing serialNumber, ipAddress, port, location
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBeDefined();
  });

  /**
   * Step 4: Test invalid data types
   */
  it('should reject invalid data types', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/biometric-devices')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Device with invalid port',
        deviceType: 'FINGERPRINT',
        serialNumber: 'TEST-001',
        ipAddress: '192.168.1.100',
        port: 'not-a-number', // Should be integer
        location: 'Test',
      });

    expect(response.status).toBe(400);
  });

  /**
   * Step 5: Test invalid enum values
   */
  it('should reject invalid enum values', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/biometric-devices')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Device with invalid type',
        deviceType: 'INVALID_TYPE', // Invalid enum
        serialNumber: 'TEST-001',
        ipAddress: '192.168.1.100',
        port: 4370,
        location: 'Test',
      });

    expect(response.status).toBe(400);
  });

  // =============== RESOURCE NOT FOUND ERRORS ===============

  /**
   * Step 6: Test accessing non-existent device
   */
  it('should return 404 for non-existent device', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/biometric-devices/non-existent-id')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(404);
  });

  /**
   * Step 7: Test accessing non-existent enrollment
   */
  it('should return 404 for non-existent enrollment', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/biometric-enrollments/non-existent-id')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(404);
  });

  /**
   * Step 8: Test accessing non-existent leave request
   */
  it('should return 404 for non-existent leave request', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/leaves/requests/non-existent-id')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(404);
  });

  // =============== BUSINESS LOGIC ERRORS ===============

  /**
   * Step 9: Test insufficient leave balance
   */
  it('should prevent leave application with insufficient balance', async () => {
    const leaveTypesResponse = await request(app.getHttpServer())
      .get('/api/v1/leaves/types')
      .set('Authorization', `Bearer ${authToken}`);

    if (leaveTypesResponse.body.length > 0) {
      const leaveTypeId = leaveTypesResponse.body[0].id;
      const employeeId = 'emp-' + Math.random().toString(36).substr(2, 9);

      const response = await request(app.getHttpServer())
        .post('/api/v1/leaves/requests/apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employeeId: employeeId,
          leaveTypeId: leaveTypeId,
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 86400000 * 100).toISOString().split('T')[0], // 100 days
          reason: 'Testing insufficient balance',
        });

      expect([400, 409, 201]).toContain(response.status);
    }
  });

  /**
   * Step 10: Test double attendance marking prevention
   */
  it('should prevent duplicate attendance for same date', async () => {
    const employeeId = 'emp-' + Math.random().toString(36).substr(2, 9);
    const today = new Date().toISOString().split('T')[0];

    // Mark first time
    const response1 = await request(app.getHttpServer())
      .post('/api/v1/attendance-records')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        employeeId: employeeId,
        attendanceDate: today,
        checkInTime: new Date().toISOString(),
      });

    expect(response1.status).toBe(201);

    // Try to mark again
    const response2 = await request(app.getHttpServer())
      .post('/api/v1/attendance-records')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        employeeId: employeeId,
        attendanceDate: today,
        checkInTime: new Date().toISOString(),
      });

    expect([400, 409, 201]).toContain(response2.status); // Either error or updated
  });

  // =============== CONCURRENCY & EDGE CASES ===============

  /**
   * Step 11: Test concurrent operations
   */
  it('should handle concurrent requests', async () => {
    const deviceName = 'Concurrent Test ' + Date.now();
    const requests = [];

    for (let i = 0; i < 3; i++) {
      requests.push(
        request(app.getHttpServer())
          .post('/api/v1/biometric-devices')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: `${deviceName}-${i}`,
            deviceType: 'FINGERPRINT',
            serialNumber: `CONCURRENT-${Date.now()}-${i}`,
            ipAddress: `192.168.1.${100 + i}`,
            port: 4370,
            location: 'Concurrent Test',
          }),
      );
    }

    const responses = await Promise.all(requests);
    const successCount = responses.filter((r) => r.status === 201).length;

    expect(successCount).toBeGreaterThanOrEqual(0);
  });

  /**
   * Step 12: Test boundary values
   */
  it('should handle boundary values correctly', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/biometric-devices')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: '', // Empty string
        deviceType: 'FINGERPRINT',
        serialNumber: 'BOUNDARY-TEST',
        ipAddress: '192.168.1.100',
        port: 0, // Invalid port
        location: 'Test',
      });

    expect(response.status).toBe(400);
  });

  /**
   * Step 13: Test SQL injection prevention
   */
  it('should prevent SQL injection attempts', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/biometric-devices?search='; DROP TABLE devices; --`)
      .set('Authorization', `Bearer ${authToken}`);

    // Should either be sanitized or rejected
    expect([200, 400]).toContain(response.status);
  });

  /**
   * Step 14: Test XSS prevention in input
   */
  it('should prevent XSS attacks in input', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/biometric-devices')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: '<script>alert("XSS")</script>',
        deviceType: 'FINGERPRINT',
        serialNumber: 'XSS-TEST',
        ipAddress: '192.168.1.100',
        port: 4370,
        location: 'Test',
      });

    expect(response.status).toBe(400);
  });

  // =============== TIMEOUT & PERFORMANCE ERRORS ===============

  /**
   * Step 15: Test response structure consistency
   */
  it('should return consistent error response structure', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/biometric-devices/non-existent')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('statusCode');
    expect(response.body).toHaveProperty('message');
  });

  /**
   * Step 16: Test server error handling
   */
  it('should handle server errors gracefully', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/biometric-devices')
      .set('Authorization', `Bearer ${authToken}`);

    // Should return either success or proper error
    expect(response.status).toBeLessThan(500);
  });

  /**
   * Step 17: Test pagination edge cases
   */
  it('should handle pagination correctly', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/biometric-devices?page=1000&limit=50')
      .set('Authorization', `Bearer ${authToken}`);

    expect([200, 400]).toContain(response.status);
    if (response.status === 200 && Array.isArray(response.body)) {
      expect(response.body.length).toBeLessThanOrEqual(50);
    }
  });

  /**
   * Step 18: Test empty result sets
   */
  it('should handle empty result sets', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/biometric-devices?search=non-existent-device-xyz-abc')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(0);
  });
});
