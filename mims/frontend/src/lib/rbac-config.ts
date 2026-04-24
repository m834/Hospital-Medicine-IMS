/**
 * Role-Based Access Control Configuration
 * Defines permissions, dashboard layouts, and feature access for each user role
 */

import { Main } from 'next/document';
import { UserRole } from './constants';
import {
  LayoutDashboard,
  Hospital,
  Users,
  Pill,
  FileText,
  BarChart3,
  Settings,
  UserCog,
  Building2,
  PackagePlus,
  ArrowLeftRight,
  AlertCircle,
  Syringe,
  HeartPulse,
  Activity,
  Store,
  ClipboardList,
  Package,
  TrendingUp,
  UserPlus,
  FileStack,
} from 'lucide-react';

export interface DashboardWidget {
  id: string;
  title: string;
  type: 'stats' | 'chart' | 'list' | 'quickActions' | 'alerts';
  roles: UserRole[];
  priority: number; // Lower number = higher priority (shows first)
}

export interface QuickAction {
  label: string;
  href: string;
  icon: React.ElementType;
  description: string;
  roles: UserRole[];
}

export interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

export interface SidebarItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: UserRole[];
  badge?: string; // For showing counts like pending items
}

// Dashboard Widgets Configuration
export const dashboardWidgets: DashboardWidget[] = [
  {
    id: 'total-hospitals',
    title: 'Total Hospitals',
    type: 'stats',
    roles: [UserRole.SUPER_ADMIN],
    priority: 1,
  },
  {
    id: 'total-users',
    title: 'Total Users',
    type: 'stats',
    roles: [UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN],
    priority: 2,
  },
  {
    id: 'total-pharmacies',
    title: 'Total Pharmacies',
    type: 'stats',
    roles: [UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN],
    priority: 3,
  },
  {
    id: 'low-stock-items',
    title: 'Low Stock Items',
    type: 'stats',
    roles: [
      UserRole.SUPER_ADMIN,
      UserRole.MAIN_PHARMACY_MANAGER,
      UserRole.SUB_PHARMACY_MANAGER,
      UserRole.PHARMACY_STAFF,
    ],
    priority: 1,
  },
  {
    id: 'expiring-batches',
    title: 'Expiring Soon',
    type: 'stats',
    roles: [
      UserRole.SUPER_ADMIN,
      UserRole.MAIN_PHARMACY_MANAGER,
      UserRole.SUB_PHARMACY_MANAGER,
      UserRole.PHARMACY_STAFF,
    ],
    priority: 2,
  },
  {
    id: 'pending-transfers',
    title: 'Pending Transfers',
    type: 'stats',
    roles: [
      UserRole.SUPER_ADMIN,
      UserRole.HOSPITAL_ADMIN,
      UserRole.MAIN_PHARMACY_MANAGER,
      UserRole.SUB_PHARMACY_MANAGER,
    ],
    priority: 3,
  },
  {
    id: 'pending-prescriptions',
    title: 'Pending Prescriptions',
    type: 'stats',
    roles: [
      UserRole.SUPER_ADMIN,
      UserRole.DOCTOR,
      UserRole.MAIN_PHARMACY_MANAGER,
      UserRole.SUB_PHARMACY_MANAGER,
      UserRole.PHARMACY_STAFF,
    ],
    priority: 4,
  },
  {
    id: 'todays-issuance',
    title: "Today's Issuance",
    type: 'stats',
    roles: [
      UserRole.SUPER_ADMIN,
      UserRole.HOSPITAL_ADMIN,
      UserRole.MAIN_PHARMACY_MANAGER,
      UserRole.SUB_PHARMACY_MANAGER,
      UserRole.PHARMACY_STAFF,
    ],
    priority: 5,
  },
  {
    id: 'todays-registrations',
    title: "Today's Registrations",
    type: 'stats',
    roles: [UserRole.SUPER_ADMIN, UserRole.REGISTRATION_STAFF, UserRole.HOSPITAL_ADMIN],
    priority: 6,
  },
];

