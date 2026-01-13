import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PermissionsService } from './permissions.service';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/services/cache.service';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let prisma: PrismaService;
  let cache: CacheService;

  const mockPermission = {
    id: 'perm-1',
    resource: 'medicines',
    action: 'read',
    scope: 'all',
    description: 'View all medicines',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRolePermission = {
    id: 'role-perm-1',
    role: UserRole.DOCTOR,
    permissionId: 'perm-1',
    createdAt: new Date(),
    permission: mockPermission,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        {
          provide: PrismaService,
          useValue: {
            permission: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            rolePermission: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            delete: jest.fn(),
            deletePattern: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
    prisma = module.get<PrismaService>(PrismaService);
    cache = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPermission', () => {
    it('should create a new permission', async () => {
      const dto = {
        resource: 'medicines',
        action: 'read',
        scope: 'all',
        description: 'View all medicines',
      };

      jest.spyOn(prisma.permission, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.permission, 'create').mockResolvedValue(mockPermission);
      jest.spyOn(cache, 'deletePattern').mockResolvedValue(undefined);

      const result = await service.createPermission(dto);

      expect(result).toEqual(mockPermission);
      expect(prisma.permission.create).toHaveBeenCalledWith({
        data: dto,
      });
      expect(cache.deletePattern).toHaveBeenCalledWith('permissions:role:.*');
    });

    it('should throw ConflictException if permission already exists', async () => {
      const dto = {
        resource: 'medicines',
        action: 'read',
        scope: 'all',
        description: 'View all medicines',
      };

      jest.spyOn(prisma.permission, 'findUnique').mockResolvedValue(mockPermission);

      await expect(service.createPermission(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAllPermissions', () => {
    it('should return all permissions with role mappings', async () => {
      const permissions = [
        { ...mockPermission, rolePermissions: [{ role: UserRole.DOCTOR }] },
      ];

      jest.spyOn(prisma.permission, 'findMany').mockResolvedValue(permissions as any);

      const result = await service.findAllPermissions();

      expect(result).toEqual(permissions);
      expect(prisma.permission.findMany).toHaveBeenCalledWith({
        include: {
          rolePermissions: {
            select: {
              role: true,
            },
          },
        },
        orderBy: [{ resource: 'asc' }, { action: 'asc' }, { scope: 'asc' }],
      });
    });
  });

  describe('findPermissionById', () => {
    it('should return permission by id', async () => {
      jest.spyOn(prisma.permission, 'findUnique').mockResolvedValue({
        ...mockPermission,
        rolePermissions: [],
      } as any);

      const result = await service.findPermissionById('perm-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('perm-1');
    });

    it('should throw NotFoundException if permission not found', async () => {
      jest.spyOn(prisma.permission, 'findUnique').mockResolvedValue(null);

      await expect(service.findPermissionById('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updatePermission', () => {
    it('should update permission', async () => {
      const dto = { description: 'Updated description' };

      jest.spyOn(prisma.permission, 'findUnique').mockResolvedValue({
        ...mockPermission,
        rolePermissions: [],
      } as any);
      jest.spyOn(prisma.permission, 'update').mockResolvedValue({
        ...mockPermission,
        ...dto,
      });
      jest.spyOn(cache, 'deletePattern').mockResolvedValue(undefined);

      const result = await service.updatePermission('perm-1', dto);

      expect(result.description).toBe('Updated description');
      expect(cache.deletePattern).toHaveBeenCalled();
    });
  });

  describe('deletePermission', () => {
    it('should delete permission', async () => {
      jest.spyOn(prisma.permission, 'findUnique').mockResolvedValue({
        ...mockPermission,
        rolePermissions: [],
      } as any);
      jest.spyOn(prisma.permission, 'delete').mockResolvedValue(mockPermission);
      jest.spyOn(cache, 'deletePattern').mockResolvedValue(undefined);

      const result = await service.deletePermission('perm-1');

      expect(result).toEqual({ message: 'Permission deleted successfully' });
      expect(prisma.permission.delete).toHaveBeenCalledWith({
        where: { id: 'perm-1' },
      });
    });
  });

  describe('assignPermissionToRole', () => {
    it('should assign permission to role', async () => {
      const dto = {
        role: UserRole.DOCTOR,
        permissionId: 'perm-1',
      };

      jest.spyOn(prisma.permission, 'findUnique').mockResolvedValue({
        ...mockPermission,
        rolePermissions: [],
      } as any);
      jest.spyOn(prisma.rolePermission, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.rolePermission, 'create').mockResolvedValue(mockRolePermission as any);
      jest.spyOn(cache, 'delete').mockResolvedValue(undefined);

      const result = await service.assignPermissionToRole(dto);

      expect(result).toEqual(mockRolePermission);
      expect(cache.delete).toHaveBeenCalledWith(`permissions:role:${UserRole.DOCTOR}`);
    });

    it('should throw ConflictException if already assigned', async () => {
      const dto = {
        role: UserRole.DOCTOR,
        permissionId: 'perm-1',
      };

      jest.spyOn(prisma.permission, 'findUnique').mockResolvedValue({
        ...mockPermission,
        rolePermissions: [],
      } as any);
      jest.spyOn(prisma.rolePermission, 'findUnique').mockResolvedValue(mockRolePermission as any);

      await expect(service.assignPermissionToRole(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('removePermissionFromRole', () => {
    it('should remove permission from role', async () => {
      jest.spyOn(prisma.rolePermission, 'findUnique').mockResolvedValue(mockRolePermission as any);
      jest.spyOn(prisma.rolePermission, 'delete').mockResolvedValue(mockRolePermission as any);
      jest.spyOn(cache, 'delete').mockResolvedValue(undefined);

      const result = await service.removePermissionFromRole(
        UserRole.DOCTOR,
        'perm-1',
      );

      expect(result).toEqual({ message: 'Permission removed from role successfully' });
      expect(cache.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if mapping not found', async () => {
      jest.spyOn(prisma.rolePermission, 'findUnique').mockResolvedValue(null);

      await expect(
        service.removePermissionFromRole(UserRole.DOCTOR, 'perm-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPermissionsByRole', () => {
    it('should return cached permissions if available', async () => {
      const permissions = [mockPermission];
      jest.spyOn(cache, 'get').mockResolvedValue(permissions);

      const result = await service.getPermissionsByRole(UserRole.DOCTOR);

      expect(result).toEqual(permissions);
      expect(prisma.rolePermission.findMany).not.toHaveBeenCalled();
    });

    it('should fetch and cache permissions if not cached', async () => {
      jest.spyOn(cache, 'get').mockResolvedValue(null);
      jest.spyOn(prisma.rolePermission, 'findMany').mockResolvedValue([mockRolePermission] as any);
      jest.spyOn(cache, 'set').mockResolvedValue(undefined);

      const result = await service.getPermissionsByRole(UserRole.DOCTOR);

      expect(result).toEqual([mockPermission]);
      expect(cache.set).toHaveBeenCalledWith(
        `permissions:role:${UserRole.DOCTOR}`,
        [mockPermission],
        300,
      );
    });
  });

  describe('hasPermission', () => {
    beforeEach(() => {
      jest.spyOn(service, 'getPermissionsByRole').mockResolvedValue([mockPermission]);
    });

    it('should return true for exact match', async () => {
      const result = await service.hasPermission(
        UserRole.DOCTOR,
        'medicines',
        'read',
        'all',
      );

      expect(result).toBe(true);
    });

    it('should return true for "all" scope covering specific scope', async () => {
      const result = await service.hasPermission(
        UserRole.DOCTOR,
        'medicines',
        'read',
        'own_pharmacy',
      );

      expect(result).toBe(true); // 'all' scope covers 'own_pharmacy'
    });

    it('should return false for no match', async () => {
      const result = await service.hasPermission(
        UserRole.DOCTOR,
        'medicines',
        'delete',
        'all',
      );

      expect(result).toBe(false);
    });

    it('should return true when no scope specified', async () => {
      const result = await service.hasPermission(
        UserRole.DOCTOR,
        'medicines',
        'read',
      );

      expect(result).toBe(true);
    });
  });

  describe('getUserPermissions', () => {
    it('should return user permissions', async () => {
      const mockUser = {
        id: 'user-1',
        role: UserRole.DOCTOR,
        pharmacyId: 'pharmacy-1',
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(service, 'getPermissionsByRole').mockResolvedValue([mockPermission]);

      const result = await service.getUserPermissions('user-1');

      expect(result.role).toBe(UserRole.DOCTOR);
      expect(result.pharmacyId).toBe('pharmacy-1');
      expect(result.permissions).toHaveLength(1);
      expect(result.permissions[0].resource).toBe('medicines');
    });

    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(service.getUserPermissions('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAllRoles', () => {
    it('should return all UserRole values', async () => {
      const result = await service.getAllRoles();

      expect(result).toContain(UserRole.MASTER_ADMIN);
      expect(result).toContain(UserRole.SUPER_ADMIN);
      expect(result).toContain(UserRole.HOSPITAL_ADMIN);
      expect(result).toContain(UserRole.DEPARTMENT_ADMIN);
      expect(result).toContain(UserRole.MAIN_PHARMACY_MANAGER);
      expect(result).toContain(UserRole.DOCTOR);
      expect(result).toContain(UserRole.AUDITOR);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('getRolePermissionMatrix', () => {
    it('should return matrix of all roles with their permissions', async () => {
      jest.spyOn(service, 'getPermissionsByRole').mockResolvedValue([mockPermission]);

      const result = await service.getRolePermissionMatrix();

      expect(result).toBeDefined();
      expect(Object.keys(result).length).toBeGreaterThan(0);
      expect(result[UserRole.DOCTOR]).toBeDefined();
    });
  });
});
