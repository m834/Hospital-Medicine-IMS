import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { getAccessToken } from '@/lib/auth';

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
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

async function fetchAdmissions(filters: AdmissionFilters, token: string) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, value.toString());
    }
  });

  const response = await fetch(`${API_URL}/admissions?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch admissions');
  }

  return response.json();
}

async function fetchAdmission(id: string, token: string) {
  const response = await fetch(`${API_URL}/admissions/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch admission');
  }

  return response.json();
}

async function fetchActiveAdmissions(hospitalId: string, token: string) {
  const response = await fetch(`${API_URL}/admissions/active/${hospitalId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch active admissions');
  }

  return response.json();
}

async function createAdmission(data: CreateAdmissionData, token: string) {
  const response = await fetch(`${API_URL}/admissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create admission');
  }

  return response.json();
}

async function updateAdmission(id: string, data: Partial<CreateAdmissionData>, token: string) {
  const response = await fetch(`${API_URL}/admissions/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update admission');
  }

  return response.json();
}

async function dischargeAdmission(id: string, data: DischargeAdmissionData, token: string) {
  const response = await fetch(`${API_URL}/admissions/${id}/discharge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to discharge admission');
  }

  return response.json();
}

// Hooks
export function useAdmissions(filters: AdmissionFilters = {}) {
  const token = useAuthStore((state) => state.token) || getAccessToken();

  return useQuery({
    queryKey: ['admissions', filters],
    queryFn: () => fetchAdmissions(filters, token!),
    enabled: !!token,
  });
}

export function useAdmission(id: string) {
  const token = useAuthStore((state) => state.token) || getAccessToken();

  return useQuery({
    queryKey: ['admission', id],
    queryFn: () => fetchAdmission(id, token!),
    enabled: !!token && !!id,
  });
}

export function useActiveAdmissions(hospitalId: string) {
  const token = useAuthStore((state) => state.token) || getAccessToken();

  return useQuery({
    queryKey: ['admissions', 'active', hospitalId],
    queryFn: () => fetchActiveAdmissions(hospitalId, token!),
    enabled: !!token && !!hospitalId,
  });
}

export function useCreateAdmission() {
  const token = useAuthStore((state) => state.token) || getAccessToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAdmissionData) => createAdmission(data, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admissions'] });
      queryClient.invalidateQueries({ queryKey: ['beds'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useUpdateAdmission() {
  const token = useAuthStore((state) => state.token) || getAccessToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateAdmissionData> }) =>
      updateAdmission(id, data, token!),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admissions'] });
      queryClient.invalidateQueries({ queryKey: ['admission', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['beds'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useDischargeAdmission() {
  const token = useAuthStore((state) => state.token) || getAccessToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DischargeAdmissionData }) =>
      dischargeAdmission(id, data, token!),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admissions'] });
      queryClient.invalidateQueries({ queryKey: ['admission', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['beds'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}
