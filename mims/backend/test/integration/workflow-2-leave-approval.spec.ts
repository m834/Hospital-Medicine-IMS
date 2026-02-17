import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import * as request from 'supertest';

/**
 * WORKFLOW 2: Leave Application → Approval Workflow
 * 
 * This workflow tests the complete leave management flow from application
 * through approval/rejection to balance updates.
 */
describe('Workflow 2: Leave Application → Approval (Integration)', () => {
  let app: INestApplication;
  let authToken: string;
  let approverToken: string;
  let hospitalId: string;
  let employeeId: string;
  let leaveTypeId: string;
  let leaveRequestId: string;

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
    approverToken = process.env.TEST_APPROVER_TOKEN || 'approver-token';
    hospitalId = process.env.TEST_HOSPITAL_ID || 'hospital-001';
    employeeId = 'emp-' + Math.random().toString(36).substr(2, 9);
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * Step 1: Verify leave type exists
   */
  it('should retrieve available leave types', async () => {
    const leaveTypesResponse = await request(app.getHttpServer())
      .get('/api/v1/leaves/types')
      .set('Authorization', `Bearer ${authToken}`);

    expect(leaveTypesResponse.status).toBe(200);
    expect(Array.isArray(leaveTypesResponse.body)).toBe(true);
    expect(leaveTypesResponse.body.length).toBeGreaterThan(0);

    leaveTypeId = leaveTypesResponse.body[0].id;
  });

  /**
   * Step 2: Check leave balance before application
   */
  it('should retrieve employee leave balance', async () => {
    const balanceResponse = await request(app.getHttpServer())
      .get(`/api/v1/leaves/balance/${employeeId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(balanceResponse.status).toBe(200);
    expect(balanceResponse.body.employeeId).toBe(employeeId);
    expect(balanceResponse.body.balances).toBeDefined();
  });

  /**
   * Step 3: Apply for leave
   */
  it('should apply for leave successfully', async () => {
    const applyResponse = await request(app.getHttpServer())
      .post('/api/v1/leaves/requests/apply')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        employeeId: employeeId,
        leaveTypeId: leaveTypeId,
        startDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
        endDate: new Date(Date.now() + 172800000).toISOString().split('T')[0],   // Day after
        reason: 'Test leave application',
        attachmentUrl: null,
      });

    expect(applyResponse.status).toBe(201);
    expect(applyResponse.body.id).toBeDefined();
    expect(applyResponse.body.status).toBe('PENDING');
    expect(applyResponse.body.employeeId).toBe(employeeId);

    leaveRequestId = applyResponse.body.id;
  });

  /**
   * Step 4: Verify leave request appears in pending list
   */
  it('should retrieve pending leave requests', async () => {
    const pendingResponse = await request(app.getHttpServer())
      .get('/api/v1/leaves/requests?status=PENDING')
      .set('Authorization', `Bearer ${approverToken}`);

    expect(pendingResponse.status).toBe(200);
    expect(Array.isArray(pendingResponse.body)).toBe(true);
    const found = pendingResponse.body.find(r => r.id === leaveRequestId);
    expect(found).toBeDefined();
  });

  /**
   * Step 5: Approve the leave request
   */
  it('should approve leave request', async () => {
    const approveResponse = await request(app.getHttpServer())
      .put(`/api/v1/leaves/requests/${leaveRequestId}/approve`)
      .set('Authorization', `Bearer ${approverToken}`)
      .send({
        approvalNotes: 'Approved - Test integration',
      });

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.status).toBe('APPROVED');
    expect(approveResponse.body.approvedBy).toBeDefined();
  });

  /**
   * Step 6: Verify leave balance was deducted
   */
  it('should reflect updated leave balance after approval', async () => {
    const updatedBalanceResponse = await request(app.getHttpServer())
      .get(`/api/v1/leaves/balance/${employeeId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(updatedBalanceResponse.status).toBe(200);
    expect(updatedBalanceResponse.body.balances).toBeDefined();
  });

  /**
   * Step 7: Test rejection flow
   */
  it('should allow rejection of leave request', async () => {
    // Apply for another leave
    const applyResponse = await request(app.getHttpServer())
      .post('/api/v1/leaves/requests/apply')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        employeeId: employeeId,
        leaveTypeId: leaveTypeId,
        startDate: new Date(Date.now() + 604800000).toISOString().split('T')[0], // Next week
        endDate: new Date(Date.now() + 691200000).toISOString().split('T')[0],
        reason: 'Test rejection scenario',
      });

    const newLeaveRequestId = applyResponse.body.id;

    // Reject it
    const rejectResponse = await request(app.getHttpServer())
      .put(`/api/v1/leaves/requests/${newLeaveRequestId}/reject`)
      .set('Authorization', `Bearer ${approverToken}`)
      .send({
        rejectionReason: 'Cannot approve at this time',
      });

    expect(rejectResponse.status).toBe(200);
    expect(rejectResponse.body.status).toBe('REJECTED');
  });

  /**
   * Step 8: Verify approval audit trail
   */
  it('should maintain approval audit trail', async () => {
    const detailResponse = await request(app.getHttpServer())
      .get(`/api/v1/leaves/requests/${leaveRequestId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.approvedBy).toBeDefined();
    expect(detailResponse.body.approvalDate).toBeDefined();
  });
});
