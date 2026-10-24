import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/services/cache.service';

describe('UsersService', () => {
  let service: UsersService;

  // Every model the permanent delete counts before it erases anyone.
  const counted = {
    patient: { count: jest.fn() },
    receipt: { count: jest.fn() },
    labOrder: { count: jest.fn() },
    visit: { count: jest.fn() },
    referral: { count: jest.fn() },
    admission: { count: jest.fn() },
    operation: { count: jest.fn() },
    prescription: { count: jest.fn() },
    prescriptionMedicine: { count: jest.fn() },
    prescriptionDispatch: { count: jest.fn() },
    medicineTemplate: { count: jest.fn() },
    issueTransaction: { count: jest.fn() },
    returnTransaction: { count: jest.fn() },
    disposalTransaction: { count: jest.fn() },
    transferRequest: { count: jest.fn() },
    purchaseOrder: { count: jest.fn() },
    gRN: { count: jest.fn() },
    expenditure: { count: jest.fn() },
    employeeShift: { count: jest.fn() },
  };

  const prisma: any = {
    user: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    department: { findUnique: jest.fn() },
    subDepartment: { findUnique: jest.fn() },
    pharmacy: { findUnique: jest.fn() },
    auditLog: { create: jest.fn(), deleteMany: jest.fn() },
    ...counted,
    $transaction: jest.fn((run: (tx: any) => unknown) => run(prisma)),
  };
  const cache = { delete: jest.fn() };

  const admin = { role: 'HOSPITAL_ADMIN', hospitalId: 'h1' };
  const staff = { hospitalId: 'h1', role: 'REGISTRATION_STAFF' };

  beforeEach(async () => {
    jest.clearAllMocks();
    // First lookup is the requesting admin, second the user being changed.
    prisma.user.findUnique.mockResolvedValueOnce(admin).mockResolvedValueOnce(staff);
    prisma.user.update.mockResolvedValue({ id: 'u1', hospitalId: 'h1', email: 'sana@x.pk', fullName: 'Sana Iqbal' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  describe('update', () => {
    it('moves a user to another department of the same hospital', async () => {
      prisma.department.findUnique.mockResolvedValue({ hospitalId: 'h1' });

      await service.update('u1', { departmentId: 'd2', subDepartmentId: null }, 'admin-1');

      expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({ departmentId: 'd2', subDepartmentId: null });
    });

    it('rejects a department from another hospital', async () => {
      prisma.department.findUnique.mockResolvedValue({ hospitalId: 'h2' });

      await expect(service.update('u1', { departmentId: 'd9' }, 'admin-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects a sub-department that is not under the chosen department', async () => {
      prisma.department.findUnique.mockResolvedValue({ hospitalId: 'h1' });
      prisma.subDepartment.findUnique.mockResolvedValue({ departmentId: 'other' });

      await expect(
        service.update('u1', { departmentId: 'd2', subDepartmentId: 's1' }, 'admin-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('drops the signed-in cache so the change applies on the next request', async () => {
      await service.update('u1', { fullName: 'Sana I.' }, 'admin-1');

      expect(cache.delete).toHaveBeenCalledWith('user:auth:u1');
    });
  });

  describe('remove', () => {
    it('deactivates the user, logs who it was, and signs them out', async () => {
      const result = await service.remove('u1', 'admin-1');

      expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({ status: 'INACTIVE' });
      expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
        action: 'DELETE',
        module: 'Users',
        description: 'Deleted user Sana Iqbal (sana@x.pk) — set to INACTIVE',
      });
      expect(cache.delete).toHaveBeenCalledWith('user:auth:u1');
      expect(result).toEqual({ message: 'User deleted successfully' });
    });

    it('refuses to delete your own account', async () => {
      await expect(service.remove('admin-1', 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('removePermanently', () => {
    const testUser = { id: 'u1', hospitalId: 'h1', role: 'REGISTRATION_STAFF', email: 'test@x.pk', fullName: 'Test Desk' };

    beforeEach(() => {
      prisma.user.findUnique.mockReset().mockResolvedValue(testUser);
      for (const model of Object.values(counted)) model.count.mockResolvedValue(0);
      prisma.auditLog.deleteMany.mockResolvedValue({ count: 4 });
    });

    it('erases a user with no records, with their own log entries, and logs the erasure', async () => {
      const result = await service.removePermanently('u1', 'super-1');

      expect(prisma.auditLog.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
      expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
        userId: 'super-1',
        action: 'DELETE',
        module: 'Users',
        description: 'Permanently deleted user Test Desk (test@x.pk), with 4 of their activity-log entries',
      });
      expect(cache.delete).toHaveBeenCalledWith('user:auth:u1');
      expect(result).toEqual({ message: 'User permanently deleted', auditEntriesRemoved: 4 });
    });

    it('refuses while the user has records, and says which', async () => {
      counted.patient.count.mockResolvedValueOnce(12).mockResolvedValue(0);
      counted.receipt.count.mockResolvedValue(30);

      await expect(service.removePermanently('u1', 'super-1')).rejects.toThrow(
        /Test Desk cannot be permanently deleted: they have 12 patients registered, 30 receipts\./,
      );
      expect(prisma.user.delete).not.toHaveBeenCalled();
      expect(prisma.auditLog.deleteMany).not.toHaveBeenCalled();
    });

    it('never erases an admin account or your own', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...testUser, role: 'SUPER_ADMIN' });
      await expect(service.removePermanently('u1', 'super-1')).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.removePermanently('super-1', 'super-1')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });
  });
});
