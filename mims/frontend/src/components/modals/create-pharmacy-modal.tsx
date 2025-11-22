/**
 * Create Pharmacy Modal
 * Create a new pharmacy for a hospital
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

interface CreatePharmacyModalProps {
  isOpen: boolean;
  hospital: Hospital | null;
  onClose: () => void;
  onPharmacyCreated: () => void;
}

const PHARMACY_TYPES = [
  { value: 'MAIN', label: 'Main Pharmacy' },
  { value: 'SUB', label: 'Sub Pharmacy' },
];

// Validation schema
const createPharmacySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  code: z.string().min(2, 'Code must be at least 2 characters').max(20, 'Code must be at most 20 characters'),
  type: z.enum(['MAIN', 'SUB'], { required_error: 'Pharmacy type is required' }),
  locationWard: z.string().optional(),
});

type CreatePharmacyFormData = z.infer<typeof createPharmacySchema>;

export function CreatePharmacyModal({
  isOpen,
  hospital,
  onClose,
  onPharmacyCreated,
}: CreatePharmacyModalProps) {
  const [loading, setLoading] = useState(false);

  const form = useForm<CreatePharmacyFormData>({
    resolver: zodResolver(createPharmacySchema),
    defaultValues: {
      name: '',
      code: '',
      locationWard: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset();
    }
  }, [isOpen]);

  const onSubmit = async (data: CreatePharmacyFormData) => {
    if (!hospital) return;

    setLoading(true);
    try {
      await api.post('/pharmacies', {
        hospitalId: hospital.id,
        name: data.name,
        code: data.code,
        type: data.type,
        locationWard: data.locationWard || undefined,
      });

      onPharmacyCreated();
      onClose();
      form.reset();
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to create pharmacy';
      console.error('Error creating pharmacy:', errorMessage);

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Pharmacy</DialogTitle>
          <DialogDescription>
            {hospital ? `Add a new pharmacy to ${hospital.name}` : 'Add a new pharmacy'}
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
                  <FormLabel>Pharmacy Code</FormLabel>
                  <FormControl>
                    <Input placeholder="MAIN-PH" {...field} />
                  </FormControl>
                  <FormDescription>
                    Unique code for this pharmacy (e.g., MAIN-PH, SUB-PH-1)
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

            {/* Hospital Info (read-only) */}
            {hospital && (
              <div className="rounded-lg border p-3 bg-muted/50">
                <p className="text-sm font-medium">Hospital</p>
                <p className="text-sm text-muted-foreground">
                  {hospital.name} ({hospital.code})
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
                {loading ? 'Creating...' : 'Create Pharmacy'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
