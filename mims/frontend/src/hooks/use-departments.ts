import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';

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
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

async function fetchDepartments(filters: DepartmentFilters, token: string) {
  // Use the general endpoint with query params
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, value.toString());
    }
  });

  const response = await fetch(`${API_URL}/departments?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch departments');
  }

  return response.json();
}

async function fetchDepartment(id: string, token: string) {
  const response = await fetch(`${API_URL}/departments/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch department');
  }

  return response.json();
}

async function createDepartment(data: CreateDepartmentData, token: string) {
  const response = await fetch(`${API_URL}/departments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create department');
  }

  return response.json();
}

async function updateDepartment(id: string, data: Partial<CreateDepartmentData>, token: string) {
  const response = await fetch(`${API_URL}/departments/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update department');
  }

  return response.json();
}

async function deleteDepartment(id: string, token: string) {
  const response = await fetch(`${API_URL}/departments/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete department');
  }

  return response.json();
}


// Hooks
export function useDepartments(filters: DepartmentFilters = {}) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['departments', filters],
    queryFn: () => fetchDepartments(filters, token!),
    enabled: !!token && !!filters.hospitalId,
  });
}

export function useDepartment(id: string) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['department', id],
    queryFn: () => fetchDepartment(id, token!),
    enabled: !!token && !!id,
  });
}

export function useCreateDepartment() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDepartmentData) => createDepartment(data, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });
}

export function useUpdateDepartment() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateDepartmentData> }) =>
      updateDepartment(id, data, token!),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['department', variables.id] });
    },
  });
}

export function useDeleteDepartment() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteDepartment(id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });
}

