import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/services/cache.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { AssignPermissionDto } from './dto/assign-permission.dto';

@Injectable()
export class PermissionsService {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  // ============================================
  // PERMISSION CRUD
  // ============================================

  async createPermission(createPermissionDto: CreatePermissionDto) {
    const { resource, action, scope, description } = createPermissionDto;

    // Check if permission already exists
    const existing = await this.prisma.permission.findUnique({
      where: {
        resource_action_scope: { resource, action, scope },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Permission ${resource}:${action}:${scope} already exists`,
      );
    }

    const permission = await this.prisma.permission.create({
      data: { resource, action, scope, description },
    });

    // Invalidate cache
    await this.invalidatePermissionCache();

    return permission;
  }

  async findAllPermissions() {
    return this.prisma.permission.findMany({
      include: {
        rolePermissions: {
          select: {
            role: true,
          },
        },
      },
      orderBy: [{ resource: 'asc' }, { action: 'asc' }, { scope: 'asc' }],
    });
  }

  async findPermissionById(id: string) {
    const permission = await this.prisma.permission.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          select: {
            role: true,
          },
        },
      },
    });

    if (!permission) {
      throw new NotFoundException(`Permission with ID ${id} not found`);
    }

    return permission;
  }

  async updatePermission(id: string, updatePermissionDto: UpdatePermissionDto) {
    await this.findPermissionById(id); // Check if exists

    const permission = await this.prisma.permission.update({
      where: { id },
      data: updatePermissionDto,
    });

    // Invalidate cache
    await this.invalidatePermissionCache();

    return permission;
  }

  async deletePermission(id: string) {
    await this.findPermissionById(id); // Check if exists

    await this.prisma.permission.delete({
      where: { id },
    });

    // Invalidate cache
    await this.invalidatePermissionCache();

    return { message: 'Permission deleted successfully' };
  }

  // ============================================
  // ROLE-PERMISSION MAPPINGS
  // ============================================

  async assignPermissionToRole(assignPermissionDto: AssignPermissionDto) {
    const { role, permissionId } = assignPermissionDto;

    // Check if permission exists
    await this.findPermissionById(permissionId);

    // Check if mapping already exists
    const existing = await this.prisma.rolePermission.findUnique({
      where: {
        role_permissionId: { role, permissionId },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Permission already assigned to role ${role}`,
      );
    }

    const rolePermission = await this.prisma.rolePermission.create({
      data: { role, permissionId },
      include: {
        permission: true,
      },
    });

    // Invalidate cache
    await this.invalidatePermissionCache(role);

    return rolePermission;
  }

  async removePermissionFromRole(role: UserRole, permissionId: string) {
    const existing = await this.prisma.rolePermission.findUnique({
      where: {
        role_permissionId: { role, permissionId },
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Permission not assigned to role ${role}`,
      );
    }

    await this.prisma.rolePermission.delete({
      where: {
        role_permissionId: { role, permissionId },
      },
    });

    // Invalidate cache
    await this.invalidatePermissionCache(role);

    return { message: 'Permission removed from role successfully' };
  }

  async getPermissionsByRole(role: UserRole) {
    const cacheKey = `permissions:role:${role}`;
    
    // Try cache first
    const cached = await this.cacheService.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { role },
      include: {
        permission: true,
      },
    });

    const permissions = rolePermissions.map((rp) => rp.permission);

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, permissions, 300);

    return permissions;
  }

  // ============================================
  // PERMISSION CHECKING
  // ============================================

  async hasPermission(
    role: UserRole,
    resource: string,
    action: string,
    scope?: string,
  ): Promise<boolean> {
    const permissions = await this.getPermissionsByRole(role);

    // Check for exact match or more permissive scope
    return permissions.some((permission) => {
      if (permission.resource !== resource || permission.action !== action) {
        return false;
      }

      // If no scope specified, match any
      if (!scope) return true;

      // 'all' scope covers everything
      if (permission.scope === 'all') return true;

      // Exact scope match
      return permission.scope === scope;
    });
  }

  async getUserPermissions(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        pharmacyId: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const permissions = await this.getPermissionsByRole(user.role);

    return {
      role: user.role,
      pharmacyId: user.pharmacyId,
      permissions: permissions.map((p) => ({
        id: p.id,
        resource: p.resource,
        action: p.action,
        scope: p.scope,
        description: p.description,
      })),
    };
  }

  // ============================================
  // UTILITIES
  // ============================================

  async getAllRoles() {
    return Object.values(UserRole);
  }

  async getRolePermissionMatrix() {
    const roles = await this.getAllRoles();
    const matrix: Record<string, any[]> = {};

    for (const role of roles) {
      matrix[role] = await this.getPermissionsByRole(role);
    }

    return matrix;
  }

  private async invalidatePermissionCache(role?: UserRole) {
    if (role) {
      await this.cacheService.delete(`permissions:role:${role}`);
    } else {
      // Invalidate all role permission caches
      await this.cacheService.deletePattern('permissions:role:.*');
    }
  }
}
