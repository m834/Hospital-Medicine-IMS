'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Plus, Eye, Edit, Trash2, RefreshCw, Pill, Package, Activity } from 'lucide-react';
import api from '@/lib/api';
import { useHospitalStore } from '@/stores/hospital.store';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@/lib/constants';
import { canModifyResources } from '@/lib/permissions';
import { CreateMedicineModal } from '@/components/modals/create-medicine-modal';
import { EditMedicineModal } from '@/components/modals/edit-medicine-modal';

interface Medicine {
  id: string;
  name: string;
  genericName?: string;
  strength?: string;
  form: string;
  manufacturer?: string;
  status: string;
  hospital?: {
    id: string;
    name: string;
  };
  _count?: {
    stockBatches: number;
  };
}

interface Stats {
  total: number;
  active: number;
  discontinued: number;
  byForm: { [key: string]: number };
}

export default function MedicinesPage() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedForm, setSelectedForm] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [stats, setStats] = useState<Stats>({
    total: 0,
    active: 0,
    discontinued: 0,
    byForm: {},
  });

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewMedicineModal, setViewMedicineModal] = useState<Medicine | null>(null);
  const [editMedicineModal, setEditMedicineModal] = useState<Medicine | null>(null);
  const [deleteMedicineModal, setDeleteMedicineModal] = useState<Medicine | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { selectedHospital } = useHospitalStore();
  const { user } = useAuthStore();

  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
  const canManage = [
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
  ].includes(user?.role as UserRole);
  
  // Check if user can update/delete (only MASTER_ADMIN)
  const canModify = user?.role ? canModifyResources(user.role as UserRole) : false;

  // Determine current hospital for operations
  const currentHospitalId = user?.hospitalId || selectedHospital?.id;
  const currentHospital = selectedHospital || (user?.hospitalId ? {
    id: user.hospitalId,
    name: 'My Hospital',
    code: 'HOSP',
  } : null);

  useEffect(() => {
    if (currentHospitalId) {
      fetchMedicines();
    }
  }, [currentHospitalId, user]);

  const fetchMedicines = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 200, status: 'ACTIVE' };
      
      // Include hospitalId
      if (currentHospitalId) {
        params.hospitalId = currentHospitalId;
      }
      
      if (!params.hospitalId) {
        console.warn('No hospital selected. Please select a hospital from the dropdown.');
        setLoading(false);
        return;
      }
      
      const response = await api.get('/medicines', { params });
      // Handle paginated response
      const medicineList = response.data?.data || response.data || [];
      setMedicines(medicineList);

      // Fetch stats
      try {
        const statsParams: any = {};
        if (currentHospitalId) {
          statsParams.hospitalId = currentHospitalId;
        }
        const statsResponse = await api.get('/medicines/stats', { params: statsParams });
        setStats(statsResponse.data);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    } catch (error: any) {
      console.error('Error fetching medicines:', error);
      const errorMessage = error.response?.data?.message || 'Failed to fetch medicines';
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMedicine = async () => {
    if (!deleteMedicineModal) return;

    setIsDeleting(true);
    try {
      await api.delete(`/medicines/${deleteMedicineModal.id}`);
      await fetchMedicines();
      setDeleteMedicineModal(null);
    } catch (error: any) {
      console.error('Error deleting medicine:', error);
      const errorMessage = error.response?.data?.message || 'Failed to delete medicine';
      alert(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter medicines
  const filteredMedicines = medicines.filter((medicine) => {
    const matchesSearch =
      medicine.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (medicine.genericName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (medicine.manufacturer || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (medicine.strength || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesForm = selectedForm === 'all' || medicine.form === selectedForm;
    const matchesStatus = selectedStatus === 'all' || medicine.status === selectedStatus;

    return matchesSearch && matchesForm && matchesStatus;
  });

  const getFormBadgeColor = (form: string) => {
    const colors: { [key: string]: string } = {
      TABLET: 'bg-blue-500',
      CAPSULE: 'bg-green-500',
      SYRUP: 'bg-purple-500',
      INJECTION: 'bg-red-500',
      CREAM: 'bg-yellow-500',
      DROPS: 'bg-cyan-500',
      OINTMENT: 'bg-orange-500',
      POWDER: 'bg-pink-500',
      SUSPENSION: 'bg-indigo-500',
    };
    return colors[form] || 'bg-gray-500';
  };

  const formatFormName = (form: string) => {
    return form.charAt(0) + form.slice(1).toLowerCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading medicines...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Medicines</h1>
          <p className="text-muted-foreground">
            Manage medicines and pharmaceutical inventory
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchMedicines} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          {canManage && (
            <Button size="sm" onClick={() => setCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Medicine
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Medicines</CardTitle>
            <Pill className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Discontinued</CardTitle>
            <Activity className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.discontinued}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tablets</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.byForm?.TABLET || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by name, generic name, manufacturer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={selectedForm} onValueChange={setSelectedForm}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by form" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Forms</SelectItem>
            <SelectItem value="TABLET">Tablet</SelectItem>
            <SelectItem value="CAPSULE">Capsule</SelectItem>
            <SelectItem value="SYRUP">Syrup</SelectItem>
            <SelectItem value="INJECTION">Injection</SelectItem>
            <SelectItem value="CREAM">Cream</SelectItem>
            <SelectItem value="DROPS">Drops</SelectItem>
            <SelectItem value="OINTMENT">Ointment</SelectItem>
            <SelectItem value="POWDER">Powder</SelectItem>
            <SelectItem value="SUSPENSION">Suspension</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="DISCONTINUED">Discontinued</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Medicines Table */}
      <Card>
        <CardHeader>
          <CardTitle>Medicines List</CardTitle>
          <CardDescription>
            {filteredMedicines.length} {filteredMedicines.length === 1 ? 'medicine' : 'medicines'} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Generic Name</TableHead>
                <TableHead>Form</TableHead>
                <TableHead>Strength</TableHead>
                <TableHead>Manufacturer</TableHead>
                <TableHead>Stock Batches</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMedicines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No medicines found
                  </TableCell>
                </TableRow>
              ) : (
                filteredMedicines.map((medicine) => (
                  <TableRow key={medicine.id}>
                    <TableCell className="font-medium">{medicine.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {medicine.genericName || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getFormBadgeColor(medicine.form)} text-white`}>
                        {formatFormName(medicine.form)}
                      </Badge>
                    </TableCell>
                    <TableCell>{medicine.strength || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {medicine.manufacturer || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{medicine._count?.stockBatches || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={medicine.status === 'ACTIVE' ? 'default' : 'secondary'}
                        className={
                          medicine.status === 'ACTIVE'
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-400 text-white'
                        }
                      >
                        {medicine.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewMedicineModal(medicine)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {canManage && canModify && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditMedicineModal(medicine)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteMedicineModal(medicine)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-sm text-muted-foreground text-center">
        Showing {filteredMedicines.length} of {medicines.length} medicines
      </div>

      {/* Create Medicine Modal */}
      <CreateMedicineModal
        isOpen={createModalOpen}
        hospital={currentHospital}
        onClose={() => setCreateModalOpen(false)}
        onMedicineCreated={fetchMedicines}
      />

      {/* Edit Medicine Modal */}
      <EditMedicineModal
        medicine={editMedicineModal}
        onClose={() => setEditMedicineModal(null)}
        onMedicineUpdated={fetchMedicines}
      />

      {/* View Medicine Modal */}
      <Dialog open={!!viewMedicineModal} onOpenChange={(open) => !open && setViewMedicineModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Medicine Details</DialogTitle>
            <DialogDescription>View complete medicine information</DialogDescription>
          </DialogHeader>
          {viewMedicineModal && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Name</p>
                <p className="text-lg font-semibold">{viewMedicineModal.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Generic Name</p>
                <p>{viewMedicineModal.genericName || 'N/A'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Form</p>
                  <Badge className={`${getFormBadgeColor(viewMedicineModal.form)} text-white mt-1`}>
                    {formatFormName(viewMedicineModal.form)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Strength</p>
                  <p>{viewMedicineModal.strength || 'N/A'}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Manufacturer</p>
                <p>{viewMedicineModal.manufacturer || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge
                  variant={viewMedicineModal.status === 'ACTIVE' ? 'default' : 'secondary'}
                  className={
                    viewMedicineModal.status === 'ACTIVE'
                      ? 'bg-green-500 text-white mt-1'
                      : 'bg-gray-400 text-white mt-1'
                  }
                >
                  {viewMedicineModal.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Stock Batches</p>
                <p>{viewMedicineModal._count?.stockBatches || 0} batches</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewMedicineModal(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Medicine Modal */}
      <Dialog open={!!deleteMedicineModal} onOpenChange={(open) => !open && setDeleteMedicineModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Medicine</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this medicine? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteMedicineModal && (
            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="font-semibold">{deleteMedicineModal.name}</p>
              <p className="text-sm text-muted-foreground">
                {deleteMedicineModal.genericName || 'No generic name'} • {formatFormName(deleteMedicineModal.form)}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteMedicineModal(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteMedicine}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Medicine'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
