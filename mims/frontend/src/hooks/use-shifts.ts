import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface Shift {
  id: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  breakDurationMinutes: number;
  gracePeriodMinutes: number;
  isActive: boolean;
  description?: string | null;
  createdAt?: string;
}

export interface ShiftFilters {
  isActive?: boolean;
  skip?: number;
  take?: number;
}

export interface CreateShiftPayload {
  name: string;
  startTime: number;
  startMinute?: number;
  endTime: number;
  endMinute?: number;
  breakDurationMinutes?: number;
  gracePeriodMinutes?: number;
  isActive?: boolean;
  description?: string;
}

export interface UpdateShiftPayload extends Partial<CreateShiftPayload> {}

export interface AssignShiftPayload {
  employeeId: string;
  shiftId: string;
  effectiveFrom: string;
  effectiveTo?: string;
  notes?: string;
}

export interface EmployeeShiftAssignment {
  id: string;
  userId: string;
  shiftId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  assignmentReason?: string | null;
  isPermanent?: boolean;
  shift?: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
  };
  user?: {
    id: string;
    fullName?: string;
    name?: string;
    email?: string;
  };
}

const getHospitalHeader = (hospitalId?: string) =>
  hospitalId ? { 'x-hospital-id': hospitalId } : undefined;

async function fetchShifts(hospitalId: string, filters: ShiftFilters) {
  const { data } = await api.get('/shifts', {
    params: filters,
    headers: getHospitalHeader(hospitalId),
  });
  return data as Shift[];
}

async function createShift(hospitalId: string, payload: CreateShiftPayload) {
  const { data } = await api.post('/shifts', payload, {
    headers: getHospitalHeader(hospitalId),
  });
  return data as Shift;
}

async function updateShift(hospitalId: string, shiftId: string, payload: UpdateShiftPayload) {
  const { data } = await api.put(`/shifts/${shiftId}`, payload, {
    headers: getHospitalHeader(hospitalId),
  });
  return data as Shift;
}

async function deactivateShift(hospitalId: string, shiftId: string) {
  const { data } = await api.delete(`/shifts/${shiftId}`, {
    headers: getHospitalHeader(hospitalId),
  });
  return data as Shift;
}

async function assignShift(hospitalId: string, payload: AssignShiftPayload) {
  const { data } = await api.post('/shifts/assign/single', payload, {
    headers: getHospitalHeader(hospitalId),
  });
  return data;
}

async function fetchEmployeeShiftHistory(hospitalId: string, employeeId: string) {
  const { data } = await api.get(`/shifts/employees/${employeeId}/history`, {
    headers: getHospitalHeader(hospitalId),
  });
  return data as EmployeeShiftAssignment[];
}

async function fetchAllShiftAssignments(hospitalId: string) {
  const { data } = await api.get('/shifts/assignments', {
    headers: getHospitalHeader(hospitalId),
  });
  return data as EmployeeShiftAssignment[];
}

export function useShifts(hospitalId?: string, filters: ShiftFilters = {}) {
  return useQuery({
    queryKey: ['shifts', hospitalId, filters],
    queryFn: () => fetchShifts(hospitalId as string, filters),
    enabled: !!hospitalId,
  });
}

export function useCreateShift(hospitalId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateShiftPayload) => createShift(hospitalId as string, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts', hospitalId] });
    },
  });
}

export function useUpdateShift(hospitalId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ shiftId, payload }: { shiftId: string; payload: UpdateShiftPayload }) =>
      updateShift(hospitalId as string, shiftId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts', hospitalId] });
    },
  });
}

export function useDeactivateShift(hospitalId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (shiftId: string) => deactivateShift(hospitalId as string, shiftId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts', hospitalId] });
    },
  });
}

export function useAssignShift(hospitalId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AssignShiftPayload) => assignShift(hospitalId as string, payload),
    onSuccess: (_, payload) => {
      queryClient.invalidateQueries({
        queryKey: ['shifts', 'history', hospitalId, payload.employeeId],
      });
      queryClient.invalidateQueries({
        queryKey: ['shifts', 'assignments', hospitalId],
      });
    },
  });
}

export function useEmployeeShiftHistory(hospitalId?: string, employeeId?: string) {
  return useQuery({
    queryKey: ['shifts', 'history', hospitalId, employeeId],
    queryFn: () => fetchEmployeeShiftHistory(hospitalId as string, employeeId as string),
    enabled: !!hospitalId && !!employeeId,
  });
}

export function useAllShiftAssignments(hospitalId?: string) {
  return useQuery({
    queryKey: ['shifts', 'assignments', hospitalId],
    queryFn: () => fetchAllShiftAssignments(hospitalId as string),
    enabled: !!hospitalId,
  });
}
