'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@/lib/constants';
import { getQuickActionsForRole } from '@/lib/rbac-config';
import StatsCard from '@/components/dashboard/StatsCard';
import QuickActionsWidget from '@/components/dashboard/QuickActionsWidget';
import AlertsWidget, { Alert } from '@/components/dashboard/AlertsWidget';
import RecentActivityWidget, { ActivityItem } from '@/components/dashboard/RecentActivityWidget';
import {
  Users,
  Store,
  Activity,
  UserPlus,
  Building2,
  TrendingUp,
  ClipboardList,
  AlertCircle,
  ArrowLeftRight,
  Syringe,
} from 'lucide-react';

interface HospitalAdminStats {
  totalUsers: number;
  totalPharmacies: number;
  activeStaff: number;
  pendingApprovals: number;
  todayRegistrations: number;
  systemActivity: number;
  pendingTransfers: number;
  todayIssuance: number;
}

export default function HospitalAdminDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<HospitalAdminStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verify Hospital Admin role
    if (!user || user.role !== UserRole.HOSPITAL_ADMIN) {
      router.push('/dashboard');
      return;
    }

    fetchDashboardData();
  }, [user, router]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // TODO: Replace with actual API calls
      setStats({
        totalUsers: 12,
        totalPharmacies: 3,
        activeStaff: 8,
        pendingApprovals: 2,
        todayRegistrations: 5,
        systemActivity: 95,
        pendingTransfers: 4,
        todayIssuance: 28,
      });

      // Generate alerts
      setAlerts([
        {
          id: '1',
          type: 'warning',
          title: 'User Approval Required',
          message: '2 new staff registration requests pending approval',
          href: '/dashboard/users?filter=pending',
          timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
        },
        {
          id: '2',
          type: 'info',
          title: 'Pharmacy Performance',
          message: 'Main Pharmacy exceeded target efficiency this month',
          timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
        },
        {
          id: '3',
          type: 'warning',
          title: 'Low Stock Alert',
          message: 'Emergency Pharmacy reported 5 critical stock items',
          href: '/dashboard/inventory/alerts',
          timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
        },
      ]);

      // Generate recent activities
      setActivities([
        {
          id: '1',
          title: 'New User Registered',
          description: 'Dr. Sarah Johnson added as DOCTOR',
          timestamp: new Date(Date.now() - 30 * 60 * 1000),
          user: 'Registration Staff',
          type: 'success',
          href: '/dashboard/users',
        },
        {
          id: '2',
          title: 'Pharmacy Created',
          description: 'OPD Pharmacy added to hospital',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          user: 'You',
          type: 'success',
          href: '/dashboard/pharmacies',
        },
        {
          id: '3',
          title: 'User Role Updated',
          description: 'John Smith promoted to MAIN_PHARMACY_MANAGER',
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
          user: 'You',
          type: 'info',
          href: '/dashboard/users',
        },
        {
          id: '4',
          title: 'Stock Transfer Completed',
          description: 'Main Pharmacy → Emergency Pharmacy (25 items)',
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
          user: 'Pharmacy Manager',
          type: 'success',
          href: '/dashboard/transfers',
        },
        {
          id: '5',
          title: 'Patient Registration',
          description: '45 new patients registered today',
          timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
          user: 'Registration Staff',
          type: 'info',
          href: '/dashboard/patients',
        },
      ]);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = getQuickActionsForRole(UserRole.HOSPITAL_ADMIN);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Hospital Admin Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage hospital users, pharmacies, and operations
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatsCard
          title="Total Users"
          value={stats?.totalUsers ?? 0}
          icon={Users}
          color="blue"
          href="/dashboard/users"
          loading={loading}
          trend={{
            value: 15,
            isPositive: true,
            label: 'vs last month',
          }}
        />
        <StatsCard
          title="Total Pharmacies"
          value={stats?.totalPharmacies ?? 0}
          icon={Store}
          color="green"
          href="/dashboard/pharmacies"
          loading={loading}
        />
        <StatsCard
          title="Active Staff"
          value={stats?.activeStaff ?? 0}
          icon={Activity}
          color="purple"
          href="/dashboard/users?filter=active"
          loading={loading}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Pending Approvals"
          value={stats?.pendingApprovals ?? 0}
          icon={ClipboardList}
          color="yellow"
          href="/dashboard/users?filter=pending"
          loading={loading}
        />
        <StatsCard
          title="Pending Transfers"
          value={stats?.pendingTransfers ?? 0}
          icon={ArrowLeftRight}
          color="purple"
          href="/dashboard/transfers?filter=pending"
          loading={loading}
        />
        <StatsCard
          title="Today's Registrations"
          value={stats?.todayRegistrations ?? 0}
          icon={UserPlus}
          color="indigo"
          href="/dashboard/patients"
          loading={loading}
          trend={{
            value: 8,
            isPositive: true,
            label: 'vs yesterday',
          }}
        />
        <StatsCard
          title="Today's Issuance"
          value={stats?.todayIssuance ?? 0}
          icon={Syringe}
          color="green"
          href="/dashboard/issuance"
          loading={loading}
        />
      </div>

      {/* System Health */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatsCard
          title="System Activity"
          value={`${stats?.systemActivity ?? 0}%`}
          icon={TrendingUp}
          color={stats && stats.systemActivity >= 90 ? 'green' : 'yellow'}
          loading={loading}
        />
      </div>

      {/* Alerts */}
      <AlertsWidget alerts={alerts} title="Hospital Alerts" maxItems={5} />

      {/* Quick Actions */}
      <QuickActionsWidget actions={quickActions} title="Administration" />

      {/* Recent Activity & User Overview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentActivityWidget
          activities={activities}
          title="Recent Activity"
          maxItems={6}
        />

        {/* Pending Transfer Requests for Review */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Pending Transfer Requests</h3>
            <a
              href="/dashboard/transfers?filter=pending"
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              View All
            </a>
          </div>
          <div className="space-y-3">
            {[
              { from: 'Sub Pharmacy A', to: 'Main Pharmacy', items: 8, status: 'PENDING', time: '2 hours ago' },
              { from: 'Sub Pharmacy B', to: 'Main Pharmacy', items: 12, status: 'PENDING', time: '5 hours ago' },
              { from: 'Emergency Pharmacy', to: 'Main Pharmacy', items: 5, status: 'APPROVED', time: '1 day ago' },
              { from: 'OPD Pharmacy', to: 'Main Pharmacy', items: 15, status: 'DISPATCHED', time: '2 days ago' },
            ].map((transfer, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4 text-gray-400" />
                    <p className="text-sm font-medium text-gray-900">
                      {transfer.from} → {transfer.to}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{transfer.items} items requested</p>
                  <p className="mt-1 text-xs text-gray-400">{transfer.time}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    transfer.status === 'PENDING'
                      ? 'bg-yellow-100 text-yellow-700'
                      : transfer.status === 'APPROVED'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {transfer.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* User Statistics by Role */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Staff by Role</h3>
            <a
              href="/dashboard/users"
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              View All
            </a>
          </div>
          <div className="space-y-3">
            {[
              { role: 'Doctors', count: 8, icon: '👨‍⚕️', color: 'blue' },
              { role: 'Pharmacy Staff', count: 12, icon: '💊', color: 'green' },
              { role: 'Registration Staff', count: 4, icon: '📋', color: 'purple' },
              { role: 'Pharmacy Managers', count: 3, icon: '🏪', color: 'indigo' },
            ].map((item) => (
              <div
                key={item.role}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{item.icon}</div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.role}</p>
                    <p className="text-xs text-gray-500">Active staff members</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">{item.count}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pharmacy Performance Overview */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Pharmacy Performance</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { name: 'Main Pharmacy', efficiency: 98, status: 'Excellent', stock: 1245 },
            { name: 'Emergency Pharmacy', efficiency: 95, status: 'Good', stock: 567 },
            { name: 'OPD Pharmacy', efficiency: 92, status: 'Good', stock: 892 },
          ].map((pharmacy) => (
            <div
              key={pharmacy.name}
              className="rounded-lg border border-gray-200 bg-gray-50 p-4"
            >
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                <p className="text-sm font-semibold text-gray-900">{pharmacy.name}</p>
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Efficiency</span>
                  <span className="font-medium text-gray-900">{pharmacy.efficiency}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200">
                  <div
                    className={`h-2 rounded-full ${
                      pharmacy.efficiency >= 95 ? 'bg-green-500' : 'bg-yellow-500'
                    }`}
                    style={{ width: `${pharmacy.efficiency}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Stock Items</span>
                  <span className="font-medium text-gray-900">{pharmacy.stock}</span>
                </div>
                <span
                  className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                    pharmacy.status === 'Excellent'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {pharmacy.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Patients', value: '1,234', change: '+45 today' },
          { label: 'Total Prescriptions', value: '567', change: '+23 today' },
          { label: 'Medicines Issued', value: '892', change: '+78 today' },
          { label: 'Stock Transfers', value: '34', change: '+5 today' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-gray-200 bg-white p-4"
          >
            <p className="text-xs font-medium text-gray-600">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="mt-1 text-xs text-green-600">{stat.change}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
