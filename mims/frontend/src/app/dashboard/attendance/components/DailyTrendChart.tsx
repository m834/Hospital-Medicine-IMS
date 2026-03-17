'use client';

import { Card } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { DailyTrendData } from '@/hooks/useAttendanceData';
import { format, parseISO } from 'date-fns';

interface DailyTrendChartProps {
  data: DailyTrendData[] | undefined;
  isLoading: boolean;
}

export function DailyTrendChart({ data, isLoading }: DailyTrendChartProps) {
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

  const chartData = data.map((item) => ({
    ...item,
    date: format(parseISO(item.date), 'MMM dd'),
    originalDate: item.date,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
          <p className="font-semibold text-gray-900">{payload[0].payload.date}</p>
          <p className="text-sm text-green-600">
            Present: {payload[0].payload.present}
          </p>
          <p className="text-sm text-red-600">
            Absent: {payload[0].payload.absent}
          </p>
          <p className="text-sm text-blue-600">
            Leave: {payload[0].payload.onLeave}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Daily Attendance Trend
      </h3>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />
          <Line
            type="monotone"
            dataKey="present"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: '#10b981', r: 4 }}
            activeDot={{ r: 6 }}
            name="Present"
          />
          <Line
            type="monotone"
            dataKey="absent"
            stroke="#ef4444"
            strokeWidth={2}
            dot={{ fill: '#ef4444', r: 4 }}
            activeDot={{ r: 6 }}
            name="Absent"
          />
          <Line
            type="monotone"
            dataKey="onLeave"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
            name="On Leave"
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
