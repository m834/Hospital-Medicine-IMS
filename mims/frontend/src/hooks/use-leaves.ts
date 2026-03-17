import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  maxDaysPerYear: number;
  description?: string | null;
  requiresApproval?: boolean;
  isActive?: boolean;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: LeaveStatus;
  reason?: string | null;
  appliedDate?: string;
  leaveType?: LeaveType;
  user?: {
    id: string;
    fullName?: string;
    name?: string;
    email?: string;
  };
}

export interface Holiday {
  id: string;
  name: string;
  holidayDate: string;
  description?: string | null;
  isActive?: boolean;
}

export interface LeaveRequestFilters {
  [key: string]: unknown;
  status?: LeaveStatus;
  leaveTypeId?: string;
  fromDate?: string;
  toDate?: string;
  employeeId?: string;
  skip?: number;
  take?: number;
}

export interface ApplyLeavePayload {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason?: string;
  attachmentUrl?: string;
}

export interface ProcessLeavePayload {
  decision: 'APPROVED' | 'REJECTED';
  comments?: string;
}

export interface CancelLeavePayload {
  reason?: string;
}

export interface CreateLeaveTypePayload {
  name: string;
  code?: string;
  annualAllowance: number;
  description?: string;
  requiresApproval?: boolean;
  isActive?: boolean;
}

export interface CreateHolidayPayload {
  name: string;
  date: string;
  description?: string;
}

const getHospitalHeader = (hospitalId?: string) =>
  hospitalId ? { 'x-hospital-id': hospitalId } : undefined;

const buildParams = <T extends Record<string, unknown>>(params: T) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  );

async function fetchLeaveRequests(hospitalId: string, filters: LeaveRequestFilters) {
  const { data } = await api.get('/leaves/requests', {
    params: buildParams(filters),
    headers: getHospitalHeader(hospitalId),
  });
  return data as LeaveRequest[];
}

async function applyLeave(hospitalId: string, payload: ApplyLeavePayload) {
  const { data } = await api.post('/leaves/requests/apply', payload, {
    headers: getHospitalHeader(hospitalId),
  });
  return data as LeaveRequest;
}

async function processLeave(hospitalId: string, leaveRequestId: string, payload: ProcessLeavePayload) {
  const { data } = await api.post(`/leaves/requests/${leaveRequestId}/process`, payload, {
    headers: getHospitalHeader(hospitalId),
  });
  return data as LeaveRequest;
}

async function cancelLeave(hospitalId: string, leaveRequestId: string, payload: CancelLeavePayload) {
  const { data } = await api.post(`/leaves/requests/${leaveRequestId}/cancel`, payload, {
    headers: getHospitalHeader(hospitalId),
  });
  return data as LeaveRequest;
}

async function fetchLeaveTypes(hospitalId: string) {
  const { data } = await api.get('/leaves/types', {
    headers: getHospitalHeader(hospitalId),
  });
  return data as LeaveType[];
}

async function createLeaveType(hospitalId: string, payload: CreateLeaveTypePayload) {
  const { data } = await api.post('/leaves/types', payload, {
    headers: getHospitalHeader(hospitalId),
  });
  return data as LeaveType;
}

async function fetchHolidays(hospitalId: string, year?: number) {
  const { data } = await api.get('/leaves/holidays', {
    params: year ? { year } : undefined,
    headers: getHospitalHeader(hospitalId),
  });
  return data as Holiday[];
}

async function createHoliday(hospitalId: string, payload: CreateHolidayPayload) {
  const { data } = await api.post('/leaves/holidays', payload, {
    headers: getHospitalHeader(hospitalId),
  });
  return data as Holiday;
}

export function useLeaveRequests(hospitalId?: string, filters: LeaveRequestFilters = {}) {
  return useQuery({
    queryKey: ['leaves', 'requests', hospitalId, filters],
    queryFn: () => fetchLeaveRequests(hospitalId as string, filters),
    enabled: !!hospitalId,
  });
}

export function useApplyLeave(hospitalId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ApplyLeavePayload) => applyLeave(hospitalId as string, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves', 'requests', hospitalId] });
    },
  });
}

export function useProcessLeave(hospitalId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leaveRequestId, payload }: { leaveRequestId: string; payload: ProcessLeavePayload }) =>
      processLeave(hospitalId as string, leaveRequestId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves', 'requests', hospitalId] });
    },
  });
}

export function useCancelLeave(hospitalId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leaveRequestId, payload }: { leaveRequestId: string; payload: CancelLeavePayload }) =>
      cancelLeave(hospitalId as string, leaveRequestId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves', 'requests', hospitalId] });
    },
  });
}

export function useLeaveTypes(hospitalId?: string) {
  return useQuery({
    queryKey: ['leaves', 'types', hospitalId],
    queryFn: () => fetchLeaveTypes(hospitalId as string),
    enabled: !!hospitalId,
  });
}

export function useCreateLeaveType(hospitalId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateLeaveTypePayload) => createLeaveType(hospitalId as string, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves', 'types', hospitalId] });
    },
  });
}

export function useHolidays(hospitalId?: string, year?: number) {
  return useQuery({
    queryKey: ['leaves', 'holidays', hospitalId, year],
    queryFn: () => fetchHolidays(hospitalId as string, year),
    enabled: !!hospitalId,
  });
}

export function useCreateHoliday(hospitalId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateHolidayPayload) => createHoliday(hospitalId as string, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves', 'holidays', hospitalId] });
    },
  });
}
