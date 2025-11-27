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
  FileSearch,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  ClipboardCheck,
} from 'lucide-react';

interface AuditorStats {
  auditsCompleted: number;
  pendingReviews: number;
  discrepanciesFound: number;
  complianceScore: number;
  thisMonthAudits: number;
}

export default function AuditorDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<AuditorStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== UserRole.AUDITOR) {
      router.push('/dashboard');
      return;
    }

    fetchDashboardData();
  }, [user, router]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      setStats({
        auditsCompleted: 45,
        pendingReviews: 3,
        discrepanciesFound: 7,
        complianceScore: 96,
        thisMonthAudits: 12,
      });

      setAlerts([
        {
          id: '1',
          type: 'warning',
          title: 'Discrepancy Detected',
          message: 'Stock count mismatch found in Main Pharmacy - Batch #B123',
          href: '/dashboard/inventory?batch=B123',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
        {
          id: '2',
          type: 'info',
          title: 'Scheduled Audit',
          message: 'Monthly pharmacy audit scheduled for tomorrow',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
        {
          id: '3',
          type: 'error',
          title: 'Compliance Issue',
          message: 'Expired medicines found in Emergency Pharmacy storage',
          href: '/dashboard/inventory/alerts',
          timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
        },
      ]);

      setActivities([
        {
          id: '1',
          title: 'Audit Completed',
          description: 'Main Pharmacy stock verification - 98% accuracy',
          timestamp: new Date(Date.now() - 30 * 60 * 1000),
          user: 'You',
          type: 'success',
          href: '/dashboard/reports',
        },
        {
          id: '2',
          title: 'Discrepancy Reported',
          description: 'Stock variance detected in Batch #B123',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          user: 'You',
          type: 'warning',
          href: '/dashboard/inventory',
        },
        {
          id: '3',
          title: 'Compliance Check',
          description: 'Emergency Pharmacy passed regulatory compliance',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
          user: 'You',
          type: 'success',
          href: '/dashboard/reports',
        },
      ]);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = getQuickActionsForRole(UserRole.AUDITOR);

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Auditor Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          System audits, compliance monitoring, and reporting
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatsCard
          title="Audits Completed"
          value={stats?.auditsCompleted ?? 0}
          icon={CheckCircle}
          color="green"
          href="/dashboard/reports?type=audits"
          loading={loading}
        />
        <StatsCard
          title="Pending Reviews"
          value={stats?.pendingReviews ?? 0}
          icon={ClipboardCheck}
          color="yellow"
          href="/dashboard/reports?filter=pending"
          loading={loading}
        />
        <StatsCard
          title="Discrepancies Found"
          value={stats?.discrepanciesFound ?? 0}
          icon={AlertTriangle}
          color="red"
          href="/dashboard/reports?type=discrepancies"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatsCard
          title="Compliance Score"
          value={`${stats?.complianceScore ?? 0}%`}
          icon={TrendingUp}
          color={stats && stats.complianceScore >= 95 ? 'green' : 'yellow'}
          loading={loading}
          trend={{
            value: 2,
            isPositive: true,
            label: 'vs last month',
          }}
        />
        <StatsCard
          title="This Month Audits"
          value={stats?.thisMonthAudits ?? 0}
          icon={FileSearch}
          color="purple"
          href="/dashboard/reports?filter=month"
          loading={loading}
        />
      </div>

      <AlertsWidget alerts={alerts} title="Audit Alerts" maxItems={5} />

      <QuickActionsWidget actions={quickActions} title="Quick Actions" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentActivityWidget
          activities={activities}
          title="Recent Audit Activity"
          maxItems={6}
        />

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Audit Schedule</h3>
          <div className="space-y-3">
            {[
              { pharmacy: 'Main Pharmacy', type: 'Monthly Stock Audit', date: 'Tomorrow', status: 'Scheduled' },
              { pharmacy: 'Emergency Pharmacy', type: 'Compliance Check', date: 'In 3 days', status: 'Scheduled' },
              { pharmacy: 'OPD Pharmacy', type: 'Quarterly Review', date: 'Next week', status: 'Pending' },
            ].map((audit, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{audit.pharmacy}</p>
                  <p className="mt-1 text-xs text-gray-500">{audit.type}</p>
                  <p className="mt-1 text-xs text-gray-400">{audit.date}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    audit.status === 'Scheduled'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {audit.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Compliance Overview</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { category: 'Stock Accuracy', score: 98, status: 'Excellent' },
            { category: 'Documentation', score: 95, status: 'Good' },
            { category: 'Safety Standards', score: 94, status: 'Good' },
          ].map((item) => (
            <div key={item.category} className="rounded-lg border border-gray-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">{item.category}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    item.status === 'Excellent'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {item.status}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-200">
                <div
                  className={`h-2 rounded-full ${
                    item.score >= 95 ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${item.score}%` }}
                />
              </div>
              <p className="mt-2 text-right text-xs font-medium text-gray-900">{item.score}%</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Recent Findings</h3>
        <div className="space-y-3">
          {[
            { finding: 'Stock count mismatch', severity: 'Medium', pharmacy: 'Main Pharmacy', resolved: false },
            { finding: 'Expired batch found', severity: 'High', pharmacy: 'Emergency Pharmacy', resolved: true },
            { finding: 'Documentation incomplete', severity: 'Low', pharmacy: 'OPD Pharmacy', resolved: true },
          ].map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">{item.finding}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.severity === 'High'
                        ? 'bg-red-100 text-red-700'
                        : item.severity === 'Medium'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {item.severity}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">{item.pharmacy}</p>
              </div>
              {item.resolved ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
