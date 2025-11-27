# Role-Based Access Control (RBAC) Implementation Guide

## Overview

The Hospital Medicine IMS now includes a comprehensive Role-Based Access Control system with:

- ✅ **9 User Roles**: SUPER_ADMIN, HOSPITAL_ADMIN, MAIN_PHARMACY_MANAGER, SUB_PHARMACY_MANAGER, DOCTOR, DOCTOR_ASSISTANT, REGISTRATION_STAFF, PHARMACY_STAFF, AUDITOR
- ✅ **Role-Specific Dashboards**: Each role has a dedicated dashboard with relevant widgets and actions
- ✅ **Sectioned Sidebar**: Organized navigation with collapsible sections
- ✅ **Reusable Widgets**: StatsCard, QuickActionsWidget, AlertsWidget, RecentActivityWidget
- ✅ **Permission Helpers**: Utility functions for granular permission checks

---

## Architecture

### 1. RBAC Configuration (`/frontend/src/lib/rbac-config.ts`)

This is the **central configuration file** for all role-based access control:

```typescript
import { UserRole } from './constants';

// Sidebar sections with role-filtered items
export const sidebarConfig: SidebarSection[] = [
  {
    title: 'OVERVIEW',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: [...] }
    ]
  },
  {
    title: 'ADMINISTRATION',
    items: [
      { label: 'Hospitals', href: '/dashboard/hospitals', icon: Hospital, roles: [UserRole.SUPER_ADMIN] }
    ]
  },
  // ... more sections
];

// Quick actions by role
export const quickActions: QuickAction[] = [
  { label: 'Add Hospital', href: '/dashboard/hospitals/new', icon: Hospital, roles: [UserRole.SUPER_ADMIN] }
  // ... more actions
];

// Permission helper functions
export function hasPermission(userRole: UserRole, requiredRoles: UserRole[]): boolean;
export function canAccessRoute(userRole: UserRole, route: string): boolean;
export function getQuickActionsForRole(userRole: UserRole): QuickAction[];
export function getSidebarSectionsForRole(userRole: UserRole): SidebarSection[];
```

**Key Features:**
- Single source of truth for permissions
- Easy to maintain and extend
- Type-safe with TypeScript interfaces

---

### 2. Dashboard Widgets (`/frontend/src/components/dashboard/`)

Reusable components for building role-specific dashboards:

#### **StatsCard**
```typescript
<StatsCard
  title="Total Hospitals"
  value={stats?.totalHospitals ?? 0}
  icon={Hospital}
  color="blue"
  href="/dashboard/hospitals"
  loading={loading}
  trend={{
    value: 5,
    isPositive: true,
    label: 'vs last month',
  }}
/>
```

**Colors**: `blue`, `green`, `yellow`, `red`, `purple`, `indigo`

#### **QuickActionsWidget**
```typescript
const actions = getQuickActionsForRole(UserRole.SUPER_ADMIN);
<QuickActionsWidget actions={actions} title="Administration" />
```

#### **AlertsWidget**
```typescript
const alerts: Alert[] = [
  {
    id: '1',
    type: 'error', // 'error' | 'warning' | 'info'
    title: 'Critical Stock Alert',
    message: 'Paracetamol has only 50 tablets',
    href: '/dashboard/inventory/alerts',
    timestamp: new Date(),
  }
];
<AlertsWidget alerts={alerts} title="System Alerts" maxItems={5} />
```

#### **RecentActivityWidget**
```typescript
const activities: ActivityItem[] = [
  {
    id: '1',
    title: 'New Hospital Registered',
    description: 'City General Hospital added',
    timestamp: new Date(),
    user: 'Admin User',
    type: 'success', // 'success' | 'info' | 'warning'
    href: '/dashboard/hospitals',
  }
];
<RecentActivityWidget activities={activities} title="Recent Activity" maxItems={10} />
```

---

### 3. Role-Specific Dashboards

Each role has a dedicated dashboard page:

