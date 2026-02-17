import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import * as request from 'supertest';

/**
 * WORKFLOW 1: Device Enrollment → Attendance Marking
 * 
 * This workflow tests the complete flow from device registration through
 * employee biometric enrollment to attendance marking.
 */
describe('Workflow 1: Device Enrollment → Attendance Marking (Integration)', () => {
  let app: INestApplication;
  let authToken: string;
  let hospitalId: string;
  let deviceId: string;
  let employeeId: string;
  let enrollmentId: string;

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

    // Setup: Get auth token and hospital ID
    // In production, this would use actual login endpoint
    authToken = process.env.TEST_JWT_TOKEN || 'test-token';
    hospitalId = process.env.TEST_HOSPITAL_ID || 'hospital-001';
    employeeId = 'emp-' + Math.random().toString(36).substr(2, 9);
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * Step 1: Register a biometric device
   */
  it('should register a biometric device', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/biometric-devices')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Integration Test Device',
        deviceType: 'FINGERPRINT',
        serialNumber: 'TEST-' + Date.now(),
        ipAddress: '192.168.1.100',
        port: 4370,
        location: 'Test Lab',
        configuration: { timezone: 'Asia/Kolkata', language: 'en' },
      });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.id).toBeDefined();
    expect(registerResponse.body.status).toBe('ACTIVE');
    expect(registerResponse.body.isOnline).toBe(true);

    deviceId = registerResponse.body.id;
  });

  /**
   * Step 2: Verify device is online and active
   */
  it('should verify device status', async () => {
    const statusResponse = await request(app.getHttpServer())
      .get(`/api/v1/biometric-devices/${deviceId}/status`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.status).toBe('ACTIVE');
    expect(statusResponse.body.isOnline).toBe(true);
  });

  /**
   * Step 3: Start enrollment for employee
   */
  it('should start biometric enrollment for employee', async () => {
    const enrollResponse = await request(app.getHttpServer())
      .post('/api/v1/biometric-enrollments')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        employeeId: employeeId,
        enrollmentType: 'FINGERPRINT',
        deviceId: deviceId,
      });

    expect(enrollResponse.status).toBe(201);
    expect(enrollResponse.body.id).toBeDefined();
    expect(enrollResponse.body.status).toBe('IN_PROGRESS');
    expect(enrollResponse.body.enrollmentType).toBe('FINGERPRINT');

    enrollmentId = enrollResponse.body.id;
  });

  /**
   * Step 4: Submit fingerprint for enrollment
   */
  it('should enroll fingerprint template', async () => {
    const fingerprintResponse = await request(app.getHttpServer())
      .post(`/api/v1/biometric-enrollments/${enrollmentId}/fingerprint`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        fingerprintData: 'mock-fingerprint-template-base64-encoded',
        quality: 95,
      });

    expect(fingerprintResponse.status).toBe(200);
    expect(fingerprintResponse.body.status).toBe('VERIFIED');
  });

  /**
   * Step 5: Mark attendance using enrolled biometric
   */
  it('should mark attendance after successful enrollment', async () => {
    const attendanceResponse = await request(app.getHttpServer())
      .post('/api/v1/attendance-records')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        employeeId: employeeId,
        attendanceDate: new Date().toISOString().split('T')[0],
        checkInTime: new Date().toISOString(),
        checkOutTime: null,
        isManualMark: false,
      });

    expect(attendanceResponse.status).toBe(201);
    expect(attendanceResponse.body.status).toBe('PRESENT');
    expect(attendanceResponse.body.employeeId).toBe(employeeId);
  });

  /**
   * Step 6: Verify attendance record was created
   */
  it('should retrieve attendance record', async () => {
    const queryResponse = await request(app.getHttpServer())
      .get(`/api/v1/attendance-records?employeeId=${employeeId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(queryResponse.status).toBe(200);
    expect(Array.isArray(queryResponse.body)).toBe(true);
    expect(queryResponse.body.length).toBeGreaterThan(0);
    expect(queryResponse.body[0].employeeId).toBe(employeeId);
  });

  /**
   * Step 7: Verify device enrollment count increased
   */
  it('should show increased enrollment count on device', async () => {
    const enrollmentCountResponse = await request(app.getHttpServer())
      .get(`/api/v1/biometric-devices/${deviceId}/enrollments/count`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(enrollmentCountResponse.status).toBe(200);
    expect(enrollmentCountResponse.body.enrollmentCount).toBeGreaterThan(0);
  });
});
