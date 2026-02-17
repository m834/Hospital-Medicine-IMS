/**
 * Tokens API Hooks
 * React Query hooks for token queue management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useToast } from './use-toast';

// Types
export interface Token {
  id: string;
  hospitalId: string;
  clinicId: string;
  tokenNumber: number;
  tokenDate: string;
  status: 'WAITING' | 'CALLED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  calledAt: string | null;
  version: number;
  createdAt: string;
  clinic?: {
    id: string;
    name: string;
    doctor?: {
      id: string;
      firstName: string;
      lastName: string;
    };
    department?: {
      id: string;
      name: string;
    };
  };
  visit?: {
    id: string;
    patient?: {
      id: string;
      nrNumber: string;
      firstName: string;
      lastName: string;
    };
  };
}

export interface TokenDisplayData {
  clinicId: string;
  clinicName: string;
  doctorName: string;
  departmentName: string;
  currentToken: number | null;
  nextTokens: Token[];
  totalWaiting: number;
  totalCompleted: number;
}

// Query Keys
export const tokenKeys = {
  all: ['tokens'] as const,
  byClinic: (clinicId: string) => [...tokenKeys.all, 'clinic', clinicId] as const,
  today: (clinicId: string) => [...tokenKeys.all, 'today', clinicId] as const,
  current: (clinicId: string) => [...tokenKeys.all, 'current', clinicId] as const,
  waiting: (clinicId: string) => [...tokenKeys.all, 'waiting', clinicId] as const,
  display: (clinicId?: string) => [...tokenKeys.all, 'display', clinicId] as const,
};

// Hooks
export function useGetClinicTokensToday(clinicId: string) {
  return useQuery({
    queryKey: tokenKeys.today(clinicId),
    queryFn: async () => {
      const { data } = await api.get(`/tokens/clinic/${clinicId}/today`);
      return data as Token[];
    },
    enabled: !!clinicId,
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });
}

export function useGetCurrentToken(clinicId: string) {
  return useQuery({
    queryKey: tokenKeys.current(clinicId),
    queryFn: async () => {
      const { data } = await api.get(`/tokens/clinic/${clinicId}/current`);
      return data as { currentToken: number | null; calledAt: string | null };
    },
    enabled: !!clinicId,
    refetchInterval: 5000, // Auto-refresh every 5 seconds for real-time display
  });
}

export function useGetWaitingTokens(clinicId: string) {
  return useQuery({
    queryKey: tokenKeys.waiting(clinicId),
    queryFn: async () => {
      const { data } = await api.get(`/tokens/clinic/${clinicId}/waiting`);
      return data as Token[];
    },
    enabled: !!clinicId,
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });
}

export function useGetTokenDisplayData(clinicId?: string) {
  return useQuery({
    queryKey: tokenKeys.display(clinicId),
    queryFn: async () => {
      const params = clinicId ? { clinicId } : {};
      const { data } = await api.get('/tokens/display', { params });
      return data as TokenDisplayData | TokenDisplayData[];
    },
    refetchInterval: 10000, // Auto-refresh every 10 seconds for TV display
  });
}

export function useCallToken() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (tokenId: string) => {
      const { data } = await api.patch(`/tokens/${tokenId}/call`);
      return data as Token;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: tokenKeys.all });
      toast({
        title: 'Token Called',
        description: `Token #${data.tokenNumber} has been called`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to call token',
        variant: 'destructive',
      });
    },
  });
}

export function useCompleteToken() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (tokenId: string) => {
      const { data } = await api.patch(`/tokens/${tokenId}/complete`);
      return data as Token;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tokenKeys.all });
      toast({
        title: 'Success',
        description: 'Token marked as completed',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to complete token',
        variant: 'destructive',
      });
    },
  });
}

export function useCancelToken() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (tokenId: string) => {
      const { data } = await api.patch(`/tokens/${tokenId}/cancel`);
      return data as Token;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tokenKeys.all });
      toast({
        title: 'Token Cancelled',
        description: 'Token has been cancelled',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to cancel token',
        variant: 'destructive',
      });
    },
  });
}
