import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

/** One test line: a test at one price. Total = quantity x unitPrice. */
export interface LabRevenueTestRow {
  testName: string;
  unitPrice: number;
  quantity: number;
  total: number;
}

export interface LabRevenueCategoryRow {
  category: string;
  quantity: number;
  subtotal: number;
  tests: LabRevenueTestRow[];
}

/** A staff member: how many tests they created in the range, and their value. */
export interface LabRevenueResourceRow {
  resourceId: string;
  resourceName: string;
  role: string | null;
  tests: number;
  amount: number;
}

export interface LabRevenueReport {
  range: { start: string | null; end: string | null };
  /** When the server built the report, by the server's clock. */
  generatedAt: string;
  categories: LabRevenueCategoryRow[];
  grandTotal: number;
  totalQuantity: number;
  resources: LabRevenueResourceRow[];
}

export interface LabRevenueParams {
  hospitalId?: string;
  /** Both dates or neither — a half-open range reports the whole history. */
  startDate?: string;
  endDate?: string;
  /** Orders booked by this department's staff only. */
  departmentId?: string;
  /** False holds the request — e.g. until a required department is chosen. */
  enabled?: boolean;
}

async function fetchLabRevenue(params: LabRevenueParams) {
  const { data } = await api.get('/lab-orders/revenue', {
    params: {
      hospitalId: params.hospitalId,
      ...(params.departmentId ? { departmentId: params.departmentId } : {}),
      ...(params.startDate && params.endDate
        ? { startDate: params.startDate, endDate: params.endDate }
        : {}),
    },
  });

  return data as LabRevenueReport;
}

export function useLabRevenue(params: LabRevenueParams) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: [
      'lab-orders',
      'revenue',
      params.hospitalId,
      params.startDate || null,
      params.endDate || null,
      params.departmentId || null,
    ],
    queryFn: () => fetchLabRevenue(params),
    enabled: !!token && !!params.hospitalId && params.enabled !== false,
  });
}

/**
 * Today by the server's clock (yyyy-mm-dd). The revenue dates default to it
 * rather than to the desk PC's date, which has been seen to be wrong.
 */
export function useServerDate() {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['lab-orders', 'server-date'],
    queryFn: async () => {
      const { data } = await api.get('/lab-orders/server-date');
      return data as { today: string; now: string };
    },
    enabled: !!token,
    staleTime: 60_000,
  });
}
