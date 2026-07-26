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
import { Search, Plus, Eye, Edit, Trash2, RefreshCw, Building2, Store, CornerDownRight } from 'lucide-react';
import api from '@/lib/api';
import { useHospitalStore } from '@/stores/hospital.store';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@/lib/constants';
import { canModifyResources } from '@/lib/permissions';
import { CreatePharmacyModal } from '@/components/modals/create-pharmacy-modal';
import { EditPharmacyModal } from '@/components/modals/edit-pharmacy-modal';
import { ManageSubPharmaciesModal } from '@/components/modals/manage-sub-pharmacies-modal';

interface Pharmacy {
  id: string;
  name: string;
  code: string;
  type: 'MAIN' | 'SUB';
  parentPharmacyId?: string | null;
  locationWard?: string;
  status: string;
  hospitalId: string;
  hospital?: {
    id: string;
    name: string;
    code: string;
  };
  _count?: {
    stockBatches: number;
    subPharmacies?: number;
  };
  createdAt: string;
}

/** A pharmacy plus its nesting depth: 0 = main (or ungrouped), 1 = sub under a main. */
interface PharmacyRow {
  pharmacy: Pharmacy;
  depth: number;
}

interface PharmacyStats {
  total: number;
  main: number;
  sub: number;
  active: number;
  inactive: number;
}

