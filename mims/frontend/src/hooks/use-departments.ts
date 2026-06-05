import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import api, { getErrorMessage } from '@/lib/api';

// Types
export interface Department {
  id: string;
  hospitalId: string;
  name: string;
  code: string;
  description?: string;
  type?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentFilters {
  hospitalId?: string;
  isActive?: boolean;
  type?: string;
  page?: number;
  limit?: number;
}

export interface CreateDepartmentData {
  hospitalId: string;
  name: string;
  code: string;
  description?: string;
  type?: string;
  isActive?: boolean;
}


// API Functions
async function fetchDepartments(filters: DepartmentFilters) {
  // Use the general endpoint with query params
  const params: Record<string, string> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params[key] = value.toString();
    }
  });

  const { data } = await api.get(`/departments`, { params });
  return data;
}

async function fetchDepartment(id: string) {
  const { data } = await api.get(`/departments/${id}`);
  return data;
}

async function createDepartment(data: CreateDepartmentData) {
  try {
    const res = await api.post(`/departments`, data);
    return res.data;
  } catch (error) {
    throw new Error(getErrorMessage(error) || 'Failed to create department');
  }
}

async function updateDepartment(id: string, data: Partial<CreateDepartmentData>) {
  try {
    const res = await api.patch(`/departments/${id}`, data);
    return res.data;
  } catch (error) {
    throw new Error(getErrorMessage(error) || 'Failed to update department');
  }
}

async function deleteDepartment(id: string) {
  try {
    const res = await api.delete(`/departments/${id}`);
    return res.data;
  } catch (error) {
    throw new Error(getErrorMessage(error) || 'Failed to delete department');
  }
}


// Hooks
export function useDepartments(filters: DepartmentFilters = {}) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['departments', filters],
    queryFn: () => fetchDepartments(filters),
    enabled: !!token && !!filters.hospitalId,
  });
}

export function useDepartment(id: string) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['department', id],
    queryFn: () => fetchDepartment(id),
    enabled: !!token && !!id,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDepartmentData) => createDepartment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateDepartmentData> }) =>
      updateDepartment(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['department', variables.id] });
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteDepartment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });
}

