/**
 * Visits API Hooks
 * React Query hooks for visit/OPD management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useToast } from './use-toast';

// Types
export interface VitalSigns {
  bloodPressureSystolic?: string;
  bloodPressureDiastolic?: string;
  pulse?: string;
  temperature?: string;
  spo2?: string;
  weight?: string;
  height?: string;
  respiratoryRate?: string;
}

export interface Visit {
  id: string;
  hospitalId: string;
  patientId: string;
  clinicId: string;
  tokenId: string | null;
  tokenNumber: number;
  visitType: 'NEW' | 'FOLLOW_UP' | 'EMERGENCY' | 'REFERRAL';
  chiefComplaint: string | null;
  vitalSigns: VitalSigns | null;
  diagnosis: string | null;
  treatment: string | null;
  notes: string | null;
  status: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  consultationFee: string;
  paymentStatus: 'UNPAID' | 'PAID' | 'PARTIALLY_PAID' | 'REFUNDED';
  registeredBy: string;
  consultedBy: string | null;
  registeredAt: string;
  consultedAt: string | null;
  completedAt: string | null;
  version: number;
  updatedAt: string;
  hospital?: {
    id: string;
    name: string;
    code: string;
  };
  patient?: {
    id: string;
    nrNumber: string;
    firstName: string;
    lastName: string;
    gender: string;
    dateOfBirth: string;
    phone: string;
  };
  clinic?: {
    id: string;
    name: string;
    opdFee: string;
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
  registrar?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  consultant?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  receipts?: Receipt[];
  referrals?: Referral[];
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  receiptType: string;
  totalAmount: string;
  paidAmount: string;
  paymentStatus: string;
}

export interface Referral {
  id: string;
  referralType: string;
  reason: string;
  status: string;
  toDepartment?: {
    id: string;
    name: string;
  };
}

export interface VisitFilters {
  hospitalId?: string;
  clinicId?: string;
  patientId?: string;
  status?: string;
  visitType?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface CreateVisitDto {
  hospitalId: string;
  clinicId: string;
  patientId: string;
  registrarId: string;
  visitType?: 'NEW' | 'FOLLOW_UP' | 'EMERGENCY' | 'REFERRAL';
  chiefComplaint?: string;
  vitalSigns?: VitalSigns;
}

export interface UpdateVisitDto {
  chiefComplaint?: string;
  vitalSigns?: VitalSigns;
  diagnosis?: string;
  treatment?: string;
  notes?: string;
  status?: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
}

// Query Keys
export const visitKeys = {
  all: ['visits'] as const,
  lists: () => [...visitKeys.all, 'list'] as const,
  list: (filters: VisitFilters) => [...visitKeys.lists(), filters] as const,
  details: () => [...visitKeys.all, 'detail'] as const,
  detail: (id: string) => [...visitKeys.details(), id] as const,
  byPatient: (patientId: string) => [...visitKeys.all, 'patient', patientId] as const,
  byClinic: (clinicId: string) => [...visitKeys.all, 'clinic', clinicId] as const,
  today: (hospitalId?: string) => [...visitKeys.all, 'today', hospitalId] as const,
  queue: (clinicId: string) => [...visitKeys.all, 'queue', clinicId] as const,
};

// Hooks
export function useGetVisits(filters: VisitFilters = {}) {
  return useQuery({
    queryKey: visitKeys.list(filters),
    queryFn: async () => {
      const { data } = await api.get('/visits', { params: filters });
      return data as { data: Visit[]; total: number; page: number; limit: number };
    },
  });
}

export function useGetVisit(id: string) {
  return useQuery({
    queryKey: visitKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get(`/visits/${id}`);
      return data as Visit;
    },
    enabled: !!id,
  });
}

export function useGetPatientVisits(patientId: string) {
  return useQuery({
    queryKey: visitKeys.byPatient(patientId),
    queryFn: async () => {
      const { data } = await api.get(`/visits/patient/${patientId}`);
      return data as Visit[];
    },
    enabled: !!patientId,
  });
}

export function useGetClinicVisits(clinicId: string) {
  return useQuery({
    queryKey: visitKeys.byClinic(clinicId),
    queryFn: async () => {
      const { data } = await api.get(`/visits/clinic/${clinicId}`);
      return data as Visit[];
    },
    enabled: !!clinicId,
  });
}

export function useGetTodayVisits(hospitalId?: string) {
  return useQuery({
    queryKey: visitKeys.today(hospitalId),
    queryFn: async () => {
      const params = hospitalId ? { hospitalId } : {};
      const { data } = await api.get('/visits/today', { params });
      return data as Visit[];
    },
  });
}

export function useGetClinicQueue(clinicId: string) {
  return useQuery({
    queryKey: visitKeys.queue(clinicId),
    queryFn: async () => {
      const { data } = await api.get(`/visits/clinic/${clinicId}/queue`);
      return data as Visit[];
    },
    enabled: !!clinicId,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });
}

export function useCreateVisit() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (dto: CreateVisitDto) => {
      const { data } = await api.post('/visits', dto);
      return data as Visit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: visitKeys.all });
      toast({
        title: 'Success',
        description: 'Visit registered successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to register visit',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateVisit() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateVisitDto }) => {
      const { data } = await api.patch(`/visits/${id}`, dto);
      return data as Visit;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: visitKeys.all });
      queryClient.invalidateQueries({ queryKey: visitKeys.detail(variables.id) });
      toast({
        title: 'Success',
        description: 'Visit updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update visit',
        variant: 'destructive',
      });
    },
  });
}

export function useCompleteVisit() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/visits/${id}/complete`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: visitKeys.all });
      toast({
        title: 'Success',
        description: 'Consultation completed successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to complete visit',
        variant: 'destructive',
      });
    },
  });
}

export function useCancelVisit() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/visits/${id}/cancel`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: visitKeys.all });
      toast({
        title: 'Success',
        description: 'Visit cancelled successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to cancel visit',
        variant: 'destructive',
      });
    },
  });
}

export function useCallNextPatient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (clinicId: string) => {
      const { data } = await api.post(`/visits/clinic/${clinicId}/call-next`);
      return data as Visit;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: visitKeys.all });
      toast({
        title: 'Next Patient Called',
        description: `Token #${data.tokenNumber} - ${data.patient?.firstName} ${data.patient?.lastName}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'No Waiting Patients',
        description: error.response?.data?.message || 'No patients in queue',
        variant: 'destructive',
      });
    },
  });
}

export function useGenerateReceipt() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (visitId: string) => {
      const { data } = await api.post(`/visits/${visitId}/receipt`);
      return data as Receipt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: visitKeys.all });
      toast({
        title: 'Success',
        description: 'Receipt generated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to generate receipt',
        variant: 'destructive',
      });
    },
  });
}
