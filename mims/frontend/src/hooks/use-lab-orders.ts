"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth.store";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

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
      const params = new URLSearchParams({ hospitalId });
      if (filters?.patientId) params.append("patientId", filters.patientId);
      if (filters?.visitId) params.append("visitId", filters.visitId);
      if (filters?.status) params.append("status", filters.status);
      if (filters?.priority) params.append("priority", filters.priority);
      if (filters?.startDate) params.append("startDate", filters.startDate);
      if (filters?.endDate) params.append("endDate", filters.endDate);

      const response = await fetch(`${API_URL}/lab-orders?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        console.error("Failed to fetch lab orders:", response.status, response.statusText);
        throw new Error(`Failed to fetch lab orders (${response.status})`);
      }
      const data = await response.json();
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
      const response = await fetch(`${API_URL}/lab-orders/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        console.error("Failed to fetch lab order:", response.status);
        throw new Error("Failed to fetch lab order");
      }
      const data = await response.json();
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
      const response = await fetch(`${API_URL}/lab-orders/pending?hospitalId=${hospitalId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        console.error("Failed to fetch pending orders:", response.status, response.statusText);
        throw new Error(`Failed to fetch pending orders (${response.status})`);
      }
      const data = await response.json();
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
      const response = await fetch(`${API_URL}/lab-orders/patient/${patientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        console.error("Failed to fetch patient lab orders:", response.status);
        throw new Error("Failed to fetch patient lab orders");
      }
      const data = await response.json();
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
      const response = await fetch(`${API_URL}/lab-orders/statistics?hospitalId=${hospitalId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        console.error("Failed to fetch lab order stats:", response.status);
        throw new Error("Failed to fetch stats");
      }
      const data = await response.json();
      return data?.data || data;
    },
    enabled: !!hospitalId && !!token,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useCreateLabOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { token } = useAuthStore();

  return useMutation({
    mutationFn: async (data: CreateLabOrderInput) => {
      const response = await fetch(`${API_URL}/lab-orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create lab order");
      }
      return response.json();
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
  const { token } = useAuthStore();

  return useMutation({
    mutationFn: async ({ orderId, data }: { orderId: string; data: CollectSampleInput }) => {
      const response = await fetch(`${API_URL}/lab-orders/${orderId}/collect-sample`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to collect sample");
      }
      return response.json();
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
  const { token } = useAuthStore();

  return useMutation({
    mutationFn: async ({ orderId, data }: { orderId: string; data: EnterResultInput }) => {
      const response = await fetch(`${API_URL}/lab-orders/${orderId}/enter-result`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to enter result");
      }
      return response.json();
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
  const { token } = useAuthStore();

  return useMutation({
    mutationFn: async ({ orderId, data }: { orderId: string; data: ApproveResultInput }) => {
      const response = await fetch(`${API_URL}/lab-orders/${orderId}/approve-result`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to approve result");
      }
      return response.json();
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

export async function downloadLabResultPdf(orderId: string, token: string) {
  const response = await fetch(`${API_URL}/lab-orders/${orderId}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error("Failed to download PDF");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lab-result-${orderId}.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
