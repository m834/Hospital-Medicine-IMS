/**
 * Edit Medicine Modal
 * Update existing medicine information
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

interface Medicine {
  id: string;
  name: string;
  genericName?: string;
  strength?: string;
  form: string;
  manufacturer?: string;
  status: string;
  quantityPerPack?: number;
  stripsPerBox?: number;
}

interface EditMedicineModalProps {
  medicine: Medicine | null;
  onClose: () => void;
  onMedicineUpdated: () => void;
}

const MEDICINE_FORMS = [
  { value: 'TABLET', label: 'Tablet' },
  { value: 'CAPSULE', label: 'Capsule' },
  { value: 'SYRUP', label: 'Syrup' },
  { value: 'INJECTION', label: 'Injection' },
  { value: 'CREAM', label: 'Cream' },
  { value: 'DROPS', label: 'Drops' },
  { value: 'OINTMENT', label: 'Ointment' },
  { value: 'POWDER', label: 'Powder' },
  { value: 'SUSPENSION', label: 'Suspension' },
  { value: 'LIQUID', label: 'Liquid' },
  { value: 'SUPPOSITORY', label: 'Suppository' },
  { value: 'DISPOSABLE', label: 'Disposable' },
];

const MEDICINE_STATUS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DISCONTINUED', label: 'Discontinued' },
];

// Validation schema
const editMedicineSchema = z.object({
  name: z.string().min(2, 'Medicine name must be at least 2 characters'),
  genericName: z.string().optional(),
  form: z.enum([
    'TABLET',
    'CAPSULE',
    'SYRUP',
    'INJECTION',
    'CREAM',
    'DROPS',
    'OINTMENT',
    'POWDER',
    'SUSPENSION',
    'LIQUID',
    'SUPPOSITORY',
    'DISPOSABLE'
  ], { required_error: 'Medicine form is required' }),
  strength: z.string().optional(),
  manufacturer: z.string().optional(),
  status: z.enum(['ACTIVE', 'DISCONTINUED'], { required_error: 'Status is required' }),
  quantityPerPack: z.coerce.number().int().positive('Quantity must be a positive number').optional().or(z.literal('')),
  stripsPerBox: z.coerce.number().int().positive('Strips per box must be a positive number').optional().or(z.literal('')),
});

type EditMedicineFormData = z.infer<typeof editMedicineSchema>;

export function EditMedicineModal({
  medicine,
  onClose,
  onMedicineUpdated,
}: EditMedicineModalProps) {
  const [loading, setLoading] = useState(false);

  const form = useForm<EditMedicineFormData>({
    resolver: zodResolver(editMedicineSchema),
    defaultValues: {
      name: '',
      genericName: '',
      strength: '',
      manufacturer: '',
      status: 'ACTIVE',
      quantityPerPack: '' as any,
      stripsPerBox: '' as any,
    },
  });

  const selectedForm = form.watch('form');
  const showQuantity = selectedForm === 'TABLET' || selectedForm === 'CAPSULE';

  useEffect(() => {
    if (!showQuantity) {
      form.setValue('quantityPerPack', '' as any);
      form.setValue('stripsPerBox', '' as any);
    }
  }, [showQuantity, form]);

  // Update form when medicine changes
  useEffect(() => {
    if (medicine) {
      form.reset({
        name: medicine.name,
        genericName: medicine.genericName || '',
        form: medicine.form as any,
        strength: medicine.strength || '',
        manufacturer: medicine.manufacturer || '',
        status: medicine.status as any,
        quantityPerPack: medicine.quantityPerPack ?? ('' as any),
        stripsPerBox: medicine.stripsPerBox ?? ('' as any),
      });
    }
  }, [medicine, form]);

  const onSubmit = async (data: EditMedicineFormData) => {
    if (!medicine) return;

    setLoading(true);
    try {
      await api.patch(`/medicines/${medicine.id}`, {
        name: data.name,
        genericName: data.genericName || undefined,
        form: data.form,
        strength: data.strength || undefined,
        manufacturer: data.manufacturer || undefined,
        status: data.status,
        quantityPerPack: data.quantityPerPack || undefined,
        stripsPerBox: data.stripsPerBox || undefined,
      });

      onMedicineUpdated();
      onClose();
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to update medicine';
      console.error('Error updating medicine:', errorMessage);

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
    <Dialog open={!!medicine} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Medicine</DialogTitle>
          <DialogDescription>
            Update medicine information
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
            {/* Medicine Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Medicine Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Paracetamol" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Generic Name */}
            <FormField
              control={form.control}
              name="genericName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Generic Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acetaminophen" {...field} />
                  </FormControl>
                  <FormDescription>
                    Chemical or generic name of the medicine
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Form */}
            <FormField
              control={form.control}
              name="form"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Medicine Form *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select medicine form" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {MEDICINE_FORMS.map((form) => (
                        <SelectItem key={form.value} value={form.value}>
                          {form.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tablets per Strip (only for Tablet / Capsule) */}
            {showQuantity && (
              <FormField
                control={form.control}
                name="quantityPerPack"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tablets per Strip *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        placeholder="e.g. 10"
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      How many {selectedForm === 'TABLET' ? 'tablets' : 'capsules'} in one strip
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Strips per Box (only for Tablet / Capsule) */}
            {showQuantity && (
              <FormField
                control={form.control}
                name="stripsPerBox"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Strips per Box</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        placeholder="e.g. 10"
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      How many strips are in one box
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Strength */}
            <FormField
              control={form.control}
              name="strength"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Strength</FormLabel>
                  <FormControl>
                    <Input placeholder="500mg, 10ml, etc." {...field} />
                  </FormControl>
                  <FormDescription>
                    Dosage strength (e.g., 500mg, 5ml)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Manufacturer */}
            <FormField
              control={form.control}
              name="manufacturer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Manufacturer</FormLabel>
                  <FormControl>
                    <Input placeholder="GSK, Pfizer, etc." {...field} />
                  </FormControl>
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
                  <FormLabel>Status *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {MEDICINE_STATUS.map((status) => (
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
                {loading ? 'Updating...' : 'Update Medicine'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
