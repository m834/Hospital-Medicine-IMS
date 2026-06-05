import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import api, { getErrorMessage } from '@/lib/api';

// Types
export interface Bed {
  id: string;
  hospitalId: string;
  departmentId?: string;
  roomId: string;
  bedNumber: string;
  bedType: 'STANDARD' | 'ICU' | 'NICU' | 'PICU' | 'CCU' | 'HDU' | 'VENTILATOR' | 'ISOLATION' | 'PEDIATRIC' | 'MATERNITY';
  dailyRate: string;
  features?: string[];
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'CLEANING';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  hospital?: {
    id: string;
    name: string;
    code: string;
  };
  department?: {
    id: string;
    name: string;
    code: string;
  };
  room?: {
    id: string;
    roomNumber: string;
    roomType: string;
    floor?: number;
    building?: string;
  };
  admissions?: Array<{
    id: string;
    admissionNumber: string;
    status: string;
    admissionDate: string;
  }>;
}

export interface BedFilters {
  hospitalId?: string;
  departmentId?: string;
  roomId?: string;
  bedType?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface CreateBedData {
  hospitalId: string;
  departmentId?: string;
  roomId: string;
  bedNumber: string;
  bedType: string;
  dailyRate: number;
  features?: string[];
  status?: string;
  notes?: string;
}

export interface UpdateBedStatusData {
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'CLEANING';
}

// API Functions
async function fetchBeds(filters: BedFilters) {
  const params: Record<string, string> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params[key] = value.toString();
    }
  });

  const { data } = await api.get(`/beds`, { params });
  return data;
}

async function fetchBed(id: string) {
  const { data } = await api.get(`/beds/${id}`);
  return data;
}

async function fetchAvailableBeds(
  hospitalId: string,
  roomId: string | undefined,
  bedType: string | undefined
) {
  const params: Record<string, string> = {};
  if (roomId) params.roomId = roomId;
  if (bedType) params.bedType = bedType;

  const { data } = await api.get(`/beds/available/${hospitalId}`, { params });
  return data;
}

async function createBed(data: CreateBedData) {
  try {
    const res = await api.post(`/beds`, data);
    return res.data;
  } catch (error) {
    throw new Error(getErrorMessage(error) || 'Failed to create bed');
  }
}

async function updateBed(id: string, data: Partial<CreateBedData>) {
  try {
    const res = await api.patch(`/beds/${id}`, data);
    return res.data;
  } catch (error) {
    throw new Error(getErrorMessage(error) || 'Failed to update bed');
  }
}

async function updateBedStatus(id: string, status: string) {
  try {
    const res = await api.patch(`/beds/${id}/status`, { status });
    return res.data;
  } catch (error) {
    throw new Error(getErrorMessage(error) || 'Failed to update bed status');
  }
}

async function deleteBed(id: string) {
  try {
    const res = await api.delete(`/beds/${id}`);
    return res.data;
  } catch (error) {
    throw new Error(getErrorMessage(error) || 'Failed to delete bed');
  }
}

// Hooks
export function useBeds(filters: BedFilters = {}) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['beds', filters],
    queryFn: () => fetchBeds(filters),
    enabled: !!token,
  });
}

export function useBed(id: string) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['bed', id],
    queryFn: () => fetchBed(id),
    enabled: !!token && !!id,
  });
}

export function useAvailableBeds(hospitalId: string, roomId?: string, bedType?: string) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['beds', 'available', hospitalId, roomId, bedType],
    queryFn: () => fetchAvailableBeds(hospitalId, roomId, bedType),
    enabled: !!token && !!hospitalId,
  });
}

export function useCreateBed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBedData) => createBed(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beds'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useUpdateBed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateBedData> }) =>
      updateBed(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['beds'] });
      queryClient.invalidateQueries({ queryKey: ['bed', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useUpdateBedStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateBedStatus(id, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['beds'] });
      queryClient.invalidateQueries({ queryKey: ['bed', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useDeleteBed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteBed(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beds'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}
