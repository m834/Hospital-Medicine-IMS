import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

// Define all permissions by resource
const PERMISSIONS = {
  // Medicines Management
  medicines: [
    { action: 'read', scope: 'all', description: 'View all medicines' },
    { action: 'read', scope: 'own_hospital', description: 'View own hospital medicines' },
    { action: 'read', scope: 'own_department', description: 'View own department medicines' },
    { action: 'write', scope: 'all', description: 'Create/update medicines' },
    { action: 'write', scope: 'own_hospital', description: 'Create/update own hospital medicines' },
    { action: 'delete', scope: 'all', description: 'Delete medicines' },
  ],
  
  // Inventory Management
  inventory: [
    { action: 'read', scope: 'all', description: 'View all inventory' },
    { action: 'read', scope: 'own_hospital', description: 'View own hospital inventory' },
    { action: 'read', scope: 'own_pharmacy', description: 'View own pharmacy inventory' },
    { action: 'read', scope: 'own_department', description: 'View own department inventory' },
    { action: 'write', scope: 'all', description: 'Manage all inventory' },
    { action: 'write', scope: 'own_hospital', description: 'Manage own hospital inventory' },
    { action: 'write', scope: 'own_pharmacy', description: 'Manage own pharmacy inventory' },
    { action: 'delete', scope: 'all', description: 'Delete inventory records' },
  ],
  
  // Transfers
  transfers: [
    { action: 'read', scope: 'all', description: 'View all transfers' },
    { action: 'read', scope: 'own_hospital', description: 'View own hospital transfers' },
    { action: 'read', scope: 'own_pharmacy', description: 'View own pharmacy transfers' },
    { action: 'write', scope: 'all', description: 'Create any transfer' },
    { action: 'write', scope: 'own_hospital', description: 'Create transfers for own hospital' },
    { action: 'write', scope: 'own_pharmacy', description: 'Create transfers for own pharmacy' },
    { action: 'approve', scope: 'all', description: 'Approve any transfer' },
    { action: 'approve', scope: 'own_pharmacy', description: 'Approve transfers for own pharmacy' },
    { action: 'delete', scope: 'all', description: 'Delete any transfer' },
  ],
  
  // Patients
  patients: [
    { action: 'read', scope: 'all', description: 'View all patients' },
    { action: 'read', scope: 'own_hospital', description: 'View own hospital patients' },
    { action: 'read', scope: 'own_department', description: 'View own department patients' },
    { action: 'write', scope: 'all', description: 'Register/update any patients' },
    { action: 'write', scope: 'own_hospital', description: 'Register/update own hospital patients' },
    { action: 'write', scope: 'own_department', description: 'Register/update own department patients' },
    { action: 'delete', scope: 'all', description: 'Delete patients' },
  ],
  
  // Prescriptions
  prescriptions: [
    { action: 'read', scope: 'all', description: 'View all prescriptions' },
    { action: 'read', scope: 'own_hospital', description: 'View own hospital prescriptions' },
    { action: 'read', scope: 'own_department', description: 'View own department prescriptions' },
    { action: 'read', scope: 'own', description: 'View own prescriptions' },
    { action: 'write', scope: 'all', description: 'Create any prescription' },
    { action: 'write', scope: 'own_hospital', description: 'Create own hospital prescriptions' },
    { action: 'write', scope: 'own', description: 'Create own prescriptions' },
    { action: 'delete', scope: 'all', description: 'Delete any prescription' },
  ],
  
  // Issuance
  issuance: [
    { action: 'read', scope: 'all', description: 'View all issuances' },
    { action: 'read', scope: 'own_hospital', description: 'View own hospital issuances' },
    { action: 'read', scope: 'own_pharmacy', description: 'View own pharmacy issuances' },
    { action: 'read', scope: 'own_department', description: 'View own department issuances' },
    { action: 'write', scope: 'all', description: 'Issue medicines from any pharmacy' },
    { action: 'write', scope: 'own_hospital', description: 'Issue medicines from own hospital' },
    { action: 'write', scope: 'own_pharmacy', description: 'Issue medicines from own pharmacy' },
  ],
  
  // Purchase Orders
  purchase_orders: [
    { action: 'read', scope: 'all', description: 'View all purchase orders' },
    { action: 'read', scope: 'own_hospital', description: 'View own hospital purchase orders' },
    { action: 'write', scope: 'all', description: 'Create purchase orders' },
    { action: 'write', scope: 'own_hospital', description: 'Create own hospital purchase orders' },
    { action: 'approve', scope: 'all', description: 'Approve purchase orders' },
    { action: 'delete', scope: 'all', description: 'Delete purchase orders' },
  ],
  
  // GRN (Goods Receipt Notes)
  grn: [
    { action: 'read', scope: 'all', description: 'View all GRNs' },
    { action: 'read', scope: 'own_hospital', description: 'View own hospital GRNs' },
    { action: 'write', scope: 'all', description: 'Create GRNs' },
    { action: 'write', scope: 'own_hospital', description: 'Create own hospital GRNs' },
    { action: 'approve', scope: 'all', description: 'Approve GRNs' },
  ],
  
  // Users Management
  users: [
    { action: 'read', scope: 'all', description: 'View all users' },
    { action: 'read', scope: 'own_hospital', description: 'View own hospital users' },
    { action: 'read', scope: 'own_department', description: 'View own department users' },
    { action: 'write', scope: 'all', description: 'Create/update any users' },
    { action: 'write', scope: 'own_hospital', description: 'Create/update own hospital users' },
    { action: 'write', scope: 'own_department', description: 'Create/update own department users' },
    { action: 'delete', scope: 'all', description: 'Delete any users' },
    { action: 'delete', scope: 'own_department', description: 'Delete own department users' },
  ],
  
  // Hospitals Management
  hospitals: [
    { action: 'read', scope: 'all', description: 'View all hospitals' },
    { action: 'write', scope: 'all', description: 'Create/update hospitals' },
    { action: 'delete', scope: 'all', description: 'Delete hospitals' },
  ],
  
  // Departments Management (NEW)
  departments: [
    { action: 'read', scope: 'all', description: 'View all departments' },
    { action: 'read', scope: 'own_hospital', description: 'View own hospital departments' },
    { action: 'read', scope: 'own_department', description: 'View own department' },
    { action: 'write', scope: 'all', description: 'Create/update any departments' },
    { action: 'write', scope: 'own_hospital', description: 'Create/update own hospital departments' },
    { action: 'write', scope: 'own_department', description: 'Update own department' },
    { action: 'delete', scope: 'all', description: 'Delete any departments' },
  ],
  
  // Sub-Departments Management (NEW)
  sub_departments: [
    { action: 'read', scope: 'all', description: 'View all sub-departments' },
    { action: 'read', scope: 'own_hospital', description: 'View own hospital sub-departments' },
    { action: 'read', scope: 'own_department', description: 'View own department sub-departments' },
    { action: 'write', scope: 'all', description: 'Create/update any sub-departments' },
    { action: 'write', scope: 'own_department', description: 'Create/update own department sub-departments' },
    { action: 'delete', scope: 'all', description: 'Delete any sub-departments' },
  ],
  
  // Pharmacies Management
  pharmacies: [
    { action: 'read', scope: 'all', description: 'View all pharmacies' },
    { action: 'read', scope: 'own_hospital', description: 'View own hospital pharmacies' },
    { action: 'write', scope: 'all', description: 'Create/update pharmacies' },
    { action: 'write', scope: 'own_hospital', description: 'Create/update own hospital pharmacies' },
    { action: 'delete', scope: 'all', description: 'Delete pharmacies' },
  ],
  
  // Reports & Analytics
  reports: [
    { action: 'read', scope: 'all', description: 'View all reports' },
    { action: 'read', scope: 'own_hospital', description: 'View own hospital reports' },
    { action: 'read', scope: 'own_pharmacy', description: 'View own pharmacy reports' },
    { action: 'read', scope: 'own_department', description: 'View own department reports' },
  ],
  
  // Analytics
  analytics: [
    { action: 'read', scope: 'all', description: 'View all analytics' },
    { action: 'read', scope: 'own_hospital', description: 'View own hospital analytics' },
    { action: 'read', scope: 'own_pharmacy', description: 'View own pharmacy analytics' },
    { action: 'read', scope: 'own_department', description: 'View own department analytics' },
  ],
  
  // Feature Flags
  feature_flags: [
    { action: 'read', scope: 'all', description: 'View feature flags' },
    { action: 'write', scope: 'all', description: 'Manage feature flags' },
  ],
  
  // Permissions Management
  permissions: [
    { action: 'read', scope: 'all', description: 'View permissions' },
    { action: 'write', scope: 'all', description: 'Manage permissions' },
  ],
  
  // Lab (for future use)
  lab: [
    { action: 'read', scope: 'all', description: 'View all lab tests' },
    { action: 'read', scope: 'own_hospital', description: 'View own hospital lab tests' },
    { action: 'read', scope: 'own_department', description: 'View own department lab tests' },
    { action: 'write', scope: 'all', description: 'Create/update lab tests' },
    { action: 'write', scope: 'own_department', description: 'Create/update own department lab tests' },
    { action: 'approve', scope: 'all', description: 'Approve lab results' },
    { action: 'approve', scope: 'own_department', description: 'Approve own department lab results' },
  ],
  
  // Radiology (for future use)
  radiology: [
    { action: 'read', scope: 'all', description: 'View all radiology tests' },
    { action: 'read', scope: 'own_hospital', description: 'View own hospital radiology tests' },
    { action: 'read', scope: 'own_department', description: 'View own department radiology tests' },
    { action: 'write', scope: 'all', description: 'Create/update radiology tests' },
    { action: 'write', scope: 'own_department', description: 'Create/update own department radiology tests' },
    { action: 'approve', scope: 'all', description: 'Approve radiology results' },
    { action: 'approve', scope: 'own_department', description: 'Approve own department radiology results' },
  ],
  
  // Billing (for future use)
  billing: [
    { action: 'read', scope: 'all', description: 'View all bills' },
    { action: 'read', scope: 'own_hospital', description: 'View own hospital bills' },
    { action: 'write', scope: 'all', description: 'Create/update bills' },
    { action: 'write', scope: 'own_hospital', description: 'Create/update own hospital bills' },
    { action: 'approve', scope: 'all', description: 'Approve payments' },
  ],
};

