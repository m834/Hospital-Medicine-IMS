'use client';

import * as React from 'react';
import { Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';

/**
 * Convert an ISO date string (yyyy-mm-dd) to the display format dd/mm/yyyy.
 */
export const isoToDisplayDate = (iso?: string | null): string => {
  if (!iso) return '';
  const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
};

/**
 * Convert a complete dd/mm/yyyy string to ISO (yyyy-mm-dd).
 * Returns '' when the value is not a full, well-formed date.
 */
export const displayToIsoDate = (value: string): string => {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
};

/**
 * Mask free text into dd/mm/yyyy, capping the year at 4 digits.
 */
export const maskDisplayDate = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  if (digits.length <= 2) return day;
  if (digits.length <= 4) return `${day}/${month}`;
  return `${day}/${month}/${year}`;
};

export interface DateInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** ISO date string (yyyy-mm-dd) — same value a native date input uses. */
  value?: string | null;
  /** Emits an ISO date string (yyyy-mm-dd), or '' while the date is incomplete. */
  onChange: (value: string) => void;
  /**
   * Adds a calendar button that opens the browser's date picker. Typing
   * dd/mm/yyyy still works; the picker only fills the same value in.
   */
  withCalendar?: boolean;
}

/**
 * Drop-in replacement for `<Input type="date" />` that shows and accepts the
 * date as dd/mm/yyyy (with a hard 4-digit year cap) while keeping the value/
 * onChange contract in ISO (yyyy-mm-dd) so call sites and the backend are
 * unchanged.
 */
export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  (
    { value, onChange, placeholder = 'dd/mm/yyyy', inputMode = 'numeric', withCalendar, ...props },
    ref,
  ) => {
    const [display, setDisplay] = React.useState(() => isoToDisplayDate(value));
    const pickerRef = React.useRef<HTMLInputElement>(null);

    // Keep the display in sync when the ISO value changes from outside, without
    // clobbering an in-progress (incomplete) entry the user is typing.
    React.useEffect(() => {
      const currentIso = displayToIsoDate(display);
      if ((value || '') !== currentIso) {
        setDisplay(isoToDisplayDate(value));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const masked = maskDisplayDate(event.target.value);
      setDisplay(masked);
      onChange(displayToIsoDate(masked));
    };

    const input = (
      <Input
        ref={ref}
        type="text"
        inputMode={inputMode}
        placeholder={placeholder}
        value={display}
        onChange={handleChange}
        {...props}
        className={withCalendar ? `pr-10 ${props.className ?? ''}` : props.className}
      />
    );

    if (!withCalendar) return input;

    const openPicker = () => {
      const picker = pickerRef.current;
      if (!picker || props.disabled) return;
      try {
        picker.showPicker();
      } catch {
        // Older browsers without showPicker: focusing the native input still
        // lets the date be chosen from its own control.
        picker.focus();
      }
    };

    return (
      <div className="relative">
        {input}
        {/* The native date input is only the calendar: it is invisible and
            sits under the button so the picker opens beside it. */}
        <input
          ref={pickerRef}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          className="pointer-events-none absolute right-2 top-1/2 h-0 w-0 -translate-y-1/2 opacity-0"
        />
        <button
          type="button"
          onClick={openPicker}
          disabled={props.disabled}
          aria-label="Open calendar"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <Calendar className="h-4 w-4" />
        </button>
      </div>
    );
  },
);

DateInput.displayName = 'DateInput';
