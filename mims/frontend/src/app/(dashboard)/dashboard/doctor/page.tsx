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
import api from '@/lib/api';
import { formatMRN } from '@/lib/mrn';
import {
  Users,
  FileText,
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
  const [todaySchedule, setTodaySchedule] = useState<
    { time: string; patient: string; type: string; status: string }[]
  >([]);

  useEffect(() => {
    if (!user || user.role !== UserRole.DOCTOR) {
      router.push('/dashboard');
      return;
    }

    let isMounted = true;
    fetchDashboardData(isMounted);
    return () => {
      isMounted = false;
    };
  }, [user, router]);

  const fetchDashboardData = async (isMounted: boolean) => {
    try {
      setLoading(true);

      if (!user?.id) return;

      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);
      const weekStart = new Date(todayStart);
      weekStart.setDate(todayStart.getDate() - 6);

      const [
        totalVisitsRes,
        todayVisitsRes,
        completedTodayRes,
        weekVisitsRes,
        pendingPrescriptionsRes,
        recentVisitsRes,
      ] = await Promise.all([
        api.get('/visits', {
          params: { attendingDoctorId: user.id, page: 1, limit: 1 },
        }),
        api.get('/visits', {
          params: {
            attendingDoctorId: user.id,
            startDate: todayStart.toISOString(),
            endDate: todayEnd.toISOString(),
            page: 1,
            limit: 1,
          },
        }),
        api.get('/visits', {
          params: {
            attendingDoctorId: user.id,
            status: 'COMPLETED',
            startDate: todayStart.toISOString(),
            endDate: todayEnd.toISOString(),
            page: 1,
            limit: 1,
          },
        }),
        api.get('/visits', {
          params: {
            attendingDoctorId: user.id,
            startDate: weekStart.toISOString(),
            endDate: todayEnd.toISOString(),
            page: 1,
            limit: 1,
          },
        }),
        api.get('/prescriptions', {
          params: { doctorId: user.id, status: 'PENDING', page: 1, limit: 1 },
        }),
        api.get('/visits', {
          params: { attendingDoctorId: user.id, page: 1, limit: 6 },
        }),
      ]);

      const totalPatients = totalVisitsRes.data?.meta?.total ?? 0;
      const todayAppointments = todayVisitsRes.data?.meta?.total ?? 0;
      const completedToday = completedTodayRes.data?.meta?.total ?? 0;
      const thisWeekPatients = weekVisitsRes.data?.meta?.total ?? 0;
      const pendingPrescriptions = pendingPrescriptionsRes.data?.total ?? 0;

      const recentVisits = recentVisitsRes.data?.data ?? [];

      if (!isMounted) return;

      setStats({
        totalPatients,
        todayAppointments,
        pendingPrescriptions,
        completedToday,
        thisWeekPatients,
      });

      const nextAlerts: Alert[] = [];
      if (pendingPrescriptions > 0) {
        nextAlerts.push({
          id: 'pending-prescriptions',
          type: 'warning',
          title: 'Pending Prescriptions',
          message: `${pendingPrescriptions} prescription(s) awaiting your review`,
          href: '/dashboard/prescriptions?filter=pending',
          timestamp: new Date(),
        });
      }

      setAlerts(nextAlerts);

      const nextActivities: ActivityItem[] = recentVisits.map((visit: any) => ({
        id: visit.id,
        title: 'OPD Visit',
        description: `${formatMRN(visit.patient?.nrNumber) || 'N/A'} - ${visit.patient?.fullName || 'Patient'}`,
        timestamp: new Date(visit.registeredAt || visit.visitDate || Date.now()),
        user: 'You',
        type: visit.status === 'COMPLETED' ? 'success' : 'info',
        href: `/doctor/consult/${visit.id}`,
      }));

      setActivities(nextActivities);

      const todayVisits = todayVisitsRes.data?.data ?? [];
      const scheduleItems = todayVisits.slice(0, 4).map((visit: any) => ({
        time: new Date(visit.registeredAt || visit.visitDate || Date.now()).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        patient: formatMRN(visit.patient?.nrNumber) || 'N/A',
        type: visit.visitType || 'OPD',
        status: visit.status || 'Scheduled',
      }));
      setTodaySchedule(scheduleItems);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      if (isMounted) setLoading(false);
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
            {todaySchedule.length === 0 ? (
              <div className="rounded-lg border border-gray-200 p-3 text-sm text-gray-500">
                No appointments today
              </div>
            ) : (
              todaySchedule.map((appointment, index) => (
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
                      appointment.status === 'COMPLETED'
                        ? 'bg-green-100 text-green-700'
                        : appointment.status === 'IN_PROGRESS'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {appointment.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
