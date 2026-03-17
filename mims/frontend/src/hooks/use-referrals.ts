/**
 * Referrals API Hooks
 * React Query hooks for referral management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useToast } from './use-toast';

// Types
export interface Referral {
  id: string;
  hospitalId: string;
  visitId: string;
  fromDepartmentId: string;
  toDepartmentId: string;
  referralType: 'LAB_TEST' | 'RADIOLOGY' | 'PHARMACY' | 'ADMISSION' | 'SPECIALIST_CONSULTATION';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  reason: string;
  notes: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED';
  referredBy: string;
  acceptedBy: string | null;
  completedBy: string | null;
  createdAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  hospital?: {
    id: string;
    name: string;
    code: string;
  };
  visit?: {
    id: string;
    tokenNumber: number;
    patient?: {
      id: string;
      nrNumber: string;
      firstName: string;
      lastName: string;
    };
    clinic?: {
      id: string;
      name: string;
      doctor?: {
        firstName: string;
        lastName: string;
      };
    };
  };
  fromDepartment?: {
    id: string;
    name: string;
    code: string;
  };
  toDepartment?: {
    id: string;
    name: string;
    code: string;
  };
  referrer?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  accepter?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface ReferralFilters {
  hospitalId?: string;
  visitId?: string;
  fromDepartmentId?: string;
  toDepartmentId?: string;
  referralType?: string;
  status?: string;
  priority?: string;
  page?: number;
  limit?: number;
}

export interface CreateReferralDto {
  hospitalId: string;
  visitId: string;
  fromDepartmentId: string;
  toDepartmentId: string;
  referrerId: string;
  referralType: 'LAB_TEST' | 'RADIOLOGY' | 'PHARMACY' | 'ADMISSION' | 'SPECIALIST_CONSULTATION';
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  reason: string;
  notes?: string;
}

export interface UpdateReferralDto {
  reason?: string;
  notes?: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
}

// Query Keys
export const referralKeys = {
  all: ['referrals'] as const,
  lists: () => [...referralKeys.all, 'list'] as const,
  list: (filters: ReferralFilters) => [...referralKeys.lists(), filters] as const,
  details: () => [...referralKeys.all, 'detail'] as const,
  detail: (id: string) => [...referralKeys.details(), id] as const,
  byVisit: (visitId: string) => [...referralKeys.all, 'visit', visitId] as const,
  byDepartment: (deptId: string) => [...referralKeys.all, 'department', deptId] as const,
  pending: (deptId?: string) => [...referralKeys.all, 'pending', deptId] as const,
  stats: (hospitalId?: string) => [...referralKeys.all, 'stats', hospitalId] as const,
};

// Hooks
export function useGetReferrals(filters: ReferralFilters = {}) {
  return useQuery({
    queryKey: referralKeys.list(filters),
    queryFn: async () => {
      const { data } = await api.get('/referrals', { params: filters });
      return data as { data: Referral[]; total: number; page: number; limit: number };
    },
  });
}

export function useGetReferral(id: string) {
  return useQuery({
    queryKey: referralKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get(`/referrals/${id}`);
      return data as Referral;
    },
    enabled: !!id,
  });
}

export function useGetVisitReferrals(visitId: string) {
  return useQuery({
    queryKey: referralKeys.byVisit(visitId),
    queryFn: async () => {
      const { data } = await api.get(`/referrals/visit/${visitId}`);
      return data as Referral[];
    },
    enabled: !!visitId,
  });
}

export function useGetDepartmentReferrals(departmentId: string) {
  return useQuery({
    queryKey: referralKeys.byDepartment(departmentId),
    queryFn: async () => {
      const { data } = await api.get(`/referrals/department/${departmentId}`);
      return data as Referral[];
    },
    enabled: !!departmentId,
  });
}

export function useGetPendingReferrals(departmentId?: string) {
  return useQuery({
    queryKey: referralKeys.pending(departmentId),
    queryFn: async () => {
      const params = departmentId ? { departmentId } : {};
      const { data } = await api.get('/referrals/pending', { params });
      return data as Referral[];
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });
}

export function useGetReferralStats(hospitalId?: string) {
  return useQuery({
    queryKey: referralKeys.stats(hospitalId),
    queryFn: async () => {
      const params = hospitalId ? { hospitalId } : {};
      const { data } = await api.get('/referrals/stats', { params });
      return data as {
        total: number;
        pending: number;
        accepted: number;
        completed: number;
        cancelled: number;
        byType: Record<string, number>;
      };
    },
  });
}

export function useCreateReferral() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (dto: CreateReferralDto) => {
      const { data } = await api.post('/referrals', dto);
      return data as Referral;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: referralKeys.all });
      toast({
        title: 'Success',
        description: 'Referral created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create referral',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateReferral() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateReferralDto }) => {
      const { data } = await api.patch(`/referrals/${id}`, dto);
      return data as Referral;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: referralKeys.all });
      queryClient.invalidateQueries({ queryKey: referralKeys.detail(variables.id) });
      toast({
        title: 'Success',
        description: 'Referral updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update referral',
        variant: 'destructive',
      });
    },
  });
}

export function useAcceptReferral() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/referrals/${id}/accept`);
      return data as Referral;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: referralKeys.all });
      toast({
        title: 'Referral Accepted',
        description: 'You have accepted the referral',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to accept referral',
        variant: 'destructive',
      });
    },
  });
}

export function useCompleteReferral() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const { data } = await api.post(`/referrals/${id}/complete`, { notes });
      return data as Referral;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: referralKeys.all });
      toast({
        title: 'Referral Completed',
        description: 'Referral has been marked as completed',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to complete referral',
        variant: 'destructive',
      });
    },
  });
}

export function useCancelReferral() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data } = await api.post(`/referrals/${id}/cancel`, { reason });
      return data as Referral;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: referralKeys.all });
      toast({
        title: 'Referral Cancelled',
        description: 'Referral has been cancelled',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to cancel referral',
        variant: 'destructive',
      });
    },
  });
}
