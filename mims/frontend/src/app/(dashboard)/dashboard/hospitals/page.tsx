/**
 * Hospitals Management Page
 * Super Admin view to manage all hospitals in the system
 */

'use client';

import { useState, useEffect } from 'react';
import { Building2, Plus, Edit, Trash2, Users, MapPin, Phone, Mail, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CreateHospitalModal } from '@/components/modals/create-hospital-modal';
import { EditHospitalModal } from '@/components/modals/edit-hospital-modal';
import { DeleteHospitalDialog } from '@/components/modals/delete-hospital-dialog';
import { HospitalUsersModal } from '@/components/modals/hospital-users-modal';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { canModifyResources } from '@/lib/permissions';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@/lib/constants';

interface Hospital {
  id: string;
  name: string;
  code: string;
  address: string;
  city?: string;
  phone: string;
  email: string;
  status: string;
  createdAt: string;
  _count?: {
    users: number;
    pharmacies: number;
    patients: number;
  };
}

export default function HospitalsPage() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [mounted, setMounted] = useState(false);
  const { user } = useAuthStore();
  const canModify = user?.role ? canModifyResources(user.role as UserRole) : false;

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch hospitals
  const fetchHospitals = async () => {
    setLoading(true);
    try {
      const response = await api.get('/hospitals');
      setHospitals(response.data || []);
    } catch (error) {
      console.error('[Hospitals] Failed to fetch hospitals:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHospitals();
  }, []);

  // Filter hospitals by search query
  const filteredHospitals = hospitals.filter(
    (hospital) =>
      hospital.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hospital.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hospital.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Hospitals</h1>
          <p className="text-sm text-muted-foreground">Manage all hospitals in the system</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Hospital
        </Button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search hospitals by name, code, or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Hospitals</p>
              <p className="text-2xl font-bold text-foreground">{hospitals.length}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-500/10 p-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Hospitals</p>
              <p className="text-2xl font-bold text-foreground">
                {hospitals.filter((h) => h.status === 'ACTIVE').length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-500/10 p-2">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Inactive Hospitals</p>
              <p className="text-2xl font-bold text-foreground">
                {hospitals.filter((h) => h.status === 'INACTIVE').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Hospitals Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      ) : filteredHospitals.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">No hospitals found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {searchQuery ? 'Try adjusting your search query' : 'Get started by creating a new hospital'}
          </p>
          {!searchQuery && (
            <Button onClick={() => setIsCreateModalOpen(true)} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Create Hospital
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredHospitals.map((hospital, index) => (
            <div
              key={hospital.id}
              className="group rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md"
              style={
                mounted
                  ? {
                      animation: 'fadeIn 0.3s ease-in-out',
                      animationDelay: `${index * 50}ms`,
                      animationFillMode: 'both',
                    }
                  : undefined
              }
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{hospital.name}</h3>
                    <p className="text-sm text-muted-foreground">{hospital.code}</p>
                  </div>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2 py-1 text-xs font-medium',
                    hospital.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  )}
                >
                  {hospital.status}
                </span>
              </div>

              {/* Details */}
              <div className="mt-4 space-y-2">
                {hospital.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {hospital.address}
                      {hospital.city && `, ${hospital.city}`}
                    </p>
                  </div>
                )}
                {hospital.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{hospital.phone}</p>
                  </div>
                )}
                {hospital.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{hospital.email}</p>
                  </div>
                )}
              </div>

              {/* Stats */}
              {hospital._count && (
                <div className="mt-4 flex items-center gap-4 border-t border-border pt-4">
                  <div className="text-center">
                    <p className="text-lg font-semibold text-foreground">{hospital._count.users || 0}</p>
                    <p className="text-xs text-muted-foreground">Users</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-foreground">{hospital._count.pharmacies || 0}</p>
                    <p className="text-xs text-muted-foreground">Pharmacies</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-foreground">{hospital._count.patients || 0}</p>
                    <p className="text-xs text-muted-foreground">Patients</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 flex items-center gap-2">
                {canModify && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setSelectedHospital(hospital);
                      setIsEditModalOpen(true);
                    }}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setSelectedHospital(hospital);
                    setIsUsersModalOpen(true);
                  }}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Users
                </Button>
                {canModify && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedHospital(hospital);
                      setIsDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Hospital Modal */}
      <CreateHospitalModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        existingCodes={hospitals.map((hospital) => hospital.code)}
        onSuccess={() => {
          fetchHospitals();
          console.log('[Hospitals] Hospital created successfully');
        }}
      />

      {/* Edit Hospital Modal */}
      <EditHospitalModal
        isOpen={isEditModalOpen}
        hospital={selectedHospital}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedHospital(null);
        }}
        onSuccess={() => {
          fetchHospitals();
          console.log('[Hospitals] Hospital updated successfully');
        }}
      />

      {/* Delete Hospital Dialog */}
      <DeleteHospitalDialog
        isOpen={isDeleteDialogOpen}
        hospital={selectedHospital}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setSelectedHospital(null);
        }}
        onSuccess={() => {
          fetchHospitals();
          console.log('[Hospitals] Hospital deleted successfully');
        }}
      />

      {/* Hospital Users Modal */}
      <HospitalUsersModal
        isOpen={isUsersModalOpen}
        hospital={selectedHospital}
        onClose={() => {
          setIsUsersModalOpen(false);
          setSelectedHospital(null);
        }}
      />
    </div>
  );
}
