'use client';

import { Card } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Department } from '@/hooks/useAttendanceData';

interface DepartmentComparisonChartProps {
  data: Department[] | undefined;
  isLoading: boolean;
}

export function DepartmentComparisonChart({
  data,
  isLoading,
}: DepartmentComparisonChartProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="h-80 bg-gray-200 rounded animate-pulse" />
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-6">
        <div className="h-80 flex items-center justify-center">
          <p className="text-gray-500">No data available</p>
        </div>
      </Card>
    );
  }

  // Get top 10 departments by total employees
  const topDepartments = [...data]
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map((item) => ({
      ...item,
      shortName: item.departmentName.length > 15
        ? item.departmentName.substring(0, 12) + '...'
        : item.departmentName,
    }));

  const getRateColor = (rate: number) => {
    if (rate >= 90) return '#10b981'; // green
    if (rate >= 75) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
          <p className="font-semibold text-gray-900">{data.departmentName}</p>
          <p className="text-sm text-green-600">
            Present: {data.present}
          </p>
          <p className="text-sm text-red-600">
            Absent: {data.absent}
          </p>
          <p className="text-sm text-gray-700">
            Total: {data.total}
          </p>
          <p className="text-sm font-semibold text-gray-700 mt-2">
            Rate: {data.attendanceRate?.toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Top 10 Departments by Attendance
      </h3>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart
          data={topDepartments}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 200 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" stroke="#6b7280" style={{ fontSize: '12px' }} />
          <YAxis
            dataKey="shortName"
            type="category"
            stroke="#6b7280"
            style={{ fontSize: '11px' }}
            width={190}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="present" fill="#10b981" name="Present" radius={[0, 8, 8, 0]}>
            {topDepartments.map((entry, index) => (
              <Cell
                key={`present-${index}`}
                fill={getRateColor(entry.attendanceRate)}
              />
            ))}
          </Bar>
          <Bar dataKey="absent" fill="#ef4444" name="Absent" radius={[0, 8, 8, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className="text-sm text-gray-700">Present</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span className="text-sm text-gray-700">Absent</span>
          </div>
          <div className="text-xs text-gray-600">
            ℹ️ Color indicates attendance rate (Green ≥90%, Amber ≥75%, Red &lt;75%)
          </div>
        </div>
      </div>
    </Card>
  );
}
