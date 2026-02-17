/**
 * Clinics API Hooks
 * React Query hooks for clinic management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useToast } from './use-toast';

// Types
export interface Clinic {
  id: string;
  hospitalId: string;
  departmentId: string;
  doctorId: string;
  name: string | null;
  opdFee: string;
  availableDays: string | null;
  availableTime: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'TEMPORARILY_CLOSED';
  version: number;
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
  doctor?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  _count?: {
    visits: number;
    tokens: number;
  };
}

export interface ClinicFilters {
  hospitalId?: string;
  departmentId?: string;
  doctorId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface CreateClinicDto {
  hospitalId: string;
  departmentId: string;
  doctorId: string;
  name?: string;
  opdFee: number;
  availableDays?: string[];
  availableTime?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'TEMPORARILY_CLOSED';
}

export interface UpdateClinicDto {
  name?: string;
  opdFee?: number;
  availableDays?: string[];
  availableTime?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'TEMPORARILY_CLOSED';
}

// Query Keys
export const clinicKeys = {
  all: ['clinics'] as const,
  lists: () => [...clinicKeys.all, 'list'] as const,
  list: (filters: ClinicFilters) => [...clinicKeys.lists(), filters] as const,
  details: () => [...clinicKeys.all, 'detail'] as const,
  detail: (id: string) => [...clinicKeys.details(), id] as const,
  byDoctor: (doctorId: string) => [...clinicKeys.all, 'doctor', doctorId] as const,
  byDepartment: (deptId: string) => [...clinicKeys.all, 'department', deptId] as const,
  available: (hospitalId?: string) => [...clinicKeys.all, 'available', hospitalId] as const,
};

// Hooks
export function useGetClinics(filters: ClinicFilters = {}) {
  return useQuery({
    queryKey: clinicKeys.list(filters),
    queryFn: async () => {
      const { data } = await api.get('/clinics', { params: filters });
      return data as { data: Clinic[]; total: number; page: number; limit: number };
    },
  });
}

export function useGetClinic(id: string) {
  return useQuery({
    queryKey: clinicKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get(`/clinics/${id}`);
      return data as Clinic;
    },
    enabled: !!id,
  });
}

export function useGetDoctorClinics(doctorId: string) {
  return useQuery({
    queryKey: clinicKeys.byDoctor(doctorId),
    queryFn: async () => {
      const { data } = await api.get(`/clinics/doctor/${doctorId}`);
      return data as Clinic[];
    },
    enabled: !!doctorId,
  });
}

export function useGetDepartmentClinics(departmentId: string) {
  return useQuery({
    queryKey: clinicKeys.byDepartment(departmentId),
    queryFn: async () => {
      const { data } = await api.get(`/clinics/department/${departmentId}`);
      return data as Clinic[];
    },
    enabled: !!departmentId,
  });
}

export function useGetAvailableClinics(hospitalId?: string) {
  return useQuery({
    queryKey: clinicKeys.available(hospitalId),
    queryFn: async () => {
      const params = hospitalId ? { hospitalId } : {};
      const { data } = await api.get('/clinics/available', { params });
      return data as Clinic[];
    },
  });
}

export function useCreateClinic() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (dto: CreateClinicDto) => {
      const { data } = await api.post('/clinics', dto);
      return data as Clinic;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clinicKeys.all });
      toast({
        title: 'Success',
        description: 'Clinic created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create clinic',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateClinic() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateClinicDto }) => {
      const { data } = await api.patch(`/clinics/${id}`, dto);
      return data as Clinic;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: clinicKeys.all });
      queryClient.invalidateQueries({ queryKey: clinicKeys.detail(variables.id) });
      toast({
        title: 'Success',
        description: 'Clinic updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update clinic',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteClinic() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/clinics/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clinicKeys.all });
      toast({
        title: 'Success',
        description: 'Clinic deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete clinic',
        variant: 'destructive',
      });
    },
  });
}
