/**
 * Add User Modal
 * Create a new user and assign them to a hospital
 */

'use client';

import { useState, useEffect } from 'react';
import { X, UserPlus, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api, { getErrorMessage } from '@/lib/api';

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
}

interface AddUserModalProps {
  isOpen: boolean;
  hospital: Hospital | null;
  onClose: () => void;
  onUserAdded: () => void;
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

export function AddUserModal({ isOpen, hospital, onClose, onUserAdded }: AddUserModalProps) {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loadingPharmacies, setLoadingPharmacies] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    role: '',
    pharmacyId: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && hospital) {
      resetForm();
      fetchPharmacies();
    }
  }, [isOpen, hospital]);

  const fetchPharmacies = async () => {
    if (!hospital) return;

    setLoadingPharmacies(true);
    try {
      // Assuming there's an endpoint to get pharmacies by hospital
      const response = await api.get(`/pharmacies?hospitalId=${hospital.id}`);
      setPharmacies(response.data || []);
    } catch (err) {
      console.error('Failed to fetch pharmacies:', err);
      setPharmacies([]);
    } finally {
      setLoadingPharmacies(false);
    }
  };

  const resetForm = () => {
    setFormData({
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      phone: '',
      role: '',
      pharmacyId: '',
    });
    setErrors({});
    setShowPassword(false);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Full Name
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters';
    }

    // Email
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please provide a valid email address';
    }

    // Password
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]/.test(formData.password)
    ) {
      newErrors.password =
        'Password must contain uppercase, lowercase, number, and special character';
    }

    // Confirm Password
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // Phone (optional but validate format if provided)
    if (formData.phone && !/^\+?[1-9]\d{1,14}$/.test(formData.phone)) {
      newErrors.phone = 'Please provide a valid phone number';
    }

    // Role
    if (!formData.role) {
      newErrors.role = 'Role is required';
    }

    // Pharmacy (if required for selected role)
    const selectedRole = USER_ROLES.find((r) => r.value === formData.role);
    if (selectedRole?.requiresPharmacy && !formData.pharmacyId) {
      newErrors.pharmacyId = 'Pharmacy is required for this role';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !hospital) return;

    setLoading(true);

    try {
      const payload: any = {
        email: formData.email.trim(),
        password: formData.password,
        fullName: formData.fullName.trim(),
        role: formData.role,
      };

      if (formData.phone) {
        payload.phone = formData.phone;
      }

      if (formData.pharmacyId) {
        payload.pharmacyId = formData.pharmacyId;
      }

      await api.post(`/hospitals/${hospital.id}/users`, payload);

      alert('User created successfully');

      onUserAdded();
      onClose();
    } catch (err) {
      alert(`Error: ${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !hospital) return null;

  const selectedRole = USER_ROLES.find((r) => r.value === formData.role);
  const availablePharmacies = selectedRole?.pharmacyType
    ? pharmacies.filter((p) => p.type === selectedRole.pharmacyType)
    : pharmacies;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-scale-in">
          {/* Header */}
          <div className="sticky top-0 z-10 border-b border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <UserPlus className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Add New User</h2>
                  <p className="text-sm text-muted-foreground">
                    Create a user for {hospital.name} ({hospital.code})
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
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 180px)' }}>
              <div className="space-y-4">
                {/* Row 1: Full Name & Email */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">
                      Full Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="fullName"
                      placeholder="John Doe"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className={errors.fullName ? 'border-destructive' : ''}
                    />
                    {errors.fullName && (
                      <p className="text-xs text-destructive">{errors.fullName}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">
                      Email <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john.doe@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={errors.email ? 'border-destructive' : ''}
                    />
                    {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                  </div>
                </div>

                {/* Row 2: Password & Confirm Password */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="password">
                      Password <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-xs text-destructive">{errors.password}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">
                      Confirm Password <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData({ ...formData, confirmPassword: e.target.value })
                      }
                      className={errors.confirmPassword ? 'border-destructive' : ''}
                    />
                    {errors.confirmPassword && (
                      <p className="text-xs text-destructive">{errors.confirmPassword}</p>
                    )}
                  </div>
                </div>

                {/* Row 3: Phone & Role */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone (Optional)</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1234567890"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className={errors.phone ? 'border-destructive' : ''}
                    />
                    {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">
                      Role <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) =>
                        setFormData({ ...formData, role: value, pharmacyId: '' })
                      }
                    >
                      <SelectTrigger className={errors.role ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {USER_ROLES.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.role && <p className="text-xs text-destructive">{errors.role}</p>}
                  </div>
                </div>

                {/* Row 4: Pharmacy (conditional) */}
                {selectedRole?.requiresPharmacy && (
                  <div className="space-y-2">
                    <Label htmlFor="pharmacy">
                      Pharmacy Assignment <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.pharmacyId}
                      onValueChange={(value) => setFormData({ ...formData, pharmacyId: value })}
                      disabled={loadingPharmacies}
                    >
                      <SelectTrigger className={errors.pharmacyId ? 'border-destructive' : ''}>
                        <SelectValue
                          placeholder={
                            loadingPharmacies
                              ? 'Loading pharmacies...'
                              : `Select ${selectedRole.pharmacyType?.toLowerCase() || ''} pharmacy`
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePharmacies.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground">
                            No {selectedRole.pharmacyType?.toLowerCase()} pharmacies available
                          </div>
                        ) : (
                          availablePharmacies.map((pharmacy) => (
                            <SelectItem key={pharmacy.id} value={pharmacy.id}>
                              {pharmacy.name} ({pharmacy.code}) - {pharmacy.type}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {errors.pharmacyId && (
                      <p className="text-xs text-destructive">{errors.pharmacyId}</p>
                    )}
                  </div>
                )}

                {/* Info Box */}
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
                  <p className="text-xs text-blue-900 dark:text-blue-400">
                    <strong>Note:</strong> The user will be automatically assigned to{' '}
                    <strong>{hospital.name}</strong>. They will receive login credentials via email.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 border-t border-border bg-card p-4">
              <div className="flex items-center justify-end gap-3">
                <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Create User
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
