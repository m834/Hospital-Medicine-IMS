"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth.store";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

export type OperationStatus = "SCHEDULED" | "PRE_OP" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "POSTPONED";
export type OperationPatientType = "OPD" | "IN_HOUSE";
export type OperationTheatreStatus = "ACTIVE" | "MAINTENANCE" | "INACTIVE";

export interface Operation {
  id: string;
  hospitalId: string;
  patientId: string;
  patientType: OperationPatientType;
  visitId?: string | null;
  admissionId?: string | null;
  departmentId: string;
  operationType: string;
  surgeonId: string;
  theatreId: string;
  scheduledAt: string;
  estimatedDurationMinutes: number;
  emergencyFlag: boolean;
  operationPrice?: number | string | null;
  status: OperationStatus;
  notes?: string | null;
  preOpNotes?: string | null;
  postOpNotes?: string | null;
  recoveryNotes?: string | null;
  followUpAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  estimatedCost?: number | string | null;
  totalCharges?: number | string | null;
  price?: number | string | null;
  createdAt: string;
  updatedAt: string;
  patient?: { id: string; fullName: string; nrNumber: string; mobile?: string; gender?: string };
  surgeon?: { id: string; fullName: string };
  theatre?: { id: string; name: string; code: string; status: OperationTheatreStatus };
  department?: { id: string; name: string; code: string };
}

export interface OperationListResponse {
  data: Operation[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CreateOperationInput {
  hospitalId: string;
  patientId: string;
  patientType: OperationPatientType;
  visitId?: string;
  admissionId?: string;
  departmentId: string;
  operationType: string;
  surgeonId: string;
  theatreId: string;
  scheduledAt: string;
  estimatedDurationMinutes?: number;
  emergencyFlag?: boolean;
  operationPrice?: number;
  notes?: string;
  preOpNotes?: string;
}

export interface UpdateOperationInput {
  operationType?: string;
  surgeonId?: string;
  theatreId?: string;
  scheduledAt?: string;
  estimatedDurationMinutes?: number;
  emergencyFlag?: boolean;
  notes?: string;
  preOpNotes?: string;
  postOpNotes?: string;
  recoveryNotes?: string;
  followUpAt?: string;
}

export interface UpdateOperationStatusInput {
  status: OperationStatus;
  postOpNotes?: string;
  recoveryNotes?: string;
  followUpAt?: string;
}

export interface RescheduleOperationInput {
  scheduledAt: string;
  theatreId?: string;
  estimatedDurationMinutes?: number;
}

export interface OperationTheatre {
  id: string;
  hospitalId: string;
  departmentId?: string | null;
  name: string;
  code: string;
  location?: string | null;
  status: OperationTheatreStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  department?: { id: string; name: string; code: string } | null;
}

export interface TheatreListResponse {
  data: OperationTheatre[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CreateOperationTheatreInput {
  hospitalId: string;
  departmentId?: string;
  name: string;
  code: string;
  location?: string;
  status?: OperationTheatreStatus;
  notes?: string;
}

export interface UpdateOperationTheatreInput {
  departmentId?: string;
  name?: string;
  code?: string;
  location?: string;
  status?: OperationTheatreStatus;
  notes?: string;
}

export interface TheatreAvailabilityResponse {
  theatre: { id: string; name: string; code: string; status: OperationTheatreStatus };
  date: string;
  operations: Operation[];
}

export function useOperations(
  hospitalId: string,
  filters?: {
    patientId?: string;
    surgeonId?: string;
    departmentId?: string;
    theatreId?: string;
    status?: OperationStatus;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  },
) {
  const { token } = useAuthStore();

  return useQuery<OperationListResponse>({
    queryKey: ["operations", hospitalId, filters],
    queryFn: async () => {
      const params = new URLSearchParams({ hospitalId });
      if (filters?.patientId) params.append("patientId", filters.patientId);
      if (filters?.surgeonId) params.append("surgeonId", filters.surgeonId);
      if (filters?.departmentId) params.append("departmentId", filters.departmentId);
      if (filters?.theatreId) params.append("theatreId", filters.theatreId);
      if (filters?.status) params.append("status", filters.status);
      if (filters?.startDate) params.append("startDate", filters.startDate);
      if (filters?.endDate) params.append("endDate", filters.endDate);
      if (filters?.page) params.append("page", filters.page.toString());
      if (filters?.limit) params.append("limit", filters.limit.toString());

      const response = await fetch(`${API_URL}/operations?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch operations");
      }

      return response.json();
    },
    enabled: !!token && !!hospitalId,
  });
}

export function useOperation(id: string) {
  const { token } = useAuthStore();
  return useQuery<Operation>({
    queryKey: ["operation", id],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/operations/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch operation");
      return response.json();
    },
    enabled: !!token && !!id,
  });
}

export function useCreateOperation() {
  const { token } = useAuthStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateOperationInput) => {
      const response = await fetch(`${API_URL}/operations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create operation");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operations"] });
      toast({ title: "Operation created", description: "Operation scheduled successfully." });
    },
  });
}

export function useUpdateOperation() {
  const { token } = useAuthStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateOperationInput }) => {
      const response = await fetch(`${API_URL}/operations/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update operation");
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["operations"] });
      queryClient.invalidateQueries({ queryKey: ["operation", variables.id] });
      toast({ title: "Operation updated" });
    },
  });
}

export function useUpdateOperationStatus() {
  const { token } = useAuthStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateOperationStatusInput }) => {
      const response = await fetch(`${API_URL}/operations/${id}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update operation status");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operations"] });
      toast({ title: "Status updated" });
    },
  });
}

