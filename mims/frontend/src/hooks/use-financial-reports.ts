import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export type FinancialReportPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface FinancialSummary {
  period: FinancialReportPeriod;
  range: {
    start: string;
    end: string;
  };
  income: number;
  expenses: number;
  payroll: number;
  profitLoss: number;
}

export interface FinancialDetailedReport {
  period: FinancialReportPeriod;
  range: {
    start: string;
    end: string;
  };
  income: {
    opd: number;
    lab: number;
    operation: number;
    room: number;
    pharmacy: number;
    other: number;
  };
  expenses: number;
  payroll: number;
  payrollByDepartment: Record<string, number>;
  totalIncome: number;
  profitLoss: number;
}

const getHospitalHeader = (hospitalId?: string) =>
  hospitalId ? { 'x-hospital-id': hospitalId } : undefined;

async function fetchFinancialSummary(params: {
  hospitalId: string;
  period: FinancialReportPeriod;
  date: string;
}) {
  const { data } = await api.get('/reports/financial-summary', {
    params: {
      period: params.period,
      date: params.date,
      hospitalId: params.hospitalId,
    },
    headers: getHospitalHeader(params.hospitalId),
  });

  return data as FinancialSummary;
}

async function fetchFinancialDetailed(params: {
  hospitalId: string;
  period: FinancialReportPeriod;
  date: string;
}) {
  const { data } = await api.get('/reports/financial-detailed', {
    params: {
      period: params.period,
      date: params.date,
      hospitalId: params.hospitalId,
    },
    headers: getHospitalHeader(params.hospitalId),
  });

  return data as FinancialDetailedReport;
}

export function useFinancialSummary(params?: {
  hospitalId?: string;
  period: FinancialReportPeriod;
  date: string;
}) {
  return useQuery({
    queryKey: ['reports', 'financial-summary', params?.hospitalId, params?.period, params?.date],
    queryFn: () =>
      fetchFinancialSummary({
        hospitalId: params?.hospitalId as string,
        period: params?.period as FinancialReportPeriod,
        date: params?.date as string,
      }),
    enabled: !!params?.hospitalId && !!params?.period && !!params?.date,
  });
}

export function useFinancialDetailed(params?: {
  hospitalId?: string;
  period: FinancialReportPeriod;
  date: string;
}) {
  return useQuery({
    queryKey: ['reports', 'financial-detailed', params?.hospitalId, params?.period, params?.date],
    queryFn: () =>
      fetchFinancialDetailed({
        hospitalId: params?.hospitalId as string,
        period: params?.period as FinancialReportPeriod,
        date: params?.date as string,
      }),
    enabled: !!params?.hospitalId && !!params?.period && !!params?.date,
  });
}
