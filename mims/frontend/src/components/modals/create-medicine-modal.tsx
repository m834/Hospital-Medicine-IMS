/**
 * Create Medicine Modal
 * Create a new medicine in the hospital inventory
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

interface CreateMedicineModalProps {
  isOpen: boolean;
  hospital: Hospital | null;
  onClose: () => void;
  onMedicineCreated: () => void;
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
];

// Validation schema
const createMedicineSchema = z.object({
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
  ], { required_error: 'Medicine form is required' }),
  strength: z.string().optional(),
  manufacturer: z.string().optional(),
  quantityPerPack: z.coerce.number().int().positive('Quantity must be a positive number').optional().or(z.literal('')),
  stripsPerBox: z.coerce.number().int().positive('Strips per box must be a positive number').optional().or(z.literal('')),
});

type CreateMedicineFormData = z.infer<typeof createMedicineSchema>;

export function CreateMedicineModal({
  isOpen,
  hospital,
  onClose,
  onMedicineCreated,
}: CreateMedicineModalProps) {
  const [loading, setLoading] = useState(false);

  const form = useForm<CreateMedicineFormData>({
    resolver: zodResolver(createMedicineSchema),
    defaultValues: {
      name: '',
      genericName: '',
      strength: '',
      manufacturer: '',
      quantityPerPack: '' as any,
      stripsPerBox: '' as any,
    },
  });

  const selectedForm = form.watch('form');
  const showQuantity = selectedForm === 'TABLET' || selectedForm === 'CAPSULE';

  useEffect(() => {
    if (isOpen) {
      form.reset();
    }
  }, [isOpen, form]);

  useEffect(() => {
    if (!showQuantity) {
      form.setValue('quantityPerPack', '' as any);
      form.setValue('stripsPerBox', '' as any);
    }
  }, [showQuantity, form]);

  const onSubmit = async (data: CreateMedicineFormData) => {
    if (!hospital) {
      form.setError('root', {
        type: 'manual',
        message: 'Please select a hospital first',
      });
      return;
    }

    setLoading(true);
    try {
      await api.post('/medicines', {
        hospitalId: hospital.id,
        name: data.name,
        genericName: data.genericName || undefined,
        form: data.form,
        strength: data.strength || undefined,
        manufacturer: data.manufacturer || undefined,
        quantityPerPack: data.quantityPerPack || undefined,
        stripsPerBox: data.stripsPerBox || undefined,
      });

      onMedicineCreated();
      onClose();
      form.reset();
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to create medicine';
      console.error('Error creating medicine:', errorMessage);

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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Medicine</DialogTitle>
          <DialogDescription>
            {hospital ? `Add a new medicine to ${hospital.name}` : 'Add a new medicine to the inventory'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
                      Chemical or generic name
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

              {/* Quantity (only for Tablet / Capsule) */}
              {showQuantity ? (
                <FormField
                  control={form.control}
                  name="quantityPerPack"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Tablets per Strip *
                      </FormLabel>
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
              ) : (
                /* Strength fills the second column when no quantity */
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

              {/* Strength (only shown separately when quantity is visible) */}
              {showQuantity && (
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
              )}

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
            </div>

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
                {loading ? 'Creating...' : 'Create Medicine'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
