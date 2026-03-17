'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  useRooms,
  useRoom,
  useCreateRoom,
  useUpdateRoom,
  useDeleteRoom,
  useOccupancyStats,
  type CreateRoomData,
} from '@/hooks/use-rooms';
import { useHospitalStore } from '@/stores/hospital.store';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  RefreshCw,
  Bed,
  Building2,
  DoorOpen,
  Loader2,
  X,
} from 'lucide-react';
import { UserRole } from '@/lib/constants';

const ROOM_TYPES = [
  { value: 'PRIVATE', label: 'Private' },
  { value: 'SEMI_PRIVATE', label: 'Semi-Private' },
  { value: 'GENERAL', label: 'General' },
  { value: 'ICU', label: 'ICU' },
  { value: 'NICU', label: 'NICU' },
  { value: 'PICU', label: 'PICU' },
  { value: 'CCU', label: 'CCU' },
  { value: 'HDU', label: 'HDU' },
  { value: 'ISOLATION', label: 'Isolation' },
  { value: 'EMERGENCY', label: 'Emergency' },
];

const ROOM_STATUS = [
  { value: 'AVAILABLE', label: 'Available', color: 'default' },
  { value: 'OCCUPIED', label: 'Occupied', color: 'destructive' },
  { value: 'MAINTENANCE', label: 'Maintenance', color: 'secondary' },
  { value: 'RESERVED', label: 'Reserved', color: 'outline' },
];