| Role | Route | Dashboard Page |
|------|-------|----------------|
| SUPER_ADMIN | `/dashboard/super-admin` | ✅ Implemented |
| HOSPITAL_ADMIN | `/dashboard/hospital-admin` | 🚧 TODO |
| MAIN_PHARMACY_MANAGER | `/dashboard/main-pharmacy` | ✅ Implemented |
| SUB_PHARMACY_MANAGER | `/dashboard/sub-pharmacy` | ✅ Implemented |
| DOCTOR | `/dashboard/doctor` | 🚧 TODO |
| DOCTOR_ASSISTANT | `/dashboard/doctor-assistant` | 🚧 TODO |
| REGISTRATION_STAFF | `/dashboard/registration` | 🚧 TODO |
| PHARMACY_STAFF | `/dashboard/pharmacy-staff` | 🚧 TODO |
| AUDITOR | `/dashboard/auditor` | 🚧 TODO |

**Dashboard Template Structure:**
```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@/lib/constants';
import { getQuickActionsForRole } from '@/lib/rbac-config';
import StatsCard from '@/components/dashboard/StatsCard';
import QuickActionsWidget from '@/components/dashboard/QuickActionsWidget';
import AlertsWidget from '@/components/dashboard/AlertsWidget';
import RecentActivityWidget from '@/components/dashboard/RecentActivityWidget';

export default function RoleDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verify role
    if (!user || user.role !== UserRole.YOUR_ROLE) {
      router.push('/dashboard');
      return;
    }

    fetchDashboardData();
  }, [user, router]);

  const fetchDashboardData = async () => {
    // Fetch stats from API
  };

  const quickActions = getQuickActionsForRole(UserRole.YOUR_ROLE);

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Role Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">Description</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatsCard {...} />
      </div>

      {/* Alerts */}
      <AlertsWidget {...} />

      {/* Quick Actions */}
      <QuickActionsWidget actions={quickActions} />

      {/* Recent Activity */}
      <RecentActivityWidget {...} />
    </div>
  );
}
```

---

### 4. Enhanced Sidebar with Sections

**File:** `/frontend/src/components/layout/sidebar-with-sections.tsx`

**Features:**
- Organized into logical sections (OVERVIEW, ADMINISTRATION, PHARMACY, PATIENT CARE, INSIGHTS, SYSTEM)
- Collapsible sections for better navigation
- Role-filtered items (only shows items user has access to)
- Badge support for showing counts (e.g., pending items)

**Usage:**
```typescript
import { SidebarWithSections } from '@/components/layout/sidebar-with-sections';

<SidebarWithSections 
  userRole={user.role as UserRole} 
  isCollapsed={isSidebarCollapsed}
  onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
/>
```

**To enable:** Update `/frontend/src/app/(dashboard)/layout.tsx`:
```diff
- import { Sidebar } from '@/components/layout/sidebar';
+ import { SidebarWithSections as Sidebar } from '@/components/layout/sidebar-with-sections';
```

---

## Implementation Examples

### Example 1: Adding a New Role Dashboard

1. **Create dashboard page** at `/app/(dashboard)/dashboard/[role-name]/page.tsx`

2. **Use the template** from section 3 above

3. **Update ROLE_DASHBOARDS** in `/lib/constants.ts`:
```typescript
export const ROLE_DASHBOARDS: Record<UserRole, string> = {
  [UserRole.YOUR_NEW_ROLE]: '/dashboard/your-role-route',
};
```

4. **Add role-specific widgets** using the dashboard widgets

### Example 2: Adding a New Quick Action

Update `/lib/rbac-config.ts`:
```typescript
export const quickActions: QuickAction[] = [
  // ... existing actions
  {
    label: 'Your Action',
    href: '/dashboard/your-route',
    icon: YourIcon,
    description: 'Description of action',
    roles: [UserRole.ROLE1, UserRole.ROLE2],
  },
];
```

### Example 3: Adding Permission Check to a Page

```typescript
'use client';

import { hasPermission } from '@/lib/rbac-config';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@/lib/constants';

export default function SensitivePage() {
  const { user } = useAuthStore();

  // Check if user has permission
  if (!user || !hasPermission(user.role as UserRole, [UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN])) {
    return <div>Access Denied</div>;
  }

  return <div>Protected Content</div>;
}
```

