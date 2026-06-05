"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth.store";
import api, { getErrorMessage } from "@/lib/api";

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
      const params: Record<string, string> = { hospitalId };
      if (filters?.patientId) params.patientId = filters.patientId;
      if (filters?.surgeonId) params.surgeonId = filters.surgeonId;
      if (filters?.departmentId) params.departmentId = filters.departmentId;
      if (filters?.theatreId) params.theatreId = filters.theatreId;
      if (filters?.status) params.status = filters.status;
      if (filters?.startDate) params.startDate = filters.startDate;
      if (filters?.endDate) params.endDate = filters.endDate;
      if (filters?.page) params.page = filters.page.toString();
      if (filters?.limit) params.limit = filters.limit.toString();

      const { data } = await api.get(`/operations`, { params });
      return data;
    },
    enabled: !!token && !!hospitalId,
  });
}

export function useOperation(id: string) {
  const { token } = useAuthStore();
  return useQuery<Operation>({
    queryKey: ["operation", id],
    queryFn: async () => {
      const { data } = await api.get(`/operations/${id}`);
      return data;
    },
    enabled: !!token && !!id,
  });
}

export function useCreateOperation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateOperationInput) => {
      try {
        const res = await api.post(`/operations`, data);
        return res.data;
      } catch (error) {
        throw new Error(getErrorMessage(error) || "Failed to create operation");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operations"] });
      toast({ title: "Operation created", description: "Operation scheduled successfully." });
    },
  });
}

export function useUpdateOperation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateOperationInput }) => {
      try {
        const res = await api.patch(`/operations/${id}`, data);
        return res.data;
      } catch (error) {
        throw new Error(getErrorMessage(error) || "Failed to update operation");
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["operations"] });
      queryClient.invalidateQueries({ queryKey: ["operation", variables.id] });
      toast({ title: "Operation updated" });
    },
  });
}

export function useUpdateOperationStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateOperationStatusInput }) => {
      try {
        const res = await api.post(`/operations/${id}/status`, data);
        return res.data;
      } catch (error) {
        throw new Error(getErrorMessage(error) || "Failed to update operation status");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operations"] });
      toast({ title: "Status updated" });
    },
  });
}

export function useRescheduleOperation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RescheduleOperationInput }) => {
      try {
        const res = await api.post(`/operations/${id}/reschedule`, data);
        return res.data;
      } catch (error) {
        throw new Error(getErrorMessage(error) || "Failed to reschedule operation");
      }
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
      const params: Record<string, string> = { hospitalId };
      if (filters?.departmentId) params.departmentId = filters.departmentId;
      if (filters?.status) params.status = filters.status;
      if (filters?.page) params.page = filters.page.toString();
      if (filters?.limit) params.limit = filters.limit.toString();

      const { data } = await api.get(`/operations/theatres`, { params });
      return data;
    },
    enabled: !!token && !!hospitalId,
  });
}

export function useCreateOperationTheatre() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateOperationTheatreInput) => {
      try {
        const res = await api.post(`/operations/theatres`, data);
        return res.data;
      } catch (error) {
        throw new Error(getErrorMessage(error) || "Failed to create theatre");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operationTheatres"] });
      toast({ title: "Theatre created" });
    },
  });
}

export function useUpdateOperationTheatre() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateOperationTheatreInput }) => {
      try {
        const res = await api.patch(`/operations/theatres/${id}`, data);
        return res.data;
      } catch (error) {
        throw new Error(getErrorMessage(error) || "Failed to update theatre");
      }
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
      const { data } = await api.get(`/operations/theatres/availability`, {
        params: { theatreId, date },
      });
      return data;
    },
    enabled: !!token && !!theatreId && !!date,
  });
}