export default function RoomsPage() {
  const { selectedHospital } = useHospitalStore();
  const { user } = useAuthStore();
  const { toast } = useToast();

  // Get the effective hospital ID (either from selected hospital or user's hospital)
  const hospitalId = user?.role === UserRole.MASTER_ADMIN || user?.role === UserRole.SUPER_ADMIN ? selectedHospital?.id : user?.hospitalId;
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFloor, setFilterFloor] = useState('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // Departments state
  const [departments, setDepartments] = useState<any[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<CreateRoomData>>({
    roomNumber: '',
    roomType: 'GENERAL',
    capacity: 1,
    dailyRate: 0,
    status: 'AVAILABLE',
    amenities: [],
  });

  // Queries
  const { data: roomsData, isLoading, refetch } = useRooms({
    hospitalId: hospitalId,
    departmentId: filterDepartment && filterDepartment !== 'all' ? filterDepartment : undefined,
    roomType: filterType && filterType !== 'all' ? filterType : undefined,
    status: filterStatus && filterStatus !== 'all' ? filterStatus : undefined,
    floor: filterFloor ? parseInt(filterFloor) : undefined,
    limit: 50,
  });

  const { data: occupancyData } = useOccupancyStats(hospitalId || '');
  const { data: selectedRoom } = useRoom(selectedRoomId || '');

  // Mutations
  const createMutation = useCreateRoom();
  const updateMutation = useUpdateRoom();
  const deleteMutation = useDeleteRoom();

  const rooms = roomsData?.data || [];

  // Fetch departments using the same pattern as Department List
  useEffect(() => {
    if (hospitalId) {
      fetchDepartments();
    }
  }, [hospitalId]);

  const fetchDepartments = async () => {
    if (!hospitalId) return;
    
    setDepartmentsLoading(true);
    try {
      const params: any = {};
      if (hospitalId) {
        params.hospitalId = hospitalId;
      }
      const response = await api.get('/departments', { params });
      console.log('[RoomsPage] Departments API Response:', response.data);
      setDepartments(response.data || []);
    } catch (error) {
      console.error('[RoomsPage] Failed to fetch departments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load departments',
        variant: 'destructive',
      });
    } finally {
      setDepartmentsLoading(false);
    }
  };

  // Debug logging
  useEffect(() => {
    console.log('[RoomsPage] Component mounted');
    console.log('[RoomsPage] Selected Hospital:', selectedHospital);
    console.log('[RoomsPage] User Hospital ID:', user?.hospitalId);
    console.log('[RoomsPage] Effective Hospital ID:', hospitalId);
  }, [selectedHospital, user?.hospitalId, hospitalId]);

  useEffect(() => {
    console.log('[RoomsPage] Departments State:', {
      loading: departmentsLoading,
      count: departments.length,
      departments,
    });
  }, [departmentsLoading, departments]);

  console.log('[RoomsPage] Effective Hospital ID:', hospitalId);
  console.log('[RoomsPage] Departments Loading:', departmentsLoading);
  console.log('[RoomsPage] Departments Count:', departments.length);

  // Handlers
  const handleCreate = () => {
    setFormData({
      roomNumber: '',
      roomType: 'GENERAL',
      capacity: 1,
      dailyRate: 0,
      status: 'AVAILABLE',
      amenities: [],
    });
    setCreateModalOpen(true);
  };

  const handleEdit = (roomId: string) => {
    setSelectedRoomId(roomId);
    const room = rooms.find((r: any) => r.id === roomId);
    if (room) {
      setFormData({
        roomNumber: room.roomNumber,
        roomType: room.roomType,
        floor: room.floor,
        building: room.building,
        capacity: room.capacity,
        dailyRate: parseFloat(room.dailyRate),
        status: room.status,
        departmentId: room.departmentId,
        amenities: room.amenities || [],
        notes: room.notes,
      });
      setEditModalOpen(true);
    }
  };

  const handleDelete = (roomId: string) => {
    setSelectedRoomId(roomId);
    setDeleteModalOpen(true);
  };

  const submitCreate = async () => {
    if (!hospitalId || !formData.roomNumber || !formData.roomType) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createMutation.mutateAsync({
        hospitalId: hospitalId,
        roomNumber: formData.roomNumber,
        roomType: formData.roomType,
        floor: formData.floor,
        building: formData.building,
        capacity: formData.capacity || 1,
        dailyRate: formData.dailyRate || 0,
        status: formData.status,
        departmentId: formData.departmentId && formData.departmentId !== 'none' ? formData.departmentId : undefined,
        amenities: formData.amenities,
        notes: formData.notes,
      });

      toast({
        title: 'Success',
        description: 'Room created successfully',
      });
      setCreateModalOpen(false);
      refetch();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create room',
        variant: 'destructive',
      });
    }
  };

  const submitEdit = async () => {
    if (!selectedRoomId || !formData.roomNumber || !formData.roomType) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: selectedRoomId,
        data: {
          roomNumber: formData.roomNumber,
          roomType: formData.roomType,
          floor: formData.floor,
          building: formData.building,
          capacity: formData.capacity || 1,
          dailyRate: formData.dailyRate || 0,
          status: formData.status,
          departmentId: formData.departmentId,
          amenities: formData.amenities,
          notes: formData.notes,
        },
      });

      toast({
        title: 'Success',
        description: 'Room updated successfully',
      });
      setEditModalOpen(false);
      setSelectedRoomId(null);
      refetch();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update room',
        variant: 'destructive',
      });
    }
  };

  const confirmDelete = async () => {
    if (!selectedRoomId) return;

    try {
      await deleteMutation.mutateAsync(selectedRoomId);

      toast({
        title: 'Success',
        description: 'Room deleted successfully',
      });
      setDeleteModalOpen(false);
      setSelectedRoomId(null);
      refetch();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete room',
        variant: 'destructive',
      });
    }
  };

  const addAmenity = (amenity: string) => {
    if (amenity && !formData.amenities?.includes(amenity)) {
      setFormData({
        ...formData,
        amenities: [...(formData.amenities || []), amenity],
      });
    }
  };

  const removeAmenity = (amenity: string) => {
    setFormData({
      ...formData,
      amenities: formData.amenities?.filter((a) => a !== amenity) || [],
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = ROOM_STATUS.find((s) => s.value === status);
    return (
      <Badge variant={statusConfig?.color as any || 'default'}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  const filteredRooms = rooms.filter((room: any) => {
    const matchesSearch =
      room.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.building?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  if (!hospitalId) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>No Hospital Selected</CardTitle>
            <CardDescription>
              Please select a hospital to manage rooms
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Room Management</h1>
          <p className="text-muted-foreground">
            Manage hospital rooms and bed capacity
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Add Room
          </Button>
        </div>
      </div>

      {/* Occupancy Stats */}
      {occupancyData && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Rooms
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{occupancyData.totalRooms}</div>
              <p className="text-xs text-muted-foreground">
                {occupancyData.availableRooms} available
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Room Occupancy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{occupancyData.roomOccupancyRate}%</div>
              <p className="text-xs text-muted-foreground">
                {occupancyData.occupiedRooms} occupied
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Beds
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{occupancyData.totalBeds}</div>
              <p className="text-xs text-muted-foreground">
                {occupancyData.availableBeds} available
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Bed Occupancy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{occupancyData.bedOccupancyRate}%</div>
              <p className="text-xs text-muted-foreground">
                {occupancyData.occupiedBeds} occupied
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search rooms..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>

            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger>
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept: any) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {ROOM_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {ROOM_STATUS.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="number"
              placeholder="Floor"
              value={filterFloor}
              onChange={(e) => setFilterFloor(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Rooms Table */}
      <Card>
        <CardHeader>
          <CardTitle>Rooms ({filteredRooms.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <DoorOpen className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No rooms found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room Number</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Floor/Building</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Daily Rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Beds</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRooms.map((room: any) => (
                  <TableRow key={room.id}>
                    <TableCell className="font-medium">{room.roomNumber}</TableCell>
                    <TableCell>
                      {ROOM_TYPES.find((t) => t.value === room.roomType)?.label || room.roomType}
                    </TableCell>
                    <TableCell>
                      {room.floor && room.building
                        ? `Floor ${room.floor}, ${room.building}`
                        : room.floor
                        ? `Floor ${room.floor}`
                        : room.building || '-'}
                    </TableCell>
                    <TableCell>
                      {room.department?.name || '-'}
                    </TableCell>
                    <TableCell>{room.capacity}</TableCell>
                    <TableCell>PKR{parseFloat(room.dailyRate).toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(room.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Bed className="h-4 w-4" />
                        <span>{room._count?.beds || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(room.id)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(room.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog
        open={createModalOpen || editModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateModalOpen(false);
            setEditModalOpen(false);
            setSelectedRoomId(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editModalOpen ? 'Edit Room' : 'Create Room'}</DialogTitle>
            <DialogDescription>
              {editModalOpen
                ? 'Update room information'
                : 'Add a new room to the hospital'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="roomNumber">Room Number *</Label>
                <Input
                  id="roomNumber"
                  value={formData.roomNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, roomNumber: e.target.value })
                  }
                  placeholder="e.g., R101"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="roomType">Room Type *</Label>
                <Select
                  value={formData.roomType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, roomType: value })
                  }
                >
                  <SelectTrigger id="roomType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROOM_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="floor">Floor</Label>
                <Input
                  id="floor"
                  type="number"
                  value={formData.floor || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, floor: parseInt(e.target.value) || undefined })
                  }
                  placeholder="e.g., 1"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="building">Building</Label>
                <Input
                  id="building"
                  value={formData.building || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, building: e.target.value })
                  }
                  placeholder="e.g., Block A"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="capacity">Capacity *</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  value={formData.capacity || 1}
                  onChange={(e) =>
                    setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dailyRate">Daily Rate (PKR) *</Label>
                <Input
                  id="dailyRate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.dailyRate || 0}
                  onChange={(e) =>
                    setFormData({ ...formData, dailyRate: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROOM_STATUS.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="department">Department</Label>
              <Select
                value={formData.departmentId || ''}
                onValueChange={(value) =>
                  setFormData({ ...formData, departmentId: value || undefined })
                }
              >
                <SelectTrigger id="department">
                  <SelectValue placeholder={departmentsLoading ? "Loading departments..." : "Select department (optional)"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {departmentsLoading ? (
                    <div className="py-2 px-2 text-sm text-muted-foreground">Loading...</div>
                  ) : departments.length === 0 ? (
                    <div className="py-2 px-2 text-sm text-muted-foreground">No departments found</div>
                  ) : (
                    departments.map((dept: any) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Amenities</Label>
              <div className="flex gap-2">
                <Input
                  id="amenityInput"
                  placeholder="Add amenity (e.g., AC, TV)"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addAmenity((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const input = document.getElementById('amenityInput') as HTMLInputElement;
                    if (input.value) {
                      addAmenity(input.value);
                      input.value = '';
                    }
                  }}
                >
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.amenities?.map((amenity) => (
                  <Badge key={amenity} variant="secondary">
                    {amenity}
                    <X
                      className="h-3 w-3 ml-1 cursor-pointer"
                      onClick={() => removeAmenity(amenity)}
                    />
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={formData.notes || ''}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Additional notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateModalOpen(false);
                setEditModalOpen(false);
                setSelectedRoomId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editModalOpen ? submitEdit : submitCreate}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editModalOpen ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Room</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this room? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