### Example 4: Conditional UI Based on Role

```typescript
import { hasPermission } from '@/lib/rbac-config';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@/lib/constants';

export default function UserList() {
  const { user } = useAuthStore();
  const canDelete = hasPermission(user?.role as UserRole, [UserRole.SUPER_ADMIN]);

  return (
    <div>
      {/* ... user list */}
      {canDelete && (
        <button onClick={handleDelete}>Delete User</button>
      )}
    </div>
  );
}
```

---

## Testing

### Test Role-Based Redirects
1. Login with different user roles
2. Verify redirect to correct dashboard URL
3. Check sidebar shows only permitted items
4. Verify quick actions are role-appropriate

### Test Permission Helpers
```typescript
import { hasPermission, canAccessRoute } from '@/lib/rbac-config';
import { UserRole } from '@/lib/constants';

// Test hasPermission
console.log(hasPermission(UserRole.SUPER_ADMIN, [UserRole.SUPER_ADMIN])); // true
console.log(hasPermission(UserRole.DOCTOR, [UserRole.SUPER_ADMIN])); // false

// Test canAccessRoute
console.log(canAccessRoute(UserRole.SUPER_ADMIN, '/dashboard/hospitals')); // true
console.log(canAccessRoute(UserRole.DOCTOR, '/dashboard/hospitals')); // false
```

---

## Next Steps

### Remaining Dashboards to Implement:
1. **Hospital Admin Dashboard** (`/dashboard/hospital-admin`)
   - Hospital-wide stats
   - User management
   - Pharmacy oversight

2. **Doctor Dashboard** (`/dashboard/doctor`)
   - Patient list
   - Prescription creation
   - Today's appointments

3. **Doctor Assistant Dashboard** (`/dashboard/doctor-assistant`)
   - Assist doctor with prescriptions
   - Patient registration support

4. **Registration Staff Dashboard** (`/dashboard/registration`)
   - Patient registration
   - NR-Number generation
   - Today's registrations

5. **Pharmacy Staff Dashboard** (`/dashboard/pharmacy-staff`)
   - Medicine issuance
   - Pending prescriptions
   - Stock check

6. **Auditor Dashboard** (`/dashboard/auditor`)
   - Audit reports
   - Stock movements
   - Compliance checks

### Additional Enhancements:
- [ ] Add permission guards to all existing pages
- [ ] Implement sidebar badge counts (e.g., pending transfers)
- [ ] Add real-time notifications for role-specific events
- [ ] Create role-based report templates
- [ ] Add activity logging for audit trail

---

## File Structure

```
frontend/src/
├── lib/
│   ├── rbac-config.ts              # Central RBAC configuration
│   └── constants.ts                # User roles and dashboard routes
├── components/
│   ├── dashboard/
│   │   ├── StatsCard.tsx           # Reusable stats card widget
│   │   ├── QuickActionsWidget.tsx  # Quick actions grid
│   │   ├── AlertsWidget.tsx        # Alerts list widget
│   │   └── RecentActivityWidget.tsx # Activity timeline
│   └── layout/
│       ├── sidebar.tsx             # Original flat sidebar
│       └── sidebar-with-sections.tsx # Enhanced sectioned sidebar
└── app/(dashboard)/dashboard/
    ├── page.tsx                    # Auto-redirects to role dashboard
    ├── super-admin/page.tsx        # Super Admin dashboard
    ├── main-pharmacy/page.tsx      # Main Pharmacy dashboard
    ├── sub-pharmacy/page.tsx       # Sub Pharmacy dashboard
    ├── hospital-admin/page.tsx     # TODO
    ├── doctor/page.tsx             # TODO
    ├── doctor-assistant/page.tsx   # TODO
    ├── registration/page.tsx       # TODO
    ├── pharmacy-staff/page.tsx     # TODO
    └── auditor/page.tsx            # TODO
```

---

## Support

For questions or issues with RBAC implementation, refer to:
- `system_architecture.md` - System design and requirements
- This guide - Implementation details
- Code comments in `rbac-config.ts`

