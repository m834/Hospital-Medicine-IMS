import { UserRole } from './constants';

/**
 * Helper functions for role-based access control
 */

/**
 * Roles with full CRUD permissions
 */
export const FULL_CRUD_ROLES = [UserRole.MASTER_ADMIN];

/**
 * Roles with read + create only (no update/delete)
 */
export const READ_CREATE_ONLY_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.HOSPITAL_ADMIN,
];

/**
 * Check if user role can update/delete resources
 */
export function canModifyResources(role: UserRole): boolean {
  return FULL_CRUD_ROLES.includes(role);
}

/**
 * Check if user role is restricted to read + create only
 */
export function isReadCreateOnly(role: UserRole): boolean {
  return READ_CREATE_ONLY_ROLES.includes(role);
}

/**
 * Check if user role has department management permissions
 */
export function canManageDepartments(role: UserRole): boolean {
  return [UserRole.MASTER_ADMIN, UserRole.DEPARTMENT_ADMIN].includes(role);
}

/**
 * Check if user role requires department assignment
 */
export function requiresDepartmentAssignment(role: UserRole): boolean {
  return [
    UserRole.DEPARTMENT_ADMIN,
    UserRole.DOCTOR,
    UserRole.DOCTOR_ASSISTANT,
    UserRole.NURSE,
    UserRole.LAB_TECHNICIAN,
    UserRole.RADIOLOGIST,
  ].includes(role);
}

/**
 * Get available actions for a role
 */
export function getAvailableActions(role: UserRole): {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
} {
  if (FULL_CRUD_ROLES.includes(role)) {
    return {
      canRead: true,
      canCreate: true,
      canUpdate: true,
      canDelete: true,
    };
  }

  if (READ_CREATE_ONLY_ROLES.includes(role)) {
    return {
      canRead: true,
      canCreate: true,
      canUpdate: false,
      canDelete: false,
    };
  }

  // For other roles, depends on specific permissions
  return {
    canRead: true,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
  };
}
