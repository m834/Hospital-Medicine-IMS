import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { getAccessToken } from '@/lib/auth';
import api, { getErrorMessage } from '@/lib/api';

// Types
export interface Admission {
  id: string;
  admissionNumber: string;
  hospitalId: string;
  patientId: string;
  visitId?: string;
  departmentId?: string;
  roomId: string;
  bedId: string;
  admissionType: 'EMERGENCY' | 'ELECTIVE' | 'TRANSFER' | 'OBSERVATION';
  admissionDate: string;
  dischargeDate?: string;
  expectedDuration?: number;
  status: 'ADMITTED' | 'DISCHARGED' | 'TRANSFERRED' | 'ABSCONDED' | 'DIED';
  admittedById: string;
  primaryDoctorId: string;
  referringDoctorId?: string;
  provisionalDiagnosis?: string;
  diagnosisOnDischarge?: string;
  dischargeSummary?: string;
  notes?: string;
  totalCharges?: string;
  createdAt: string;
  updatedAt: string;
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    mobile?: string;
    email?: string;
    address?: string;
  };
  visit?: {
    id: string;
    visitNumber: string;
    visitType: string;
  };
  department?: {
    id: string;
    name: string;
    code: string;
  };
  room?: {
    id: string;
    roomNumber: string;
    roomType: string;
    floor?: number;
    building?: string;
    dailyRate: string;
  };
  bed?: {
    id: string;
    bedNumber: string;
    bedType: string;
    dailyRate: string;
  };
  admittedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  primaryDoctor?: {
    id: string;
    firstName: string;
    lastName: string;
    specialization?: string;
  };
  referringDoctor?: {
    id: string;
    firstName: string;
    lastName: string;
    specialization?: string;
  };
  dailyCharges?: Array<{
    id: string;
    date: string;
    roomCharge: string;
    bedCharge: string;
    nursingCharge: string;
    otherCharges: string;
    totalCharge: string;
    notes?: string;
  }>;
}

export interface AdmissionFilters {
  hospitalId?: string;
  patientId?: string;
  departmentId?: string;
  roomId?: string;
  bedId?: string;
  admissionType?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface CreateAdmissionData {
  hospitalId: string;
  patientId: string;
  visitId?: string;
  departmentId?: string;
  roomId: string;
  bedId: string;
  admissionType: string;
  admissionDate: string;
  expectedDuration?: number;
  admittedById: string;
  primaryDoctorId: string;
  referringDoctorId?: string;
  provisionalDiagnosis?: string;
  notes?: string;
}

export interface DischargeAdmissionData {
  dischargingUserId: string;
  dischargedAt: string;
  diagnosisOnDischarge: string;
  dischargeSummary: string;
  estimatedTotal?: number;
}

// API Functions
async function fetchAdmissions(filters: AdmissionFilters) {
  const params: Record<string, string> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params[key] = value.toString();
    }
  });

  const { data } = await api.get(`/admissions`, { params });
  return data;
}

async function fetchAdmission(id: string) {
  const { data } = await api.get(`/admissions/${id}`);
  return data;
}

async function fetchActiveAdmissions(hospitalId: string) {
  const { data } = await api.get(`/admissions/active/${hospitalId}`);
  return data;
}

async function createAdmission(data: CreateAdmissionData) {
  try {
    const res = await api.post(`/admissions`, data);
    return res.data;
  } catch (error) {
    throw new Error(getErrorMessage(error) || 'Failed to create admission');
  }
}

async function updateAdmission(id: string, data: Partial<CreateAdmissionData>) {
  try {
    const res = await api.patch(`/admissions/${id}`, data);
    return res.data;
  } catch (error) {
    throw new Error(getErrorMessage(error) || 'Failed to update admission');
  }
}

async function dischargeAdmission(id: string, data: DischargeAdmissionData) {
  try {
    const res = await api.post(`/admissions/${id}/discharge`, data);
    return res.data;
  } catch (error) {
    throw new Error(getErrorMessage(error) || 'Failed to discharge admission');
  }
}

// Hooks
export function useAdmissions(filters: AdmissionFilters = {}) {
  const token = useAuthStore((state) => state.token) || getAccessToken();

  return useQuery({
    queryKey: ['admissions', filters],
    queryFn: () => fetchAdmissions(filters),
    enabled: !!token,
  });
}

export function useAdmission(id: string) {
  const token = useAuthStore((state) => state.token) || getAccessToken();

  return useQuery({
    queryKey: ['admission', id],
    queryFn: () => fetchAdmission(id),
    enabled: !!token && !!id,
  });
}

export function useActiveAdmissions(hospitalId: string) {
  const token = useAuthStore((state) => state.token) || getAccessToken();

  return useQuery({
    queryKey: ['admissions', 'active', hospitalId],
    queryFn: () => fetchActiveAdmissions(hospitalId),
    enabled: !!token && !!hospitalId,
  });
}

export function useCreateAdmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAdmissionData) => createAdmission(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admissions'] });
      queryClient.invalidateQueries({ queryKey: ['beds'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useUpdateAdmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateAdmissionData> }) =>
      updateAdmission(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admissions'] });
      queryClient.invalidateQueries({ queryKey: ['admission', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['beds'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useDischargeAdmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DischargeAdmissionData }) =>
      dischargeAdmission(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admissions'] });
      queryClient.invalidateQueries({ queryKey: ['admission', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['beds'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}