export function useRescheduleOperation() {
  const { token } = useAuthStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RescheduleOperationInput }) => {
      const response = await fetch(`${API_URL}/operations/${id}/reschedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to reschedule operation");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operations"] });
      toast({ title: "Operation rescheduled" });
    },
  });
}

export function useOperationTheatres(
  hospitalId: string,
  filters?: { departmentId?: string; status?: OperationTheatreStatus; page?: number; limit?: number },
) {
  const { token } = useAuthStore();

  return useQuery<TheatreListResponse>({
    queryKey: ["operationTheatres", hospitalId, filters],
    queryFn: async () => {
      const params = new URLSearchParams({ hospitalId });
      if (filters?.departmentId) params.append("departmentId", filters.departmentId);
      if (filters?.status) params.append("status", filters.status);
      if (filters?.page) params.append("page", filters.page.toString());
      if (filters?.limit) params.append("limit", filters.limit.toString());

      const response = await fetch(`${API_URL}/operations/theatres?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch theatres");
      }

      return response.json();
    },
    enabled: !!token && !!hospitalId,
  });
}

export function useCreateOperationTheatre() {
  const { token } = useAuthStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateOperationTheatreInput) => {
      const response = await fetch(`${API_URL}/operations/theatres`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create theatre");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operationTheatres"] });
      toast({ title: "Theatre created" });
    },
  });
}

export function useUpdateOperationTheatre() {
  const { token } = useAuthStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateOperationTheatreInput }) => {
      const response = await fetch(`${API_URL}/operations/theatres/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update theatre");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operationTheatres"] });
      toast({ title: "Theatre updated" });
    },
  });
}

export function useTheatreAvailability(theatreId: string, date: string) {
  const { token } = useAuthStore();

  return useQuery<TheatreAvailabilityResponse>({
    queryKey: ["operationTheatreAvailability", theatreId, date],
    queryFn: async () => {
      const params = new URLSearchParams({ theatreId, date });
      const response = await fetch(`${API_URL}/operations/theatres/availability?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch availability");
      }

      return response.json();
    },
    enabled: !!token && !!theatreId && !!date,
  });
}
