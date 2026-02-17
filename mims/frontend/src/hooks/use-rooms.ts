import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';

// Types
export interface Room {
  id: string;
  hospitalId: string;
  departmentId?: string;
  roomNumber: string;
  roomType: 'PRIVATE' | 'SEMI_PRIVATE' | 'GENERAL' | 'ICU' | 'NICU' | 'PICU' | 'CCU' | 'HDU' | 'ISOLATION' | 'EMERGENCY';
  floor?: number;
  building?: string;
  capacity: number;
  dailyRate: string;
  amenities?: string[];
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'RESERVED';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  hospital?: {
    id: string;
    name: string;
    code: string;
  };
  department?: {
    id: string;
    name: string;
    code: string;
  };
  beds?: Array<{
    id: string;
    bedNumber: string;
    status: string;
  }>;
  _count?: {
    beds: number;
    admissions: number;
  };
}

export interface RoomFilters {
  hospitalId?: string;
  departmentId?: string;
  roomType?: string;
  status?: string;
  floor?: number;
  building?: string;
  page?: number;
  limit?: number;
}

export interface CreateRoomData {
  hospitalId: string;
  departmentId?: string;
  roomNumber: string;
  roomType: string;
  floor?: number;
  building?: string;
  capacity: number;
  dailyRate: number;
  amenities?: string[];
  status?: string;
  notes?: string;
}

export interface OccupancyStats {
  totalRooms: number;
  occupiedRooms: number;
  availableRooms: number;
  roomOccupancyRate: string;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  bedOccupancyRate: string;
  roomsByType: Record<string, { total: number; occupied: number }>;
}

// API Functions
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

async function fetchRooms(filters: RoomFilters, token: string) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, value.toString());
    }
  });

  const response = await fetch(`${API_URL}/rooms?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch rooms');
  }

  return response.json();
}

async function fetchRoom(id: string, token: string) {
  const response = await fetch(`${API_URL}/rooms/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch room');
  }

  return response.json();
}

async function fetchAvailableRooms(hospitalId: string, roomType: string | undefined, token: string) {
  const params = new URLSearchParams();
  if (roomType) params.append('roomType', roomType);

  const response = await fetch(`${API_URL}/rooms/available/${hospitalId}?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch available rooms');
  }

  return response.json();
}

async function fetchOccupancyStats(hospitalId: string, token: string) {
  const response = await fetch(`${API_URL}/rooms/occupancy/${hospitalId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch occupancy stats');
  }

  return response.json();
}

async function createRoom(data: CreateRoomData, token: string) {
  const response = await fetch(`${API_URL}/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create room');
  }

  return response.json();
}

async function updateRoom(id: string, data: Partial<CreateRoomData>, token: string) {
  const response = await fetch(`${API_URL}/rooms/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update room');
  }

  return response.json();
}

async function deleteRoom(id: string, token: string) {
  const response = await fetch(`${API_URL}/rooms/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete room');
  }

  return response.json();
}

// Hooks
export function useRooms(filters: RoomFilters = {}) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['rooms', filters],
    queryFn: () => fetchRooms(filters, token!),
    enabled: !!token,
  });
}

export function useRoom(id: string) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['room', id],
    queryFn: () => fetchRoom(id, token!),
    enabled: !!token && !!id,
  });
}

export function useAvailableRooms(hospitalId: string, roomType?: string) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['rooms', 'available', hospitalId, roomType],
    queryFn: () => fetchAvailableRooms(hospitalId, roomType, token!),
    enabled: !!token && !!hospitalId,
  });
}

export function useOccupancyStats(hospitalId: string) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['rooms', 'occupancy', hospitalId],
    queryFn: () => fetchOccupancyStats(hospitalId, token!),
    enabled: !!token && !!hospitalId,
  });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRoomData) => {
      const token = useAuthStore.getState().token;
      if (!token) throw new Error('No authentication token available');
      return createRoom(data, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useUpdateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateRoomData> }) => {
      const token = useAuthStore.getState().token;
      if (!token) throw new Error('No authentication token available');
      return updateRoom(id, data, token);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['room', variables.id] });
    },
  });
}

export function useDeleteRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => {
      const token = useAuthStore.getState().token;
      if (!token) throw new Error('No authentication token available');
      return deleteRoom(id, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}
