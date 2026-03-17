'use client';

import { Card } from '@/components/ui/card';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Department } from '@/hooks/useAttendanceData';
import { useState } from 'react';

interface DepartmentBreakdownProps {
  departments: Department[] | undefined;
  isLoading: boolean;
}

export function DepartmentBreakdown({
  departments,
  isLoading,
}: DepartmentBreakdownProps) {
  const [sortBy, setSortBy] = useState<
    'name' | 'present' | 'absent' | 'rate'
  >('rate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: 'name' | 'present' | 'absent' | 'rate') => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('desc');
    }
  };

  const sortedDepartments = [...(departments || [])].sort((a, b) => {
    let aVal: any;
    let bVal: any;

    if (sortBy === 'name') {
      aVal = a.departmentName;
      bVal = b.departmentName;
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    } else {
      aVal = a[sortBy as keyof Department];
      bVal = b[sortBy as keyof Department];
    }

    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  const getRateColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600 bg-green-50';
    if (rate >= 75) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  if (!departments || departments.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-center text-gray-500">No department data available</p>
      </Card>
    );
  }

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Department Breakdown
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-2 font-semibold text-gray-700 hover:text-gray-900 text-sm"
                >
                  Department
                  <SortIcon column="name" />
                </button>
              </th>
              <th className="text-right py-3 px-4">
                <button
                  onClick={() => handleSort('present')}
                  className="flex items-center justify-end gap-2 font-semibold text-gray-700 hover:text-gray-900 text-sm ml-auto"
                >
                  Present
                  <SortIcon column="present" />
                </button>
              </th>
              <th className="text-right py-3 px-4">
                <button
                  onClick={() => handleSort('absent')}
                  className="flex items-center justify-end gap-2 font-semibold text-gray-700 hover:text-gray-900 text-sm ml-auto"
                >
                  Absent
                  <SortIcon column="absent" />
                </button>
              </th>
              <th className="text-right py-3 px-4">
                <button
                  onClick={() => handleSort('rate')}
                  className="flex items-center justify-end gap-2 font-semibold text-gray-700 hover:text-gray-900 text-sm ml-auto"
                >
                  Rate %
                  <SortIcon column="rate" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedDepartments.map((dept) => (
              <tr
                key={dept.departmentId}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <td className="py-4 px-4">
                  <p className="font-medium text-gray-900">
                    {dept.departmentName}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Total: {dept.total}
                  </p>
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                    {dept.present}
                  </span>
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="inline-block bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-semibold">
                    {dept.absent}
                  </span>
                </td>
                <td className="py-4 px-4 text-right">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getRateColor(
                      dept.attendanceRate
                    )}`}
                  >
                    {dept.attendanceRate.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
