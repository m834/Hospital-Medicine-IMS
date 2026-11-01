'use client';

import { DateInput } from '@/components/ui/date-input';
import { LAB_LIST_LIMIT } from '@/hooks/use-lab-orders';

interface LabListDateFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  /** How many rows the list came back with. */
  shown: number;
}

/**
 * Date range for a capped lab work list, and a note when the list hit the cap
 * — so a long backlog shows that there is more, rather than silently stopping.
 * Both dates or neither: one alone does not filter.
 */
export function LabListDateFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  shown,
}: LabListDateFilterProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DateInput
          value={startDate}
          onChange={onStartDateChange}
          placeholder="Start Date"
          aria-label="Start date"
          withCalendar
        />
        <DateInput
          value={endDate}
          onChange={onEndDateChange}
          placeholder="End Date"
          aria-label="End date"
          withCalendar
        />
      </div>
      {shown >= LAB_LIST_LIMIT && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Showing the first {LAB_LIST_LIMIT}. There may be more — set the dates to narrow the list.
        </p>
      )}
    </div>
  );
}
