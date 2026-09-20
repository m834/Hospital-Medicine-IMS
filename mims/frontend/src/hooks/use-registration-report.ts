import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

/** One test line inside a staff member's row: CBC x2 — 100. */
export interface RegistrationReportTestRow {
  testName: string;
  orders: number;
  revenue: number;
}

export interface RegistrationReportStaffRow {
  staffId: string;
  staffName: string;
  role: string | null;
  departmentId: string | null;
  departmentName: string;
  registrations: number;
  labTestOrders: number;
  labTestRevenue: number;
  labTestCollected: number;
  labTestOutstanding: number;
  /** What the lab money was made of, biggest earner first. */
  tests: RegistrationReportTestRow[];
}

export interface RegistrationReportDepartmentRow {
  departmentId: string | null;
  departmentName: string;
  registrations: number;
  labTestOrders: number;
  labTestRevenue: number;
  labTestCollected: number;
  labTestOutstanding: number;
  staff: RegistrationReportStaffRow[];
}

/** A test category — X-Ray, Hematology — and the tests that make it up. */
export interface RegistrationReportCategoryRow {
  category: string;
  orders: number;
  revenue: number;
  tests: RegistrationReportTestRow[];
}

/** One patient in the Registered Patients drill-down. */
export interface RegistrationReportPatientRow {
  id: string;
  nrNumber: string;
  fullName: string;
  registeredAt: string;
  visitType: string | null;
  staffId: string;
  staffName: string;
}

/** One day of the range, for the trend table. */
export interface RegistrationReportDayRow {
  date: string;
  registrations: number;
  labTestOrders: number;
  labTestRevenue: number;
}

export interface RegistrationReportStaffOption {
  id: string;
  fullName: string;
  role: string | null;
}

export interface RegistrationReport {
  range: {
    start: string;
    end: string;
    isSingleDay: boolean;
  };
  filters: {
    departmentId: string | null;
    staffId: string | null;
  };
  /** The desk roster behind the staff filter, independent of the current filters. */
  staffOptions: RegistrationReportStaffOption[];
  totals: {
    registrations: number;
    labTestOrders: number;
    labTestRevenue: number;
    labTestCollected: number;
    labTestOutstanding: number;
    staffCount: number;
  };
  departments: RegistrationReportDepartmentRow[];
  staff: RegistrationReportStaffRow[];
  /** Test categories across the whole report, biggest earner first. */
  categories: RegistrationReportCategoryRow[];
  /** Every day of the range, quiet days included. */
  daily: RegistrationReportDayRow[];
  /** The patients behind the registration count, newest first, capped at 500. */
  patients: RegistrationReportPatientRow[];
  patientsTruncated: boolean;
}

export interface RegistrationReportParams {
  hospitalId?: string;
  startDate?: string;
  endDate?: string;
  departmentId?: string;
  /**
   * Ignored by the backend for a registration staff member, who is pinned to
   * their own id off the token.
   */
  staffId?: string;
}

async function fetchRegistrationReport(params: RegistrationReportParams) {
  const { data } = await api.get('/reports/registration', {
    params: {
      startDate: params.startDate,
      endDate: params.endDate,
      // The backend pins the hospital to the token; it only reads this for a
      // platform admin, who has no hospital of their own.
      ...(params.hospitalId ? { hospitalId: params.hospitalId } : {}),
      ...(params.departmentId ? { departmentId: params.departmentId } : {}),
      ...(params.staffId ? { staffId: params.staffId } : {}),
    },
  });

  return data as RegistrationReport;
}

export function useRegistrationReport(params: RegistrationReportParams) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: [
      'reports',
      'registration',
      params.hospitalId,
      params.startDate,
      params.endDate,
      params.departmentId ?? null,
      params.staffId ?? null,
    ],
    queryFn: () => fetchRegistrationReport(params),
    enabled: !!token && !!params.hospitalId && !!params.startDate && !!params.endDate,
    // The desk report is read while the desk is working, so it refreshes itself
    // rather than waiting to be reloaded: every minute, and again whenever the
    // manager comes back to the tab.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    // Keep the previous period on screen while the next one loads, so changing
    // a filter does not blank the page.
    placeholderData: (previous: RegistrationReport | undefined) => previous,
  });
}
