'use client';

import { useState } from 'react';
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
  useBeds,
  useBed,
  useCreateBed,
  useUpdateBed,
  useUpdateBedStatus,
  useDeleteBed,
  useAvailableBeds,
  type CreateBedData,
} from '@/hooks/use-beds';
import { useRooms } from '@/hooks/use-rooms';
import { useDepartments } from '@/hooks/use-departments';
import { useHospitalStore } from '@/stores/hospital.store';
import { useAuthStore } from '@/stores/auth.store';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  RefreshCw,
  Bed as BedIcon,
  CheckCircle,
  AlertCircle,
  Wrench,
  Loader2,
  X,
} from 'lucide-react';

const BED_TYPES = [
  { value: 'STANDARD', label: 'Standard' },
  { value: 'ICU', label: 'ICU' },
  { value: 'NICU', label: 'NICU' },
  { value: 'PICU', label: 'PICU' },
  { value: 'CCU', label: 'CCU' },
  { value: 'HDU', label: 'HDU' },
  { value: 'VENTILATOR', label: 'Ventilator' },
  { value: 'ISOLATION', label: 'Isolation' },
  { value: 'PEDIATRIC', label: 'Pediatric' },
  { value: 'MATERNITY', label: 'Maternity' },
];

const BED_STATUS = [
  { value: 'AVAILABLE', label: 'Available', color: 'default', icon: CheckCircle },
  { value: 'OCCUPIED', label: 'Occupied', color: 'destructive', icon: AlertCircle },
  { value: 'MAINTENANCE', label: 'Maintenance', color: 'secondary', icon: Wrench },
  { value: 'CLEANING', label: 'Cleaning', color: 'outline', icon: AlertCircle },
];

