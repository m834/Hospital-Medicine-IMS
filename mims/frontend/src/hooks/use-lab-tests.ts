"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth.store";
import api, { getErrorMessage } from "@/lib/api";

export interface LabTest {
  id: string;
  hospitalId: string;
  departmentId?: string;
  subDepartmentId?: string;
  testCode: string;
  testName: string;
  testCategory: string;
  description?: string;
  price: number;
  turnaroundTime?: string;
  requirements?: string;
  normalRange?: any;
  status: "ACTIVE" | "INACTIVE" | "DISCONTINUED";
  version: number;
  createdAt: string;
  updatedAt: string;
  hospital?: { id: string; name: string };
  department?: { id: string; name: string };
  subDepartment?: { id: string; name: string };
  _count?: { labOrders: number };
}

export interface CreateLabTestInput {
  hospitalId: string;
  departmentId?: string;
  subDepartmentId?: string;
  testCode: string;
  testName: string;
  testCategory: string;
  description?: string;
  price: number;
  turnaroundTime?: string;
  requirements?: string;
  normalRange?: any;
  status?: "ACTIVE" | "INACTIVE" | "DISCONTINUED";
}

export function useLabTests(
  hospitalId: string,
  filters?: {
    departmentId?: string;
    subDepartmentId?: string;
    testCategory?: string;
    status?: string;
  }
) {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ["labTests", hospitalId, filters],
    queryFn: async () => {
      const params: Record<string, string> = { hospitalId };
      if (filters?.departmentId) params.departmentId = filters.departmentId;
      if (filters?.subDepartmentId) params.subDepartmentId = filters.subDepartmentId;
      if (filters?.testCategory) params.testCategory = filters.testCategory;
      if (filters?.status) params.status = filters.status;

      const { data } = await api.get(`/lab-tests`, { params });
      return (data?.data || data) as LabTest[];
    },
    enabled: !!hospitalId && !!token,
  });
}

export function useLabTest(id: string) {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ["labTests", id],
    queryFn: async () => {
      const { data } = await api.get(`/lab-tests/${id}`);
      return (data?.data || data) as LabTest;
    },
    enabled: !!id && !!token,
  });
}

export function useLabTestsByDepartment(departmentId: string) {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ["labTests", "department", departmentId],
    queryFn: async () => {
      const { data } = await api.get(`/lab-tests/department/${departmentId}`);
      return (data?.data || data) as LabTest[];
    },
    enabled: !!departmentId && !!token,
  });
}

export function useLabTestCategories(hospitalId: string) {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ["labTestCategories", hospitalId],
    queryFn: async () => {
      const { data } = await api.get(`/lab-tests/categories`, { params: { hospitalId } });
      return (data?.data || data) as { category: string; count: number }[];
    },
    enabled: !!hospitalId && !!token,
  });
}

export function useCreateLabTest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateLabTestInput) => {
      try {
        const res = await api.post(`/lab-tests`, data);
        return res.data;
      } catch (error) {
        throw new Error(getErrorMessage(error) || "Failed to create lab test");
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["labTests", variables.hospitalId] });
      queryClient.invalidateQueries({ queryKey: ["labTestCategories"] });
      toast({ title: "Lab test created successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create lab test",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateLabTest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateLabTestInput> }) => {
      try {
        const res = await api.patch(`/lab-tests/${id}`, data);
        return res.data;
      } catch (error) {
        throw new Error(getErrorMessage(error) || "Failed to update lab test");
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["labTests"] });
      queryClient.invalidateQueries({ queryKey: ["labTests", data.id] });
      toast({ title: "Lab test updated successfully" });
    },
    onError: () => {
      toast({
        title: "Failed to update lab test",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteLabTest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        const res = await api.delete(`/lab-tests/${id}`);
        return res.data;
      } catch (error) {
        throw new Error(getErrorMessage(error) || "Failed to delete lab test");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labTests"] });
      toast({ title: "Lab test deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete lab test",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateLabTestStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "ACTIVE" | "INACTIVE" | "DISCONTINUED";
    }) => {
      try {
        const res = await api.patch(`/lab-tests/${id}/status`, { status });
        return res.data;
      } catch (error) {
        throw new Error(getErrorMessage(error) || "Failed to update status");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labTests"] });
      toast({ title: "Status updated successfully" });
    },
    onError: () => {
      toast({
        title: "Failed to update status",
        variant: "destructive",
      });
    },
  });
}
