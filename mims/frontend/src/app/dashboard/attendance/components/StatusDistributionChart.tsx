'use client';

import { Card } from '@/components/ui/card';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import { DashboardStats } from '@/hooks/useAttendanceData';

interface StatusDistributionChartProps {
  stats: DashboardStats | undefined;
  isLoading: boolean;
}

const COLORS = {
  present: '#10b981',
  absent: '#ef4444',
  onLeave: '#3b82f6',
  lateArrivals: '#f59e0b',
};

export function StatusDistributionChart({
  stats,
  isLoading,
}: StatusDistributionChartProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="h-80 bg-gray-200 rounded animate-pulse" />
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className="p-6">
        <div className="h-80 flex items-center justify-center">
          <p className="text-gray-500">No data available</p>
        </div>
      </Card>
    );
  }

  const total = stats.present + stats.absent + stats.onLeave + stats.lateArrivals;

  if (total === 0) {
    return (
      <Card className="p-6">
        <div className="h-80 flex items-center justify-center">
          <p className="text-gray-500">No attendance data for today</p>
        </div>
      </Card>
    );
  }

  const data = [
    {
      name: 'Present',
      value: stats.present,
      percentage: ((stats.present / total) * 100).toFixed(1),
    },
    {
      name: 'Absent',
      value: stats.absent,
      percentage: ((stats.absent / total) * 100).toFixed(1),
    },
    {
      name: 'On Leave',
      value: stats.onLeave,
      percentage: ((stats.onLeave / total) * 100).toFixed(1),
    },
    {
      name: 'Late Arrivals',
      value: stats.lateArrivals,
      percentage: ((stats.lateArrivals / total) * 100).toFixed(1),
    },
  ].filter((item) => item.value > 0); // Only show non-zero values

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
          <p className="font-semibold text-gray-900">{data.name}</p>
          <p className="text-sm font-bold" style={{ color: data.color }}>
            {data.value} ({((data.value / total) * 100).toFixed(1)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const renderLabel = (entry: any) => {
    return `${entry.percentage}%`;
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Status Distribution
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={true}
            label={renderLabel}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  COLORS[entry.name.toLowerCase().replace(' ', '') as keyof typeof COLORS] ||
                  '#8b5cf6'
                }
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-4 border-t border-gray-200">
        {data.map((item) => (
          <div
            key={item.name}
            className="text-center p-3 rounded-lg bg-gray-50"
          >
            <p className="text-2xl font-bold text-gray-900">{item.value}</p>
            <p className="text-xs text-gray-600 mt-1">{item.name}</p>
            <p className="text-xs font-semibold text-gray-700 mt-1">
              {item.percentage}%
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
