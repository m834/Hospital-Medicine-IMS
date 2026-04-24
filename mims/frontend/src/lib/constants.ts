/**
 * Application Constants
 * Centralized configuration for the M-IMS frontend
 */

// API Configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

// Authentication
export const AUTH_TOKENS = {
  ACCESS_TOKEN: 'mims_access_token',
  REFRESH_TOKEN: 'mims_refresh_token',
  USER_DATA: 'mims_user_data',
  TOKEN_EXPIRY: 'mims_token_expiry',
} as const;

// User Roles
export enum UserRole {
  MASTER_ADMIN = 'MASTER_ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
  HOSPITAL_ADMIN = 'HOSPITAL_ADMIN',
  DEPARTMENT_ADMIN = 'DEPARTMENT_ADMIN',
  MAIN_PHARMACY_MANAGER = 'MAIN_PHARMACY_MANAGER',
  SUB_PHARMACY_MANAGER = 'SUB_PHARMACY_MANAGER',
  DOCTOR = 'DOCTOR',
  DOCTOR_ASSISTANT = 'DOCTOR_ASSISTANT',
  REGISTRATION_STAFF = 'REGISTRATION_STAFF',
  REGISTRATION_STAFF_MANAGER = 'REGISTRATION_STAFF_MANAGER',
  PHARMACY_STAFF = 'PHARMACY_STAFF',
  AUDITOR = 'AUDITOR',
  LAB_TECHNICIAN = 'LAB_TECHNICIAN',
  RADIOLOGIST = 'RADIOLOGIST',
  NURSE = 'NURSE',
  BILLING_STAFF = 'BILLING_STAFF',
  RECEPTIONIST = 'RECEPTIONIST',
}

// Dashboard Routes by Role
export const ROLE_DASHBOARDS: Record<UserRole, string> = {
  [UserRole.MASTER_ADMIN]: '/dashboard/super-admin', // Same as Super Admin
  [UserRole.SUPER_ADMIN]: '/dashboard/super-admin',
  [UserRole.HOSPITAL_ADMIN]: '/dashboard/hospital-admin',
  [UserRole.DEPARTMENT_ADMIN]: '/dashboard/department-admin',
  [UserRole.MAIN_PHARMACY_MANAGER]: '/dashboard/main-pharmacy',
  [UserRole.SUB_PHARMACY_MANAGER]: '/dashboard/sub-pharmacy',
  [UserRole.DOCTOR]: '/dashboard/doctor',
  [UserRole.DOCTOR_ASSISTANT]: '/dashboard/doctor-assistant',
  [UserRole.REGISTRATION_STAFF]: '/dashboard/registration',
  [UserRole.REGISTRATION_STAFF_MANAGER]: '/dashboard/registration',
  [UserRole.PHARMACY_STAFF]: '/dashboard/pharmacy',
  [UserRole.AUDITOR]: '/dashboard/auditor',
  [UserRole.LAB_TECHNICIAN]: '/dashboard/lab-technician',
  [UserRole.RADIOLOGIST]: '/dashboard/radiologist',
  [UserRole.NURSE]: '/dashboard/nurse',
  [UserRole.BILLING_STAFF]: '/dashboard/billing',
  [UserRole.RECEPTIONIST]: '/dashboard/receptionist',
};

// Role Display Names
export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.MASTER_ADMIN]: 'Master Admin',
  [UserRole.SUPER_ADMIN]: 'Super Admin',
  [UserRole.HOSPITAL_ADMIN]: 'Hospital Admin',
  [UserRole.DEPARTMENT_ADMIN]: 'Department Admin',
  [UserRole.MAIN_PHARMACY_MANAGER]: 'Main Pharmacy Manager',
  [UserRole.SUB_PHARMACY_MANAGER]: 'Sub Pharmacy Manager',
  [UserRole.DOCTOR]: 'Doctor',
  [UserRole.DOCTOR_ASSISTANT]: 'Doctor Assistant',
  [UserRole.REGISTRATION_STAFF]: 'Registration Staff',
  [UserRole.REGISTRATION_STAFF_MANAGER]: 'Registration Staff Manager',
  [UserRole.PHARMACY_STAFF]: 'Pharmacy Staff',
  [UserRole.AUDITOR]: 'Auditor',
  [UserRole.LAB_TECHNICIAN]: 'Lab Technician',
  [UserRole.RADIOLOGIST]: 'Radiologist',
  [UserRole.NURSE]: 'Nurse',
  [UserRole.BILLING_STAFF]: 'Billing Staff',
  [UserRole.RECEPTIONIST]: 'Receptionist',
};

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 200,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
} as const;

// Cache TTL (milliseconds)
export const CACHE_TTL = {
  MEDICINES: 5 * 60 * 1000, // 5 minutes
  INVENTORY: 3 * 60 * 1000, // 3 minutes
  STATS: 2 * 60 * 1000, // 2 minutes
} as const;

// Medicine Forms
export const MEDICINE_FORMS = [
  'TABLET',
  'CAPSULE',
  'SYRUP',
  'INJECTION',
  'CREAM',
  'DROPS',
] as const;

// Visit Types
export const VISIT_TYPES = [
  'OPD',
  'EMERGENCY',
  'WARD_INDOOR',
] as const;

// Price Types
export const PRICE_TYPES = [
  'GOVERNMENT',
  'RETAIL',
  'CUSTOM',
] as const;

// Status Options
export const STATUSES = {
  MEDICINE: ['ACTIVE', 'DISCONTINUED'],
  BATCH: ['AVAILABLE', 'EXPIRED', 'DEPLETED'],
  USER: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
  PRESCRIPTION: ['PENDING', 'ISSUED', 'PARTIALLY_ISSUED', 'CANCELLED'],
  TRANSFER: ['PENDING', 'APPROVED', 'REJECTED', 'DISPATCHED', 'RECEIVED', 'CANCELLED'],
} as const;
