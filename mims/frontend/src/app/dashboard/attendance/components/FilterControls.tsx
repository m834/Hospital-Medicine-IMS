'use client';

import { Card } from '@/components/ui/card';
import { DateInput } from '@/components/ui/date-input';
import { Filter, X } from 'lucide-react';
import { useState } from 'react';
import { AttendanceFilters } from '@/hooks/useAttendanceData';

interface FilterControlsProps {
  filters: AttendanceFilters;
  onFiltersChange: (filters: AttendanceFilters) => void;
  departments?: Array<{ id: string; name: string }>;
  isDepartmentsLoading?: boolean;
}

export function FilterControls({
  filters,
  onFiltersChange,
  departments = [],
  isDepartmentsLoading = false,
}: FilterControlsProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleDateChange = (value: string) => {
    onFiltersChange({
      ...filters,
      date: value,
    });
  };

  const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({
      ...filters,
      departmentId: e.target.value || undefined,
    });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({
      ...filters,
      status: e.target.value || undefined,
    });
  };

  const handleDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      days: parseInt(e.target.value) || undefined,
    });
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      limit: parseInt(e.target.value) || undefined,
    });
  };

  const handleReset = () => {
    onFiltersChange({
      date: undefined,
      departmentId: undefined,
      status: undefined,
      days: undefined,
      limit: undefined,
    });
  };

  const hasActiveFilters =
    filters.date || filters.departmentId || filters.status;

  return (
    <Card className="p-4 md:p-6">
      <div className="space-y-4">
        {/* Main Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Date Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date
            </label>
            <DateInput
              value={filters.date || ''}
              onChange={handleDateChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Department Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Department {isDepartmentsLoading && <span className="text-xs text-gray-500">(Loading...)</span>}
            </label>
            <select
              value={filters.departmentId || ''}
              onChange={handleDepartmentChange}
              disabled={isDepartmentsLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">
                {isDepartmentsLoading
                  ? 'Loading departments...'
                  : departments.length === 0
                    ? 'No departments available'
                    : 'All Departments'}
              </option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={filters.status || ''}
              onChange={handleStatusChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
            >
              <option value="">All Status</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="LATE">Late</option>
              <option value="ON_LEAVE">On Leave</option>
            </select>
          </div>
        </div>

        {/* Advanced Filters Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            <Filter className="w-4 h-4" />
            {showAdvanced ? 'Hide' : 'Show'} Advanced Options
          </button>
          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-700 transition-colors"
            >
              <X className="w-4 h-4" />
              Clear All
            </button>
          )}
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Days for Trend */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Days for Trend Analysis (1-90)
                </label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={filters.days || 30}
                  onChange={handleDaysChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Currently viewing: {filters.days || 30} days
                </p>
              </div>

              {/* Limit for Check-Ins */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recent Check-Ins Limit (1-100)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={filters.limit || 20}
                  onChange={handleLimitChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Currently showing: {filters.limit || 20} records
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="pt-2 flex flex-wrap gap-2">
            {filters.date && (
              <span className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">
                Date: {filters.date}
                <button
                  onClick={() =>
                    onFiltersChange({ ...filters, date: undefined })
                  }
                  className="hover:text-blue-900"
                >
                  ×
                </button>
              </span>
            )}
            {filters.departmentId && (
              <span className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">
                Department: {filters.departmentId}
                <button
                  onClick={() =>
                    onFiltersChange({ ...filters, departmentId: undefined })
                  }
                  className="hover:text-blue-900"
                >
                  ×
                </button>
              </span>
            )}
            {filters.status && (
              <span className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">
                Status: {filters.status}
                <button
                  onClick={() =>
                    onFiltersChange({ ...filters, status: undefined })
                  }
                  className="hover:text-blue-900"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
