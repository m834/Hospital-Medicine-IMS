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
  SUPER_ADMIN = 'SUPER_ADMIN',
  HOSPITAL_ADMIN = 'HOSPITAL_ADMIN',
  MAIN_PHARMACY_MANAGER = 'MAIN_PHARMACY_MANAGER',
  SUB_PHARMACY_MANAGER = 'SUB_PHARMACY_MANAGER',
  DOCTOR = 'DOCTOR',
  DOCTOR_ASSISTANT = 'DOCTOR_ASSISTANT',
  REGISTRATION_STAFF = 'REGISTRATION_STAFF',
  PHARMACY_STAFF = 'PHARMACY_STAFF',
  AUDITOR = 'AUDITOR',
}

// Dashboard Routes by Role
export const ROLE_DASHBOARDS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: '/dashboard/super-admin',
  [UserRole.HOSPITAL_ADMIN]: '/dashboard/hospital-admin',
  [UserRole.MAIN_PHARMACY_MANAGER]: '/dashboard/main-pharmacy',
  [UserRole.SUB_PHARMACY_MANAGER]: '/dashboard/sub-pharmacy',
  [UserRole.DOCTOR]: '/dashboard/doctor',
  [UserRole.DOCTOR_ASSISTANT]: '/dashboard/doctor-assistant',
  [UserRole.REGISTRATION_STAFF]: '/dashboard/registration',
  [UserRole.PHARMACY_STAFF]: '/dashboard/pharmacy',
  [UserRole.AUDITOR]: '/dashboard/auditor',
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
