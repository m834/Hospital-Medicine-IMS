/**
 * Hospital Users Modal
 * View and manage all users assigned to a specific hospital
 */

'use client';

import { useState, useEffect } from 'react';
import { X, Users, Mail, Phone, Shield, Loader2, UserPlus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api, { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { AddUserModal } from './add-user-modal';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  phone: string | null;
  status: string;
  lastLogin: string | null;
  createdAt: string;
}

interface Hospital {
  id: string;
  name: string;
  code: string;
}

interface HospitalUsersModalProps {
  isOpen: boolean;
  hospital: Hospital | null;
  onClose: () => void;
}

export function HospitalUsersModal({ isOpen, hospital, onClose }: HospitalUsersModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen && hospital) {
      fetchUsers();
      setSearchQuery('');
      setError(null);
    }
  }, [isOpen, hospital]);

  const fetchUsers = async () => {
    if (!hospital) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.get(`/hospitals/${hospital.id}/users`);
      setUsers(response.data || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      SUPER_ADMIN: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      HOSPITAL_ADMIN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      MAIN_PHARMACY_MANAGER: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      SUB_PHARMACY_MANAGER: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      DOCTOR: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
      DOCTOR_ASSISTANT: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      REGISTRATION_STAFF: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
      PHARMACY_STAFF: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
      AUDITOR: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };
    return colors[role] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
  };

  const formatRoleName = (role: string) => {
    return role.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen || !hospital) return null;

  const filteredUsers = users.filter(
    (user) =>
      user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-scale-in">
          {/* Header */}
          <div className="sticky top-0 z-10 border-b border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Hospital Users</h2>
                  <p className="text-sm text-muted-foreground">
                    {hospital.name} ({hospital.code})
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search and Actions */}
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Search by name, email, or role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <Button onClick={() => setIsAddUserModalOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </div>

            {/* Stats */}
            <div className="mt-4 flex items-center gap-6">
              <div>
                <p className="text-2xl font-bold text-foreground">{users.length}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {users.filter((u) => u.status === 'ACTIVE').length}
                </p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">
                  {users.filter((u) => u.status === 'INACTIVE').length}
                </p>
                <p className="text-xs text-muted-foreground">Inactive</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 280px)' }}>
            {error && (
              <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-sm text-muted-foreground">Loading users...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="rounded-lg border border-border bg-muted/50 p-12 text-center">
                <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  {searchQuery ? 'No users found' : 'No users assigned'}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {searchQuery
                    ? 'Try adjusting your search query'
                    : 'This hospital has no users assigned yet'}
                </p>
                {!searchQuery && (
                  <Button className="mt-4" onClick={() => setIsAddUserModalOpen(true)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add First User
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="group rounded-lg border border-border bg-background p-4 transition-all hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      {/* User Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {user.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{user.fullName}</h3>
                            <div className="mt-1 flex items-center gap-4">
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                <span>{user.email}</span>
                              </div>
                              {user.phone && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  <span>{user.phone}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Role and Status */}
                        <div className="mt-3 flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <Shield className="h-3 w-3 text-muted-foreground" />
                            <span className={cn('rounded-full px-2 py-1 text-xs font-medium', getRoleBadgeColor(user.role))}>
                              {formatRoleName(user.role)}
                            </span>
                          </div>
                          <span
                            className={cn(
                              'rounded-full px-2 py-1 text-xs font-medium',
                              user.status === 'ACTIVE'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            )}
                          >
                            {user.status}
                          </span>
                        </div>

                        {/* Additional Info */}
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Last login: {formatDate(user.lastLogin)}</span>
                          <span>•</span>
                          <span>Joined: {formatDate(user.createdAt)}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 border-t border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {filteredUsers.length} of {users.length} users
              </p>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      <AddUserModal
        isOpen={isAddUserModalOpen}
        hospital={hospital}
        onClose={() => setIsAddUserModalOpen(false)}
        onUserAdded={() => {
          fetchUsers(); // Refresh user list
          setIsAddUserModalOpen(false);
        }}
      />
    </>
  );
}