export default function PharmaciesPage() {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [stats, setStats] = useState<PharmacyStats>({
    total: 0,
    main: 0,
    sub: 0,
    active: 0,
    inactive: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [manageSubsForPharmacy, setManageSubsForPharmacy] = useState<Pharmacy | null>(null);
  const [viewPharmacyModal, setViewPharmacyModal] = useState<Pharmacy | null>(null);
  const [editPharmacyModal, setEditPharmacyModal] = useState<Pharmacy | null>(null);
  const [deletePharmacyModal, setDeletePharmacyModal] = useState<Pharmacy | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { selectedHospital } = useHospitalStore();
  const { user } = useAuthStore();

  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
  const canModify = user?.role ? canModifyResources(user.role as UserRole) : false;
  const canAddPharmacy = user?.role === UserRole.SUPER_ADMIN ||
    user?.role === UserRole.MASTER_ADMIN ||
    user?.role === UserRole.HOSPITAL_ADMIN;
  // Mirrors the backend guard on PATCH /pharmacies/:id, which allows
  // SUPER_ADMIN and HOSPITAL_ADMIN in addition to MASTER_ADMIN.
  const canEditPharmacy = canModify ||
    user?.role === UserRole.SUPER_ADMIN ||
    user?.role === UserRole.HOSPITAL_ADMIN;

  // Determine current hospital for create modal
  const currentHospital = selectedHospital || (user?.hospitalId ? {
    id: user.hospitalId,
    name: 'My Hospital', // Will be fetched from API if needed
    code: 'HOSP',
  } : null);

  useEffect(() => {
    fetchPharmacies();
  }, [selectedHospital, user]);

  const fetchPharmacies = async () => {
    setLoading(true);
    try {
      let allPharmacies: Pharmacy[] = [];

      if (isSuperAdmin && !selectedHospital) {
        // Fetch all pharmacies for all hospitals
        const response = await api.get('/pharmacies');
        allPharmacies = response.data || [];
      } else if (isSuperAdmin && selectedHospital) {
        // Fetch pharmacies for selected hospital
        const response = await api.get(`/pharmacies?hospitalId=${selectedHospital.id}`);
        allPharmacies = response.data || [];
      } else if (user?.hospitalId) {
        // Hospital Admin - fetch their hospital's pharmacies
        const response = await api.get(`/pharmacies?hospitalId=${user.hospitalId}`);
        allPharmacies = response.data || [];
      }

      setPharmacies(allPharmacies);
      calculateStats(allPharmacies);
    } catch (error) {
      console.error('Failed to fetch pharmacies:', error);
      setPharmacies([]);
      setStats({ total: 0, main: 0, sub: 0, active: 0, inactive: 0 });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (pharmacyList: Pharmacy[]) => {
    const stats = {
      total: pharmacyList.length,
      main: pharmacyList.filter(p => p.type === 'MAIN').length,
      sub: pharmacyList.filter(p => p.type === 'SUB').length,
      active: pharmacyList.filter(p => p.status === 'ACTIVE').length,
      inactive: pharmacyList.filter(p => p.status === 'INACTIVE').length,
    };
    setStats(stats);
  };

  const handleDeletePharmacy = async () => {
    if (!deletePharmacyModal) return;

    setIsDeleting(true);
    try {
      await api.delete(`/pharmacies/${deletePharmacyModal.id}`);
      await fetchPharmacies();
      setDeletePharmacyModal(null);
    } catch (error) {
      console.error('Error deleting pharmacy:', error);
      alert('Failed to delete pharmacy');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredPharmacies = pharmacies.filter((pharmacy) => {
    const matchesSearch =
      pharmacy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pharmacy.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (pharmacy.locationWard || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (pharmacy.hospital?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = selectedType === 'all' || pharmacy.type === selectedType;
    const matchesStatus = selectedStatus === 'all' || pharmacy.status === selectedStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  // Group the surviving rows: each main followed by its own subs, then anything
  // left over (parentless subs, or subs whose main was filtered out).
  const pharmacyRows: PharmacyRow[] = (() => {
    const rows: PharmacyRow[] = [];
    const emitted = new Set<string>();

    const mains = filteredPharmacies.filter(
      (p) => !p.parentPharmacyId && p.type === 'MAIN'
    );

    for (const main of mains) {
      rows.push({ pharmacy: main, depth: 0 });
      emitted.add(main.id);

      for (const sub of filteredPharmacies) {
        if (sub.parentPharmacyId === main.id) {
          rows.push({ pharmacy: sub, depth: 1 });
          emitted.add(sub.id);
        }
      }
    }

    for (const pharmacy of filteredPharmacies) {
      if (!emitted.has(pharmacy.id)) {
        rows.push({ pharmacy, depth: 0 });
      }
    }

    return rows;
  })();

  const getTypeBadgeColor = (type: string) => {
    return type === 'MAIN' ? 'bg-blue-500' : 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading pharmacies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pharmacies</h1>
          <p className="text-muted-foreground">
            {isSuperAdmin && !selectedHospital && 'Viewing all pharmacies across hospitals'}
            {isSuperAdmin && selectedHospital && `Viewing pharmacies for ${selectedHospital.name}`}
            {!isSuperAdmin && 'Manage pharmacies in your hospital'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchPharmacies} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <div className="relative group">
            {canAddPharmacy && (
            <Button 
              size="sm" 
              onClick={() => setCreateModalOpen(true)}
              disabled={!currentHospital}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Pharmacy
            </Button>
            )}
            {canAddPharmacy && !currentHospital && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-gray-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                Please select a hospital first
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pharmacies</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Main Pharmacies</CardTitle>
            <Building2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.main}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sub Pharmacies</CardTitle>
            <Store className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sub}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-500">{stats.inactive}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by name, code, location, or hospital..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="MAIN">Main Pharmacy</SelectItem>
            <SelectItem value="SUB">Sub Pharmacy</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Location/Ward</TableHead>
              {isSuperAdmin && <TableHead>Hospital</TableHead>}
              <TableHead>Stock Items</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pharmacyRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isSuperAdmin ? 8 : 7}
                  className="text-center py-8 text-muted-foreground"
                >
                  {searchTerm || selectedType !== 'all' || selectedStatus !== 'all'
                    ? 'No pharmacies found matching your filters'
                    : 'No pharmacies yet. Create your first pharmacy to get started.'}
                </TableCell>
              </TableRow>
            ) : (
              pharmacyRows.map(({ pharmacy, depth }) => (
                <TableRow
                  key={pharmacy.id}
                  className={depth > 0 ? 'bg-muted/30' : undefined}
                >
                  <TableCell className="font-medium">
                    <div
                      className="flex items-center gap-2"
                      style={{ paddingLeft: depth * 24 }}
                    >
                      {depth > 0 && (
                        <CornerDownRight className="w-4 h-4 shrink-0 text-muted-foreground" />
                      )}
                      {pharmacy.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {pharmacy.code}
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge className={getTypeBadgeColor(pharmacy.type)}>
                        {pharmacy.type}
                      </Badge>
                      {pharmacy.type === 'MAIN' && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {pharmacy._count?.subPharmacies ?? 0} sub
                          {(pharmacy._count?.subPharmacies ?? 0) === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {pharmacy.locationWard || (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  {isSuperAdmin && (
                    <TableCell>{pharmacy.hospital?.name || 'N/A'}</TableCell>
                  )}
                  <TableCell>
                    {pharmacy._count?.stockBatches || 0}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={pharmacy.status === 'ACTIVE' ? 'default' : 'secondary'}
                    >
                      {pharmacy.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      {canAddPharmacy && pharmacy.type === 'MAIN' && !pharmacy.parentPharmacyId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setManageSubsForPharmacy(pharmacy)}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add sub-pharmacy
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewPharmacyModal(pharmacy)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {canEditPharmacy && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditPharmacyModal(pharmacy)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                      {canModify && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletePharmacyModal(pharmacy)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination info */}
      <div className="text-sm text-muted-foreground">
        Showing {pharmacyRows.length} of {pharmacies.length} pharmacies
      </div>

      {/* Create Pharmacy Modal */}
      <CreatePharmacyModal
        isOpen={createModalOpen}
        hospital={currentHospital}
        onClose={() => setCreateModalOpen(false)}
        onPharmacyCreated={fetchPharmacies}
        existingCodes={pharmacies.map((pharmacy) => pharmacy.code)}
      />

      {/* Sub-Pharmacy Bundle Modal (tick existing pharmacies to nest them) */}
      <ManageSubPharmaciesModal
        mainPharmacy={manageSubsForPharmacy}
        allPharmacies={pharmacies}
        onClose={() => setManageSubsForPharmacy(null)}
        onSaved={fetchPharmacies}
      />

      {/* Edit Pharmacy Modal */}
      <EditPharmacyModal
        pharmacy={editPharmacyModal}
        mainPharmacies={pharmacies.filter(
          (p) => p.type === 'MAIN' && !p.parentPharmacyId
        )}
        onClose={() => setEditPharmacyModal(null)}
        onPharmacyUpdated={fetchPharmacies}
      />

      {/* View Pharmacy Modal */}
      <Dialog open={!!viewPharmacyModal} onOpenChange={(open) => !open && setViewPharmacyModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pharmacy Details</DialogTitle>
            <DialogDescription>
              View pharmacy information
            </DialogDescription>
          </DialogHeader>
          {viewPharmacyModal && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <p className="text-sm text-muted-foreground">{viewPharmacyModal.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Code</label>
                <p className="text-sm text-muted-foreground">{viewPharmacyModal.code}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <div className="text-sm text-muted-foreground">
                  <Badge className={getTypeBadgeColor(viewPharmacyModal.type)}>
                    {viewPharmacyModal.type}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Location/Ward</label>
                <p className="text-sm text-muted-foreground">
                  {viewPharmacyModal.locationWard || 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Hospital</label>
                <p className="text-sm text-muted-foreground">
                  {viewPharmacyModal.hospital?.name || 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Stock Items</label>
                <p className="text-sm text-muted-foreground">
                  {viewPharmacyModal._count?.stockBatches || 0} items
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <div className="text-sm text-muted-foreground">
                  <Badge variant={viewPharmacyModal.status === 'ACTIVE' ? 'default' : 'secondary'}>
                    {viewPharmacyModal.status}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Created At</label>
                <p className="text-sm text-muted-foreground">
                  {new Date(viewPharmacyModal.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewPharmacyModal(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Pharmacy Confirmation */}
      <Dialog open={!!deletePharmacyModal} onOpenChange={(open) => !open && setDeletePharmacyModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Pharmacy</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this pharmacy? This action will set its status to INACTIVE.
            </DialogDescription>
          </DialogHeader>
          {deletePharmacyModal && (
            <div className="space-y-2">
              <p className="text-sm">
                <strong>Name:</strong> {deletePharmacyModal.name}
              </p>
              <p className="text-sm">
                <strong>Code:</strong> {deletePharmacyModal.code}
              </p>
              <p className="text-sm">
                <strong>Type:</strong> {deletePharmacyModal.type}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeletePharmacyModal(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeletePharmacy}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Pharmacy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
