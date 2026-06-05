'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Stethoscope, Clock, Calendar, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { UserRole } from '@/lib/constants';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import api from '@/lib/api';
import {
  useGetClinics,
  useCreateClinic,
  useUpdateClinic,
  useDeleteClinic,
  Clinic,
  ClinicFilters,
} from '@/hooks/use-clinics';

interface Department {
  id: string;
  name: string;
  code: string;
}

interface Doctor {
  id: string;
  fullName: string;
  email: string;
}

const DAYS_OF_WEEK = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const STATUS_COLORS = {
  ACTIVE: 'bg-green-100 text-green-800 border-green-300',
  INACTIVE: 'bg-gray-100 text-gray-800 border-gray-300',
  TEMPORARILY_CLOSED: 'bg-yellow-100 text-yellow-800 border-yellow-300',
};

export function ClinicManagement() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingClinic, setEditingClinic] = useState<Clinic | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const { toast } = useToast();
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();

  // Determine current hospital based on user role
  // Master Admin & Super Admin must select hospital, others use their hospitalId
  const currentHospitalId = selectedHospital?.id || user?.hospitalId;
  const userRole = user?.role as UserRole | null;

  const [form, setForm] = useState({
    departmentId: '',
    doctorId: '',
    name: '',
    opdFee: '',
    availableDays: [] as string[],
    availableTime: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'TEMPORARILY_CLOSED',
  });

  // Build filters for query
  const filters: ClinicFilters = {
    hospitalId: currentHospitalId || undefined,
    departmentId: selectedDepartment && selectedDepartment !== 'all' ? selectedDepartment : undefined,
    status: selectedStatus && selectedStatus !== 'all' ? selectedStatus as 'ACTIVE' | 'INACTIVE' | 'TEMPORARILY_CLOSED' : undefined,
    page: 1,
    limit: 50,
  };

  const { data: clinicsData, isLoading, refetch } = useGetClinics(filters);
  const createClinic = useCreateClinic();
  const updateClinic = useUpdateClinic();
  const deleteClinic = useDeleteClinic();

  const clinics = clinicsData?.data || [];

  useEffect(() => {
    if (currentHospitalId) {
      fetchDepartments();
      fetchDoctors();
    }
  }, [currentHospitalId]);

  const fetchDepartments = async () => {
    if (!currentHospitalId) return;
    try {
      const response = await api.get('/departments', {
        params: { hospitalId: currentHospitalId },
      });
      setDepartments(response.data || []);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  const fetchDoctors = async () => {
    if (!currentHospitalId) return;
    try {
      const response = await api.get(`/clinics/doctors/hospital/${currentHospitalId}`);
      setDoctors(response.data || []);
    } catch (error) {
      console.error('Failed to fetch doctors:', error);
    }
  };

  const parseTimeRange = (value: string) => {
    const [from, to] = value.split('-').map((t) => t.trim());
    return { availableFrom: from || undefined, availableTo: to || undefined };
  };

  const handleCreateClinic = async () => {
    if (!currentHospitalId) {
      toast({
        title: 'Error',
        description: 'Hospital context is required',
        variant: 'destructive',
      });
      return;
    }

    const timeRange = form.availableTime ? parseTimeRange(form.availableTime) : {};

    try {
      await createClinic.mutateAsync({
        hospitalId: currentHospitalId,
        departmentId: form.departmentId,
        doctorId: form.doctorId,
        name: form.name || undefined,
        opdFee: parseFloat(form.opdFee),
        availableDays: form.availableDays.length > 0 ? form.availableDays : undefined,
        ...timeRange,
        status: form.status,
      });
      setShowDialog(false);
      resetForm();
      refetch();
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleUpdateClinic = async () => {
    if (!editingClinic) return;

    const timeRange = form.availableTime ? parseTimeRange(form.availableTime) : {};

    try {
      await updateClinic.mutateAsync({
        id: editingClinic.id,
        dto: {
          name: form.name || undefined,
          opdFee: parseFloat(form.opdFee),
          availableDays: form.availableDays.length > 0 ? form.availableDays : undefined,
          ...timeRange,
          status: form.status,
        },
      });
      setShowDialog(false);
      setEditingClinic(null);
      resetForm();
      refetch();
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleDeleteClinic = async (clinic: Clinic) => {
    if (!confirm(`Are you sure you want to delete this clinic?`)) return;

    try {
      await deleteClinic.mutateAsync(clinic.id);
      refetch();
    } catch (error) {
      // Error handled in hook
    }
  };

  const parseAvailableDays = (value: string | string[] | null | undefined) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fallback for comma-separated values like "MON,TUE,WED"
    }
    return trimmed
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);
  };

  const openEditDialog = (clinic: Clinic) => {
    setEditingClinic(clinic);
    setForm({
      departmentId: clinic.departmentId,
      doctorId: clinic.doctorId,
      name: clinic.name || '',
      opdFee: clinic.opdFee,
      availableDays: parseAvailableDays(clinic.availableDays),
      availableTime: [clinic.availableFrom, clinic.availableTo].filter(Boolean).join('-'),
      status: clinic.status,
    });
    setShowDialog(true);
  };

  const resetForm = () => {
    setForm({
      departmentId: '',
      doctorId: '',
      name: '',
      opdFee: '',
      availableDays: [],
      availableTime: '',
      status: 'ACTIVE',
    });
  };

  const toggleDay = (day: string) => {
    setForm((prev) => ({
      ...prev,
      availableDays: prev.availableDays.includes(day)
        ? prev.availableDays.filter((d) => d !== day)
        : [...prev.availableDays, day],
    }));
  };

  const canCreate = userRole && [UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.DEPARTMENT_ADMIN].includes(userRole);
  const canUpdate = userRole && [UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN].includes(userRole);
  const canDelete = userRole && [UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN].includes(userRole);

  if (!currentHospitalId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please select a hospital first</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clinic Management</h1>
          <p className="text-muted-foreground">
            Manage doctor clinics and OPD schedules
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Clinic
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Department</Label>
              <Select value={selectedDepartment || 'all'} onValueChange={(v) => setSelectedDepartment(v === 'all' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={selectedStatus || 'all'} onValueChange={(v) => setSelectedStatus(v === 'all' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="TEMPORARILY_CLOSED">Temporarily Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clinics Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24 bg-gray-100" />
              <CardContent className="h-32 bg-gray-50" />
            </Card>
          ))}
        </div>
      ) : clinics.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Stethoscope className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No clinics found</p>
            {canCreate && (
              <Button variant="outline" className="mt-4" onClick={() => setShowDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Clinic
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clinics.map((clinic) => (
            <Card key={clinic.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Stethoscope className="h-5 w-5 text-primary" />
                      {clinic.name || `Dr. ${clinic.doctor?.lastName}'s Clinic`}
                    </CardTitle>
                    <CardDescription>
                      {clinic.doctor?.firstName} {clinic.doctor?.lastName}
                    </CardDescription>
                  </div>
                  <Badge className={STATUS_COLORS[clinic.status]}>
                    {clinic.status.replace('_', ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium">Department:</span>
                  {clinic.department?.name}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="font-semibold text-green-600">
                    Rs. {parseFloat(clinic.opdFee).toLocaleString()}
                  </span>
                  <span className="text-muted-foreground">consultation fee</span>
                </div>
                {(clinic.availableFrom || clinic.availableTo) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {[clinic.availableFrom, clinic.availableTo].filter(Boolean).join(' - ')}
                  </div>
                )}
                {clinic.availableDays && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <div className="flex gap-1 flex-wrap">
                      {(Array.isArray(clinic.availableDays) 
                        ? clinic.availableDays 
                        : clinic.availableDays.split(',')
                      ).map((day: string) => (
                        <Badge key={day} variant="outline" className="text-xs">
                          {day.trim()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {clinic._count && (
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    {clinic._count.visits || 0} visits • {clinic._count.tokens || 0} tokens today
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  {canUpdate && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(clinic)}
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteClinic(clinic)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) {
          setEditingClinic(null);
          resetForm();
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingClinic ? 'Edit Clinic' : 'Create New Clinic'}
            </DialogTitle>
            <DialogDescription>
              {editingClinic
                ? 'Update clinic details and schedule'
                : 'Add a new doctor clinic with OPD fee and schedule'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {!editingClinic && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="department">Department *</Label>
                  <Select
                    value={form.departmentId}
                    onValueChange={(value) => setForm({ ...form, departmentId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="doctor">Doctor *</Label>
                  <Select
                    value={form.doctorId}
                    onValueChange={(value) => setForm({ ...form, doctorId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.map((doctor) => (
                        <SelectItem key={doctor.id} value={doctor.id}>
                          Dr. {doctor.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="grid gap-2">
              <Label htmlFor="name">Clinic Name (Optional)</Label>
              <Input
                id="name"
                placeholder="e.g., Evening Clinic, Special OPD"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="opdFee">OPD Fee (Rs.) *</Label>
              <Input
                id="opdFee"
                type="number"
                placeholder="1000"
                value={form.opdFee}
                onChange={(e) => setForm({ ...form, opdFee: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Available Days</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <Button
                    key={day}
                    type="button"
                    variant={form.availableDays.includes(day) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleDay(day)}
                  >
                    {day}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="availableTime">Available Time</Label>
              <Input
                id="availableTime"
                placeholder="e.g., 09:00-17:00"
                value={form.availableTime}
                onChange={(e) => setForm({ ...form, availableTime: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(value: any) => setForm({ ...form, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="TEMPORARILY_CLOSED">Temporarily Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={editingClinic ? handleUpdateClinic : handleCreateClinic}
              disabled={
                createClinic.isPending ||
                updateClinic.isPending ||
                (!editingClinic && (!form.departmentId || !form.doctorId)) ||
                !form.opdFee
              }
            >
              {createClinic.isPending || updateClinic.isPending
                ? 'Saving...'
                : editingClinic
                ? 'Update Clinic'
                : 'Create Clinic'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
