'use client';

import { useState, useEffect } from 'react';
import { Shield, Users, Lock, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { UserRole, ROLE_LABELS } from '@/lib/constants';
import {
  ROLE_DESCRIPTIONS,
  ROLE_PERMISSION_COUNTS,
  ROLE_CATEGORIES,
  getRoleBadgeClass,
} from '@/lib/roles';
import { useToast } from '@/hooks/use-toast';

interface Permission {
  id: string;
  resource: string;
  action: string;
  scope: string;
  description: string | null;
}

interface RolePermissionMatrix {
  [role: string]: Permission[];
}

export default function PermissionsPage() {
  const [matrix, setMatrix] = useState<RolePermissionMatrix>({});
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPermissionMatrix();
  }, []);

  const fetchPermissionMatrix = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/permissions/matrix/all');
      setMatrix(response.data);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to load permissions';
      setError(errorMsg);
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getResourceGroups = (permissions: Permission[]) => {
    const groups: Record<string, Permission[]> = {};
    permissions.forEach((perm) => {
      if (!groups[perm.resource]) {
        groups[perm.resource] = [];
      }
      groups[perm.resource].push(perm);
    });
    return groups;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading permissions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-red-800">Error Loading Permissions</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            <button
              onClick={fetchPermissionMatrix}
              className="mt-3 text-sm font-medium text-red-600 hover:text-red-500"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Role Permissions
          </h1>
          <p className="text-muted-foreground mt-2">
            View and manage role-based access control permissions
          </p>
        </div>
      </div>

      {/* Role Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(ROLE_CATEGORIES).map(([category, roles]) => (
          <div key={category} className="bg-card rounded-lg border p-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5" />
              {category.charAt(0) + category.slice(1).toLowerCase()} Roles
            </h3>
            <div className="space-y-3">
              {roles.map((role) => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedRole === role
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/50 hover:bg-accent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={getRoleBadgeClass(role)}>
                      {ROLE_LABELS[role]}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {ROLE_PERMISSION_COUNTS[role]} permissions
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {ROLE_DESCRIPTIONS[role]}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Selected Role Permissions */}
      {selectedRole && matrix[selectedRole] && (
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <Lock className="h-6 w-6" />
              Permissions for {ROLE_LABELS[selectedRole]}
            </h2>
            <button
              onClick={() => setSelectedRole(null)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Clear Selection
            </button>
          </div>

          <div className="space-y-6">
            {Object.entries(getResourceGroups(matrix[selectedRole])).map(
              ([resource, permissions]) => (
                <div key={resource} className="border-l-4 border-primary/30 pl-4">
                  <h3 className="text-lg font-medium mb-3 capitalize">
                    {resource.replace(/_/g, ' ')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {permissions.map((perm) => (
                      <div
                        key={perm.id}
                        className="bg-accent/50 rounded-md p-3 border border-border"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium capitalize">
                            {perm.action}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-muted rounded text-muted-foreground">
                            {perm.scope}
                          </span>
                        </div>
                        {perm.description && (
                          <p className="text-xs text-muted-foreground">
                            {perm.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Roles</p>
          <p className="text-2xl font-bold">{Object.keys(matrix).length}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Permissions</p>
          <p className="text-2xl font-bold">
            {Object.values(matrix)
              .flat()
              .filter(
                (perm, index, self) =>
                  self.findIndex((p) => p.id === perm.id) === index
              ).length}
          </p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground mb-1">Resources</p>
          <p className="text-2xl font-bold">
            {
              new Set(
                Object.values(matrix)
                  .flat()
                  .map((p) => p.resource)
              ).size
            }
          </p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground mb-1">Actions</p>
          <p className="text-2xl font-bold">
            {
              new Set(
                Object.values(matrix)
                  .flat()
                  .map((p) => p.action)
              ).size
            }
          </p>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">About Permissions</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Permissions are automatically assigned based on roles</li>
              <li>
                <strong>Scope:</strong> &quot;all&quot; = system-wide, &quot;own_pharmacy&quot; = user&apos;s pharmacy only
              </li>
              <li>Changes to permissions require backend seed data update</li>
              <li>Contact Super Admin to modify role-permission mappings</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
