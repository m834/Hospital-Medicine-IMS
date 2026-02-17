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

interface Department {
  id: string;
  name: string;
  code: string;
}

interface SubDepartment {
  id: string;
  name: string;
  code: string;
  departmentId: string;
}

interface AddUserModalProps {
  isOpen: boolean;
  hospital: Hospital | null;
  onClose: () => void;
  onUserAdded: () => void;
}

const USER_ROLES = [
  { value: 'HOSPITAL_ADMIN', label: 'Hospital Admin', requiresPharmacy: false, requiresDepartment: false, pharmacyType: undefined },
  { value: 'DEPARTMENT_ADMIN', label: 'Department Admin', requiresPharmacy: false, requiresDepartment: true, pharmacyType: undefined },
  { value: 'MAIN_PHARMACY_MANAGER', label: 'Main Pharmacy Manager', requiresPharmacy: true, pharmacyType: 'MAIN' as const, requiresDepartment: false },
  { value: 'SUB_PHARMACY_MANAGER', label: 'Sub-Pharmacy Manager', requiresPharmacy: true, pharmacyType: 'SUB' as const, requiresDepartment: false },
  { value: 'PHARMACY_STAFF', label: 'Pharmacy Staff', requiresPharmacy: true, requiresDepartment: false, pharmacyType: undefined },
  { value: 'DOCTOR', label: 'Doctor', requiresPharmacy: false, requiresDepartment: true, pharmacyType: undefined },
  { value: 'DOCTOR_ASSISTANT', label: 'Doctor Assistant', requiresPharmacy: false, requiresDepartment: true, pharmacyType: undefined },
  { value: 'REGISTRATION_STAFF', label: 'Registration Staff', requiresPharmacy: false, requiresDepartment: true, pharmacyType: undefined },
  { value: 'AUDITOR', label: 'Auditor', requiresPharmacy: false, requiresDepartment: true, pharmacyType: undefined },
] as const;

export function AddUserModal({ isOpen, hospital, onClose, onUserAdded }: AddUserModalProps) {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loadingPharmacies, setLoadingPharmacies] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [loadingSubDepartments, setLoadingSubDepartments] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    role: '',
    pharmacyId: '',
    departmentId: '',
    subDepartmentId: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && hospital) {
      resetForm();
      fetchPharmacies();
      fetchDepartments();
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

  const fetchDepartments = async () => {
    if (!hospital) return;

    setLoadingDepartments(true);
    try {
      const response = await api.get('/departments', {
        params: { hospitalId: hospital.id }
      });
      setDepartments(response.data || []);
    } catch (err) {
      console.error('Failed to fetch departments:', err);
      setDepartments([]);
    } finally {
      setLoadingDepartments(false);
    }
  };

  const fetchSubDepartments = async (departmentId: string) => {
    if (!departmentId) return;

    setLoadingSubDepartments(true);
    try {
      const response = await api.get(`/sub-departments/department/${departmentId}`);
      setSubDepartments(response.data || []);
    } catch (err) {
      console.error('Failed to fetch sub-departments:', err);
      setSubDepartments([]);
    } finally {
      setLoadingSubDepartments(false);
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
      departmentId: '',
      subDepartmentId: '',
    });
    setErrors({});
    setShowPassword(false);
    setSubDepartments([]);
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

    // Department (if required for selected role)
    if (selectedRole?.requiresDepartment && !formData.departmentId) {
      newErrors.departmentId = 'Department is required for this role';
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

      if (formData.departmentId) {
        payload.departmentId = formData.departmentId;
      }

      if (formData.subDepartmentId) {
        payload.subDepartmentId = formData.subDepartmentId;
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
  const showPharmacyDropdown = selectedRole?.requiresPharmacy === true;
  const showDepartmentDropdown = selectedRole?.requiresDepartment === true;
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
                        setFormData({ ...formData, role: value, pharmacyId: '', departmentId: '', subDepartmentId: '' })
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
                {showPharmacyDropdown && (
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
                              : selectedRole?.pharmacyType
                              ? `Select ${selectedRole.pharmacyType.toLowerCase()} pharmacy`
                              : 'Select pharmacy'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePharmacies.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground">
                            No {selectedRole?.pharmacyType?.toLowerCase() || ''} pharmacies available
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

                {/* Row 5: Department & Sub-Department (conditional) */}
                {showDepartmentDropdown && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="department">
                        Department <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={formData.departmentId}
                        onValueChange={(value) => {
                          setFormData({ ...formData, departmentId: value, subDepartmentId: '' });
                          fetchSubDepartments(value);
                        }}
                        disabled={loadingDepartments}
                      >
                        <SelectTrigger className={errors.departmentId ? 'border-destructive' : ''}>
                          <SelectValue
                            placeholder={
                              loadingDepartments ? 'Loading departments...' : 'Select department'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground">
                              No departments available
                            </div>
                          ) : (
                            departments.map((department) => (
                              <SelectItem key={department.id} value={department.id}>
                                {department.name} ({department.code})
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {errors.departmentId && (
                        <p className="text-xs text-destructive">{errors.departmentId}</p>
                      )}
                    </div>

                    {formData.departmentId && subDepartments.length > 0 && (
                      <div className="space-y-2">
                        <Label htmlFor="subDepartment">
                          Sub-Department (Optional)
                        </Label>
                        <Select
                          value={formData.subDepartmentId}
                          onValueChange={(value) => setFormData({ ...formData, subDepartmentId: value })}
                          disabled={loadingSubDepartments}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                loadingSubDepartments
                                  ? 'Loading sub-departments...'
                                  : 'Select sub-department (optional)'
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {subDepartments.map((subDept) => (
                              <SelectItem key={subDept.id} value={subDept.id}>
                                {subDept.name} ({subDept.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
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
