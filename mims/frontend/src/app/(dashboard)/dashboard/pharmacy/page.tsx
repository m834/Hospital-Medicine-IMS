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
  Syringe,
  FileText,
  Package,
  CheckCircle,
  Clock,
} from 'lucide-react';

interface PharmacyStaffStats {
  todayIssuance: number;
  pendingPrescriptions: number;
  completedPrescriptions: number;
  stockChecks: number;
}

export default function PharmacyStaffDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<PharmacyStaffStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== UserRole.PHARMACY_STAFF) {
      router.push('/dashboard');
      return;
    }

    fetchDashboardData();
  }, [user, router]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      setStats({
        todayIssuance: 28,
        pendingPrescriptions: 5,
        completedPrescriptions: 23,
        stockChecks: 12,
      });

      setAlerts([
        {
          id: '1',
          type: 'warning',
          title: 'Pending Prescriptions',
          message: '5 prescriptions waiting to be dispensed',
          href: '/dashboard/prescriptions?filter=pending',
          timestamp: new Date(Date.now() - 20 * 60 * 1000),
        },
        {
          id: '2',
          type: 'info',
          title: 'Low Stock Alert',
          message: 'Paracetamol 500mg running low - 50 tablets remaining',
          href: '/dashboard/inventory/alerts',
          timestamp: new Date(Date.now() - 60 * 60 * 1000),
        },
      ]);

      setActivities([
        {
          id: '1',
          title: 'Medicine Issued',
          description: 'Patient MRN-2024-145 - 3 medicines dispensed',
          timestamp: new Date(Date.now() - 10 * 60 * 1000),
          user: 'You',
          type: 'success',
          href: '/dashboard/issuance',
        },
        {
          id: '2',
          title: 'Prescription Completed',
          description: 'Patient MRN-2024-144 - All medicines issued',
          timestamp: new Date(Date.now() - 30 * 60 * 1000),
          user: 'You',
          type: 'success',
          href: '/dashboard/prescriptions',
        },
        {
          id: '3',
          title: 'Stock Check',
          description: 'Verified batch expiry dates for Aisle A',
          timestamp: new Date(Date.now() - 90 * 60 * 1000),
          user: 'You',
          type: 'info',
          href: '/dashboard/inventory',
        },
      ]);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = getQuickActionsForRole(UserRole.PHARMACY_STAFF);

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Pharmacy Staff Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Medicine dispensing and inventory management
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Today's Issuance"
          value={stats?.todayIssuance ?? 0}
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
          title="Pending Prescriptions"
          value={stats?.pendingPrescriptions ?? 0}
          icon={Clock}
          color="yellow"
          href="/dashboard/prescriptions?filter=pending"
          loading={loading}
        />
        <StatsCard
          title="Completed Today"
          value={stats?.completedPrescriptions ?? 0}
          icon={CheckCircle}
          color="blue"
          href="/dashboard/prescriptions?filter=completed"
          loading={loading}
        />
        <StatsCard
          title="Stock Checks"
          value={stats?.stockChecks ?? 0}
          icon={Package}
          color="purple"
          href="/dashboard/inventory"
          loading={loading}
        />
      </div>

      <AlertsWidget alerts={alerts} title="Pharmacy Alerts" maxItems={5} />

      <QuickActionsWidget actions={quickActions} title="Quick Actions" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentActivityWidget
          activities={activities}
          title="Recent Activity"
          maxItems={6}
        />

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Pending Prescriptions</h3>
            <a
              href="/dashboard/prescriptions?filter=pending"
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              View All
            </a>
          </div>
          <div className="space-y-3">
            {[
              { patient: 'MRN-2024-150', medicines: 3, priority: 'Normal', time: '5 min ago' },
              { patient: 'MRN-2024-149', medicines: 2, priority: 'Urgent', time: '12 min ago' },
              { patient: 'MRN-2024-148', medicines: 4, priority: 'Normal', time: '20 min ago' },
            ].map((prescription, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{prescription.patient}</p>
                    {prescription.priority === 'Urgent' && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Urgent
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {prescription.medicines} medicines to dispense
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">{prescription.time}</p>
                  <button className="mt-1 rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700">
                    Issue
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Today's Summary</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Prescriptions Processed', value: '23', icon: FileText },
            { label: 'Medicines Dispensed', value: '87', icon: Syringe },
            { label: 'Patients Served', value: '23', icon: CheckCircle },
            { label: 'Average Time', value: '4.2 min', icon: Clock },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-lg border border-gray-200 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-gray-400" />
                  <p className="text-xs text-gray-600">{item.label}</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">{item.value}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
