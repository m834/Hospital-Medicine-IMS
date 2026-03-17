'use client';

import { useAttendanceData } from '@/hooks/useAttendanceData';
import {
  AttendanceStats,
  DepartmentBreakdown,
  RecentCheckIns,
  FilterControls,
  DailyTrendChart,
  WeeklyPatternChart,
  DepartmentComparisonChart,
  StatusDistributionChart,
} from '@/app/dashboard/attendance/components';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@/lib/constants';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

interface DepartmentOption {
  id: string;
  name: string;
}

export default function AttendanceDashboard() {
  const {
    dashboardStats,
    departmentBreakdown,
    dailyTrend,
    weeklyPattern,
    recentCheckIns,
    isLoading,
    isError,
    error,
    filters,
    updateFilters,
    refetchAll,
    exportToExcel,
  } = useAttendanceData();

  const { user, token } = useAuthStore();
  const [isExporting, setIsExporting] = useState(false);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [isDepartmentsLoading, setIsDepartmentsLoading] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportToExcel();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const canMarkAttendance =
    user?.role === UserRole.MASTER_ADMIN ||
    user?.role === UserRole.SUPER_ADMIN ||
    user?.role === UserRole.HOSPITAL_ADMIN;

  useEffect(() => {
    const fetchDepartments = async () => {
      if (!user?.hospitalId || !token) return;

      setIsDepartmentsLoading(true);
      try {
        const response = await fetch(
          `${API_BASE}/departments?hospitalId=${user.hospitalId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const activeDepartments = data
            .filter((dept: { status: string }) => dept.status === 'ACTIVE')
            .map((dept: { id: string; name: string }) => ({
              id: dept.id,
              name: dept.name,
            }));
          setDepartments(activeDepartments);
        } else {
          setDepartments([]);
        }
      } catch (err) {
        console.error('Failed to fetch departments:', err);
        setDepartments([]);
      } finally {
        setIsDepartmentsLoading(false);
      }
    };

    fetchDepartments();
  }, [user?.hospitalId, token]);

  const derivedDepartments = useMemo<DepartmentOption[]>(() => {
    return (
      departmentBreakdown?.data?.map((dept) => ({
        id: dept.departmentId,
        name: dept.departmentName,
      })) || []
    );
  }, [departmentBreakdown?.data]);

  const departmentOptions = departments.length > 0 ? departments : derivedDepartments;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Attendance Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time attendance monitoring and analytics
          </p>
        </div>
        <div className="flex gap-3">
          {canMarkAttendance && (
            <Button asChild size="sm" className="gap-2">
              <Link href="/dashboard/attendance/mark">
                <Plus className="w-4 h-4" />
                Mark Attendance
              </Link>
            </Button>
          )}
          <Button
            onClick={refetchAll}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || isLoading}
            variant="default"
            size="sm"
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export to Excel
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {isError && error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-destructive font-medium">Failed to load data</p>
          <p className="text-destructive/80 text-sm mt-1">{error.message}</p>
        </div>
      )}

      {/* Filters */}
      <FilterControls
        filters={filters}
        onFiltersChange={updateFilters}
        departments={departmentOptions}
        isDepartmentsLoading={isDepartmentsLoading}
      />

      {/* Stats Cards */}
      <AttendanceStats stats={dashboardStats?.data} isLoading={isLoading} />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Trend Chart */}
        <DailyTrendChart data={dailyTrend?.data} isLoading={isLoading} />

        {/* Weekly Pattern Chart */}
        <WeeklyPatternChart data={weeklyPattern?.data} isLoading={isLoading} />

        {/* Department Comparison Chart */}
        <div className="lg:col-span-2">
          <DepartmentComparisonChart
            data={departmentBreakdown?.data}
            isLoading={isLoading}
          />
        </div>

        {/* Status Distribution */}
        <StatusDistributionChart stats={dashboardStats?.data} isLoading={isLoading} />

        {/* Department Breakdown Table */}
        <div className="lg:col-span-1">
          <div className="h-full">
            <DepartmentBreakdown
              departments={departmentBreakdown?.data}
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>

      {/* Recent Check-Ins Table */}
      <RecentCheckIns checkIns={recentCheckIns?.data} isLoading={isLoading} />

      {/* Footer Info */}
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
        <p className="text-primary text-sm">
          <span className="font-semibold">Auto-refresh:</span> Dashboard data
          updates automatically every 10 seconds. Last update:{' '}
          <span className="font-mono">
            {dashboardStats?.data?.lastUpdated
              ? new Date(dashboardStats.data.lastUpdated).toLocaleTimeString()
              : 'N/A'}
          </span>
        </p>
      </div>
    </div>
  );
}
