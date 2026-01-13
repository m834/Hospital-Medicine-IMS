import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionsService } from './permissions.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { AssignPermissionDto } from './dto/assign-permission.dto';

@Controller('permissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  // ============================================
  // PERMISSION CRUD
  // ============================================

  @Post()
  @Roles(UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  async createPermission(@Body() createPermissionDto: CreatePermissionDto) {
    return this.permissionsService.createPermission(createPermissionDto);
  }

  @Get()
  @Roles(UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  async findAllPermissions() {
    return this.permissionsService.findAllPermissions();
  }

  @Get(':id')
  @Roles(UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  async findPermissionById(@Param('id') id: string) {
    return this.permissionsService.findPermissionById(id);
  }

  @Put(':id')
  @Roles(UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  async updatePermission(
    @Param('id') id: string,
    @Body() updatePermissionDto: UpdatePermissionDto,
  ) {
    return this.permissionsService.updatePermission(id, updatePermissionDto);
  }

  @Delete(':id')
  @Roles(UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN)
  async deletePermission(@Param('id') id: string) {
    return this.permissionsService.deletePermission(id);
  }

  // ============================================
  // ROLE-PERMISSION MAPPINGS
  // ============================================

  @Post('assign')
  @Roles(UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  async assignPermissionToRole(@Body() assignPermissionDto: AssignPermissionDto) {
    return this.permissionsService.assignPermissionToRole(assignPermissionDto);
  }

  @Delete('role/:role/permission/:permissionId')
  @Roles(UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  async removePermissionFromRole(
    @Param('role') role: UserRole,
    @Param('permissionId') permissionId: string,
  ) {
    return this.permissionsService.removePermissionFromRole(role, permissionId);
  }

  @Get('role/:role')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.AUDITOR,
  )
  async getPermissionsByRole(@Param('role') role: UserRole) {
    return this.permissionsService.getPermissionsByRole(role);
  }

  // ============================================
  // PERMISSION CHECKING
  // ============================================

  @Get('check/:role')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.AUDITOR,
  )
  async checkPermission(
    @Param('role') role: UserRole,
    @Query('resource') resource: string,
    @Query('action') action: string,
    @Query('scope') scope?: string,
  ) {
    const hasPermission = await this.permissionsService.hasPermission(
      role,
      resource,
      action,
      scope,
    );
    return { hasPermission };
  }

  @Get('user/:userId')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.AUDITOR,
  )
  async getUserPermissions(@Param('userId') userId: string) {
    return this.permissionsService.getUserPermissions(userId);
  }

  // ============================================
  // UTILITIES
  // ============================================

  @Get('roles/all')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.AUDITOR,
  )
  async getAllRoles() {
    return this.permissionsService.getAllRoles();
  }

  @Get('matrix/all')
  @Roles(UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  async getRolePermissionMatrix() {
    return this.permissionsService.getRolePermissionMatrix();
  }
}
