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
import { Search, UserPlus, Eye, Edit, Trash2, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { useHospitalStore } from '@/stores/hospital.store';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@/lib/constants';
import { canModifyResources } from '@/lib/permissions';
import { EditUserModal } from '@/components/modals/edit-user-modal';
import { AddUserModal } from '@/components/modals/add-user-modal';

interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  hospitalId: string;
  pharmacyId?: string;
  hospital?: {
    id: string;
    name: string;
    code: string;
  };
  pharmacy?: {
    id: string;
    name: string;
    code: string;
    type: 'MAIN' | 'SUB';
    locationWard?: string;
    status: string;
  };
  createdAt: string;
}

interface Hospital {
  id: string;
  name: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');

  // Modal states
  const [viewUserModal, setViewUserModal] = useState<User | null>(null);
  const [editUserModal, setEditUserModal] = useState<User | null>(null);
  const [deleteUserModal, setDeleteUserModal] = useState<User | null>(null);
  const [addUserModal, setAddUserModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get selected hospital from store (for Super Admin)
  const { selectedHospital } = useHospitalStore();
  const { user } = useAuthStore();

  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
  const canModify = user?.role ? canModifyResources(user.role as UserRole) : false;

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHospital]); // Re-fetch when hospital selection changes

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let allUsers: User[] = [];

      if (isSuperAdmin) {
        // Super Admin: Filter by selected hospital or show all
        if (selectedHospital) {
          // Fetch users for selected hospital only
          const response = await api.get(`/hospitals/${selectedHospital.id}/users`);
          const users = response.data || [];
          allUsers = users.map((user: any) => ({
            ...user,
            hospital: {
              id: selectedHospital.id,
              name: selectedHospital.name,
            },
          }));
        } else {
          // Fetch users from all hospitals
          const hospitalsRes = await api.get('/hospitals');
          const allHospitals = hospitalsRes.data || [];
          setHospitals(allHospitals);

          const userPromises = allHospitals.map(async (hospital: Hospital) => {
            try {
              const response = await api.get(`/hospitals/${hospital.id}/users`);
              const users = response.data || [];
              return users.map((user: any) => ({
                ...user,
                hospital: {
                  id: hospital.id,
                  name: hospital.name,
                },
              }));
            } catch (error) {
              console.error(`Failed to fetch users for hospital ${hospital.name}:`, error);
              return [];
            }
          });

          const userArrays = await Promise.all(userPromises);
          allUsers = userArrays.flat();
        }
      } else {
        // Hospital Admin or other roles: Only their hospital
        if (user?.hospitalId) {
          const response = await api.get(`/hospitals/${user.hospitalId}/users`);
          const users = response.data || [];
          allUsers = users.map((u: any) => ({
            ...u,
            hospital: {
              id: user.hospitalId,
              name: (user as any).hospitalName || 'My Hospital',
            },
          }));
        }
      }

      setUsers(allUsers);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserModal) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`http://localhost:3001/api/v1/users/${deleteUserModal.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      // Refresh users list
      await fetchUsers();
      setDeleteUserModal(null);
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.hospital?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = selectedRole === 'all' || user.role === selectedRole;

    return matchesSearch && matchesRole;
  });

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      SUPER_ADMIN: 'bg-purple-500',
      HOSPITAL_ADMIN: 'bg-blue-500',
      MAIN_PHARMACY_MANAGER: 'bg-green-500',
      SUB_PHARMACY_MANAGER: 'bg-teal-500',
      DOCTOR: 'bg-cyan-500',
      DOCTOR_ASSISTANT: 'bg-sky-500',
      REGISTRATION_STAFF: 'bg-orange-500',
      PHARMACY_STAFF: 'bg-yellow-500',
      AUDITOR: 'bg-gray-500',
    };
    return colors[role] || 'bg-gray-500';
  };

  const formatRole = (role: string) => {
    return role
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Users Management</h1>
          <p className="text-muted-foreground mt-1">
            {isSuperAdmin && selectedHospital
              ? `Viewing users for ${selectedHospital.name}`
              : isSuperAdmin
              ? 'Viewing all users across all hospitals'
              : 'Manage users in your hospital'}
          </p>
        </div>
        <Button onClick={() => setAddUserModal(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 border rounded-lg bg-card">
          <p className="text-sm text-muted-foreground">Total Users</p>
          <p className="text-2xl font-bold mt-1">{users.length}</p>
        </div>
        <div className="p-4 border rounded-lg bg-card">
          <p className="text-sm text-muted-foreground">Active Users</p>
          <p className="text-2xl font-bold mt-1">
            {users.filter((u) => u.status === 'ACTIVE').length}
          </p>
        </div>
        <div className="p-4 border rounded-lg bg-card">
          <p className="text-sm text-muted-foreground">Hospitals</p>
          <p className="text-2xl font-bold mt-1">{hospitals.length}</p>
        </div>
        <div className="p-4 border rounded-lg bg-card">
          <p className="text-sm text-muted-foreground">Admins</p>
          <p className="text-2xl font-bold mt-1">
            {users.filter((u) => u.role.includes('ADMIN')).length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by name, email, or hospital..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          onClick={fetchUsers}
          className="w-full md:w-auto"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
        <Select value={selectedRole} onValueChange={setSelectedRole}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="HOSPITAL_ADMIN">Hospital Admin</SelectItem>
            <SelectItem value="MAIN_PHARMACY_MANAGER">Main Pharmacy Manager</SelectItem>
            <SelectItem value="SUB_PHARMACY_MANAGER">Sub Pharmacy Manager</SelectItem>
            <SelectItem value="DOCTOR">Doctor</SelectItem>
            <SelectItem value="DOCTOR_ASSISTANT">Doctor Assistant</SelectItem>
            <SelectItem value="REGISTRATION_STAFF">Registration Staff</SelectItem>
            <SelectItem value="PHARMACY_STAFF">Pharmacy Staff</SelectItem>
            <SelectItem value="AUDITOR">Auditor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Hospital</TableHead>
              <TableHead>Pharmacy</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading users...
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.fullName}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge className={getRoleBadgeColor(user.role)}>
                      {formatRole(user.role)}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.hospital?.name || 'N/A'}</TableCell>
                  <TableCell>
                    {user.pharmacy ? (
                      <div className="text-sm">
                        <div>{user.pharmacy.name}</div>
                        <div className="text-muted-foreground">
                          ({user.pharmacy.type})
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.status === 'ACTIVE' ? 'default' : 'secondary'}
                    >
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setViewUserModal(user)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {canModify && (
                        <>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setEditUserModal(user)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setDeleteUserModal(user)}
                          >
                            <Trash2 className="w-4 h-4" />
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
      </div>

      {/* Pagination info */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredUsers.length} of {users.length} users
      </div>

      {/* View User Modal */}
      <Dialog open={!!viewUserModal} onOpenChange={(open) => !open && setViewUserModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              View user information
            </DialogDescription>
          </DialogHeader>
          {viewUserModal && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Full Name</label>
                <p className="text-sm text-muted-foreground">{viewUserModal.fullName}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <p className="text-sm text-muted-foreground">{viewUserModal.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <div className="text-sm text-muted-foreground">
                  <Badge className={getRoleBadgeColor(viewUserModal.role)}>
                    {formatRole(viewUserModal.role)}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Hospital</label>
                <p className="text-sm text-muted-foreground">
                  {viewUserModal.hospital?.name || 'N/A'}
                </p>
              </div>
              {viewUserModal.pharmacy && (
                <div>
                  <label className="text-sm font-medium">Pharmacy</label>
                  <p className="text-sm text-muted-foreground">
                    {viewUserModal.pharmacy.name} ({viewUserModal.pharmacy.type})
                  </p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium">Status</label>
                <div className="text-sm text-muted-foreground">
                  <Badge variant={viewUserModal.status === 'ACTIVE' ? 'default' : 'secondary'}>
                    {viewUserModal.status}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Created At</label>
                <p className="text-sm text-muted-foreground">
                  {new Date(viewUserModal.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewUserModal(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <EditUserModal
        user={editUserModal}
        onClose={() => setEditUserModal(null)}
        onUserUpdated={fetchUsers}
      />

      {/* Add User Modal */}
      <AddUserModal
        isOpen={addUserModal}
        hospital={
          isSuperAdmin
            ? selectedHospital
              ? { id: selectedHospital.id, name: selectedHospital.name, code: selectedHospital.code || '' }
              : null
            : user?.hospitalId
            ? { id: user.hospitalId, name: (user as any).hospitalName || 'My Hospital', code: '' }
            : null
        }
        onClose={() => setAddUserModal(false)}
        onUserAdded={fetchUsers}
      />

      {/* Delete User Confirmation */}
      <Dialog open={!!deleteUserModal} onOpenChange={(open) => !open && setDeleteUserModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteUserModal && (
            <div className="space-y-2">
              <p className="text-sm">
                <strong>Name:</strong> {deleteUserModal.fullName}
              </p>
              <p className="text-sm">
                <strong>Email:</strong> {deleteUserModal.email}
              </p>
              <p className="text-sm">
                <strong>Role:</strong> {formatRole(deleteUserModal.role)}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteUserModal(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteUser}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
