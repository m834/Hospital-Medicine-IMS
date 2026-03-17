import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth.store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

// TypeScript interfaces
export interface DashboardStats {
  present: number;
  absent: number;
  onLeave: number;
  lateArrivals: number;
  attendanceRate: number;
  lastUpdated: string;
}

export interface Department {
  departmentId: string;
  departmentName: string;
  present: number;
  absent: number;
  onLeave: number;
  total: number;
  attendanceRate: number;
}

export interface DailyTrendData {
  date: string;
  present: number;
  absent: number;
  onLeave: number;
}

export interface WeeklyPattern {
  day: string;
  dayOfWeek: number;
  present: number;
  absent: number;
  onLeave: number;
  count: number;
  attendanceRate: number;
}

export interface CheckIn {
  employeeId: string;
  employeeName: string;
  email: string;
  departmentId: string;
  departmentName: string;
  checkInTime: string;
  checkOutTime: string | null;
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE';
  workingHours: number;
  lateByMinutes: number;
  notes: string | null;
}

// Filter parameters
export interface AttendanceFilters {
  date?: string;
  days?: number;
  departmentId?: string;
  status?: string;
  limit?: number;
}

/**
 * React Query hook for Attendance Dashboard
 * Manages all API calls and caching
 */
export function useAttendanceData() {
  const { token } = useAuthStore();

  // Filter state
  const [filters, setFilters] = useState<AttendanceFilters>({
    date: new Date().toISOString().split('T')[0],
    days: 30,
    limit: 20,
  });

  // Query 1: Dashboard Stats
  const dashboardStatsQuery = useQuery<DashboardStats>({
    queryKey: ['attendance', 'dashboard', 'stats', filters.date],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/attendance-records/dashboard/stats`, {
        params: { date: filters.date },
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      });
      return data;
    },
    enabled: !!token,
    refetchInterval: 10000, // Refresh every 10 seconds
    staleTime: 5000, // Data is stale after 5 seconds
  });

  // Query 2: Department Breakdown
  const departmentBreakdownQuery = useQuery<Department[]>({
    queryKey: ['attendance', 'dashboard', 'department-breakdown', filters.date],
    queryFn: async () => {
      const { data } = await axios.get(
        `${API_BASE}/attendance-records/dashboard/department-breakdown`,
        {
          params: { date: filters.date },
          headers: { Authorization: `Bearer ${token}` },
          withCredentials: true,
        }
      );
      return data;
    },
    enabled: !!token,
    refetchInterval: 10000,
    staleTime: 5000,
  });

  // Query 3: Daily Trend
  const dailyTrendQuery = useQuery<DailyTrendData[]>({
    queryKey: ['attendance', 'dashboard', 'daily-trend', filters.days],
    queryFn: async () => {
      const { data } = await axios.get(
        `${API_BASE}/attendance-records/dashboard/daily-trend`,
        {
          params: { days: filters.days },
          headers: { Authorization: `Bearer ${token}` },
          withCredentials: true,
        }
      );
      return data;
    },
    enabled: !!token,
    staleTime: 60000, // Trend data refreshes every minute
  });

  // Query 4: Weekly Pattern
  const weeklyPatternQuery = useQuery<WeeklyPattern[]>({
    queryKey: ['attendance', 'dashboard', 'weekly-pattern'],
    queryFn: async () => {
      const { data } = await axios.get(
        `${API_BASE}/attendance-records/dashboard/weekly-pattern`,
        {
          headers: { Authorization: `Bearer ${token}` },
          withCredentials: true,
        }
      );
      return data;
    },
    enabled: !!token,
    staleTime: 60000,
  });

  // Query 5: Recent Check-Ins
  const recentCheckInsQuery = useQuery<CheckIn[]>({
    queryKey: [
      'attendance',
      'dashboard',
      'recent-checkins',
      filters.limit,
      filters.departmentId,
      filters.status,
    ],
    queryFn: async () => {
      const { data } = await axios.get(
        `${API_BASE}/attendance-records/dashboard/recent-checkins`,
        {
          params: {
            limit: filters.limit,
            departmentId: filters.departmentId,
            status: filters.status,
          },
          headers: { Authorization: `Bearer ${token}` },
          withCredentials: true,
        }
      );
      return data;
    },
    enabled: !!token,
    refetchInterval: 10000,
    staleTime: 5000,
  });

  // Helper: Update filters
  const updateFilters = useCallback((newFilters: Partial<AttendanceFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  // Helper: Refresh all data
  const refetchAll = useCallback(async () => {
    await Promise.all([
      dashboardStatsQuery.refetch(),
      departmentBreakdownQuery.refetch(),
      dailyTrendQuery.refetch(),
      weeklyPatternQuery.refetch(),
      recentCheckInsQuery.refetch(),
    ]);
  }, [
    dashboardStatsQuery,
    departmentBreakdownQuery,
    dailyTrendQuery,
    weeklyPatternQuery,
    recentCheckInsQuery,
  ]);

  // Helper: Export data to Excel
  const exportToExcel = useCallback(async () => {
    try {
      const XLSX = await import('xlsx');

      const wb = XLSX.utils.book_new();

      // Sheet 1: Dashboard Stats
      if (dashboardStatsQuery.data) {
        const statsData = [
          ['Attendance Dashboard', ''],
          ['Date', filters.date],
          ['Total Present', dashboardStatsQuery.data.present],
          ['Total Absent', dashboardStatsQuery.data.absent],
          ['On Leave', dashboardStatsQuery.data.onLeave],
          ['Late Arrivals', dashboardStatsQuery.data.lateArrivals],
          ['Attendance Rate (%)', dashboardStatsQuery.data.attendanceRate],
        ];
        const wsStats = XLSX.utils.aoa_to_sheet(statsData);
        XLSX.utils.book_append_sheet(wb, wsStats, 'Summary');
      }

      // Sheet 2: Department Breakdown
      if (departmentBreakdownQuery.data) {
        const deptData = [
          ['Department Name', 'Present', 'Absent', 'On Leave', 'Total', 'Attendance Rate (%)'],
          ...departmentBreakdownQuery.data.map((dept) => [
            dept.departmentName,
            dept.present,
            dept.absent,
            dept.onLeave,
            dept.total,
            dept.attendanceRate,
          ]),
        ];
        const wsDept = XLSX.utils.aoa_to_sheet(deptData);
        XLSX.utils.book_append_sheet(wb, wsDept, 'Departments');
      }

      // Sheet 3: Recent Check-Ins
      if (recentCheckInsQuery.data) {
        const checkInData = [
          [
            'Employee Name',
            'Department',
            'Check-In Time',
            'Check-Out Time',
            'Status',
            'Working Hours',
            'Late Minutes',
            'Notes',
          ],
          ...recentCheckInsQuery.data.map((checkin) => [
            checkin.employeeName,
            checkin.departmentName,
            new Date(checkin.checkInTime).toLocaleString(),
            checkin.checkOutTime ? new Date(checkin.checkOutTime).toLocaleString() : 'N/A',
            checkin.status,
            checkin.workingHours,
            checkin.lateByMinutes,
            checkin.notes || '',
          ]),
        ];
        const wsCheckins = XLSX.utils.aoa_to_sheet(checkInData);
        XLSX.utils.book_append_sheet(wb, wsCheckins, 'Check-Ins');
      }

      // Generate filename with date
      const filename = `Attendance_Report_${filters.date}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  }, [
    dashboardStatsQuery.data,
    departmentBreakdownQuery.data,
    recentCheckInsQuery.data,
    filters.date,
  ]);

  // Return all queries and helpers
  return {
    // Queries
    dashboardStats: dashboardStatsQuery,
    departmentBreakdown: departmentBreakdownQuery,
    dailyTrend: dailyTrendQuery,
    weeklyPattern: weeklyPatternQuery,
    recentCheckIns: recentCheckInsQuery,

    // State
    filters,
    updateFilters,

    // Actions
    refetchAll,
    exportToExcel,

    // Computed
    isLoading:
      dashboardStatsQuery.isLoading ||
      departmentBreakdownQuery.isLoading ||
      dailyTrendQuery.isLoading ||
      weeklyPatternQuery.isLoading ||
      recentCheckInsQuery.isLoading,

    isError:
      dashboardStatsQuery.isError ||
      departmentBreakdownQuery.isError ||
      dailyTrendQuery.isError ||
      weeklyPatternQuery.isError ||
      recentCheckInsQuery.isError,

    error:
      dashboardStatsQuery.error ||
      departmentBreakdownQuery.error ||
      dailyTrendQuery.error ||
      weeklyPatternQuery.error ||
      recentCheckInsQuery.error,
  };
}
