/**
 * Super Admin Dashboard
 * System-wide overview and hospital management with role-based widgets
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Hospital, Users, Building2, Activity, Plus, UserPlus, BarChart3, Filter, AlertCircle, Store, ArrowLeftRight } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import { UserRole } from '@/lib/constants';
import { getQuickActionsForRole } from '@/lib/rbac-config';
import StatsCard from '@/components/dashboard/StatsCard';
import QuickActionsWidget from '@/components/dashboard/QuickActionsWidget';
import AlertsWidget, { Alert } from '@/components/dashboard/AlertsWidget';
import RecentActivityWidget, { ActivityItem } from '@/components/dashboard/RecentActivityWidget';
import { cn } from '@/lib/utils';
import { CreateHospitalModal } from '@/components/modals/create-hospital-modal';
import api from '@/lib/api';

interface DashboardStats {
  totalHospitals: number;
  totalUsers: number;
  totalPharmacies: number;
  activeTransfers: number;
  systemHealth: number;
}

export default function SuperAdminDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { selectedHospital, setHospitals } = useHospitalStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    // Verify Super Admin role
    if (!user || user.role !== UserRole.SUPER_ADMIN) {
      router.push('/dashboard');
      return;
    }

    fetchDashboardData();
  }, [user, router, selectedHospital]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch stats - TODO: replace with actual API calls
      setStats({
        totalHospitals: 2,
        totalUsers: 3,
        totalPharmacies: 6,
        activeTransfers: 5,
        systemHealth: 98,
      });

      // Generate alerts
      setAlerts([
        {
          id: '1',
          type: 'warning',
          title: 'Pending User Approvals',
          message: '3 new user registration requests waiting for approval',
          href: '/dashboard/users?filter=pending',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
        {
          id: '2',
          type: 'info',
          title: 'System Update Available',
          message: 'A new version is available for deployment',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      ]);

      // Generate activities
      setActivities([
        {
          id: '1',
          title: 'New Hospital Registered',
          description: 'City General Hospital added to the system',
          timestamp: new Date(Date.now() - 30 * 60 * 1000),
          user: 'Admin User',
          type: 'success',
          href: '/dashboard/hospitals',
        },
        {
          id: '2',
          title: 'User Created',
          description: 'Dr. John Smith registered as DOCTOR',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          user: 'Hospital Admin',
          type: 'info',
          href: '/dashboard/users',
        },
        {
          id: '3',
          title: 'Transfer Completed',
          description: 'Main Pharmacy → Sub Pharmacy A (50 items)',
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
          user: 'Pharmacy Manager',
          type: 'success',
          href: '/dashboard/transfers',
        },
      ]);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Refresh hospitals list
  const refreshHospitals = useCallback(async () => {
    try {
      const response = await api.get('/hospitals');
      setHospitals(response.data || []);
    } catch (error) {
      console.error('[SuperAdmin] Failed to refresh hospitals:', error);
    }
  }, [setHospitals]);

  const quickActions = getQuickActionsForRole(UserRole.SUPER_ADMIN);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {selectedHospital ? selectedHospital.name : 'Super Admin Dashboard'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedHospital ? (
              <>
                <span className="font-medium text-primary">{selectedHospital.code}</span> - Hospital-specific view
              </>
            ) : (
              <>Welcome back, {user?.fullName}! Manage all hospitals and system-wide operations.</>
            )}
          </p>
        </div>
        {selectedHospital ? (
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-all hover:bg-accent">
              <Filter className="h-4 w-4" />
              Filters
            </button>
            <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow">
              <Plus className="h-4 w-4" />
              Add User
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow"
          >
            <Plus className="h-4 w-4" />
            New Hospital
          </button>
        )}
      </div>

      {/* Stats Grid - Using new StatsCard component */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Hospitals"
          value={stats?.totalHospitals ?? 0}
          icon={Hospital}
          color="blue"
          href="/dashboard/hospitals"
          loading={loading}
          trend={{
            value: 0,
            isPositive: true,
            label: 'vs last month',
          }}
        />
        <StatsCard
          title="Total Users"
          value={stats?.totalUsers ?? 0}
          icon={Users}
          color="green"
          href="/dashboard/users"
          loading={loading}
          trend={{
            value: 0,
            isPositive: true,
            label: 'vs last month',
          }}
        />
        <StatsCard
          title="Total Pharmacies"
          value={stats?.totalPharmacies ?? 0}
          icon={Store}
          color="purple"
          href="/dashboard/pharmacies"
          loading={loading}
        />
        <StatsCard
          title="Active Transfers"
          value={stats?.activeTransfers ?? 0}
          icon={ArrowLeftRight}
          color="yellow"
          href="/dashboard/transfers"
          loading={loading}
        />
      </div>

      {/* System Health & Alerts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <StatsCard
          title="System Health"
          value={`${stats?.systemHealth ?? 0}%`}
          icon={Activity}
          color={stats && stats.systemHealth >= 95 ? 'green' : 'yellow'}
          loading={loading}
        />
        <div className="lg:col-span-2">
          <AlertsWidget alerts={alerts} title="System Alerts" maxItems={3} />
        </div>
      </div>

      {/* Context Indicator - Shows when hospital is selected */}
      {selectedHospital && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <AlertCircle className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              Viewing Hospital-Specific Data
            </p>
            <p className="text-xs text-muted-foreground">
              All data below is filtered for <span className="font-medium text-primary">{selectedHospital.name}</span>. 
              Use the dropdown in the header to switch context.
            </p>
          </div>
        </div>
      )}

      {/* Quick Actions using new widget */}
      <QuickActionsWidget actions={quickActions} title="Administration" />

      {/* Recent Activity & Cross-Hospital Stats */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RecentActivityWidget activities={activities} title="Recent System Activity" maxItems={5} />
        
        {/* Cross-Hospital Statistics */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-foreground">Cross-Hospital Insights</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Total Stock Value</p>
                <p className="text-xs text-muted-foreground">Across all hospitals</p>
              </div>
              <p className="text-2xl font-bold text-primary">PKR 2.5M</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Daily Transactions</p>
                <p className="text-xs text-muted-foreground">Last 24 hours</p>
              </div>
              <p className="text-2xl font-bold text-secondary">1,234</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Active Users</p>
                <p className="text-xs text-muted-foreground">Currently online</p>
              </div>
              <p className="text-2xl font-bold text-accent">87</p>
            </div>
          </div>
        </div>
      </div>

      {/* Hospitals List - Only show when viewing all hospitals */}
      {!selectedHospital && (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Hospitals</h2>
              <span className="text-xs text-muted-foreground">2 hospitals</span>
            </div>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {[
                { name: 'City General Hospital', code: 'CGH001', status: 'Active', pharmacies: 3 },
                { name: 'District Medical Center', code: 'DMC002', status: 'Active', pharmacies: 3 },
              ].map((hospital) => (
                <div
                  key={hospital.code}
                  className="flex items-center justify-between rounded-lg border border-border bg-background p-4 transition-all hover:border-primary hover:shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Hospital className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{hospital.name}</p>
                      <p className="text-xs text-muted-foreground">Code: {hospital.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs font-medium text-muted-foreground">{hospital.pharmacies} Pharmacies</p>
                      <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        {hospital.status}
                      </span>
                    </div>
                    <button className="rounded-lg border border-border bg-background px-4 py-1.5 text-xs font-medium text-foreground transition-all hover:bg-primary hover:text-primary-foreground hover:border-primary">
                      Manage
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hospital-Specific Content - Only show when hospital is selected */}
      {selectedHospital && (
        <div className="space-y-6">
          {/* Pharmacies Section */}
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">Pharmacies</h2>
                <span className="text-xs text-muted-foreground">3 pharmacies</span>
              </div>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {[
                  { name: 'Main Pharmacy', type: 'Main', status: 'Active', stock: '1,245 items' },
                  { name: 'Emergency Pharmacy', type: 'Sub', status: 'Active', stock: '567 items' },
                  { name: 'OPD Pharmacy', type: 'Sub', status: 'Active', stock: '892 items' },
                ].map((pharmacy, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg border border-border bg-background p-4 transition-all hover:border-secondary hover:shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
                        <Building2 className="h-5 w-5 text-secondary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{pharmacy.name}</p>
                        <p className="text-xs text-muted-foreground">Type: {pharmacy.type} Pharmacy</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs font-medium text-muted-foreground">{pharmacy.stock}</p>
                        <span className="mt-1 inline-block rounded-full bg-secondary/10 px-2 py-0.5 text-xs font-semibold text-secondary">
                          {pharmacy.status}
                        </span>
                      </div>
                      <button className="rounded-lg border border-border bg-background px-4 py-1.5 text-xs font-medium text-foreground transition-all hover:bg-secondary hover:text-secondary-foreground hover:border-secondary">
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Users Section */}
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">Recent Users</h2>
                <button className="text-xs font-medium text-primary hover:underline">View All</button>
              </div>
            </div>
            <div className="p-4">
              <div className="space-y-2">
                {[
                  { name: 'Dr. Sarah Johnson', role: 'DOCTOR', status: 'Online' },
                  { name: 'John Smith', role: 'PHARMACY_STAFF', status: 'Offline' },
                  { name: 'Emma Wilson', role: 'REGISTRATION_STAFF', status: 'Online' },
                ].map((user, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg bg-background p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.role.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      user.status === 'Online' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                    )}>
                      {user.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Hospital Modal */}
      <CreateHospitalModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          // Refresh hospitals list
          refreshHospitals();
          console.log('[SuperAdmin] Hospital created successfully');
        }}
      />
    </div>
  );
}
