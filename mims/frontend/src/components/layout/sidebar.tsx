'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRole } from '@/lib/constants';
import {
  LayoutDashboard, Hospital, Users, Pill, FileText, BarChart3, Bell,
  Settings, UserCog, Building2, PackagePlus, ArrowLeftRight,
  AlertCircle, Syringe, HeartPulse, Activity, ChevronLeft, ChevronRight,
  Store, Flag, Shield, Stethoscope, ClipboardList, Clock, UserPlus, Receipt,
  DoorOpen, Bed, UserRoundPlus, UserRoundX, TestTube, Microscope, CheckSquare, FileCheck, Wallet, DollarSign,
  Trash2, Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MenuItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const menuItems: MenuItem[] = [
  // Dashboard - All roles
  { 
    label: 'Dashboard', 
    href: '/dashboard', 
    icon: LayoutDashboard, 
    roles: [UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.DEPARTMENT_ADMIN, UserRole.MAIN_PHARMACY_MANAGER, UserRole.SUB_PHARMACY_MANAGER, UserRole.DOCTOR, UserRole.DOCTOR_ASSISTANT, UserRole.REGISTRATION_STAFF, UserRole.REGISTRATION_STAFF_MANAGER, UserRole.PHARMACY_STAFF, UserRole.AUDITOR, UserRole.LAB_TECHNICIAN, UserRole.RADIOLOGIST, UserRole.NURSE, UserRole.BILLING_STAFF, UserRole.RECEPTIONIST] 
  },
  
  // Super Admin Exclusive
  { 
    label: 'Hospitals', 
    href: '/dashboard/hospitals', 
    icon: Hospital, 
    roles: [UserRole.SUPER_ADMIN, UserRole.MASTER_ADMIN] 
  },
  {
    label: 'System Users',
    href: '/dashboard/users',
    icon: UserCog,
    roles: [UserRole.SUPER_ADMIN, UserRole.MASTER_ADMIN, UserRole.HOSPITAL_ADMIN]
  },
  {
    label: 'Notifications',
    href: '/dashboard/notifications',
    icon: Bell,
    roles: [UserRole.SUPER_ADMIN, UserRole.MASTER_ADMIN, UserRole.HOSPITAL_ADMIN]
  },
  {
    label: 'Departments',
    href: '/admin/departments',
    icon: Building2,
    roles: [UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.DEPARTMENT_ADMIN]
  },
  
  // In-House Management - Admin only
  {
    label: 'Room Management',
    href: '/admin/rooms',
    icon: DoorOpen,
    roles: [UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.DEPARTMENT_ADMIN]
  },
  {
    label: 'Bed Management',
    href: '/admin/beds',
    icon: Bed,
    roles: [UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.DEPARTMENT_ADMIN]
  },
  {
    label: 'Operations',
    href: '/admin/operations',
    icon: FileCheck,
    roles: [UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.DEPARTMENT_ADMIN]
  },
  
  // Clinical Services - OPD/Clinics
  {
    label: 'Clinics',
    href: '/admin/clinics',
    icon: Stethoscope,
    roles: [UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.DEPARTMENT_ADMIN]
  },
  {
    label: 'OPD Registration',
    href: '/reception/opd',
    icon: ClipboardList,
    roles: [UserRole.RECEPTIONIST, UserRole.REGISTRATION_STAFF,UserRole.SUPER_ADMIN, UserRole.MASTER_ADMIN]
  },
  {
    label: 'Doctor Queue',
    href: '/doctor/queue',
    icon: Clock,
    roles: [UserRole.DOCTOR, UserRole.DOCTOR_ASSISTANT, UserRole.NURSE,  UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN]
  },
  {
    label: 'Referrals',
    href: '/referrals',
    icon: ArrowLeftRight,
    roles: [ UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN, UserRole.DOCTOR]
  },
  {
    label: 'Receipts',
    href: '/finance/receipts',
    icon: Receipt,
    roles: [UserRole.SUPER_ADMIN, UserRole.MASTER_ADMIN, UserRole.AUDITOR]
  },
  
  // Ward Management - Admission & Discharge
  {
    label: 'Patient Admission',
    href: '/ward/admissions',
    icon: UserRoundPlus,
    roles: [UserRole.NURSE,UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.MASTER_ADMIN, UserRole.REGISTRATION_STAFF, UserRole.RECEPTIONIST]
  },
  {
    label: 'Patient Discharge',
    href: '/ward/discharge',
    icon: UserRoundX,
    roles: [UserRole.NURSE, UserRole.SUPER_ADMIN,UserRole.HOSPITAL_ADMIN, UserRole.MASTER_ADMIN, UserRole.BILLING_STAFF, UserRole.RECEPTIONIST]
  },
  
  // Lab Services - Phase 3
  {
    label: 'Lab Tests Catalog',
    href: '/admin/lab-tests',
    icon: TestTube,
    roles: [UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN, UserRole.DEPARTMENT_ADMIN, UserRole.REGISTRATION_STAFF_MANAGER]
  },
  {
    label: 'Lab Services',
    href: '/lab',
    icon: Microscope,
    roles: [UserRole.DOCTOR, UserRole.HOSPITAL_ADMIN, UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN, UserRole.LAB_TECHNICIAN, UserRole.RECEPTIONIST, UserRole.REGISTRATION_STAFF_MANAGER, UserRole.REGISTRATION_STAFF]
  },
  
  { 
    label: 'Pharmacies', 
    href: '/dashboard/pharmacies', 
    icon: Store, 
    roles: [UserRole.SUPER_ADMIN, UserRole.MASTER_ADMIN,UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.MAIN_PHARMACY_MANAGER] 
  },
  
  // Pharmacy Management - SUPER_ADMIN has access to everything
  { 
    label: 'Medicines', 
    href: '/dashboard/medicines', 
    icon: Pill, 
    roles: [UserRole.SUPER_ADMIN, UserRole.MAIN_PHARMACY_MANAGER, UserRole.SUPER_ADMIN,UserRole.SUB_PHARMACY_MANAGER, UserRole.PHARMACY_STAFF, UserRole.AUDITOR] 
  },
  { 
    label: 'Inventory', 
    href: '/dashboard/inventory', 
    icon: PackagePlus, 
    roles: [UserRole.SUPER_ADMIN, UserRole.MAIN_PHARMACY_MANAGER,UserRole.HOSPITAL_ADMIN,UserRole.SUPER_ADMIN, UserRole.SUB_PHARMACY_MANAGER, UserRole.PHARMACY_STAFF, UserRole.AUDITOR] 
  },
  {
    label: 'Stock Alerts',
    href: '/dashboard/inventory/alerts',
    icon: AlertCircle,
    roles: [UserRole.SUPER_ADMIN, UserRole.MAIN_PHARMACY_MANAGER, UserRole.SUB_PHARMACY_MANAGER, UserRole.HOSPITAL_ADMIN]
  },
  {
    label: 'Dispose',
    href: '/dashboard/dispose',
    icon: Trash2,
    roles: [UserRole.SUPER_ADMIN, UserRole.MASTER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.MAIN_PHARMACY_MANAGER, UserRole.SUB_PHARMACY_MANAGER, UserRole.AUDITOR]
  },
  {
    label: 'Rx Templates',
    href: '/dashboard/medicine-templates',
    icon: ClipboardList,
    roles: [UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.MAIN_PHARMACY_MANAGER, UserRole.SUB_PHARMACY_MANAGER, UserRole.PHARMACY_STAFF]
  },
  
  // Patient Management - SUPER_ADMIN has full access
  { 
    label: 'Patients', 
    href: '/dashboard/patients', 
    icon: Users, 
    roles: [UserRole.SUPER_ADMIN,UserRole.HOSPITAL_ADMIN, UserRole.REGISTRATION_STAFF, UserRole.REGISTRATION_STAFF_MANAGER, UserRole.RECEPTIONIST, UserRole.DOCTOR_ASSISTANT, UserRole.MAIN_PHARMACY_MANAGER, UserRole.SUB_PHARMACY_MANAGER]
  },
  { 
    label: 'Prescriptions', 
    href: '/dashboard/prescriptions', 
    icon: FileText, 
    roles: [UserRole.SUPER_ADMIN, UserRole.DOCTOR,UserRole.HOSPITAL_ADMIN, UserRole.DOCTOR_ASSISTANT, UserRole.MAIN_PHARMACY_MANAGER, UserRole.SUB_PHARMACY_MANAGER, UserRole.PHARMACY_STAFF] 
  },
  
  // Medicine Issuance - SUPER_ADMIN has full access
  { 
    label: 'Issue Medicines', 
    href: '/dashboard/issuance', 
    icon: Syringe, 
    roles: [UserRole.SUPER_ADMIN, UserRole.MAIN_PHARMACY_MANAGER, UserRole.SUB_PHARMACY_MANAGER, UserRole.PHARMACY_STAFF] 
  },
  
  // Transfers - SUPER_ADMIN has full access
  { 
    label: 'Transfers', 
    href: '/dashboard/transfers', 
    icon: ArrowLeftRight, 
    roles: [UserRole.SUPER_ADMIN, UserRole.MAIN_PHARMACY_MANAGER, UserRole.SUB_PHARMACY_MANAGER] 
  },
  
  // Reports - SUPER_ADMIN has full access
  { 
    label: 'Reports', 
    href: '/dashboard/reports/daily-transactions', 
    icon: BarChart3, 
    roles: [UserRole.SUPER_ADMIN, UserRole.MAIN_PHARMACY_MANAGER, UserRole.AUDITOR] 
  },
  { 
    label: 'Financial Reports', 
    href: '/dashboard/reports/financial', 
    icon: DollarSign, 
    roles: [UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.AUDITOR] 
  },
  
  // Analytics - Admin only
  { 
    label: 'Analytics', 
    href: '/dashboard/analytics', 
    icon: Activity, 
    roles: [UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN] 
  },

  // Attendance Dashboard - Admin and HR
  { 
    label: 'Attendance Dashboard', 
    href: '/dashboard/attendance', 
    icon: CheckSquare, 
    roles: [UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.MASTER_ADMIN, UserRole.DEPARTMENT_ADMIN] 
  },
  { 
    label: 'Shifts', 
    href: '/dashboard/attendance/shifts', 
    icon: Clock, 
    roles: [UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.MASTER_ADMIN, UserRole.DEPARTMENT_ADMIN] 
  },
  { 
    label: 'Leaves', 
    href: '/dashboard/attendance/leaves', 
    icon: ClipboardList, 
    roles: [UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.MASTER_ADMIN, UserRole.DEPARTMENT_ADMIN] 
  },
  { 
    label: 'Payroll', 
    href: '/dashboard/payroll', 
    icon: Receipt, 
    roles: [UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.MASTER_ADMIN] 
  },
  { 
    label: 'Expenditure', 
    href: '/dashboard/expenditure', 
    icon: Wallet, 
    roles: [UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.MASTER_ADMIN] 
  },
  
  // Feature Flags - Admin only
  {
    label: 'Feature Flags',
    href: '/admin/feature-flags',
    icon: Flag,
    roles: [UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN]
  },

  // Database Backup - platform admins only (a dump is the whole database)
  {
    label: 'Database Backup',
    href: '/admin/backups',
    icon: Database,
    roles: [UserRole.SUPER_ADMIN, UserRole.MASTER_ADMIN]
  },
  
  // Activity Logs - Admin only
  { 
    label: 'Activity Logs', 
    href: '/dashboard/activity-logs', 
    icon: Activity, 
    roles: [UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN] 
  },
  
  // Permissions - Admin only
  { 
    label: 'Permissions', 
    href: '/admin/permissions', 
    icon: Shield, 
    roles: [UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN] 
  },
  
  // Settings - SUPER_ADMIN has full access
  { 
    label: 'Settings', 
    href: '/dashboard/settings', 
    icon: Settings, 
    roles: [UserRole.SUPER_ADMIN, UserRole.MAIN_PHARMACY_MANAGER, UserRole.SUB_PHARMACY_MANAGER] 
  },
];

interface SidebarProps {
  userRole: UserRole;
  isCollapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ userRole, isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const filteredMenuItems = menuItems.filter((item) => item.roles.includes(userRole));

  return (
    <aside className={cn('relative flex h-screen flex-col border-r border-border bg-[hsl(var(--sidebar-bg))] transition-all duration-300 ease-in-out', isCollapsed ? 'w-16' : 'w-64')}>
      {/* Toggle Button - Positioned outside sidebar */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-muted))] shadow-md transition-all hover:bg-primary hover:text-primary-foreground"
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>

      <div className="flex h-16 items-center justify-center border-b border-border px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <HeartPulse className="h-5 w-5 text-primary-foreground" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-[hsl(var(--sidebar-fg))]">M-IMS</span>
              <span className="text-[10px] text-[hsl(var(--sidebar-muted))]">Medicine System</span>
            </div>
          )}
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {filteredMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href} className={cn('group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200', isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-[hsl(var(--sidebar-fg))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-primary', isCollapsed && 'justify-center')} title={isCollapsed ? item.label : undefined}>
              <Icon className={cn('h-5 w-5 flex-shrink-0', isActive ? '' : 'text-[hsl(var(--sidebar-muted))] group-hover:text-primary')} />
              {!isCollapsed && <span className="flex-1">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      {!isCollapsed && (
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <span className="text-sm font-semibold text-primary">{userRole.charAt(0)}</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-[hsl(var(--sidebar-fg))]">{userRole.replace(/_/g, ' ')}</p>
              <p className="text-xs text-[hsl(var(--sidebar-muted))]">Active</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
