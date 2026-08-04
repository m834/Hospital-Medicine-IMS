'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@/lib/constants';
import { getQuickActionsForRole } from '@/lib/rbac-config';
import StatsCard from '@/components/dashboard/StatsCard';
import QuickActionsWidget from '@/components/dashboard/QuickActionsWidget';
import RecentActivityWidget, { ActivityItem } from '@/components/dashboard/RecentActivityWidget';
import { UserPlus, Users, ClipboardCheck, Activity, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { formatMRN } from '@/lib/mrn';

interface PatientStats {
  total: number;
  todayRegistrations: number;
  byVisitType: Record<string, number>;
  byGender: Record<string, number>;
}

interface RecentPatient {
  id: string;
  nrNumber: string;
  fullName: string;
  visitType: string;
  registeredAt: string;
}

export default function RegistrationDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<PatientStats | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!user || user.role !== UserRole.REGISTRATION_STAFF) {
      router.push('/dashboard');
      return;
    }
    fetchDashboardData();
  }, [user, router]);

  const fetchDashboardData = useCallback(async () => {
    if (!user?.hospitalId) return;
    try {
      setLoading(true);
      const hospitalId = user.hospitalId;

      const [statsRes, patientsRes] = await Promise.allSettled([
        api.get('/patients/stats', { params: { hospitalId } }),
        api.get('/patients', {
          params: { hospitalId, limit: 10, sortBy: 'registeredAt', sortOrder: 'desc' },
        }),
      ]);

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data);
      }

      if (patientsRes.status === 'fulfilled') {
        const patients: RecentPatient[] = patientsRes.value.data?.data || patientsRes.value.data || [];
        const activityItems: ActivityItem[] = patients.slice(0, 8).map((p) => ({
          id: p.id,
          title: 'Patient Registered',
          description: `${formatMRN(p.nrNumber)} — ${p.fullName} (${p.visitType || 'OPD'})`,
          timestamp: new Date(p.registeredAt),
          user: 'Registration Staff',
          type: (p.visitType === 'EMERGENCY' ? 'warning' : 'success') as 'warning' | 'success',
          href: `/dashboard/patients/${p.id}`,
        }));
        setActivities(activityItems);
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const quickActions = getQuickActionsForRole(UserRole.REGISTRATION_STAFF);

  // Derived values
  const opdCount = stats?.byVisitType?.['OPD'] ?? stats?.byVisitType?.['opd'] ?? 0;
  const emergencyCount = stats?.byVisitType?.['EMERGENCY'] ?? stats?.byVisitType?.['emergency'] ?? 0;
  const totalVisitTypes = opdCount + emergencyCount || 1;
  const opdPct = Math.round((opdCount / totalVisitTypes) * 100);
  const emergencyPct = Math.round((emergencyCount / totalVisitTypes) * 100);

  const genderEntries = Object.entries(stats?.byGender || {});
  const totalGender = genderEntries.reduce((s, [, v]) => s + v, 0) || 1;
  const genderColors: Record<string, string> = {
    MALE: 'bg-blue-500', FEMALE: 'bg-pink-500', OTHER: 'bg-purple-500',
    male: 'bg-blue-500', female: 'bg-pink-500', other: 'bg-purple-500',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Registration Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Patient registration and visit management
            {lastUpdated && (
              <span className="ml-2 text-xs text-gray-400">
                · Updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDashboardData} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Patients" value={stats?.total ?? 0} icon={Users} color="blue" href="/dashboard/patients" loading={loading} />
        <StatsCard title="Today's Registrations" value={stats?.todayRegistrations ?? 0} icon={UserPlus} color="green" href="/dashboard/patients" loading={loading} />
        <StatsCard title="OPD Visits" value={opdCount} icon={ClipboardCheck} color="indigo" loading={loading} />
        <StatsCard title="Emergency Visits" value={emergencyCount} icon={Activity} color="red" loading={loading} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Visit Type Chart */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="mb-5 text-lg font-semibold text-gray-900">Registration by Visit Type</h3>
          {loading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2].map((i) => <div key={i}><div className="h-4 bg-gray-200 rounded w-1/2 mb-2" /><div className="h-3 bg-gray-200 rounded w-full" /></div>)}
            </div>
          ) : (
            <div className="space-y-5">
              {[
                { label: 'OPD', count: opdCount, pct: opdPct, color: 'bg-blue-500' },
                { label: 'Emergency', count: emergencyCount, pct: emergencyPct, color: 'bg-red-500' },
              ].map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="font-medium text-gray-800">{item.label}</span>
                    <span className="text-gray-500">{item.count} patients ({item.pct}%)</span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-gray-100">
                    <div className={`h-3 rounded-full transition-all duration-700 ${item.color}`} style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              ))}
              <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
                <h4 className="mb-3 text-sm font-semibold text-gray-700">Today's Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Total Today</span><span className="font-semibold text-gray-900">{stats?.todayRegistrations ?? 0}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">OPD</span><span className="font-semibold text-blue-600">{opdCount}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Emergency</span><span className="font-semibold text-red-600">{emergencyCount}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">All Time Total</span><span className="font-semibold text-gray-900">{stats?.total ?? 0}</span></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Gender Chart */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="mb-5 text-lg font-semibold text-gray-900">Patients by Gender</h3>
          {loading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => <div key={i}><div className="h-4 bg-gray-200 rounded w-1/2 mb-2" /><div className="h-3 bg-gray-200 rounded w-full" /></div>)}
            </div>
          ) : genderEntries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No data available</p>
          ) : (
            <div className="space-y-5">
              {genderEntries.map(([gender, count]) => {
                const pct = Math.round((count / totalGender) * 100);
                const colorClass = genderColors[gender] || 'bg-gray-400';
                return (
                  <div key={gender}>
                    <div className="mb-2 flex justify-between text-sm">
                      <span className="font-medium text-gray-800 capitalize">{gender.toLowerCase()}</span>
                      <span className="text-gray-500">{count} patients ({pct}%)</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-gray-100">
                      <div className={`h-3 rounded-full transition-all duration-700 ${colorClass}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="mt-4 flex flex-wrap gap-3">
                {genderEntries.map(([gender, count]) => (
                  <div key={gender} className="flex items-center gap-2 text-xs text-gray-600">
                    <span className={`inline-block h-3 w-3 rounded-full ${genderColors[gender] || 'bg-gray-400'}`} />
                    <span className="capitalize">{gender.toLowerCase()}: {count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentActivityWidget activities={activities} title="Recent Registrations" maxItems={8} />
        <QuickActionsWidget actions={quickActions} title="Quick Actions" />
      </div>
    </div>
  );
}
