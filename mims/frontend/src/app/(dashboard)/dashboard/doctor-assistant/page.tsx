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
  FileText,
  Users,
  ClipboardList,
  CheckCircle,
} from 'lucide-react';

interface DoctorAssistantStats {
  assistedPrescriptions: number;
  todayPatients: number;
  pendingReviews: number;
  completedToday: number;
}

export default function DoctorAssistantDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DoctorAssistantStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== UserRole.DOCTOR_ASSISTANT) {
      router.push('/dashboard');
      return;
    }

    fetchDashboardData();
  }, [user, router]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      setStats({
        assistedPrescriptions: 45,
        todayPatients: 18,
        pendingReviews: 2,
        completedToday: 15,
      });

      setAlerts([
        {
          id: '1',
          type: 'info',
          title: 'Pending Doctor Review',
          message: '2 prescriptions waiting for doctor signature',
          href: '/dashboard/prescriptions?filter=pending',
          timestamp: new Date(Date.now() - 30 * 60 * 1000),
        },
      ]);

      setActivities([
        {
          id: '1',
          title: 'Prescription Prepared',
          description: 'Patient MRN-2024-145 - Draft ready for doctor review',
          timestamp: new Date(Date.now() - 20 * 60 * 1000),
          user: 'You',
          type: 'info',
          href: '/dashboard/prescriptions',
        },
        {
          id: '2',
          title: 'Patient Registered',
          description: 'New patient MRN-2024-146 registered',
          timestamp: new Date(Date.now() - 45 * 60 * 1000),
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

  const quickActions = getQuickActionsForRole(UserRole.DOCTOR_ASSISTANT);

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Doctor Assistant Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Support doctors with patient care and prescriptions
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Assisted Prescriptions"
          value={stats?.assistedPrescriptions ?? 0}
          icon={FileText}
          color="blue"
          href="/dashboard/prescriptions"
          loading={loading}
        />
        <StatsCard
          title="Today's Patients"
          value={stats?.todayPatients ?? 0}
          icon={Users}
          color="green"
          href="/dashboard/patients"
          loading={loading}
        />
        <StatsCard
          title="Pending Reviews"
          value={stats?.pendingReviews ?? 0}
          icon={ClipboardList}
          color="yellow"
          href="/dashboard/prescriptions?filter=pending"
          loading={loading}
        />
        <StatsCard
          title="Completed Today"
          value={stats?.completedToday ?? 0}
          icon={CheckCircle}
          color="purple"
          loading={loading}
        />
      </div>

      <AlertsWidget alerts={alerts} title="Notifications" maxItems={5} />

      <QuickActionsWidget actions={quickActions} title="Quick Actions" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentActivityWidget
          activities={activities}
          title="Recent Activity"
          maxItems={6}
        />

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Pending Doctor Reviews</h3>
          <div className="space-y-3">
            {[
              { patient: 'MRN-2024-150', medicines: 3, time: '15 min ago' },
              { patient: 'MRN-2024-149', medicines: 2, time: '1 hour ago' },
            ].map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.patient}</p>
                  <p className="text-xs text-gray-500">{item.medicines} medicines prescribed</p>
                </div>
                <span className="text-xs text-gray-400">{item.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