// Quick Actions by Role
export const quickActions: QuickAction[] = [
  // Super Admin
  {
    label: 'Add Hospital',
    href: '/dashboard/hospitals/new',
    icon: Hospital,
    description: 'Register a new hospital',
    roles: [UserRole.SUPER_ADMIN],
  },
  {
    label: 'Add User',
    href: '/dashboard/users/new',
    icon: UserCog,
    description: 'Create a new system user',
    roles: [UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN],
  },

  // Pharmacy Management
  {
    label: 'Receive Stock',
    href: '/dashboard/inventory/receive',
    icon: PackagePlus,
    description: 'Record new stock arrival',
    roles: [UserRole.SUPER_ADMIN, UserRole.MAIN_PHARMACY_MANAGER, UserRole.PHARMACY_STAFF],
  },
  {
    label: 'Request Transfer',
    href: '/dashboard/transfers/request',
    icon: ArrowLeftRight,
    description: 'Request stock from main pharmacy',
    roles: [UserRole.SUPER_ADMIN, UserRole.SUB_PHARMACY_MANAGER],
  },
  {
    label: 'Review Transfers',
    href: '/dashboard/transfers?filter=pending',
    icon: ClipboardList,
    description: 'Review and approve transfer requests',
    roles: [UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.MAIN_PHARMACY_MANAGER],
  },
  {
    label: 'Issue Medicines',
    href: '/dashboard/issuance',
    icon: Syringe,
    description: 'Issue medicines to patients',
    roles: [
      UserRole.SUPER_ADMIN,
      UserRole.MAIN_PHARMACY_MANAGER,
      UserRole.SUB_PHARMACY_MANAGER,
      UserRole.PHARMACY_STAFF,
    ],
  },

  // Patient Management
  {
    label: 'Register Patient',
    href: '/dashboard/patients/register',
    icon: UserPlus,
    description: 'Register a new patient',
    roles: [UserRole.SUPER_ADMIN, UserRole.REGISTRATION_STAFF, UserRole.HOSPITAL_ADMIN,  UserRole.MAIN_PHARMACY_MANAGER,
      UserRole.SUB_PHARMACY_MANAGER],
  },
  {
    label: 'Create Prescription',
    href: '/dashboard/prescriptions/new',
    icon: FileText,
    description: 'Write a new prescription',
    roles: [UserRole.SUPER_ADMIN, UserRole.DOCTOR, UserRole.DOCTOR_ASSISTANT],
  },

  // Reports
  {
    label: 'Generate Report',
    href: '/dashboard/reports',
    icon: BarChart3,
    description: 'Create custom reports',
    roles: [
      UserRole.SUPER_ADMIN,
      UserRole.HOSPITAL_ADMIN,
      UserRole.MAIN_PHARMACY_MANAGER,
      UserRole.AUDITOR,
    ],
  },
];

