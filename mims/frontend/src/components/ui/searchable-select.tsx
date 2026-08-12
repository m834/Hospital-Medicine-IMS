'use client';

/**
 * SearchableSelect – a Combobox (Popover + Command) that replaces plain <Select>
 * wherever the item list is large (medicines, patients, hospitals, etc.).
 *
 * Usage:
 *   <SearchableSelect
 *     options={medicines.map(m => ({ value: m.id, label: m.name, sub: m.strength }))}
 *     value={selectedId}
 *     onValueChange={setSelectedId}
 *     placeholder="Select medicine..."
 *     searchPlaceholder="Search medicines..."
 *   />
 *
 * Filtering is done here rather than by cmdk, deliberately. cmdk unmounts
 * non-matching items and then re-orders the survivors by score with
 * appendChild — moving real nodes behind React's back. React's next render
 * inserts items against a sibling order that no longer matches the DOM, so the
 * "first" item by document order ends up somewhere down the list, and cmdk
 * scrolls to it. That is the list jumping to the bottom mid-search.
 *
 * With shouldFilter={false} cmdk's sort returns early and never touches the
 * DOM, leaving React sole owner of order. Ranking happens in a memo instead,
 * so the best match is genuinely the first node, and the results are capped so
 * a catalogue of thousands is never all mounted at once.
 */

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Optional secondary line shown in smaller grey text */
  sub?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  /** Width of the popover panel. Defaults to match trigger width. */
  popoverWidth?: string;
  /** Rows rendered at once. Raise only if a list is small and must show whole. */
  maxResults?: number;
}

/**
 * Lower is better. Every whitespace-separated term must appear somewhere in
 * the row, so "pana 500" finds Panadol 500mg.
 *
 * Position is then judged on the FIRST term against the name only. Later terms
 * are almost always strength or form, which live on the secondary line —
 * ranking on the joined query instead would find no label containing
 * "pana 500", drop every row into the last tier, and leave the results
 * alphabetical, putting Co-Panadol above Panadol.
 */
function rankOption(option: SearchableSelectOption, terms: string[]): number {
  const label = option.label.toLowerCase();
  const haystack = `${label} ${(option.sub ?? '').toLowerCase()}`;

  for (const term of terms) {
    if (!haystack.includes(term)) return -1;
  }

  const head = terms[0];

  if (label === head) return 0;
  if (label.startsWith(head)) return 1;
  // Split rather than build a regex — medicine names carry (), -, / and %,
  // which would need escaping to be safe.
  if (label.split(/[^a-z0-9]+/i).some((word) => word.startsWith(head))) return 2;
  if (label.includes(head)) return 3;
  return 4;
}

/**
 * Match, rank and cap. Exported for tests: the guarantee the fix rests on is
 * that results[0] is the best match, since it is also the first node rendered.
 */
export function rankOptions(
  options: SearchableSelectOption[],
  query: string,
  maxResults: number,
): { results: SearchableSelectOption[]; totalMatches: number } {
  const q = query.trim().toLowerCase();

  if (!q) {
    return { results: options.slice(0, maxResults), totalMatches: options.length };
  }

  const terms = q.split(/\s+/);
  const scored: Array<{ option: SearchableSelectOption; rank: number }> = [];

  for (const option of options) {
    const rank = rankOption(option, terms);
    if (rank >= 0) scored.push({ option, rank });
  }

  scored.sort((a, b) =>
    a.rank !== b.rank ? a.rank - b.rank : a.option.label.localeCompare(b.option.label),
  );

  return {
    results: scored.slice(0, maxResults).map((s) => s.option),
    totalMatches: scored.length,
  };
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found.',
  disabled = false,
  className,
  popoverWidth,
  maxResults = 100,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  /** cmdk's highlighted row, driven so it always starts at the best match */
  const [activeValue, setActiveValue] = React.useState('');
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState<number | undefined>(undefined);

  React.useEffect(() => {
    if (triggerRef.current) {
      setWidth(triggerRef.current.offsetWidth);
    }
  }, [open]);

  const selected = options.find((o) => o.value === value);

  const { results, totalMatches } = React.useMemo(
    () => rankOptions(options, query, maxResults),
    [options, query, maxResults],
  );

  // Put the highlight back on the best match, and the view back at the top,
  // every time the results change.
  //
  // cmdk only re-picks the first item when the highlighted one unmounts, so a
  // row that survives a narrowing query keeps the highlight — and cmdk scrolls
  // it into view wherever it now sits. Driving the highlight here makes the
  // top row the target every time. Arrow keys still move it, since they come
  // back through onValueChange and do not re-run this effect.
  React.useEffect(() => {
    setActiveValue(results[0]?.value ?? '');
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [results]);

  // Reopening should start from a clean search rather than the last one.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery('');
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        style={{ width: popoverWidth ?? (width ? `${width}px` : undefined) }}
        align="start"
      >
        {/* shouldFilter={false}: ranking above is authoritative — see file header */}
        <Command shouldFilter={false} value={activeValue} onValueChange={setActiveValue}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList ref={listRef}>
            {/* CommandEmpty keys off cmdk's own filter count, which no longer
                updates, so the empty state is rendered directly. */}
            {results.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              // Plain wrapper rather than CommandGroup — it only supplied this
              // padding, and grouping would reintroduce cmdk's sort targets.
              <div className="p-1">
              {results.map((option) => (
                <CommandItem
                  key={option.value}
                  // The id, not the label — labels repeat across the catalogue
                  // and cmdk treats equal values as the same item.
                  value={option.value}
                  onSelect={() => {
                    onValueChange(option.value === value ? '' : option.value);
                    handleOpenChange(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      value === option.value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="flex flex-col min-w-0">
                    <span className="truncate">{option.label}</span>
                    {option.sub && (
                      <span className="text-xs text-muted-foreground truncate">
                        {option.sub}
                      </span>
                    )}
                  </span>
                </CommandItem>
              ))}
              </div>
            )}
            {totalMatches > results.length && (
              <div className="px-2 py-2 text-center text-xs text-muted-foreground border-t">
                Showing {results.length} of {totalMatches} — keep typing to narrow.
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
