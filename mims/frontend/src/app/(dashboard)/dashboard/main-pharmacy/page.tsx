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
  TrendingUp,
  Clock,
  Users,
} from 'lucide-react';

interface PharmacyStats {
  totalStockValue: number;
  lowStockItems: number;
  expiringBatches: number;
  pendingTransfers: number;
  todaysIssuance: number;
  availableStock: number;
}

export default function MainPharmacyDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<PharmacyStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verify Main Pharmacy Manager role
    if (!user || user.role !== UserRole.MAIN_PHARMACY_MANAGER) {
      router.push('/dashboard');
      return;
    }

    fetchDashboardData();
  }, [user, router]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // TODO: Replace with actual API calls
      // Fetch inventory stats
      // const inventoryRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/inventory/stats`, {
      //   headers: { Authorization: `Bearer ${token}` },
      // });

      // Mock data for now
      setStats({
        totalStockValue: 125000,
        lowStockItems: 8,
        expiringBatches: 3,
        pendingTransfers: 5,
        todaysIssuance: 45,
        availableStock: 1245,
      });

      // Generate alerts
      setAlerts([
        {
          id: '1',
          type: 'error',
          title: 'Critical Stock Alert',
          message: 'Paracetamol 500mg has only 50 tablets remaining',
          href: '/dashboard/inventory/alerts',
          timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
        },
        {
          id: '2',
          type: 'warning',
          title: 'Expiring Soon',
          message: '3 batches expiring within 30 days',
          href: '/dashboard/inventory?filter=expiring',
          timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
        },
        {
          id: '3',
          type: 'info',
          title: 'Transfer Pending Approval',
          message: 'Sub Pharmacy A requested 25 items',
          href: '/dashboard/transfers?status=PENDING',
          timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
        },
      ]);

      // Generate recent activities
      setActivities([
        {
          id: '1',
          title: 'Stock Received',
          description: 'New shipment of Amoxicillin 500mg (500 units)',
          timestamp: new Date(Date.now() - 20 * 60 * 1000),
          user: 'Pharmacy Staff',
          type: 'success',
          href: '/dashboard/inventory',
        },
        {
          id: '2',
          title: 'Transfer Dispatched',
          description: 'To Sub Pharmacy B - 30 items delivered',
          timestamp: new Date(Date.now() - 45 * 60 * 1000),
          user: 'You',
          type: 'success',
          href: '/dashboard/transfers',
        },
        {
          id: '3',
          title: 'Medicine Issued',
          description: 'Patient NR-2024-001 - 5 medicines dispensed',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          user: 'Pharmacy Staff',
          type: 'info',
          href: '/dashboard/issuance',
        },
        {
          id: '4',
          title: 'Low Stock Warning',
          description: 'Ibuprofen 400mg below minimum threshold',
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
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

  const quickActions = getQuickActionsForRole(UserRole.MAIN_PHARMACY_MANAGER);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Main Pharmacy Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage inventory, transfers, and medicine distribution
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatsCard
          title="Total Stock Value"
          value={`PKR${stats?.totalStockValue.toLocaleString() ?? 0}`}
          icon={Package}
          color="blue"
          href="/dashboard/inventory"
          loading={loading}
          trend={{
            value: 8,
            isPositive: true,
            label: 'vs last month',
          }}
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
          title="Expiring Soon"
          value={stats?.expiringBatches ?? 0}
          icon={Clock}
          color="yellow"
          href="/dashboard/inventory?filter=expiring"
          loading={loading}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatsCard
          title="Pending Transfers"
          value={stats?.pendingTransfers ?? 0}
          icon={ArrowLeftRight}
          color="purple"
          href="/dashboard/transfers?status=PENDING"
          loading={loading}
        />
        <StatsCard
          title="Today's Issuance"
          value={stats?.todaysIssuance ?? 0}
          icon={Syringe}
          color="green"
          href="/dashboard/issuance"
          loading={loading}
          trend={{
            value: 15,
            isPositive: true,
            label: 'vs yesterday',
          }}
        />
        <StatsCard
          title="Available Stock Items"
          value={stats?.availableStock ?? 0}
          icon={Package}
          color="indigo"
          href="/dashboard/inventory"
          loading={loading}
        />
      </div>

      {/* Alerts Section */}
      <AlertsWidget alerts={alerts} title="Pharmacy Alerts" maxItems={5} />

      {/* Quick Actions */}
      <QuickActionsWidget actions={quickActions} title="Pharmacy Operations" />

      {/* Recent Activity & Pending Tasks */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentActivityWidget
          activities={activities}
          title="Recent Pharmacy Activity"
          maxItems={6}
        />

        {/* Pending Transfers Widget */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Pending Transfer Requests</h3>
            <a
              href="/dashboard/transfers?status=PENDING"
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              View All
            </a>
          </div>
          <div className="space-y-3">
            {[
              {
                id: '1',
                from: 'Sub Pharmacy A',
                items: 25,
                requestedBy: 'Manager A',
                timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
              },
              {
                id: '2',
                from: 'Sub Pharmacy B',
                items: 15,
                requestedBy: 'Manager B',
                timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
              },
              {
                id: '3',
                from: 'Emergency Pharmacy',
                items: 8,
                requestedBy: 'Dr. Smith',
                timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
              },
            ].map((transfer) => (
              <div
                key={transfer.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-4 transition-all hover:border-blue-500 hover:shadow-md"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{transfer.from}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {transfer.items} items • Requested by {transfer.requestedBy}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(transfer.timestamp).toLocaleString()}
                  </p>
                </div>
                <div className="ml-4 flex gap-2">
                  <button className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700">
                    Approve
                  </button>
                  <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50">
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stock Summary */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Stock Summary by Category</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { category: 'Antibiotics', count: 245, value: 'PKR45K' },
            { category: 'Painkillers', count: 389, value: 'PKR28K' },
            { category: 'Vitamins', count: 156, value: 'PKR12K' },
            { category: 'Others', count: 455, value: 'PKR40K' },
          ].map((item) => (
            <div
              key={item.category}
              className="rounded-lg border border-gray-200 bg-gray-50 p-4"
            >
              <p className="text-xs font-medium text-gray-600">{item.category}</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{item.count}</p>
              <p className="mt-1 text-xs text-gray-500">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
