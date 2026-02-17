"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth.store";
import { API_BASE_URL } from "@/lib/constants";

const API_URL = API_BASE_URL;

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
      const params = new URLSearchParams({ hospitalId });
      if (filters?.departmentId) params.append("departmentId", filters.departmentId);
      if (filters?.subDepartmentId) params.append("subDepartmentId", filters.subDepartmentId);
      if (filters?.testCategory) params.append("testCategory", filters.testCategory);
      if (filters?.status) params.append("status", filters.status);

      const response = await fetch(`${API_URL}/lab-tests?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch lab tests");
      return response.json() as Promise<LabTest[]>;
    },
    enabled: !!hospitalId && !!token,
  });
}

export function useLabTest(id: string) {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ["labTests", id],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/lab-tests/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch lab test");
      return response.json() as Promise<LabTest>;
    },
    enabled: !!id && !!token,
  });
}

export function useLabTestsByDepartment(departmentId: string) {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ["labTests", "department", departmentId],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/lab-tests/department/${departmentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch department lab tests");
      return response.json() as Promise<LabTest[]>;
    },
    enabled: !!departmentId && !!token,
  });
}

export function useLabTestCategories(hospitalId: string) {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ["labTestCategories", hospitalId],
    queryFn: async () => {
      const response = await fetch(
        `${API_URL}/lab-tests/categories?hospitalId=${hospitalId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json() as Promise<{ category: string; count: number }[]>;
    },
    enabled: !!hospitalId && !!token,
  });
}

export function useCreateLabTest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { token } = useAuthStore();

  return useMutation({
    mutationFn: async (data: CreateLabTestInput) => {
      const response = await fetch(`${API_URL}/lab-tests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create lab test");
      }
      return response.json();
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
  const { token } = useAuthStore();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateLabTestInput> }) => {
      const response = await fetch(`${API_URL}/lab-tests/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update lab test");
      return response.json();
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
  const { token } = useAuthStore();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${API_URL}/lab-tests/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete lab test");
      }
      return response.json();
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
  const { token } = useAuthStore();

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "ACTIVE" | "INACTIVE" | "DISCONTINUED";
    }) => {
      const response = await fetch(`${API_URL}/lab-tests/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed to update status");
      return response.json();
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
