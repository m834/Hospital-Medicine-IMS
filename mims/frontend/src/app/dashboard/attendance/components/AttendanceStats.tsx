'use client';

import { Card } from '@/components/ui/card';
import { Users, UserX, Calendar, Clock } from 'lucide-react';
import { DashboardStats } from '@/hooks/useAttendanceData';

interface AttendanceStatsProps {
  stats: DashboardStats | undefined;
  isLoading: boolean;
}

export function AttendanceStats({ stats, isLoading }: AttendanceStatsProps) {
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-6">
            <div className="h-20 bg-gray-200 rounded animate-pulse" />
          </Card>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Present',
      value: stats.present,
      percentage: stats.attendanceRate,
      icon: Users,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-700',
      iconBg: 'bg-green-100',
    },
    {
      title: 'Total Absent',
      value: stats.absent,
      percentage: stats.absent > 0 ? ((stats.absent / (stats.present + stats.absent + stats.onLeave)) * 100).toFixed(1) : 0,
      icon: UserX,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-700',
      iconBg: 'bg-red-100',
    },
    {
      title: 'On Leave',
      value: stats.onLeave,
      percentage: stats.onLeave > 0 ? ((stats.onLeave / (stats.present + stats.absent + stats.onLeave)) * 100).toFixed(1) : 0,
      icon: Calendar,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-700',
      iconBg: 'bg-blue-100',
    },
    {
      title: 'Late Arrivals',
      value: stats.lateArrivals,
      percentage: '0',
      icon: Clock,
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-700',
      iconBg: 'bg-yellow-100',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card
            key={stat.title}
            className={`${stat.bgColor} border-l-4 ${stat.borderColor} p-6 transition-all hover:shadow-lg`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                <p className={`text-xs mt-2 ${stat.textColor} font-semibold`}>
                  {typeof stat.percentage === 'number'
                    ? stat.percentage.toFixed(1)
                    : stat.percentage}
                  %
                </p>
              </div>
              <div className={`${stat.iconBg} p-3 rounded-lg`}>
                <Icon className={`w-6 h-6 ${stat.textColor}`} />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
