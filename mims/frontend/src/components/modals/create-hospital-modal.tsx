/**
 * Create Hospital Modal
 * Professional form for adding new hospitals to the system
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, Building2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api, { getErrorMessage } from '@/lib/api';
import { generateNextCode } from '@/lib/code';

const hospitalSchema = z.object({
  name: z.string().min(3, 'Hospital name must be at least 3 characters'),
  code: z.string().min(2, 'Hospital code must be at least 2 characters').max(10, 'Code too long'),
  address: z.string().min(5, 'Address is required'),
  phone: z.string().min(10, 'Valid phone number required'),
  email: z.string().email('Valid email required'),
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

type HospitalFormData = z.infer<typeof hospitalSchema>;

interface CreateHospitalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  existingCodes?: string[];
}

export function CreateHospitalModal({ isOpen, onClose, onSuccess, existingCodes = [] }: CreateHospitalModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextHospitalCode = useMemo(
    () => generateNextCode(existingCodes, 'HOSP'),
    [existingCodes]
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
  } = useForm<HospitalFormData>({
    resolver: zodResolver(hospitalSchema),
    defaultValues: {
      status: 'ACTIVE',
    },
  });

  useEffect(() => {
    if (isOpen) {
      setValue('code', nextHospitalCode, { shouldValidate: true });
    }
  }, [isOpen, nextHospitalCode, setValue]);

  const onSubmit = async (data: HospitalFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await api.post('/hospitals', data);
      reset();
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl animate-scale-in">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Create New Hospital</h2>
                <p className="text-sm text-muted-foreground">Add a new hospital to the system</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="p-6">
            {error && (
              <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Row 1: Name and Code */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Hospital Name *</Label>
                  <Input
                    id="name"
                    placeholder="City General Hospital"
                    {...register('name')}
                    disabled={isSubmitting}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="code">Hospital Code (Auto-generated)</Label>
                  <Input
                    id="code"
                    placeholder="HOSP-001"
                    {...register('code')}
                    disabled={isSubmitting}
                    readOnly
                    className="bg-muted/50 uppercase"
                  />
                  {errors.code && (
                    <p className="text-sm text-destructive">{errors.code.message}</p>
                  )}
                </div>
              </div>

              {/* Row 2: Address */}
              <div className="space-y-2">
                <Label htmlFor="address">Address *</Label>
                <Input
                  id="address"
                  placeholder="123 Main Street, City Name"
                  {...register('address')}
                  disabled={isSubmitting}
                />
                {errors.address && (
                  <p className="text-sm text-destructive">{errors.address.message}</p>
                )}
              </div>

              {/* Row 3: Phone and Email */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+92-300-1234567"
                    {...register('phone')}
                    disabled={isSubmitting}
                  />
                  {errors.phone && (
                    <p className="text-sm text-destructive">{errors.phone.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="contact@hospital.com"
                    {...register('email')}
                    disabled={isSubmitting}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                </div>
              </div>

              {/* Row 4: Status */}
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <select
                  id="status"
                  {...register('status')}
                  disabled={isSubmitting}
                  className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
                {errors.status && (
                  <p className="text-sm text-destructive">{errors.status.message}</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Hospital'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
