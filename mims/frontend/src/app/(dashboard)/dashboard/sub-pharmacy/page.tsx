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
  Package,
  AlertTriangle,
  ArrowLeftRight,
  Syringe,
  Clock,
  Send,
  CheckCircle,
} from 'lucide-react';

interface SubPharmacyStats {
  currentStock: number;
  lowStockItems: number;
  pendingRequests: number;
  todaysIssuance: number;
  expiringBatches: number;
  receivedToday: number;
}

export default function SubPharmacyDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<SubPharmacyStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verify Sub Pharmacy Manager role
    if (!user || user.role !== UserRole.SUB_PHARMACY_MANAGER) {
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
        currentStock: 567,
        lowStockItems: 5,
        pendingRequests: 2,
        todaysIssuance: 28,
        expiringBatches: 1,
        receivedToday: 3,
      });

      // Generate alerts
      setAlerts([
        {
          id: '1',
          type: 'error',
          title: 'Critical Stock Alert',
          message: 'Aspirin 100mg has only 20 tablets remaining',
          href: '/dashboard/inventory/alerts',
          timestamp: new Date(Date.now() - 30 * 60 * 1000),
        },
        {
          id: '2',
          type: 'warning',
          title: 'Transfer Request Pending',
          message: 'Waiting for main pharmacy approval (2 days)',
          href: '/dashboard/transfers?status=PENDING',
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
        {
          id: '3',
          type: 'info',
          title: 'Stock Dispatched',
          message: 'Your transfer request has been dispatched from main pharmacy',
          href: '/dashboard/transfers?status=DISPATCHED',
          timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
        },
      ]);

      // Generate recent activities
      setActivities([
        {
          id: '1',
          title: 'Transfer Received',
          description: 'From Main Pharmacy - 15 items received',
          timestamp: new Date(Date.now() - 15 * 60 * 1000),
          user: 'You',
          type: 'success',
          href: '/dashboard/transfers',
        },
        {
          id: '2',
          title: 'Medicine Issued',
          description: 'Patient NR-2024-045 - 3 medicines dispensed',
          timestamp: new Date(Date.now() - 45 * 60 * 1000),
          user: 'Pharmacy Staff',
          type: 'info',
          href: '/dashboard/issuance',
        },
        {
          id: '3',
          title: 'Transfer Requested',
          description: 'Requested Paracetamol 500mg (200 tablets)',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          user: 'You',
          type: 'info',
          href: '/dashboard/transfers',
        },
        {
          id: '4',
          title: 'Low Stock Alert',
          description: 'Amoxicillin 250mg below minimum threshold',
          timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
          user: 'System',
          type: 'warning',
          href: '/dashboard/inventory/alerts',
        },
      ]);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = getQuickActionsForRole(UserRole.SUB_PHARMACY_MANAGER);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Sub Pharmacy Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage your pharmacy's stock and request transfers
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatsCard
          title="Current Stock Items"
          value={stats?.currentStock ?? 0}
          icon={Package}
          color="blue"
          href="/dashboard/inventory"
          loading={loading}
        />
        <StatsCard
          title="Low Stock Items"
          value={stats?.lowStockItems ?? 0}
          icon={AlertTriangle}
          color="red"
          href="/dashboard/inventory/alerts"
          loading={loading}
        />
        <StatsCard
          title="Pending Requests"
          value={stats?.pendingRequests ?? 0}
          icon={Clock}
          color="yellow"
          href="/dashboard/transfers?status=PENDING"
          loading={loading}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatsCard
          title="Today's Issuance"
          value={stats?.todaysIssuance ?? 0}
          icon={Syringe}
          color="green"
          href="/dashboard/issuance"
          loading={loading}
          trend={{
            value: 10,
            isPositive: true,
            label: 'vs yesterday',
          }}
        />
        <StatsCard
          title="Expiring Soon"
          value={stats?.expiringBatches ?? 0}
          icon={Clock}
          color="purple"
          href="/dashboard/inventory?filter=expiring"
          loading={loading}
        />
        <StatsCard
          title="Received Today"
          value={stats?.receivedToday ?? 0}
          icon={CheckCircle}
          color="indigo"
          href="/dashboard/transfers?status=RECEIVED"
          loading={loading}
        />
      </div>

      {/* Alerts Section */}
      <AlertsWidget alerts={alerts} title="Pharmacy Alerts" maxItems={5} />

      {/* Quick Actions */}
      <QuickActionsWidget actions={quickActions} title="Quick Actions" />

      {/* Recent Activity & Transfer Status */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentActivityWidget
          activities={activities}
          title="Recent Activity"
          maxItems={6}
        />

        {/* Transfer Requests Widget */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">My Transfer Requests</h3>
            <a
              href="/dashboard/transfers"
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              View All
            </a>
          </div>
          <div className="space-y-3">
            {[
              {
                id: '1',
                items: 15,
                status: 'DISPATCHED',
                requestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
              },
              {
                id: '2',
                items: 8,
                status: 'PENDING',
                requestedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
              },
            ].map((transfer) => (
              <div
                key={transfer.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    Transfer Request #{transfer.id}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {transfer.items} items requested
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(transfer.requestedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="ml-4">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      transfer.status === 'DISPATCHED'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {transfer.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stock Overview */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Stock Overview</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { category: 'Emergency Meds', count: 85, status: 'Good' },
            { category: 'Common Drugs', count: 234, status: 'Good' },
            { category: 'Antibiotics', count: 128, status: 'Low' },
            { category: 'Others', count: 120, status: 'Good' },
          ].map((item) => (
            <div
              key={item.category}
              className="rounded-lg border border-gray-200 bg-gray-50 p-4"
            >
              <p className="text-xs font-medium text-gray-600">{item.category}</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{item.count}</p>
              <span
                className={`mt-1 inline-block text-xs font-medium ${
                  item.status === 'Good' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
