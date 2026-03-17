import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export type LatePenaltyType = 'NONE' | 'HALF_DAY' | 'ABSENT';
export type LeavePayType = 'PAID' | 'UNPAID';

export interface PayrollSetting {
  id: string;
  hospitalId: string;
  userId: string;
  monthlySalary: number;
  allowanceAmount?: number;
  otherDeductionAmount?: number;
  latePenaltyType: LatePenaltyType;
  leavePayType: LeavePayType;
  user?: {
    id: string;
    fullName?: string;
    name?: string;
    email?: string;
  };
}

export interface PayrollRunResult {
  employeeId: string;
  year: number;
  month: number;
  monthlySalary: number;
  allowanceAmount?: number;
  otherDeductionAmount?: number;
  dailyRate: number;
  counts: {
    present: number;
    absent: number;
    late: number;
    halfDay: number;
    onLeave: number;
  };
  deductions: {
    absent: number;
    halfDay: number;
    late: number;
    leave: number;
    total: number;
  };
  netPay: number;
  policy: {
    latePenaltyType: LatePenaltyType;
    leavePayType: LeavePayType;
  };
}

export interface PayrollBatchItem {
  employeeId: string;
  employeeName: string;
  departmentName: string;
  role: string;
  counts: {
    present: number;
    absent: number;
    late: number;
    halfDay: number;
    onLeave: number;
  };
  monthlySalary: number;
  allowanceAmount: number;
  otherDeductionAmount: number;
  netPay: number;
  configured: boolean;
}

const getHospitalHeader = (hospitalId?: string) =>
  hospitalId ? { 'x-hospital-id': hospitalId } : undefined;

async function fetchPayrollSettings(hospitalId: string) {
  const { data } = await api.get('/payroll/settings', {
    headers: getHospitalHeader(hospitalId),
  });
  return data as PayrollSetting[];
}

async function upsertPayrollSetting(hospitalId: string, employeeId: string, payload: {
  monthlySalary: number;
  allowanceAmount?: number;
  otherDeductionAmount?: number;
  latePenaltyType: LatePenaltyType;
  leavePayType: LeavePayType;
}) {
  const { data } = await api.put(`/payroll/settings/${employeeId}`, payload, {
    headers: getHospitalHeader(hospitalId),
  });
  return data as PayrollSetting;
}

async function runPayroll(hospitalId: string, params: { employeeId: string; year: number; month: number }) {
  const { data } = await api.get('/payroll/run', {
    params,
    headers: getHospitalHeader(hospitalId),
  });
  return data as PayrollRunResult;
}

async function runPayrollBatch(hospitalId: string, params: { year: number; month: number }) {
  const { data } = await api.get('/payroll/run/batch', {
    params,
    headers: getHospitalHeader(hospitalId),
  });
  return data as PayrollBatchItem[];
}

async function getPayrollGenerated(hospitalId: string, params: { year: number; month: number }) {
  const { data } = await api.get('/payroll/generated', {
    params,
    headers: getHospitalHeader(hospitalId),
  });
  return data as { generated: boolean };
}

async function generatePayrollBatch(hospitalId: string, payload: { year: number; month: number }) {
  const { data } = await api.post('/payroll/generate', payload, {
    headers: getHospitalHeader(hospitalId),
  });
  return data as PayrollBatchItem[];
}

export function usePayrollSettings(hospitalId?: string) {
  return useQuery({
    queryKey: ['payroll', 'settings', hospitalId],
    queryFn: () => fetchPayrollSettings(hospitalId as string),
    enabled: !!hospitalId,
  });
}

export function useUpsertPayrollSetting(hospitalId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ employeeId, payload }: { employeeId: string; payload: { monthlySalary: number; allowanceAmount?: number; otherDeductionAmount?: number; latePenaltyType: LatePenaltyType; leavePayType: LeavePayType } }) =>
      upsertPayrollSetting(hospitalId as string, employeeId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'settings', hospitalId] });
    },
  });
}

export function useRunPayroll(hospitalId?: string) {
  return useMutation({
    mutationFn: (params: { employeeId: string; year: number; month: number }) =>
      runPayroll(hospitalId as string, params),
  });
}

export function useRunPayrollBatch(hospitalId?: string) {
  return useMutation({
    mutationFn: (params: { year: number; month: number }) =>
      runPayrollBatch(hospitalId as string, params),
  });
}

export function usePayrollGeneratedStatus(hospitalId?: string, params?: { year: number; month: number }) {
  return useQuery({
    queryKey: ['payroll', 'generated', hospitalId, params?.year, params?.month],
    queryFn: () => getPayrollGenerated(hospitalId as string, params as { year: number; month: number }),
    enabled: !!hospitalId && !!params?.year && !!params?.month,
  });
}

export function useGeneratePayrollBatch(hospitalId?: string) {
  return useMutation({
    mutationFn: (payload: { year: number; month: number }) =>
      generatePayrollBatch(hospitalId as string, payload),
  });
}
