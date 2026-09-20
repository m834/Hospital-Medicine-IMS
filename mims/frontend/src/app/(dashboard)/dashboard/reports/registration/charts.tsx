'use client';

/**
 * Charts for the registration report.
 *
 * Every chart here carries a single series, so identity never rides on colour:
 * counts are drawn in blue, money in green, and the axis label says what each
 * mark is. Both colours are validated against a light surface; the green sits
 * below 3:1 contrast, which is why each money chart ships beside the table that
 * carries the same numbers as text.
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/** Counts. */
const SERIES_COUNT = '#2a78d6';
/** Money. */
const SERIES_MONEY = '#1baf7a';
/** Grid and axis ink — recessive, never competing with the marks. */
const AXIS_INK = '#71717a';
const GRID_INK = '#e4e4e7';

const currency = (value: number) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(value || 0);

/** Short money for axis ticks: 12.5k rather than PKR 12,500. */
const compactMoney = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k` : `${value}`;

const dayLabel = (iso: string) => {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
};

interface TooltipRow {
  label: string;
  value: string;
}

function ChartTooltip({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="rounded-md border bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-foreground">{title}</p>
      {rows.map((row) => (
        <p key={row.label} className="text-xs text-muted-foreground">
          {row.label}: <span className="font-medium text-foreground">{row.value}</span>
        </p>
      ))}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export interface DayPoint {
  date: string;
  registrations: number;
  labTestOrders: number;
  labTestRevenue: number;
}

/** Registrations per day — a count over time, so bars rather than a line. */
export function RegistrationTrendChart({ data }: { data: DayPoint[] }) {
  if (data.every((point) => point.registrations === 0)) {
    return <EmptyChart message="No registrations in this period." />;
  }

  return (
    <ResponsiveContainer width="100%" height={224}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid stroke={GRID_INK} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={dayLabel}
          tick={{ fill: AXIS_INK, fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: GRID_INK }}
          interval="preserveStartEnd"
          minTickGap={12}
        />
        <YAxis
          tick={{ fill: AXIS_INK, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          width={44}
        />
        <Tooltip
          cursor={{ fill: 'rgba(42, 120, 214, 0.08)' }}
          content={({ active, payload }: any) =>
            active && payload?.length ? (
              <ChartTooltip
                title={dayLabel(payload[0].payload.date)}
                rows={[
                  {
                    label: 'Registrations',
                    value: payload[0].payload.registrations.toLocaleString(),
                  },
                ]}
              />
            ) : null
          }
        />
        <Bar
          dataKey="registrations"
          fill={SERIES_COUNT}
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
          stroke="#ffffff"
          strokeWidth={2}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Lab revenue per day. Bars rather than a line: a day's takings are a discrete
 * amount and most days here are zero, so a curve between them would draw a rise
 * and fall that never happened.
 */
export function LabRevenueTrendChart({ data }: { data: DayPoint[] }) {
  if (data.every((point) => point.labTestRevenue === 0)) {
    return <EmptyChart message="No lab charges in this period." />;
  }

  return (
    <ResponsiveContainer width="100%" height={224}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid stroke={GRID_INK} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={dayLabel}
          tick={{ fill: AXIS_INK, fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: GRID_INK }}
          interval="preserveStartEnd"
          minTickGap={12}
        />
        <YAxis
          tickFormatter={compactMoney}
          tick={{ fill: AXIS_INK, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip
          cursor={{ fill: 'rgba(27, 175, 122, 0.10)' }}
          content={({ active, payload }: any) =>
            active && payload?.length ? (
              <ChartTooltip
                title={dayLabel(payload[0].payload.date)}
                rows={[
                  { label: 'Revenue', value: currency(payload[0].payload.labTestRevenue) },
                  {
                    label: 'Tests',
                    value: payload[0].payload.labTestOrders.toLocaleString(),
                  },
                ]}
              />
            ) : null
          }
        />
        <Bar
          dataKey="labTestRevenue"
          fill={SERIES_MONEY}
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
          stroke="#ffffff"
          strokeWidth={2}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface CategoryPoint {
  category: string;
  orders: number;
  revenue: number;
}

/**
 * Revenue by category — magnitude across names, so horizontal bars with the
 * value written on each one. The bars share a hue: the category name on the
 * axis is what identifies them, not the colour.
 */
export function CategoryRevenueChart({ data }: { data: CategoryPoint[] }) {
  if (data.length === 0) {
    return <EmptyChart message="No lab charges in this period." />;
  }

  // Deep enough for the bars to breathe, capped so one busy month does not
  // produce a chart taller than the screen.
  const height = Math.min(360, Math.max(160, data.length * 44));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 72, bottom: 4, left: 8 }}
      >
        <CartesianGrid stroke={GRID_INK} horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={compactMoney}
          tick={{ fill: AXIS_INK, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="category"
          tick={{ fill: AXIS_INK, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={120}
        />
        <Tooltip
          cursor={{ fill: 'rgba(42, 120, 214, 0.08)' }}
          content={({ active, payload }: any) =>
            active && payload?.length ? (
              <ChartTooltip
                title={payload[0].payload.category}
                rows={[
                  { label: 'Revenue', value: currency(payload[0].payload.revenue) },
                  { label: 'Tests', value: payload[0].payload.orders.toLocaleString() },
                ]}
              />
            ) : null
          }
        />
        {/* One fill on the Bar rather than a Cell per row: with Cell children
            recharts treats the Bar's children as cells and never renders the
            label layer, which is what these bars are read by. */}
        <Bar
          dataKey="revenue"
          fill={SERIES_COUNT}
          radius={[0, 4, 4, 0]}
          maxBarSize={24}
          stroke="#ffffff"
          strokeWidth={2}
        >
          <LabelList
            dataKey="revenue"
            position="right"
            formatter={(value: number) => currency(value)}
            fill="#3f3f46"
            fontSize={11}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