// Define role-permission mappings
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  // MASTER_ADMIN - Full CRUD access to everything (NEW)
  MASTER_ADMIN: [
    'medicines:read:all', 'medicines:write:all', 'medicines:delete:all',
    'inventory:read:all', 'inventory:write:all', 'inventory:delete:all',
    'transfers:read:all', 'transfers:write:all', 'transfers:approve:all', 'transfers:delete:all',
    'patients:read:all', 'patients:write:all', 'patients:delete:all',
    'prescriptions:read:all', 'prescriptions:write:all', 'prescriptions:delete:all',
    'issuance:read:all', 'issuance:write:all',
    'purchase_orders:read:all', 'purchase_orders:write:all', 'purchase_orders:approve:all', 'purchase_orders:delete:all',
    'grn:read:all', 'grn:write:all', 'grn:approve:all',
    'users:read:all', 'users:write:all', 'users:delete:all',
    'hospitals:read:all', 'hospitals:write:all', 'hospitals:delete:all',
    'departments:read:all', 'departments:write:all', 'departments:delete:all',
    'sub_departments:read:all', 'sub_departments:write:all', 'sub_departments:delete:all',
    'pharmacies:read:all', 'pharmacies:write:all', 'pharmacies:delete:all',
    'reports:read:all', 'analytics:read:all',
    'feature_flags:read:all', 'feature_flags:write:all',
    'permissions:read:all', 'permissions:write:all',
    'lab:read:all', 'lab:write:all', 'lab:approve:all',
    'radiology:read:all', 'radiology:write:all', 'radiology:approve:all',
    'billing:read:all', 'billing:write:all', 'billing:approve:all',
  ],
  
  // SUPER_ADMIN - Read + Create only (NO update/delete) (MODIFIED)
  SUPER_ADMIN: [
    'medicines:read:all', 'medicines:write:all', // NO delete
    'inventory:read:all', 'inventory:write:all', // NO delete
    'transfers:read:all', 'transfers:write:all', // NO approve/delete
    'patients:read:all', 'patients:write:all', // NO delete
    'prescriptions:read:all', 'prescriptions:write:all', // NO delete
    'issuance:read:all', 'issuance:write:all',
    'purchase_orders:read:all', 'purchase_orders:write:all', // NO approve/delete
    'grn:read:all', 'grn:write:all', // NO approve
    'users:read:all', 'users:write:all', // NO delete
    'hospitals:read:all', 'hospitals:write:all', // NO delete
    'departments:read:all', 'departments:write:all', // NO delete
    'sub_departments:read:all', 'sub_departments:write:all', // NO delete
    'pharmacies:read:all', 'pharmacies:write:all', // NO delete
    'reports:read:all', 'analytics:read:all',
    'feature_flags:read:all',
    'permissions:read:all',
    'lab:read:all', 'lab:write:all', // NO approve
    'radiology:read:all', 'radiology:write:all', // NO approve
    'billing:read:all', 'billing:write:all', // NO approve
  ],
  
  // HOSPITAL_ADMIN - Hospital-scoped, Read + Create only (MODIFIED)
  HOSPITAL_ADMIN: [
    'medicines:read:own_hospital', 'medicines:write:own_hospital', // NO delete
    'inventory:read:own_hospital', 'inventory:write:own_hospital', // NO delete
    'transfers:read:own_hospital', 'transfers:write:own_hospital', // NO approve/delete
    'patients:read:own_hospital', 'patients:write:own_hospital', // NO delete
    'prescriptions:read:own_hospital', 'prescriptions:write:own_hospital', // NO delete
    'issuance:read:own_hospital', 'issuance:write:own_hospital',
    'purchase_orders:read:own_hospital', 'purchase_orders:write:own_hospital', // NO approve/delete
    'grn:read:own_hospital', 'grn:write:own_hospital', // NO approve
    'users:read:own_hospital', 'users:write:own_hospital', // NO delete
    'departments:read:own_hospital', 'departments:write:own_hospital', // NO delete
    'sub_departments:read:own_hospital', 'sub_departments:write:own_department',
    'pharmacies:read:own_hospital', 'pharmacies:write:own_hospital', // NO delete
    'reports:read:own_hospital', 'analytics:read:own_hospital',
    'feature_flags:read:all',
    'lab:read:own_hospital', 'radiology:read:own_hospital', 'billing:read:own_hospital',
  ],
  
  // DEPARTMENT_ADMIN - Department-scoped management (NEW)
  DEPARTMENT_ADMIN: [
    'medicines:read:own_department',
    'patients:read:own_department', 'patients:write:own_department',
    'prescriptions:read:own_department',
    'users:read:own_department', 'users:write:own_department', 'users:delete:own_department',
    'departments:read:own_department', 'departments:write:own_department',
    'sub_departments:read:own_department', 'sub_departments:write:own_department',
    'reports:read:own_department', 'analytics:read:own_department',
    'lab:read:own_department', 'lab:write:own_department',
    'radiology:read:own_department', 'radiology:write:own_department',
  ],
  
  // MAIN_PHARMACY_MANAGER - Main pharmacy operations + approvals
  MAIN_PHARMACY_MANAGER: [
    'medicines:read:all', 'medicines:write:all',
    'inventory:read:all', 'inventory:write:all',
    'transfers:read:all', 'transfers:write:all', 'transfers:approve:all',
    'patients:read:all',
    'prescriptions:read:all',
    'issuance:read:all', 'issuance:write:all',
    'purchase_orders:read:all', 'purchase_orders:write:all', 'purchase_orders:approve:all',
    'grn:read:all', 'grn:write:all', 'grn:approve:all',
    'reports:read:all', 'analytics:read:all',
  ],
  
  // SUB_PHARMACY_MANAGER - Own pharmacy operations
  SUB_PHARMACY_MANAGER: [
    'medicines:read:all',
    'inventory:read:own_pharmacy', 'inventory:write:own_pharmacy',
    'transfers:read:own_pharmacy', 'transfers:write:own_pharmacy', 'transfers:approve:own_pharmacy',
    'patients:read:all',
    'prescriptions:read:all',
    'issuance:read:own_pharmacy', 'issuance:write:own_pharmacy',
    'reports:read:own_pharmacy', 'analytics:read:own_pharmacy',
  ],
  
  // DOCTOR - Prescriptions and patient management (department-scoped)
  DOCTOR: [
    'medicines:read:own_department',
    'patients:read:own_department', 'patients:write:own_department',
    'prescriptions:read:own_department', 'prescriptions:write:own',
    'lab:read:own_department', 'lab:write:own_department',
    'radiology:read:own_department', 'radiology:write:own_department',
  ],
  
  // DOCTOR_ASSISTANT - Limited prescription and patient access (department-scoped)
  DOCTOR_ASSISTANT: [
    'medicines:read:own_department',
    'patients:read:own_department', 'patients:write:own_department',
    'prescriptions:read:own_department',
    'lab:read:own_department',
    'radiology:read:own_department',
  ],
  
  // REGISTRATION_STAFF - Patient registration only
  REGISTRATION_STAFF: [
    'patients:read:all', 'patients:write:all',
  ],
  
  // PHARMACY_STAFF - Basic pharmacy operations
  PHARMACY_STAFF: [
    'medicines:read:all',
    'inventory:read:own_pharmacy',
    'patients:read:all',
    'prescriptions:read:all',
    'issuance:read:own_pharmacy', 'issuance:write:own_pharmacy',
  ],
  
  // AUDITOR - Read-only access to everything
  AUDITOR: [
    'medicines:read:all',
    'inventory:read:all',
    'transfers:read:all',
    'patients:read:all',
    'prescriptions:read:all',
    'issuance:read:all',
    'purchase_orders:read:all',
    'grn:read:all',
    'users:read:all',
    'departments:read:all',
    'sub_departments:read:all',
    'pharmacies:read:all',
    'reports:read:all',
    'analytics:read:all',
    'lab:read:all',
    'radiology:read:all',
    'billing:read:all',
  ],
  
  // LAB_TECHNICIAN - Lab operations (department-scoped)
  LAB_TECHNICIAN: [
    'patients:read:own_department',
    'lab:read:own_department', 'lab:write:own_department', 'lab:approve:own_department',
  ],
  
  // RADIOLOGIST - Radiology operations (department-scoped)
  RADIOLOGIST: [
    'patients:read:own_department',
    'radiology:read:own_department', 'radiology:write:own_department', 'radiology:approve:own_department',
  ],
  
  // NURSE - Patient care and basic operations (department-scoped)
  NURSE: [
    'medicines:read:own_department',
    'patients:read:own_department', 'patients:write:own_department',
    'prescriptions:read:own_department',
    'issuance:read:own_department',
    'lab:read:own_department',
    'radiology:read:own_department',
  ],
  
  // BILLING_STAFF - Billing operations
  BILLING_STAFF: [
    'patients:read:all',
    'billing:read:all', 'billing:write:all', 'billing:approve:all',
  ],
  
  // RECEPTIONIST - Front desk operations
  RECEPTIONIST: [
    'patients:read:all', 'patients:write:all',
  ],
};

