/**
 * Receipts API Hooks
 * React Query hooks for receipt management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useToast } from './use-toast';

// Types
export interface Receipt {
  id: string;
  hospitalId: string;
  receiptNumber: string;
  receiptType: 'OPD_CONSULTATION' | 'LAB_TEST' | 'RADIOLOGY' | 'PHARMACY' | 'ADMISSION' | 'ROOM_CHARGES' | 'PROCEDURE';
  patientId: string;
  visitId: string | null;
  departmentId: string;
  totalAmount: string;
  paidAmount: string;
  paymentMethod: 'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER' | 'INSURANCE';
  paymentStatus: 'UNPAID' | 'PAID' | 'PARTIALLY_PAID' | 'REFUNDED';
  generatedBy: string;
  metadata: Record<string, any> | null;
  createdAt: string;
  version: number;
  hospital?: {
    id: string;
    name: string;
    code: string;
    address?: string;
    phone?: string;
  };
  patient?: {
    id: string;
    nrNumber: string;
    firstName: string;
    lastName: string;
    gender: string;
    dateOfBirth: string;
    phone: string;
    cnic?: string;
  };
  visit?: {
    id: string;
    tokenNumber: number;
    clinic?: {
      id: string;
      name: string;
      doctor?: {
        firstName: string;
        lastName: string;
      };
    };
  };
  department?: {
    id: string;
    name: string;
    code: string;
  };
  generator?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface ReceiptFilters {
  hospitalId?: string;
  patientId?: string;
  visitId?: string;
  departmentId?: string;
  receiptType?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface CreateReceiptDto {
  hospitalId: string;
  receiptType: 'OPD_CONSULTATION' | 'LAB_TEST' | 'RADIOLOGY' | 'PHARMACY' | 'ADMISSION' | 'ROOM_CHARGES' | 'PROCEDURE';
  patientId: string;
  visitId?: string;
  departmentId: string;
  totalAmount: number;
  paidAmount: number;
  paymentMethod: 'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER' | 'INSURANCE';
  paymentStatus?: 'UNPAID' | 'PAID' | 'PARTIALLY_PAID';
  metadata?: Record<string, any>;
}

export interface ReceiptPrintData {
  receipt: Receipt;
  format: {
    receiptNumber: string;
    formattedDate: string;
    formattedAmount: string;
    hospitalHeader: {
      name: string;
      address: string;
      phone: string;
      logo?: string;
    };
    patientInfo: {
      name: string;
      nrNumber: string;
      phone: string;
    };
    serviceDetails: {
      description: string;
      amount: string;
    };
    footer: {
      termsAndConditions: string[];
      generatedBy: string;
    };
  };
}

export interface RevenueStats {
  totalRevenue: number;
  totalReceipts: number;
  byPaymentMethod: Record<string, number>;
  byReceiptType: Record<string, number>;
  byDepartment: { departmentId: string; departmentName: string; amount: number }[];
}

// Query Keys
export const receiptKeys = {
  all: ['receipts'] as const,
  lists: () => [...receiptKeys.all, 'list'] as const,
  list: (filters: ReceiptFilters) => [...receiptKeys.lists(), filters] as const,
  details: () => [...receiptKeys.all, 'detail'] as const,
  detail: (id: string) => [...receiptKeys.details(), id] as const,
  byPatient: (patientId: string) => [...receiptKeys.all, 'patient', patientId] as const,
  byVisit: (visitId: string) => [...receiptKeys.all, 'visit', visitId] as const,
  print: (id: string) => [...receiptKeys.all, 'print', id] as const,
  revenue: (filters: { hospitalId?: string; fromDate?: string; toDate?: string }) => 
    [...receiptKeys.all, 'revenue', filters] as const,
};

// Hooks
export function useGetReceipts(filters: ReceiptFilters = {}) {
  return useQuery({
    queryKey: receiptKeys.list(filters),
    queryFn: async () => {
      const { data } = await api.get('/receipts', { params: filters });
      return data as { data: Receipt[]; total: number; page: number; limit: number };
    },
  });
}

export function useGetReceipt(id: string) {
  return useQuery({
    queryKey: receiptKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get(`/receipts/${id}`);
      return data as Receipt;
    },
    enabled: !!id,
  });
}

export function useGetPatientReceipts(patientId: string) {
  return useQuery({
    queryKey: receiptKeys.byPatient(patientId),
    queryFn: async () => {
      const { data } = await api.get(`/receipts/patient/${patientId}`);
      return data as Receipt[];
    },
    enabled: !!patientId,
  });
}

export function useGetVisitReceipts(visitId: string) {
  return useQuery({
    queryKey: receiptKeys.byVisit(visitId),
    queryFn: async () => {
      const { data } = await api.get(`/receipts/visit/${visitId}`);
      return data as Receipt[];
    },
    enabled: !!visitId,
  });
}

export function useGetReceiptPrintData(id: string) {
  return useQuery({
    queryKey: receiptKeys.print(id),
    queryFn: async () => {
      const { data } = await api.get(`/receipts/${id}/print`);
      return data as ReceiptPrintData;
    },
    enabled: !!id,
  });
}

export function useGetRevenueStats(filters: { hospitalId?: string; fromDate?: string; toDate?: string } = {}) {
  return useQuery({
    queryKey: receiptKeys.revenue(filters),
    queryFn: async () => {
      const { data } = await api.get('/receipts/revenue', { params: filters });
      return data as RevenueStats;
    },
  });
}

export function useCreateReceipt() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (dto: CreateReceiptDto) => {
      const { data } = await api.post('/receipts', dto);
      return data as Receipt;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: receiptKeys.all });
      toast({
        title: 'Receipt Generated',
        description: `Receipt ${data.receiptNumber} has been created`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create receipt',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdatePaymentStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      id, 
      paidAmount, 
      paymentMethod 
    }: { 
      id: string; 
      paidAmount: number; 
      paymentMethod: string;
    }) => {
      const { data } = await api.post(`/receipts/${id}/payment`, { paidAmount, paymentMethod });
      return data as Receipt;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: receiptKeys.all });
      queryClient.invalidateQueries({ queryKey: receiptKeys.detail(variables.id) });
      toast({
        title: 'Payment Updated',
        description: 'Payment status has been updated',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update payment',
        variant: 'destructive',
      });
    },
  });
}

export function useGenerateReceiptPDF() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.get(`/receipts/${id}/pdf`, { responseType: 'blob' });
      return data as Blob;
    },
    onSuccess: (blob, id) => {
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `RECEIPT-${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: 'PDF Downloaded',
        description: 'Receipt PDF has been downloaded',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to generate PDF',
        variant: 'destructive',
      });
    },
  });
}

export function usePrintReceipt() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.get(`/receipts/${id}/print`);
      return data as ReceiptPrintData;
    },
    onSuccess: () => {
      // Trigger print dialog
      window.print();
      toast({
        title: 'Print Initiated',
        description: 'Print dialog opened',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to load print data',
        variant: 'destructive',
      });
    },
  });
}
