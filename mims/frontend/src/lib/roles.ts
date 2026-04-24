import { UserRole } from './constants';

/**
 * Role descriptions for admin UI and documentation
 */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  [UserRole.MASTER_ADMIN]: 'Ultimate system control with full CRUD access across all hospitals. Can create, read, update, and delete all resources.',
  [UserRole.SUPER_ADMIN]: 'System-wide access across all hospitals with READ and CREATE permissions only. Cannot update or delete existing records.',
  [UserRole.HOSPITAL_ADMIN]: 'Hospital-scoped administrative access with READ and CREATE permissions only. Cannot update or delete existing records.',
  [UserRole.DEPARTMENT_ADMIN]: 'Manages hospital departments and sub-departments. Can assign users to departments.',
  [UserRole.MAIN_PHARMACY_MANAGER]: 'Manages main pharmacy operations including procurement, transfers, and approvals.',
  [UserRole.SUB_PHARMACY_MANAGER]: 'Manages sub-pharmacy operations within their assigned pharmacy.',
  [UserRole.DOCTOR]: 'Can prescribe medicines, manage patient records, and order lab/radiology tests.',
  [UserRole.DOCTOR_ASSISTANT]: 'Assists doctors with patient management. Limited prescription access.',
  [UserRole.REGISTRATION_STAFF]: 'Handles patient registration and basic patient information management.',
  [UserRole.REGISTRATION_STAFF_MANAGER]: 'Manages patient registration operations and has access to patients and lab services.',
  [UserRole.PHARMACY_STAFF]: 'Dispenses medicines and manages basic pharmacy operations.',
  [UserRole.AUDITOR]: 'Read-only access to all operations for auditing and compliance purposes.',
  [UserRole.LAB_TECHNICIAN]: 'Manages lab test orders, sample collection, and result entry.',
  [UserRole.RADIOLOGIST]: 'Manages radiology orders, image uploads, and report generation.',
  [UserRole.NURSE]: 'Patient care operations with access to patient records and medication information.',
  [UserRole.BILLING_STAFF]: 'Handles billing, payment processing, and invoice generation.',
  [UserRole.RECEPTIONIST]: 'Front desk operations including patient registration and appointment scheduling.',
};

/**
 * Permission count by role (for display purposes)
 */
export const ROLE_PERMISSION_COUNTS: Record<UserRole, number> = {
  [UserRole.MASTER_ADMIN]: 55,
  [UserRole.SUPER_ADMIN]: 36,
  [UserRole.HOSPITAL_ADMIN]: 30,
  [UserRole.DEPARTMENT_ADMIN]: 17,
  [UserRole.MAIN_PHARMACY_MANAGER]: 19,
  [UserRole.SUB_PHARMACY_MANAGER]: 12,
  [UserRole.DOCTOR]: 9,
  [UserRole.DOCTOR_ASSISTANT]: 6,
  [UserRole.REGISTRATION_STAFF]: 2,
  [UserRole.REGISTRATION_STAFF_MANAGER]: 5,
  [UserRole.PHARMACY_STAFF]: 6,
  [UserRole.AUDITOR]: 15,
  [UserRole.LAB_TECHNICIAN]: 4,
  [UserRole.RADIOLOGIST]: 4,
  [UserRole.NURSE]: 7,
  [UserRole.BILLING_STAFF]: 4,
  [UserRole.RECEPTIONIST]: 2,
};

/**
 * Role categories for grouping in UI
 */
export const ROLE_CATEGORIES: Record<string, UserRole[]> = {
  SYSTEM: [UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN],
  ADMINISTRATION: [UserRole.HOSPITAL_ADMIN, UserRole.DEPARTMENT_ADMIN, UserRole.AUDITOR],
  PHARMACY: [
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
    UserRole.PHARMACY_STAFF,
  ],
  CLINICAL: [
    UserRole.DOCTOR,
    UserRole.DOCTOR_ASSISTANT,
    UserRole.NURSE,
  ],
  DIAGNOSTICS: [
    UserRole.LAB_TECHNICIAN,
    UserRole.RADIOLOGIST,
  ],
  SUPPORT: [
    UserRole.REGISTRATION_STAFF,
    UserRole.REGISTRATION_STAFF_MANAGER,
    UserRole.BILLING_STAFF,
    UserRole.RECEPTIONIST,
  ],
} as const;

/**
 * Role colors for visual distinction in UI
 */
export const ROLE_COLORS: Record<UserRole, string> = {
  [UserRole.MASTER_ADMIN]: 'bg-rose-100 text-rose-800 border-rose-300',
  [UserRole.SUPER_ADMIN]: 'bg-red-100 text-red-800 border-red-300',
  [UserRole.HOSPITAL_ADMIN]: 'bg-purple-100 text-purple-800 border-purple-300',
  [UserRole.DEPARTMENT_ADMIN]: 'bg-violet-100 text-violet-800 border-violet-300',
  [UserRole.MAIN_PHARMACY_MANAGER]: 'bg-blue-100 text-blue-800 border-blue-300',
  [UserRole.SUB_PHARMACY_MANAGER]: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  [UserRole.DOCTOR]: 'bg-green-100 text-green-800 border-green-300',
  [UserRole.DOCTOR_ASSISTANT]: 'bg-lime-100 text-lime-800 border-lime-300',
  [UserRole.REGISTRATION_STAFF]: 'bg-gray-100 text-gray-800 border-gray-300',
  [UserRole.REGISTRATION_STAFF_MANAGER]: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  [UserRole.PHARMACY_STAFF]: 'bg-sky-100 text-sky-800 border-sky-300',
  [UserRole.AUDITOR]: 'bg-orange-100 text-orange-800 border-orange-300',
  [UserRole.LAB_TECHNICIAN]: 'bg-teal-100 text-teal-800 border-teal-300',
  [UserRole.RADIOLOGIST]: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  [UserRole.NURSE]: 'bg-pink-100 text-pink-800 border-pink-300',
  [UserRole.BILLING_STAFF]: 'bg-amber-100 text-amber-800 border-amber-300',
  [UserRole.RECEPTIONIST]: 'bg-slate-100 text-slate-800 border-slate-300',
};

/**
 * Helper to get role badge component classes
 */
export function getRoleBadgeClass(role: UserRole): string {
  return `inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${ROLE_COLORS[role]}`;
}

/**
 * Helper to format permission key for display
 * e.g., "medicines:read:all" -> "Medicines: Read (All)"
 */
export function formatPermissionKey(key: string): string {
  const [resource, action, scope] = key.split(':');
  const resourceLabel = resource
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  const actionLabel = action.charAt(0).toUpperCase() + action.slice(1);
  const scopeLabel = scope
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  return `${resourceLabel}: ${actionLabel} (${scopeLabel})`;
}