export async function seedPermissions() {
  console.log('🌱 Seeding permissions...');

  // Create all permissions
  const createdPermissions: Record<string, any> = {};
  
  for (const [resource, actions] of Object.entries(PERMISSIONS)) {
    for (const { action, scope, description } of actions) {
      const permissionKey = `${resource}:${action}:${scope}`;
      
      const permission = await prisma.permission.upsert({
        where: {
          resource_action_scope: { resource, action, scope },
        },
        update: { description },
        create: { resource, action, scope, description },
      });
      
      createdPermissions[permissionKey] = permission;
      console.log(`  ✓ ${permissionKey}`);
    }
  }

  console.log(`\n✅ Created ${Object.keys(createdPermissions).length} permissions\n`);

  // Create role-permission mappings
  console.log('🔗 Creating role-permission mappings...');
  
  for (const [role, permissionKeys] of Object.entries(ROLE_PERMISSIONS)) {
    for (const permissionKey of permissionKeys) {
      const permission = createdPermissions[permissionKey];
      
      if (!permission) {
        console.warn(`  ⚠️  Permission not found: ${permissionKey}`);
        continue;
      }

      await prisma.rolePermission.upsert({
        where: {
          role_permissionId: {
            role: role as UserRole,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          role: role as UserRole,
          permissionId: permission.id,
        },
      });
    }
    
    console.log(`  ✓ ${role}: ${permissionKeys.length} permissions`);
  }

  console.log('\n✅ Permissions and role mappings seeded successfully!');
}

// Run if executed directly
if (require.main === module) {
  seedPermissions()
    .catch((error) => {
      console.error('❌ Error seeding permissions:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
