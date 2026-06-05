"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth.store";
import api, { getErrorMessage } from "@/lib/api";

export interface LabOrder {
  id: string;
  hospitalId: string;
  patientId: string;
  visitId?: string;
  labTestId: string;
  orderNumber: string;
  orderedById: string;
  priority: "ROUTINE" | "URGENT" | "STAT";
  clinicalNotes?: string;
  status: "PENDING" | "SAMPLE_COLLECTED" | "IN_PROGRESS" | "COMPLETED" | "APPROVED" | "CANCELLED";
  sampleCollectedAt?: string;
  sampleCollectedById?: string;
  sampleType?: string;
  sampleNotes?: string;
  resultsEnteredAt?: string;
  resultsEnteredById?: string;
  results?: any;
  resultNotes?: string;
  resultFiles?: any[];
  resultsApprovedAt?: string;
  resultsApprovedById?: string;
  approvalNotes?: string;
  paymentStatus: string;
  amountPaid: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  hospital?: { id: string; name: string };
  patient?: {
    id: string;
    nrNumber: string;
    fullName: string;
    mobile?: string;
    gender?: string;
    dob?: string;
  };
  visit?: { id: string; tokenNumber: number; visitDate: string };
  labTest?: {
    id: string;
    testCode: string;
    testName: string;
    testCategory: string;
    price: number;
    turnaroundTime?: string;
    requirements?: string;
    normalRange?: any;
  };
  orderedBy?: { id: string; fullName: string; role: string };
  sampleCollectedBy?: { fullName: string };
  resultsEnteredBy?: { fullName: string };
  resultsApprovedBy?: { fullName: string; role: string };
}

export interface CreateLabOrderInput {
  hospitalId: string;
  patientId: string;
  visitId?: string;
  labTestId: string;
  orderedById: string;
  priority?: "ROUTINE" | "URGENT" | "STAT";
  clinicalNotes?: string;
}

export interface CollectSampleInput {
  sampleCollectedById: string;
  sampleType?: string;
  sampleNotes?: string;
}

export interface EnterResultInput {
  resultsEnteredById: string;
  results: any;
  resultNotes?: string;
  resultFiles?: any[];
}

export interface ApproveResultInput {
  resultsApprovedById: string;
  approvalNotes?: string;
}

export function useLabOrders(
  hospitalId: string,
  filters?: {
    patientId?: string;
    visitId?: string;
    status?: string;
    priority?: string;
    startDate?: string;
    endDate?: string;
  }
) {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ["labOrders", hospitalId, filters],
    queryFn: async () => {
      const params: Record<string, string> = { hospitalId };
      if (filters?.patientId) params.patientId = filters.patientId;
      if (filters?.visitId) params.visitId = filters.visitId;
      if (filters?.status) params.status = filters.status;
      if (filters?.priority) params.priority = filters.priority;
      if (filters?.startDate) params.startDate = filters.startDate;
      if (filters?.endDate) params.endDate = filters.endDate;

      const { data } = await api.get(`/lab-orders`, { params });
      // Handle both wrapped and unwrapped responses
      return (data?.data || data) as LabOrder[];
    },
    enabled: !!hospitalId && !!token,
  });
}

export function useLabOrder(id: string) {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ["labOrders", id],
    queryFn: async () => {
      const { data } = await api.get(`/lab-orders/${id}`);
      return (data?.data || data) as LabOrder;
    },
    enabled: !!id && !!token,
  });
}

export function usePendingLabOrders(hospitalId: string) {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ["labOrders", "pending", hospitalId],
    queryFn: async () => {
      const { data } = await api.get(`/lab-orders/pending`, { params: { hospitalId } });
      // Handle both wrapped and unwrapped responses
      return (data?.data || data) as LabOrder[];
    },
    enabled: !!hospitalId && !!token,
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });
}

export function usePatientLabOrders(patientId: string) {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ["labOrders", "patient", patientId],
    queryFn: async () => {
      const { data } = await api.get(`/lab-orders/patient/${patientId}`);
      return (data?.data || data) as LabOrder[];
    },
    enabled: !!patientId && !!token,
  });
}

export function useLabOrderStats(hospitalId: string) {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ["labOrderStats", hospitalId],
    queryFn: async () => {
      const { data } = await api.get(`/lab-orders/statistics`, { params: { hospitalId } });
      return data?.data || data;
    },
    enabled: !!hospitalId && !!token,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useCreateLabOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateLabOrderInput) => {
      try {
        const res = await api.post(`/lab-orders`, data);
        return res.data;
      } catch (error) {
        throw new Error(getErrorMessage(error) || "Failed to create lab order");
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["labOrders", variables.hospitalId] });
      queryClient.invalidateQueries({ queryKey: ["labOrderStats", variables.hospitalId] });
      toast({ title: "Lab order created successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create lab order",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useCollectSample() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ orderId, data }: { orderId: string; data: CollectSampleInput }) => {
      try {
        const res = await api.post(`/lab-orders/${orderId}/collect-sample`, data);
        return res.data;
      } catch (error) {
        throw new Error(getErrorMessage(error) || "Failed to collect sample");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labOrders"] });
      queryClient.invalidateQueries({ queryKey: ["labOrders", "pending"] });
      toast({ title: "Sample collected successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to collect sample",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useEnterResult() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ orderId, data }: { orderId: string; data: EnterResultInput }) => {
      try {
        const res = await api.post(`/lab-orders/${orderId}/enter-result`, data);
        return res.data;
      } catch (error) {
        throw new Error(getErrorMessage(error) || "Failed to enter result");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labOrders"] });
      toast({ title: "Result entered successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to enter result",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useApproveResult() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ orderId, data }: { orderId: string; data: ApproveResultInput }) => {
      try {
        const res = await api.post(`/lab-orders/${orderId}/approve-result`, data);
        return res.data;
      } catch (error) {
        throw new Error(getErrorMessage(error) || "Failed to approve result");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labOrders"] });
      toast({ title: "Result approved successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to approve result",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export async function downloadLabResultPdf(orderId: string, _token?: string) {
  const response = await api.get(`/lab-orders/${orderId}/pdf`, {
    responseType: "blob",
  });

  const blob = response.data as Blob;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lab-result-${orderId}.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