// Sidebar Configuration with Sections
export const sidebarConfig: SidebarSection[] = [
  {
    title: 'OVERVIEW',
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        roles: [
          UserRole.SUPER_ADMIN,
          UserRole.HOSPITAL_ADMIN,
          UserRole.MAIN_PHARMACY_MANAGER,
          UserRole.SUB_PHARMACY_MANAGER,
          UserRole.DOCTOR,
          UserRole.DOCTOR_ASSISTANT,
          UserRole.REGISTRATION_STAFF,
          UserRole.REGISTRATION_STAFF_MANAGER,
          UserRole.PHARMACY_STAFF,
          UserRole.AUDITOR,
        ],
      },
    ],
  },
  {
    title: 'ADMINISTRATION',
    items: [
      {
        label: 'Hospitals',
        href: '/dashboard/hospitals',
        icon: Hospital,
        roles: [UserRole.SUPER_ADMIN],
      },
      {
        label: 'Users',
        href: '/dashboard/users',
        icon: UserCog,
        roles: [UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN],
      },
      {
        label: 'Pharmacies',
        href: '/dashboard/pharmacies',
        icon: Store,
        roles: [UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.MAIN_PHARMACY_MANAGER],
      },
    ],
  },
  {
    title: 'PHARMACY',
    items: [
      {
        label: 'Medicines',
        href: '/dashboard/medicines',
        icon: Pill,
        roles: [
          UserRole.SUPER_ADMIN,
          UserRole.HOSPITAL_ADMIN,
          UserRole.MAIN_PHARMACY_MANAGER,
          UserRole.SUB_PHARMACY_MANAGER,
          UserRole.PHARMACY_STAFF,
          UserRole.AUDITOR,
        ],
      },
      {
        label: 'Inventory',
        href: '/dashboard/inventory',
        icon: PackagePlus,
        roles: [
          UserRole.SUPER_ADMIN,
          UserRole.HOSPITAL_ADMIN,
          UserRole.MAIN_PHARMACY_MANAGER,
          UserRole.SUB_PHARMACY_MANAGER,
          UserRole.PHARMACY_STAFF,
          UserRole.AUDITOR,
        ],
      },
      {
        label: 'Stock Alerts',
        href: '/dashboard/inventory/alerts',
        icon: AlertCircle,
        roles: [
          UserRole.SUPER_ADMIN,
          UserRole.HOSPITAL_ADMIN,
          UserRole.MAIN_PHARMACY_MANAGER,
          UserRole.SUB_PHARMACY_MANAGER,
        ],
      },
      {
        label: 'Transfers',
        href: '/dashboard/transfers',
        icon: ArrowLeftRight,
        roles: [
          UserRole.SUPER_ADMIN,
          UserRole.HOSPITAL_ADMIN,
          UserRole.MAIN_PHARMACY_MANAGER,
          UserRole.SUB_PHARMACY_MANAGER,
        ],
      },
      {
        label: 'Issue Medicines',
        href: '/dashboard/issuance',
        icon: Syringe,
        roles: [
          UserRole.SUPER_ADMIN,
          UserRole.HOSPITAL_ADMIN,
          UserRole.MAIN_PHARMACY_MANAGER,
          UserRole.SUB_PHARMACY_MANAGER,
          UserRole.PHARMACY_STAFF,
        ],
      },
    ],
  },
  {
    title: 'PATIENT CARE',
    items: [
      {
        label: 'Patients',
        href: '/dashboard/patients',
        icon: Users,
        roles: [
          UserRole.SUPER_ADMIN,
          UserRole.HOSPITAL_ADMIN,
          UserRole.REGISTRATION_STAFF,
          UserRole.REGISTRATION_STAFF_MANAGER,
          UserRole.DOCTOR,
          UserRole.DOCTOR_ASSISTANT,
          UserRole.MAIN_PHARMACY_MANAGER,
          UserRole.SUB_PHARMACY_MANAGER,
          UserRole.PHARMACY_STAFF,
        ],
      },
      {
        label: 'Prescriptions',
        href: '/dashboard/prescriptions',
        icon: FileText,
        roles: [
          UserRole.SUPER_ADMIN,
          UserRole.HOSPITAL_ADMIN,
          UserRole.DOCTOR,
          UserRole.DOCTOR_ASSISTANT,
          UserRole.MAIN_PHARMACY_MANAGER,
          UserRole.SUB_PHARMACY_MANAGER,
          UserRole.PHARMACY_STAFF,
        ],
      },
    ],
  },
  {
    title: 'INSIGHTS',
    items: [
      {
        label: 'Reports',
        href: '/dashboard/reports',
        icon: BarChart3,
        roles: [
          UserRole.SUPER_ADMIN,
          UserRole.HOSPITAL_ADMIN,
          UserRole.MAIN_PHARMACY_MANAGER,
          UserRole.SUB_PHARMACY_MANAGER,
          UserRole.AUDITOR,
        ],
      },
      {
        label: 'Analytics',
        href: '/dashboard/analytics',
        icon: Activity,
        roles: [
          UserRole.MASTER_ADMIN,
          UserRole.SUPER_ADMIN,
          UserRole.HOSPITAL_ADMIN,
        ],
      },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      {
        label: 'Settings',
        href: '/dashboard/settings',
        icon: Settings,
        roles: [
          UserRole.SUPER_ADMIN,
          UserRole.HOSPITAL_ADMIN,
          UserRole.MAIN_PHARMACY_MANAGER,
          UserRole.SUB_PHARMACY_MANAGER,
        ],
      },
    ],
  },
];

// Permission Helper Functions
export function hasPermission(userRole: UserRole, requiredRoles: UserRole[]): boolean {
  return requiredRoles.includes(userRole);
}

export function canAccessRoute(userRole: UserRole, route: string): boolean {
  // Find all sidebar items that match this route
  for (const section of sidebarConfig) {
    for (const item of section.items) {
      if (route.startsWith(item.href)) {
        return hasPermission(userRole, item.roles);
      }
    }
  }
  return false;
}

export function getQuickActionsForRole(userRole: UserRole): QuickAction[] {
  return quickActions.filter((action) => hasPermission(userRole, action.roles));
}

export function getDashboardWidgetsForRole(userRole: UserRole): DashboardWidget[] {
  return dashboardWidgets
    .filter((widget) => hasPermission(userRole, widget.roles))
    .sort((a, b) => a.priority - b.priority);
}

export function getSidebarSectionsForRole(userRole: UserRole): SidebarSection[] {
  return sidebarConfig
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => hasPermission(userRole, item.roles)),
    }))
    .filter((section) => section.items.length > 0); // Only show sections with visible items
}
