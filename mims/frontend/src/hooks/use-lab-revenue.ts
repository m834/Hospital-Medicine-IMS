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

/** A staff member and how many tests they created in the range. */
export interface LabRevenueResourceRow {
  resourceId: string;
  resourceName: string;
  role: string | null;
  tests: number;
}

export interface LabRevenueReport {
  range: { start: string | null; end: string | null };
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
}

async function fetchLabRevenue(params: LabRevenueParams) {
  const { data } = await api.get('/lab-orders/revenue', {
    params: {
      hospitalId: params.hospitalId,
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
    ],
    queryFn: () => fetchLabRevenue(params),
    enabled: !!token && !!params.hospitalId,
  });
}
