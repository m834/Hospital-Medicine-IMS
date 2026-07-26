/**
 * Edit Pharmacy Modal
 * Update pharmacy information
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
    subPharmacies?: number;
  };
}

interface EditPharmacyModalProps {
  pharmacy: Pharmacy | null;
  onClose: () => void;
  onPharmacyUpdated: () => void;
  /** Candidate main pharmacies in the same hospital, for re-parenting. */
  mainPharmacies?: Pharmacy[];
}

/** Sentinel for "not under any main pharmacy" (Select cannot hold an empty value). */
const NO_PARENT = '__none__';

const PHARMACY_TYPES = [
  { value: 'MAIN', label: 'Main Pharmacy' },
  { value: 'SUB', label: 'Sub Pharmacy' },
];

const PHARMACY_STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

// Validation schema
const editPharmacySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  code: z.string().min(2, 'Code must be at least 2 characters').max(20, 'Code must be at most 20 characters'),
  type: z.enum(['MAIN', 'SUB'], { required_error: 'Pharmacy type is required' }),
  locationWard: z.string().optional(),
  status: z.string().min(1, 'Status is required'),
  parentPharmacyId: z.string().optional(),
});

type EditPharmacyFormData = z.infer<typeof editPharmacySchema>;

export function EditPharmacyModal({
  pharmacy,
  onClose,
  onPharmacyUpdated,
  mainPharmacies = [],
}: EditPharmacyModalProps) {
  const [loading, setLoading] = useState(false);

  // A pharmacy that already owns subs cannot itself be moved under a main
  const ownsSubs = (pharmacy?._count?.subPharmacies ?? 0) > 0;
  const parentOptions = mainPharmacies.filter(
    (candidate) =>
      candidate.id !== pharmacy?.id &&
      candidate.hospitalId === pharmacy?.hospitalId &&
      candidate.type === 'MAIN' &&
      !candidate.parentPharmacyId
  );
  const canReparent = !!pharmacy && !ownsSubs && parentOptions.length > 0;

  const form = useForm<EditPharmacyFormData>({
    resolver: zodResolver(editPharmacySchema),
    defaultValues: {
      name: '',
      code: '',
      type: undefined,
      locationWard: '',
      status: '',
    },
  });

  useEffect(() => {
    if (pharmacy) {
      form.reset({
        name: pharmacy.name,
        code: pharmacy.code,
        type: pharmacy.type,
        locationWard: pharmacy.locationWard || '',
        status: pharmacy.status,
        parentPharmacyId: pharmacy.parentPharmacyId || NO_PARENT,
      });
    }
  }, [pharmacy]);

  const onSubmit = async (data: EditPharmacyFormData) => {
    if (!pharmacy) return;

    setLoading(true);
    try {
      const nextParentId =
        data.parentPharmacyId === NO_PARENT ? null : data.parentPharmacyId ?? null;
      const currentParentId = pharmacy.parentPharmacyId ?? null;

      await api.patch(`/pharmacies/${pharmacy.id}`, {
        name: data.name,
        code: data.code,
        // The backend forces SUB when a parent is attached
        type: nextParentId ? 'SUB' : data.type,
        locationWard: data.locationWard || undefined,
        status: data.status,
        // Only send when it actually changed, so unrelated edits never re-parent
        ...(canReparent && nextParentId !== currentParentId
          ? { parentPharmacyId: nextParentId }
          : {}),
      });

      onPharmacyUpdated();
      onClose();
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to update pharmacy';
      console.error('Error updating pharmacy:', errorMessage);

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
    <Dialog open={!!pharmacy} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Pharmacy</DialogTitle>
          <DialogDescription>
            Update pharmacy information and settings
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pharmacy Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Main Pharmacy" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Code */}
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pharmacy Code (Auto-generated)</FormLabel>
                  <FormControl>
                    <Input placeholder="PHAR-001" readOnly className="bg-muted/50" {...field} />
                  </FormControl>
                  <FormDescription>
                    System-generated code for this pharmacy
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Type */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pharmacy Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select pharmacy type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PHARMACY_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Parent main pharmacy (re-parenting) */}
            {canReparent && (
              <FormField
                control={form.control}
                name="parentPharmacyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent Main Pharmacy</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Not under any main pharmacy" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_PARENT}>
                          Not under any main pharmacy
                        </SelectItem>
                        {parentOptions.map((main) => (
                          <SelectItem key={main.id} value={main.id}>
                            {main.name} ({main.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Selecting a main pharmacy nests this one underneath it as a
                      sub-pharmacy.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {ownsSubs && (
              <div className="rounded-lg border p-3 bg-muted/50">
                <p className="text-sm font-medium">Parent Main Pharmacy</p>
                <p className="text-sm text-muted-foreground">
                  This pharmacy has {pharmacy?._count?.subPharmacies} sub-pharmac
                  {pharmacy?._count?.subPharmacies === 1 ? 'y' : 'ies'} of its own,
                  so it cannot be nested under another pharmacy.
                </p>
              </div>
            )}

            {/* Location/Ward */}
            <FormField
              control={form.control}
              name="locationWard"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location/Ward (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Building A, 2nd Floor" {...field} />
                  </FormControl>
                  <FormDescription>
                    Physical location or ward where the pharmacy is located
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      {PHARMACY_STATUSES.map((status) => (
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
            {pharmacy?.hospital && (
              <div className="rounded-lg border p-3 bg-muted/50">
                <p className="text-sm font-medium">Hospital</p>
                <p className="text-sm text-muted-foreground">
                  {pharmacy.hospital.name} ({pharmacy.hospital.code})
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
