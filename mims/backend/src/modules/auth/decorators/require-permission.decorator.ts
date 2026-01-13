import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'requirePermission';

export interface PermissionRequirement {
  resource: string;
  action: string;
  scope?: string;
}

/**
 * Decorator to require specific permission for a route
 * @param resource - Resource name (e.g., 'medicines', 'inventory')
 * @param action - Action name (e.g., 'read', 'write', 'delete', 'approve')
 * @param scope - Optional scope (e.g., 'all', 'own', 'own_pharmacy')
 * 
 * @example
 * @RequirePermission('medicines', 'write')
 * @RequirePermission('inventory', 'read', 'own_pharmacy')
 */
export const RequirePermission = (
  resource: string,
  action: string,
  scope?: string,
) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, {
    resource,
    action,
    scope,
  } as PermissionRequirement);
