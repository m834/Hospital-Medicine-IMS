import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';

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
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

async function fetchBeds(filters: BedFilters, token: string) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, value.toString());
    }
  });

  const response = await fetch(`${API_URL}/beds?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch beds');
  }

  return response.json();
}

async function fetchBed(id: string, token: string) {
  const response = await fetch(`${API_URL}/beds/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch bed');
  }

  return response.json();
}

async function fetchAvailableBeds(
  hospitalId: string,
  roomId: string | undefined,
  bedType: string | undefined,
  token: string
) {
  const params = new URLSearchParams();
  if (roomId) params.append('roomId', roomId);
  if (bedType) params.append('bedType', bedType);

  const response = await fetch(`${API_URL}/beds/available/${hospitalId}?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch available beds');
  }

  return response.json();
}

async function createBed(data: CreateBedData, token: string) {
  const response = await fetch(`${API_URL}/beds`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create bed');
  }

  return response.json();
}

async function updateBed(id: string, data: Partial<CreateBedData>, token: string) {
  const response = await fetch(`${API_URL}/beds/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update bed');
  }

  return response.json();
}

async function updateBedStatus(id: string, status: string, token: string) {
  const response = await fetch(`${API_URL}/beds/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update bed status');
  }

  return response.json();
}

async function deleteBed(id: string, token: string) {
  const response = await fetch(`${API_URL}/beds/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete bed');
  }

  return response.json();
}

// Hooks
export function useBeds(filters: BedFilters = {}) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['beds', filters],
    queryFn: () => fetchBeds(filters, token!),
    enabled: !!token,
  });
}

export function useBed(id: string) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['bed', id],
    queryFn: () => fetchBed(id, token!),
    enabled: !!token && !!id,
  });
}

export function useAvailableBeds(hospitalId: string, roomId?: string, bedType?: string) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['beds', 'available', hospitalId, roomId, bedType],
    queryFn: () => fetchAvailableBeds(hospitalId, roomId, bedType, token!),
    enabled: !!token && !!hospitalId,
  });
}

export function useCreateBed() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBedData) => createBed(data, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beds'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useUpdateBed() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateBedData> }) =>
      updateBed(id, data, token!),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['beds'] });
      queryClient.invalidateQueries({ queryKey: ['bed', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useUpdateBedStatus() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateBedStatus(id, status, token!),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['beds'] });
      queryClient.invalidateQueries({ queryKey: ['bed', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useDeleteBed() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteBed(id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beds'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}
