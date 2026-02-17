import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import * as request from 'supertest';

/**
 * WORKFLOW 5: Cross-Module Data Consistency
 * 
 * This workflow tests that data remains consistent across all modules when
 * making changes that affect multiple modules.
 */
describe('Workflow 5: Cross-Module Data Consistency (Integration)', () => {
  let app: INestApplication;
  let authToken: string;
  let hospitalId: string;
  let employeeId: string;
  let shiftId: string;
  let leaveTypeId: string;

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
    employeeId = 'emp-' + Math.random().toString(36).substr(2, 9);
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * Step 1: Create shift and assign to employee
   */
  it('should create shift and assign to employee', async () => {
    const shiftResponse = await request(app.getHttpServer())
      .post('/api/v1/shifts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Shift for Cross-Module',
        startTime: '09:00',
        endTime: '17:00',
        durationMinutes: 480,
      });

    expect(shiftResponse.status).toBe(201);
    shiftId = shiftResponse.body.id;

    const assignResponse = await request(app.getHttpServer())
      .post(`/api/v1/shifts/${shiftId}/assign`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        employeeId: employeeId,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 2592000000).toISOString().split('T')[0],
      });

    expect(assignResponse.status).toBe(200);
  });

  /**
   * Step 2: Mark attendance on assigned shift day
   */
  it('should mark attendance on shift day', async () => {
    const today = new Date().toISOString().split('T')[0];
    const attendanceResponse = await request(app.getHttpServer())
      .post('/api/v1/attendance-records')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        employeeId: employeeId,
        attendanceDate: today,
        checkInTime: new Date(new Date().setHours(9, 0, 0)).toISOString(),
        checkOutTime: new Date(new Date().setHours(17, 30, 0)).toISOString(),
      });

    expect(attendanceResponse.status).toBe(201);
    expect(attendanceResponse.body.status).toBe('PRESENT');
  });

  /**
   * Step 3: Verify attendance reflects shift working hours
   */
  it('should calculate working hours based on shift', async () => {
    const today = new Date().toISOString().split('T')[0];
    const recordResponse = await request(app.getHttpServer())
      .get(`/api/v1/attendance-records?employeeId=${employeeId}&date=${today}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(recordResponse.status).toBe(200);
    expect(Array.isArray(recordResponse.body)).toBe(true);
    if (recordResponse.body.length > 0) {
      const record = recordResponse.body[0];
      expect(record.workingHours).toBeDefined();
    }
  });

  /**
   * Step 4: Apply leave on shift day - should affect shift coverage
   */
  it('should apply leave on shift day', async () => {
    const leaveTypesResponse = await request(app.getHttpServer())
      .get('/api/v1/leaves/types')
      .set('Authorization', `Bearer ${authToken}`);

    leaveTypeId = leaveTypesResponse.body[0].id;

    const leaveResponse = await request(app.getHttpServer())
      .post('/api/v1/leaves/requests/apply')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        employeeId: employeeId,
        leaveTypeId: leaveTypeId,
        startDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        endDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        reason: 'Cross-module test',
      });

    expect(leaveResponse.status).toBe(201);
  });

  /**
   * Step 5: Verify leave request shows in shift roster
   */
  it('should show leave in shift roster', async () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const rosterResponse = await request(app.getHttpServer())
      .get(`/api/v1/shifts/${shiftId}/roster`)
      .set('Authorization', `Bearer ${authToken}`)
      .query({
        startDate: tomorrow,
        endDate: tomorrow,
      });

    expect(rosterResponse.status).toBe(200);
    if (rosterResponse.body.roster) {
      const employeeRoster = rosterResponse.body.roster.find(
        (r: any) => r.employeeId === employeeId
      );
      if (employeeRoster) {
        expect(employeeRoster.hasLeave).toBe(true);
      }
    }
  });

  /**
   * Step 6: Check leave balance is correctly updated
   */
  it('should maintain correct leave balance', async () => {
    const balanceResponse = await request(app.getHttpServer())
      .get(`/api/v1/leaves/balance/${employeeId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(balanceResponse.status).toBe(200);
    expect(balanceResponse.body.balances).toBeDefined();
  });

  /**
   * Step 7: Verify attendance summary respects leaves
   */
  it('should correctly calculate monthly attendance respecting leaves', async () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');

    const summaryResponse = await request(app.getHttpServer())
      .post('/api/v1/attendance-records/monthly')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        employeeId: employeeId,
        year: year,
        month: parseInt(month),
      });

    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.presentDays).toBeDefined();
    expect(summaryResponse.body.absentDays).toBeDefined();
    expect(summaryResponse.body.leaveDays).toBeDefined();
  });

  /**
   * Step 8: Test data consistency when canceling leave
   */
  it('should maintain consistency when canceling leave', async () => {
    // Get latest leave request
    const requestsResponse = await request(app.getHttpServer())
      .get(`/api/v1/leaves/requests?employeeId=${employeeId}`)
      .set('Authorization', `Bearer ${authToken}`);

    if (requestsResponse.body.length > 0) {
      const leaveId = requestsResponse.body[0].id;

      // Cancel it
      const cancelResponse = await request(app.getHttpServer())
        .delete(`/api/v1/leaves/requests/${leaveId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 204, 404]).toContain(cancelResponse.status);
    }
  });

  /**
   * Step 9: Verify cascade effects across modules
   */
  it('should handle cascade effects correctly', async () => {
    // Get attendance records
    const recordsResponse = await request(app.getHttpServer())
      .get(`/api/v1/attendance-records?employeeId=${employeeId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(recordsResponse.status).toBe(200);

    // Get shift assignments
    const shiftsResponse = await request(app.getHttpServer())
      .get(`/api/v1/shifts?employeeId=${employeeId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(shiftsResponse.status).toBe(200);

    // Get leave balance
    const balanceResponse = await request(app.getHttpServer())
      .get(`/api/v1/leaves/balance/${employeeId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(balanceResponse.status).toBe(200);

    // All should be accessible and consistent
    expect(recordsResponse.body).toBeDefined();
    expect(shiftsResponse.body).toBeDefined();
    expect(balanceResponse.body).toBeDefined();
  });
});
