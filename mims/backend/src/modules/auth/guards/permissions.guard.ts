import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  REQUIRE_PERMISSION_KEY,
  PermissionRequirement,
} from '../decorators/require-permission.decorator';
import { PermissionsService } from '../../permissions/permissions.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get permission requirement from decorator
    const permissionReq = this.reflector.getAllAndOverride<PermissionRequirement>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!permissionReq) {
      // No permission requirement, allow access
      return true;
    }

    // Get user from request
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user has required permission
    const hasPermission = await this.permissionsService.hasPermission(
      user.role,
      permissionReq.resource,
      permissionReq.action,
      permissionReq.scope,
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `You don't have permission to ${permissionReq.action} ${permissionReq.resource}`,
      );
    }

    return true;
  }
}
