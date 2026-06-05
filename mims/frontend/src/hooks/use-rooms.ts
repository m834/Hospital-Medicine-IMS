import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import api, { getErrorMessage } from '@/lib/api';

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
async function fetchRooms(filters: RoomFilters) {
  const params: Record<string, string> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params[key] = value.toString();
    }
  });

  const { data } = await api.get(`/rooms`, { params });
  return data;
}

async function fetchRoom(id: string) {
  const { data } = await api.get(`/rooms/${id}`);
  return data;
}

async function fetchAvailableRooms(hospitalId: string, roomType: string | undefined) {
  const params: Record<string, string> = {};
  if (roomType) params.roomType = roomType;

  const { data } = await api.get(`/rooms/available/${hospitalId}`, { params });
  return data;
}

async function fetchOccupancyStats(hospitalId: string) {
  const { data } = await api.get(`/rooms/occupancy/${hospitalId}`);
  return data;
}

async function createRoom(data: CreateRoomData) {
  try {
    const res = await api.post(`/rooms`, data);
    return res.data;
  } catch (error) {
    throw new Error(getErrorMessage(error) || 'Failed to create room');
  }
}

async function updateRoom(id: string, data: Partial<CreateRoomData>) {
  try {
    const res = await api.patch(`/rooms/${id}`, data);
    return res.data;
  } catch (error) {
    throw new Error(getErrorMessage(error) || 'Failed to update room');
  }
}

async function deleteRoom(id: string) {
  try {
    const res = await api.delete(`/rooms/${id}`);
    return res.data;
  } catch (error) {
    throw new Error(getErrorMessage(error) || 'Failed to delete room');
  }
}

// Hooks
export function useRooms(filters: RoomFilters = {}) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['rooms', filters],
    queryFn: () => fetchRooms(filters),
    enabled: !!token,
  });
}

export function useRoom(id: string) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['room', id],
    queryFn: () => fetchRoom(id),
    enabled: !!token && !!id,
  });
}

export function useAvailableRooms(hospitalId: string, roomType?: string) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['rooms', 'available', hospitalId, roomType],
    queryFn: () => fetchAvailableRooms(hospitalId, roomType),
    enabled: !!token && !!hospitalId,
  });
}

export function useOccupancyStats(hospitalId: string) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['rooms', 'occupancy', hospitalId],
    queryFn: () => fetchOccupancyStats(hospitalId),
    enabled: !!token && !!hospitalId,
  });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRoomData) => createRoom(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useUpdateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateRoomData> }) =>
      updateRoom(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['room', variables.id] });
    },
  });
}

export function useDeleteRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteRoom(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}
