import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export type ExpenditureType =
  | 'DAILY_WAGES'
  | 'ELECTRICITY'
  | 'MAINTENANCE'
  | 'PURCHASE'
  | 'MISCELLANEOUS'
  | 'RENT'
  | 'SUPPLIES'
  | 'OTHER';

export const EXPENDITURE_TYPE_LABELS: Record<ExpenditureType, string> = {
  DAILY_WAGES: 'Daily Wages',
  ELECTRICITY: 'Electricity',
  MAINTENANCE: 'Maintenance',
  PURCHASE: 'Purchase',
  MISCELLANEOUS: 'Miscellaneous',
  RENT: 'Rent',
  SUPPLIES: 'Supplies',
  OTHER: 'Other',
};

export interface Expenditure {
  id: string;
  hospitalId: string;
  date: string;
  type: ExpenditureType;
  amount: number;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  creator?: {
    id: string;
    fullName?: string;
  };
}

export interface CreateExpenditureDto {
  date: string;
  type: ExpenditureType;
  amount: number;
  description?: string;
}

export interface UpdateExpenditureDto {
  date?: string;
  type?: ExpenditureType;
  amount?: number;
  description?: string;
}

export interface ExpenditureFilter {
  startDate?: string;
  endDate?: string;
  type?: ExpenditureType;
}

export interface ExpenditureTotals {
  daily: { date: string; total: number };
  monthly: { year: number; month: number; total: number };
  yearly: { year: number; total: number };
}

const getHospitalHeader = (hospitalId?: string) =>
  hospitalId ? { 'x-hospital-id': hospitalId } : undefined;

// Fetch all expenditure records
async function fetchExpenditures(hospitalId: string, filter?: ExpenditureFilter) {
  const params: Record<string, string> = {};
  if (filter?.startDate) params.startDate = filter.startDate;
  if (filter?.endDate) params.endDate = filter.endDate;
  if (filter?.type) params.type = filter.type;

  const { data } = await api.get('/expenditure', {
    headers: getHospitalHeader(hospitalId),
    params,
  });
  return data as Expenditure[];
}

// Fetch day/month/year totals
async function fetchExpenditureTotals(hospitalId: string, date?: string) {
  const params: Record<string, string> = {};
  if (date) params.date = date;

  const { data } = await api.get('/expenditure/totals', {
    headers: getHospitalHeader(hospitalId),
    params,
  });
  return data as ExpenditureTotals;
}

export function useExpenditures(hospitalId: string, filter?: ExpenditureFilter) {
  return useQuery({
    queryKey: ['expenditures', hospitalId, filter],
    queryFn: () => fetchExpenditures(hospitalId, filter),
    enabled: !!hospitalId,
  });
}

export function useExpenditureTotals(hospitalId: string, date?: string) {
  return useQuery({
    queryKey: ['expenditure-totals', hospitalId, date],
    queryFn: () => fetchExpenditureTotals(hospitalId, date),
    enabled: !!hospitalId,
  });
}

export function useCreateExpenditure(hospitalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateExpenditureDto) =>
      api.post('/expenditure', dto, {
        headers: getHospitalHeader(hospitalId),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenditures', hospitalId] });
      qc.invalidateQueries({ queryKey: ['expenditure-totals', hospitalId] });
    },
  });
}

export function useUpdateExpenditure(hospitalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateExpenditureDto }) =>
      api.put(`/expenditure/${id}`, dto, {
        headers: getHospitalHeader(hospitalId),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenditures', hospitalId] });
      qc.invalidateQueries({ queryKey: ['expenditure-totals', hospitalId] });
    },
  });
}

export function useDeleteExpenditure(hospitalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/expenditure/${id}`, {
        headers: getHospitalHeader(hospitalId),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenditures', hospitalId] });
      qc.invalidateQueries({ queryKey: ['expenditure-totals', hospitalId] });
    },
  });
}
