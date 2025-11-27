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
  FileText,
  ClipboardList,
  Calendar,
  Clock,
  CheckCircle,
} from 'lucide-react';

interface DoctorStats {
  totalPatients: number;
  todayAppointments: number;
  pendingPrescriptions: number;
  completedToday: number;
  thisWeekPatients: number;
}

export default function DoctorDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DoctorStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== UserRole.DOCTOR) {
      router.push('/dashboard');
      return;
    }

    fetchDashboardData();
  }, [user, router]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      setStats({
        totalPatients: 145,
        todayAppointments: 12,
        pendingPrescriptions: 3,
        completedToday: 8,
        thisWeekPatients: 67,
      });

      setAlerts([
        {
          id: '1',
          type: 'warning',
          title: 'Pending Prescriptions',
          message: '3 prescriptions awaiting your review and signature',
          href: '/dashboard/prescriptions?filter=pending',
          timestamp: new Date(Date.now() - 30 * 60 * 1000),
        },
        {
          id: '2',
          type: 'info',
          title: 'Scheduled Appointments',
          message: 'You have 4 appointments scheduled for tomorrow',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
      ]);

      setActivities([
        {
          id: '1',
          title: 'Prescription Created',
          description: 'Patient NR-2024-145 - 3 medicines prescribed',
          timestamp: new Date(Date.now() - 15 * 60 * 1000),
          user: 'You',
          type: 'success',
          href: '/dashboard/prescriptions',
        },
        {
          id: '2',
          title: 'Patient Consultation',
          description: 'Patient NR-2024-144 - OPD visit completed',
          timestamp: new Date(Date.now() - 45 * 60 * 1000),
          user: 'You',
          type: 'info',
          href: '/dashboard/patients',
        },
        {
          id: '3',
          title: 'Prescription Issued',
          description: 'Patient NR-2024-143 - Medicines dispensed from pharmacy',
          timestamp: new Date(Date.now() - 90 * 60 * 1000),
          user: 'Pharmacy Staff',
          type: 'success',
          href: '/dashboard/prescriptions',
        },
      ]);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = getQuickActionsForRole(UserRole.DOCTOR);

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Doctor Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Welcome back, Dr. {user?.fullName}
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
          title="Today's Appointments"
          value={stats?.todayAppointments ?? 0}
          icon={Calendar}
          color="green"
          href="/dashboard/patients?filter=today"
          loading={loading}
        />
        <StatsCard
          title="Pending Prescriptions"
          value={stats?.pendingPrescriptions ?? 0}
          icon={Clock}
          color="yellow"
          href="/dashboard/prescriptions?filter=pending"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatsCard
          title="Completed Today"
          value={stats?.completedToday ?? 0}
          icon={CheckCircle}
          color="indigo"
          loading={loading}
          trend={{
            value: 12,
            isPositive: true,
            label: 'vs yesterday',
          }}
        />
        <StatsCard
          title="This Week Patients"
          value={stats?.thisWeekPatients ?? 0}
          icon={FileText}
          color="purple"
          href="/dashboard/patients?filter=week"
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
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Today's Schedule</h3>
          <div className="space-y-3">
            {[
              { time: '09:00 AM', patient: 'NR-2024-150', type: 'OPD', status: 'Completed' },
              { time: '10:30 AM', patient: 'NR-2024-151', type: 'OPD', status: 'Completed' },
              { time: '11:00 AM', patient: 'NR-2024-152', type: 'Emergency', status: 'In Progress' },
              { time: '02:00 PM', patient: 'NR-2024-153', type: 'OPD', status: 'Scheduled' },
            ].map((appointment, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                    <Clock className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{appointment.time}</p>
                    <p className="text-xs text-gray-500">
                      {appointment.patient} - {appointment.type}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    appointment.status === 'Completed'
                      ? 'bg-green-100 text-green-700'
                      : appointment.status === 'In Progress'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {appointment.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
