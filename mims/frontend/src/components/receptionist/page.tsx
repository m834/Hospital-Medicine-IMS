'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import { UserRole } from '@/lib/constants';
import { getQuickActionsForRole } from '@/lib/rbac-config';
import StatsCard from '@/components/dashboard/StatsCard';
import QuickActionsWidget from '@/components/dashboard/QuickActionsWidget';
import AlertsWidget, { Alert } from '@/components/dashboard/AlertsWidget';
import RecentActivityWidget, { ActivityItem } from '@/components/dashboard/RecentActivityWidget';
import { Card, CardContent } from '@/components/ui/card';
import api from '@/lib/api';
import {
  UserPlus,
  Users,
  TrendingUp,
  ClipboardCheck,
} from 'lucide-react';

interface ReceptionistStats {
  totalPatients: number;
  todayRegistrations: number;
  thisWeekRegistrations: number;
  opdVisits: number;
  emergencyVisits: number;
}

export default function ReceptionistDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();
  const [stats, setStats] = useState<ReceptionistStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const hospitalId = selectedHospital?.id || user?.hospitalId;
  const isMasterOrSuper = user?.role === UserRole.MASTER_ADMIN || user?.role === UserRole.SUPER_ADMIN;

  useEffect(() => {
    if (!user || user.role !== UserRole.RECEPTIONIST) {
      router.push('/dashboard');
      return;
    }

    fetchDashboardData();
  }, [user, router]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      if (!hospitalId) return;

      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);
      const weekStart = new Date(todayStart);
      weekStart.setDate(todayStart.getDate() - 6);

      const [
        patientsRes,
        todayVisitsRes,
        weekVisitsRes,
        todayOpdRes,
        todayEmergencyRes,
        recentVisitsRes,
      ] = await Promise.all([
        api.get('/patients', { params: { hospitalId, page: 1, limit: 1 } }),
        api.get('/visits', {
          params: {
            hospitalId,
            startDate: todayStart.toISOString(),
            endDate: todayEnd.toISOString(),
            page: 1,
            limit: 1,
          },
        }),
        api.get('/visits', {
          params: {
            hospitalId,
            startDate: weekStart.toISOString(),
            endDate: todayEnd.toISOString(),
            page: 1,
            limit: 1,
          },
        }),
        api.get('/visits', {
          params: {
            hospitalId,
            visitType: 'OPD',
            startDate: todayStart.toISOString(),
            endDate: todayEnd.toISOString(),
            page: 1,
            limit: 1,
          },
        }),
        api.get('/visits', {
          params: {
            hospitalId,
            visitType: 'EMERGENCY',
            startDate: todayStart.toISOString(),
            endDate: todayEnd.toISOString(),
            page: 1,
            limit: 1,
          },
        }),
        api.get('/visits', {
          params: { hospitalId, page: 1, limit: 8 },
        }),
      ]);

      const totalPatients = patientsRes.data?.total ?? 0;
      const todayRegistrations = todayVisitsRes.data?.meta?.total ?? 0;
      const thisWeekRegistrations = weekVisitsRes.data?.meta?.total ?? 0;
      const opdVisits = todayOpdRes.data?.meta?.total ?? 0;
      const emergencyVisits = todayEmergencyRes.data?.meta?.total ?? 0;

      setStats({
        totalPatients,
        todayRegistrations,
        thisWeekRegistrations,
        opdVisits,
        emergencyVisits,
      });

      const nextAlerts: Alert[] = [];
      if (todayRegistrations === 0) {
        nextAlerts.push({
          id: 'no-registrations',
          type: 'info',
          title: 'No registrations yet',
          message: 'No patient registrations recorded today',
          timestamp: new Date(),
        });
      }
      setAlerts(nextAlerts);

      const recentVisits = recentVisitsRes.data?.data ?? [];
      const nextActivities: ActivityItem[] = recentVisits.map((visit: any) => ({
        id: visit.id,
        title: 'Patient Visit',
        description: `${visit.patient?.nrNumber || 'N/A'} - ${visit.patient?.fullName || 'Patient'}`,
        timestamp: new Date(visit.registeredAt || visit.visitDate || Date.now()),
        user: 'Reception',
        type: visit.visitType === 'EMERGENCY' ? 'warning' : 'success',
        href: '/dashboard/patients',
      }));
      setActivities(nextActivities);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = getQuickActionsForRole(UserRole.RECEPTIONIST);

  if (isMasterOrSuper && !hospitalId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Please select a hospital from the dropdown to proceed</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Receptionist Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Patient registration and front desk management
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
            {(() => {
              const opdCount = stats?.opdVisits ?? 0;
              const emergencyCount = stats?.emergencyVisits ?? 0;
              const total = opdCount + emergencyCount || 1;
              return [
                {
                  type: 'OPD',
                  count: opdCount,
                  percentage: Math.round((opdCount / total) * 100),
                  color: 'blue',
                },
                {
                  type: 'Emergency',
                  count: emergencyCount,
                  percentage: Math.round((emergencyCount / total) * 100),
                  color: 'red',
                },
              ];
            })().map((item) => (
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
                <span className="font-medium">{stats?.todayRegistrations ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">OPD Visits</span>
                <span className="font-medium">{stats?.opdVisits ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Emergency Visits</span>
                <span className="font-medium">{stats?.emergencyVisits ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
