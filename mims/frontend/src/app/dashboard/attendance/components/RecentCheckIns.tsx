'use client';

import { Card } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { CheckIn } from '@/hooks/useAttendanceData';
import { useState } from 'react';
import { format } from 'date-fns';

interface RecentCheckInsProps {
  checkIns: CheckIn[] | undefined;
  isLoading: boolean;
}

const ITEMS_PER_PAGE = 10;

export function RecentCheckIns({ checkIns, isLoading }: RecentCheckInsProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil((checkIns?.length || 0) / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedCheckIns = checkIns?.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  ) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return (
          <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
            Present
          </span>
        );
      case 'absent':
        return (
          <span className="inline-block bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-semibold">
            Absent
          </span>
        );
      case 'late':
        return (
          <span className="inline-block bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-semibold">
            Late
          </span>
        );
      case 'leave':
        return (
          <span className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
            On Leave
          </span>
        );
      default:
        return (
          <span className="inline-block bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold">
            {status}
          </span>
        );
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'HH:mm:ss');
    } catch {
      return 'N/A';
    }
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

  if (!checkIns || checkIns.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-center text-gray-500">No check-in data available</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Recent Check-Ins
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">
                Employee
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">
                Department
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">
                Check-In Time
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedCheckIns.map((checkIn, idx) => (
              <tr
                key={`${checkIn.employeeId}-${idx}`}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <td className="py-4 px-4">
                  <p className="font-medium text-gray-900">
                    {checkIn.employeeName}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    ID: {checkIn.employeeId}
                  </p>
                </td>
                <td className="py-4 px-4">
                  <p className="text-sm text-gray-700">{checkIn.departmentName}</p>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {formatTime(checkIn.checkInTime)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(
                          new Date(checkIn.checkInTime),
                          'dd MMM yyyy'
                        )}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4">
                  {getStatusBadge(checkIn.status.toLowerCase())}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            Showing {startIndex + 1} to{' '}
            {Math.min(startIndex + ITEMS_PER_PAGE, checkIns.length)} of{' '}
            {checkIns.length} results
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 rounded transition-colors ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    {page}
                  </button>
                )
              )}
            </div>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
