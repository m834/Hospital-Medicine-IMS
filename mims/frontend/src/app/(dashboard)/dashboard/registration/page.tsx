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
  UserPlus,
  Users,
  TrendingUp,
  ClipboardCheck,
} from 'lucide-react';

interface RegistrationStats {
  totalPatients: number;
  todayRegistrations: number;
  thisWeekRegistrations: number;
  opdVisits: number;
  emergencyVisits: number;
}

export default function RegistrationDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<RegistrationStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== UserRole.REGISTRATION_STAFF) {
      router.push('/dashboard');
      return;
    }

    fetchDashboardData();
  }, [user, router]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      setStats({
        totalPatients: 1234,
        todayRegistrations: 45,
        thisWeekRegistrations: 234,
        opdVisits: 38,
        emergencyVisits: 7,
      });

      setAlerts([
        {
          id: '1',
          type: 'info',
          title: 'Peak Registration Hours',
          message: 'Morning hours (9-11 AM) showing high traffic',
          timestamp: new Date(Date.now() - 60 * 60 * 1000),
        },
      ]);

      setActivities([
        {
          id: '1',
          title: 'Patient Registered',
          description: 'NR-2024-150 - OPD Visit',
          timestamp: new Date(Date.now() - 10 * 60 * 1000),
          user: 'You',
          type: 'success',
          href: '/dashboard/patients',
        },
        {
          id: '2',
          title: 'Emergency Registration',
          description: 'NR-2024-149 - Emergency Visit',
          timestamp: new Date(Date.now() - 25 * 60 * 1000),
          user: 'You',
          type: 'warning',
          href: '/dashboard/patients',
        },
        {
          id: '3',
          title: 'Patient Registered',
          description: 'NR-2024-148 - OPD Visit',
          timestamp: new Date(Date.now() - 40 * 60 * 1000),
          user: 'You',
          type: 'success',
          href: '/dashboard/patients',
        },
      ]);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = getQuickActionsForRole(UserRole.REGISTRATION_STAFF);

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Registration Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Patient registration and visit management
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatsCard
          title="Total Patients"
          value={stats?.totalPatients ?? 0}
          icon={Users}
          color="blue"
          href="/dashboard/patients"
          loading={loading}
        />
        <StatsCard
          title="Today's Registrations"
          value={stats?.todayRegistrations ?? 0}
          icon={UserPlus}
          color="green"
          href="/dashboard/patients?filter=today"
          loading={loading}
          trend={{
            value: 15,
            isPositive: true,
            label: 'vs yesterday',
          }}
        />
        <StatsCard
          title="This Week"
          value={stats?.thisWeekRegistrations ?? 0}
          icon={TrendingUp}
          color="purple"
          href="/dashboard/patients?filter=week"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatsCard
          title="OPD Visits Today"
          value={stats?.opdVisits ?? 0}
          icon={ClipboardCheck}
          color="indigo"
          loading={loading}
        />
        <StatsCard
          title="Emergency Visits Today"
          value={stats?.emergencyVisits ?? 0}
          icon={ClipboardCheck}
          color="red"
          loading={loading}
        />
      </div>

      <AlertsWidget alerts={alerts} title="Notifications" maxItems={5} />

      <QuickActionsWidget actions={quickActions} title="Quick Actions" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentActivityWidget
          activities={activities}
          title="Recent Registrations"
          maxItems={8}
        />

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Registration by Type</h3>
          <div className="space-y-4">
            {[
              { type: 'OPD', count: 38, percentage: 84, color: 'blue' },
              { type: 'Emergency', count: 7, percentage: 16, color: 'red' },
            ].map((item) => (
              <div key={item.type}>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium text-gray-900">{item.type}</span>
                  <span className="text-gray-600">{item.count} patients</span>
                </div>
                <div className="h-3 w-full rounded-full bg-gray-200">
                  <div
                    className={`h-3 rounded-full ${
                      item.color === 'blue' ? 'bg-blue-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-gray-200 p-4">
            <h4 className="mb-3 text-sm font-semibold text-gray-900">Today's Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Registrations</span>
                <span className="font-medium text-gray-900">45</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Average Time</span>
                <span className="font-medium text-gray-900">3.5 min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Peak Hour</span>
                <span className="font-medium text-gray-900">10:00 AM</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
