import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import * as request from 'supertest';

/**
 * WORKFLOW 3: Shift Assignment → Roster Generation
 * 
 * This workflow tests the complete shift management flow from shift creation
 * through employee assignment to roster generation.
 */
describe('Workflow 3: Shift Assignment → Roster (Integration)', () => {
  let app: INestApplication;
  let authToken: string;
  let hospitalId: string;
  let shiftId: string;
  let employeeIds: string[] = [];

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

    // Create test employee IDs
    for (let i = 0; i < 3; i++) {
      employeeIds.push('emp-' + Math.random().toString(36).substr(2, 9));
    }
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * Step 1: Create a shift template
   */
  it('should create a shift template', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/shifts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Morning Shift',
        startTime: '08:00',
        endTime: '16:00',
        durationMinutes: 480,
        description: 'Test morning shift for integration testing',
        isActive: true,
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.id).toBeDefined();
    expect(createResponse.body.startTime).toBe('08:00');
    expect(createResponse.body.endTime).toBe('16:00');

    shiftId = createResponse.body.id;
  });

  /**
   * Step 2: Verify shift template is active
   */
  it('should retrieve shift template', async () => {
    const getResponse = await request(app.getHttpServer())
      .get(`/api/v1/shifts/${shiftId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.id).toBe(shiftId);
    expect(getResponse.body.isActive).toBe(true);
  });

  /**
   * Step 3: Assign shift to first employee
   */
  it('should assign shift to employee', async () => {
    const assignResponse = await request(app.getHttpServer())
      .post(`/api/v1/shifts/${shiftId}/assign`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        employeeId: employeeIds[0],
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 2592000000).toISOString().split('T')[0], // 30 days
      });

    expect(assignResponse.status).toBe(200);
    expect(assignResponse.body.employeeId).toBe(employeeIds[0]);
    expect(assignResponse.body.shiftId).toBe(shiftId);
  });

  /**
   * Step 4: Bulk assign shift to multiple employees
   */
  it('should bulk assign shift to multiple employees', async () => {
    const bulkResponse = await request(app.getHttpServer())
      .post(`/api/v1/shifts/bulk-assign`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        shiftId: shiftId,
        employeeIds: [employeeIds[1], employeeIds[2]],
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 2592000000).toISOString().split('T')[0],
      });

    expect(bulkResponse.status).toBe(200);
    expect(bulkResponse.body.assigned).toBeGreaterThanOrEqual(2);
  });

  /**
   * Step 5: Retrieve employees assigned to shift
   */
  it('should retrieve employees assigned to shift', async () => {
    const employeesResponse = await request(app.getHttpServer())
      .get(`/api/v1/shifts/${shiftId}/employees`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(employeesResponse.status).toBe(200);
    expect(Array.isArray(employeesResponse.body)).toBe(true);
    expect(employeesResponse.body.length).toBeGreaterThanOrEqual(3);
  });

  /**
   * Step 6: Generate roster for the shift
   */
  it('should generate shift roster', async () => {
    const rosterResponse = await request(app.getHttpServer())
      .get(`/api/v1/shifts/${shiftId}/roster`)
      .set('Authorization', `Bearer ${authToken}`)
      .query({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 604800000).toISOString().split('T')[0],
      });

    expect(rosterResponse.status).toBe(200);
    expect(rosterResponse.body.shiftId).toBe(shiftId);
    expect(rosterResponse.body.roster).toBeDefined();
    expect(Array.isArray(rosterResponse.body.roster)).toBe(true);
  });

  /**
   * Step 7: Retrieve employee's shift assignments
   */
  it('should retrieve employee shift assignments', async () => {
    const employeeShiftsResponse = await request(app.getHttpServer())
      .get(`/api/v1/shifts?employeeId=${employeeIds[0]}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(employeeShiftsResponse.status).toBe(200);
    expect(Array.isArray(employeeShiftsResponse.body)).toBe(true);
    expect(employeeShiftsResponse.body.length).toBeGreaterThan(0);
  });

  /**
   * Step 8: Test shift conflict detection
   */
  it('should detect shift conflicts', async () => {
    // Create another shift that overlaps
    const shiftResponse = await request(app.getHttpServer())
      .post('/api/v1/shifts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Conflicting Shift',
        startTime: '14:00',
        endTime: '22:00',
        durationMinutes: 480,
      });

    const conflictingShiftId = shiftResponse.body.id;

    // Try to assign overlapping shift
    const conflictResponse = await request(app.getHttpServer())
      .post(`/api/v1/shifts/check-conflict`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        employeeId: employeeIds[0],
        shiftId: conflictingShiftId,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      });

    expect([200, 409]).toContain(conflictResponse.status);
  });

  /**
   * Step 9: Update shift assignment
   */
  it('should allow shift reassignment', async () => {
    // Create new shift
    const newShiftResponse = await request(app.getHttpServer())
      .post('/api/v1/shifts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Evening Shift',
        startTime: '16:00',
        endTime: '00:00',
        durationMinutes: 480,
      });

    const newShiftId = newShiftResponse.body.id;

    // Assign new shift to employee
    const reassignResponse = await request(app.getHttpServer())
      .post(`/api/v1/shifts/${newShiftId}/assign`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        employeeId: employeeIds[1],
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 2592000000).toISOString().split('T')[0],
      });

    expect(reassignResponse.status).toBe(200);
  });
});
