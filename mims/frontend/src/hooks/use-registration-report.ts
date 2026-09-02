import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

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

export interface RegistrationReport {
  range: {
    start: string;
    end: string;
    isSingleDay: boolean;
  };
  filters: {
    departmentId: string | null;
  };
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
}

export interface RegistrationReportParams {
  hospitalId?: string;
  startDate?: string;
  endDate?: string;
  departmentId?: string;
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
    ],
    queryFn: () => fetchRegistrationReport(params),
    enabled: !!token && !!params.hospitalId && !!params.startDate && !!params.endDate,
  });
}
