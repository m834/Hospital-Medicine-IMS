/**
 * Edit User Modal
 * Update user information with form validation
 */

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';

interface Hospital {
  id: string;
  name: string;
  code: string;
}

interface Pharmacy {
  id: string;
  name: string;
  code: string;
  type: 'MAIN' | 'SUB';
  locationWard?: string;
  status: string;
}

interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  hospitalId: string;
  pharmacyId?: string;
  hospital?: Hospital;
  pharmacy?: Pharmacy;
  createdAt: string;
}

interface EditUserModalProps {
  user: User | null;
  onClose: () => void;
  onUserUpdated: () => void;
}

const USER_ROLES = [
  { value: 'HOSPITAL_ADMIN', label: 'Hospital Admin', requiresPharmacy: false },
  { value: 'MAIN_PHARMACY_MANAGER', label: 'Main Pharmacy Manager', requiresPharmacy: true, pharmacyType: 'MAIN' },
  { value: 'SUB_PHARMACY_MANAGER', label: 'Sub-Pharmacy Manager', requiresPharmacy: true, pharmacyType: 'SUB' },
  { value: 'DOCTOR', label: 'Doctor', requiresPharmacy: false },
  { value: 'DOCTOR_ASSISTANT', label: 'Doctor Assistant', requiresPharmacy: false },
  { value: 'REGISTRATION_STAFF', label: 'Registration Staff', requiresPharmacy: false },
  { value: 'PHARMACY_STAFF', label: 'Pharmacy Staff', requiresPharmacy: true },
  { value: 'AUDITOR', label: 'Auditor', requiresPharmacy: false },
];

const USER_STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

// Validation schema
const editUserSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  role: z.string().min(1, 'Role is required'),
  status: z.string().min(1, 'Status is required'),
  pharmacyId: z.string().optional(),
});

type EditUserFormData = z.infer<typeof editUserSchema>;

export function EditUserModal({ user, onClose, onUserUpdated }: EditUserModalProps) {
  const [loading, setLoading] = useState(false);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loadingPharmacies, setLoadingPharmacies] = useState(false);

  const form = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      role: '',
      status: '',
      pharmacyId: '',
    },
  });

  const selectedRole = form.watch('role');
  const roleConfig = USER_ROLES.find((r) => r.value === selectedRole);
  const requiresPharmacy = roleConfig?.requiresPharmacy || false;

  useEffect(() => {
    if (user) {
      // Populate form with user data
      form.reset({
        fullName: user.fullName,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        status: user.status,
        pharmacyId: user.pharmacyId || '',
      });

      // Fetch pharmacies for the user's hospital
      fetchPharmacies(user.hospitalId);
    }
  }, [user]);

  const fetchPharmacies = async (hospitalId: string) => {
    setLoadingPharmacies(true);
    try {
      const response = await api.get(`/pharmacies?hospitalId=${hospitalId}`);
      const allPharmacies = response.data || [];
      
      // Filter pharmacies based on role if needed
      if (roleConfig?.pharmacyType) {
        setPharmacies(allPharmacies.filter((p: Pharmacy) => 
          p.type === roleConfig.pharmacyType && p.status === 'ACTIVE'
        ));
      } else {
        setPharmacies(allPharmacies.filter((p: Pharmacy) => p.status === 'ACTIVE'));
      }
    } catch (err) {
      console.error('Failed to fetch pharmacies:', err);
      setPharmacies([]);
    } finally {
      setLoadingPharmacies(false);
    }
  };

  // Re-fetch pharmacies when role changes
  useEffect(() => {
    if (user?.hospitalId && selectedRole) {
      fetchPharmacies(user.hospitalId);
      
      // Clear pharmacy selection if role doesn't require it
      if (!requiresPharmacy) {
        form.setValue('pharmacyId', '');
      }
    }
  }, [selectedRole]);

  const onSubmit = async (data: EditUserFormData) => {
    if (!user) return;

    setLoading(true);
    try {
      const updateData: any = {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone || undefined,
        role: data.role,
        status: data.status,
      };

      // Only include pharmacyId if role requires it
      if (requiresPharmacy && data.pharmacyId) {
        updateData.pharmacyId = data.pharmacyId;
      } else {
        updateData.pharmacyId = null;
      }

      await api.patch(`/users/${user.id}`, updateData);

      onUserUpdated();
      onClose();
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to update user';
      console.error('Error updating user:', errorMessage);
      
      // Show error in form
      form.setError('root', {
        type: 'manual',
        message: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user information and permissions
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Full Name */}
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="john@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Phone */}
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="+880 1234-567890" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Role */}
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {USER_ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Pharmacy Assignment (conditional) */}
            {requiresPharmacy && (
              <FormField
                control={form.control}
                name="pharmacyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pharmacy</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={loadingPharmacies}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={
                            loadingPharmacies 
                              ? "Loading pharmacies..." 
                              : "Select a pharmacy"
                          } />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {pharmacies.length === 0 ? (
                          <SelectItem value="none" disabled>
                            No pharmacies available
                          </SelectItem>
                        ) : (
                          pharmacies.map((pharmacy) => (
                            <SelectItem key={pharmacy.id} value={pharmacy.id}>
                              {pharmacy.name} ({pharmacy.type})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {roleConfig?.pharmacyType 
                        ? `Select a ${roleConfig.pharmacyType} pharmacy`
                        : 'Select the pharmacy this user will manage'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Status */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {USER_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Hospital Info (read-only) */}
            {user?.hospital && (
              <div className="rounded-lg border p-3 bg-muted/50">
                <p className="text-sm font-medium">Hospital</p>
                <p className="text-sm text-muted-foreground">
                  {user.hospital.name} ({user.hospital.code})
                </p>
              </div>
            )}

            {/* Form-level error */}
            {form.formState.errors.root && (
              <div className="rounded-lg border border-destructive p-3 bg-destructive/10">
                <p className="text-sm text-destructive">
                  {form.formState.errors.root.message}
                </p>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