export default function BedsPage() {
  const { selectedHospital } = useHospitalStore();
  const { user } = useAuthStore();
  const { toast } = useToast();

  // Get the effective hospital ID (either from selected hospital or user's hospital)
  const hospitalId = selectedHospital?.id || user?.hospitalId;

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterRoom, setFilterRoom] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<CreateBedData>>({
    bedNumber: '',
    bedType: 'STANDARD',
    dailyRate: 0,
    status: 'AVAILABLE',
    features: [],
  });
  const [newStatus, setNewStatus] = useState('AVAILABLE');

  // Queries
  const { data: bedsData, isLoading, refetch } = useBeds({
    hospitalId: hospitalId,
    departmentId: filterDepartment && filterDepartment !== 'all' ? filterDepartment : undefined,
    roomId: filterRoom && filterRoom !== 'all' ? filterRoom : undefined,
    bedType: filterType && filterType !== 'all' ? filterType : undefined,
    status: filterStatus && filterStatus !== 'all' ? filterStatus : undefined,
    limit: 100,
  });

  const { data: availableBedsData } = useAvailableBeds(
    hospitalId || '',
    undefined,
    undefined
  );

  const { data: roomsData } = useRooms({
    hospitalId: hospitalId,
    limit: 100,
  });

  const { data: departmentsData } = useDepartments({ hospitalId: hospitalId });
  const { data: selectedBed } = useBed(selectedBedId || '');

  // Mutations
  const createMutation = useCreateBed();
  const updateMutation = useUpdateBed();
  const updateStatusMutation = useUpdateBedStatus();
  const deleteMutation = useDeleteBed();

  const beds = bedsData?.data || [];
  const rooms = roomsData?.data || [];
  const departments = Array.isArray(departmentsData) ? departmentsData : (departmentsData?.data || []);
  const availableBeds = availableBedsData || [];

  // Stats
  const totalBeds = beds.length;
  const availableCount = beds.filter((b: any) => b.status === 'AVAILABLE').length;
  const occupiedCount = beds.filter((b: any) => b.status === 'OCCUPIED').length;
  const maintenanceCount = beds.filter((b: any) => b.status === 'MAINTENANCE').length;
  const cleaningCount = beds.filter((b: any) => b.status === 'CLEANING').length;

  // Handlers
  const handleCreate = () => {
    setFormData({
      bedNumber: '',
      bedType: 'STANDARD',
      dailyRate: 0,
      status: 'AVAILABLE',
      features: [],
    });
    setCreateModalOpen(true);
  };

  const handleEdit = (bedId: string) => {
    setSelectedBedId(bedId);
    const bed = beds.find((b: any) => b.id === bedId);
    if (bed) {
      setFormData({
        bedNumber: bed.bedNumber,
        bedType: bed.bedType,
        roomId: bed.roomId,
        departmentId: bed.departmentId,
        dailyRate: parseFloat(bed.dailyRate),
        status: bed.status,
        features: bed.features || [],
        notes: bed.notes,
      });
      setEditModalOpen(true);
    }
  };

  const handleDelete = (bedId: string) => {
    setSelectedBedId(bedId);
    setDeleteModalOpen(true);
  };

  const handleChangeStatus = (bedId: string) => {
    const bed = beds.find((b: any) => b.id === bedId);
    if (bed) {
      setSelectedBedId(bedId);
      setNewStatus(bed.status);
      setStatusModalOpen(true);
    }
  };

  const submitCreate = async () => {
    if (!hospitalId || !formData.bedNumber || !formData.bedType || !formData.roomId || formData.roomId === 'none') {
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
        bedNumber: formData.bedNumber,
        bedType: formData.bedType,
        roomId: formData.roomId,
        departmentId: formData.departmentId && formData.departmentId !== 'none' ? formData.departmentId : undefined,
        dailyRate: formData.dailyRate || 0,
        status: formData.status,
        features: formData.features,
        notes: formData.notes,
      });

      toast({
        title: 'Success',
        description: 'Bed created successfully',
      });
      setCreateModalOpen(false);
      refetch();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create bed',
        variant: 'destructive',
      });
    }
  };

  const submitEdit = async () => {
    if (!selectedBedId || !formData.bedNumber || !formData.bedType || !formData.roomId) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: selectedBedId,
        data: {
          bedNumber: formData.bedNumber,
          bedType: formData.bedType,
          roomId: formData.roomId,
          departmentId: formData.departmentId,
          dailyRate: formData.dailyRate || 0,
          status: formData.status,
          features: formData.features,
          notes: formData.notes,
        },
      });

      toast({
        title: 'Success',
        description: 'Bed updated successfully',
      });
      setEditModalOpen(false);
      setSelectedBedId(null);
      refetch();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update bed',
        variant: 'destructive',
      });
    }
  };

  const submitStatusChange = async () => {
    if (!selectedBedId) return;

    try {
      await updateStatusMutation.mutateAsync({
        id: selectedBedId,
        status: newStatus,
      });

      toast({
        title: 'Success',
        description: 'Bed status updated successfully',
      });
      setStatusModalOpen(false);
      setSelectedBedId(null);
      refetch();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update bed status',
        variant: 'destructive',
      });
    }
  };

  const confirmDelete = async () => {
    if (!selectedBedId) return;

    try {
      await deleteMutation.mutateAsync(selectedBedId);

      toast({
        title: 'Success',
        description: 'Bed deleted successfully',
      });
      setDeleteModalOpen(false);
      setSelectedBedId(null);
      refetch();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete bed',
        variant: 'destructive',
      });
    }
  };

  const addFeature = (feature: string) => {
    if (feature && !formData.features?.includes(feature)) {
      setFormData({
        ...formData,
        features: [...(formData.features || []), feature],
      });
    }
  };

  const removeFeature = (feature: string) => {
    setFormData({
      ...formData,
      features: formData.features?.filter((f) => f !== feature) || [],
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = BED_STATUS.find((s) => s.value === status);
    const StatusIcon = statusConfig?.icon || AlertCircle;
    return (
      <Badge variant={statusConfig?.color as any || 'default'} className="gap-1">
        <StatusIcon className="h-3 w-3" />
        {statusConfig?.label || status}
      </Badge>
    );
  };

  const filteredBeds = beds.filter((bed: any) => {
    const matchesSearch =
      bed.bedNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bed.room?.roomNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  if (!selectedHospital) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>No Hospital Selected</CardTitle>
            <CardDescription>
              Please select a hospital to manage beds
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
          <h1 className="text-3xl font-bold">Bed Management</h1>
          <p className="text-muted-foreground">
            Manage hospital beds and their availability
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Add Bed
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Beds
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBeds}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Available
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{availableCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Occupied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{occupiedCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Maintenance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{maintenanceCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cleaning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{cleaningCount}</div>
          </CardContent>
        </Card>
      </div>

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
                placeholder="Search beds..."
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

            <Select value={filterRoom} onValueChange={setFilterRoom}>
              <SelectTrigger>
                <SelectValue placeholder="All Rooms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Rooms</SelectItem>
                {rooms.map((room: any) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.roomNumber}
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
                {BED_TYPES.map((type) => (
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
                {BED_STATUS.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Beds Table */}
      <Card>
        <CardHeader>
          <CardTitle>Beds ({filteredBeds.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredBeds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <BedIcon className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No beds found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bed Number</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Daily Rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Features</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBeds.map((bed: any) => (
                  <TableRow key={bed.id}>
                    <TableCell className="font-medium">{bed.bedNumber}</TableCell>
                    <TableCell>
                      {bed.room?.roomNumber || '-'}
                      {bed.room?.floor && ` (Floor ${bed.room.floor})`}
                    </TableCell>
                    <TableCell>
                      {BED_TYPES.find((t) => t.value === bed.bedType)?.label || bed.bedType}
                    </TableCell>
                    <TableCell>
                      {bed.department?.name || bed.room?.department?.name || '-'}
                    </TableCell>
                    <TableCell>PKR{parseFloat(bed.dailyRate).toFixed(2)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-0 h-auto"
                        onClick={() => handleChangeStatus(bed.id)}
                      >
                        {getStatusBadge(bed.status)}
                      </Button>
                    </TableCell>
                    <TableCell>
                      {bed.features && bed.features.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {bed.features.slice(0, 2).map((feature: string) => (
                            <Badge key={feature} variant="outline" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                          {bed.features.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{bed.features.length - 2}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(bed.id)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(bed.id)}
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
            setSelectedBedId(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editModalOpen ? 'Edit Bed' : 'Create Bed'}</DialogTitle>
            <DialogDescription>
              {editModalOpen
                ? 'Update bed information'
                : 'Add a new bed to the hospital'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="bedNumber">Bed Number *</Label>
                <Input
                  id="bedNumber"
                  value={formData.bedNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, bedNumber: e.target.value })
                  }
                  placeholder="e.g., B101"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="bedType">Bed Type *</Label>
                <Select
                  value={formData.bedType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, bedType: value })
                  }
                >
                  <SelectTrigger id="bedType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BED_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="room">Room *</Label>
                <Select
                  value={formData.roomId}
                  onValueChange={(value) => {
                    const selectedRoom = rooms.find((r: any) => r.id === value);
                    setFormData({
                      ...formData,
                      roomId: value,
                      departmentId: selectedRoom?.departmentId,
                    });
                  }}
                >
                  <SelectTrigger id="room">
                    <SelectValue placeholder="Select room" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.map((room: any) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.roomNumber} ({room.roomType})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    <SelectValue placeholder="Auto-filled from room" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {departments.map((dept: any) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    {BED_STATUS.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Features</Label>
              <div className="flex gap-2">
                <Input
                  id="featureInput"
                  placeholder="Add feature (e.g., Monitor, Ventilator)"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addFeature((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const input = document.getElementById('featureInput') as HTMLInputElement;
                    if (input.value) {
                      addFeature(input.value);
                      input.value = '';
                    }
                  }}
                >
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.features?.map((feature) => (
                  <Badge key={feature} variant="secondary">
                    {feature}
                    <X
                      className="h-3 w-3 ml-1 cursor-pointer"
                      onClick={() => removeFeature(feature)}
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
                setSelectedBedId(null);
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

      {/* Status Change Dialog */}
      <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Bed Status</DialogTitle>
            <DialogDescription>
              Update the status of bed{' '}
              {beds.find((b: any) => b.id === selectedBedId)?.bedNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="newStatus">New Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger id="newStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BED_STATUS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitStatusChange}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bed</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this bed? This action cannot be undone.
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
