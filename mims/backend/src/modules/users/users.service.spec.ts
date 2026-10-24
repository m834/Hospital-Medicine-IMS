import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/services/cache.service';

describe('UsersService', () => {
  let service: UsersService;

  const prisma = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    department: { findUnique: jest.fn() },
    subDepartment: { findUnique: jest.fn() },
    pharmacy: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
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
});
