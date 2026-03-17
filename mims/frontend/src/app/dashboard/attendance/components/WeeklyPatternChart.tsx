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
import { WeeklyPattern } from '@/hooks/useAttendanceData';

interface WeeklyPatternChartProps {
  data: WeeklyPattern[] | undefined;
  isLoading: boolean;
}

const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function WeeklyPatternChart({
  data,
  isLoading,
}: WeeklyPatternChartProps) {
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

  // Sort data by day of week (dayOfWeek is 0-6 where 0=Sunday, 6=Saturday)
  const chartData = [...data].sort((a, b) => a.dayOfWeek - b.dayOfWeek).map((item) => ({
    ...item,
    dayName: dayOrder[item.dayOfWeek],
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
          <p className="font-semibold text-gray-900">{data.dayOfWeek}</p>
          <p className="text-sm text-green-600">
            Present: {data.present}
          </p>
          <p className="text-sm text-red-600">
            Absent: {data.absent}
          </p>
          <p className="text-sm text-blue-600">
            Leave: {data.onLeave}
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
        Weekly Attendance Pattern
      </h3>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="dayName"
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Bar dataKey="present" fill="#10b981" name="Present" radius={[8, 8, 0, 0]} />
          <Bar dataKey="absent" fill="#ef4444" name="Absent" radius={[8, 8, 0, 0]} />
          <Bar dataKey="onLeave" fill="#3b82f6" name="On Leave" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Rate Cards */}
      <div className="grid grid-cols-7 gap-2 mt-6 pt-4 border-t border-gray-200">
        {chartData.map((item) => (
          <div key={item.dayName} className="text-center">
            <p className="text-xs font-semibold text-gray-600 mb-1">
              {item.dayName?.slice(0, 3)}
            </p>
            <div
              className="p-2 rounded text-white font-bold text-sm"
              style={{ backgroundColor: getRateColor(item.attendanceRate || 0) }}
            >
              {(item.attendanceRate || 0).toFixed(0)}%
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
