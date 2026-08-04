'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
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
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  PackagePlus,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import api from '@/lib/api';
import { fetchAllMedicines } from '@/lib/medicines';

interface Medicine {
  id: string;
  name: string;
  genericName?: string;
  form: string;
  strength?: string;
  status: string;
}

interface Hospital {
  id: string;
  name: string;
  code: string;
  status?: string;
}

interface Pharmacy {
  id: string;
  name: string;
  code: string;
  type: 'MAIN' | 'SUB';
  hospitalId: string;
  // Null on a main pharmacy; on a sub it points at the main that owns it
  parentPharmacyId?: string | null;
}

interface TransferItem {
  medicineId: string;
  medicineName: string;
  medicineForm: string;
  medicineStrength?: string;
  qtyRequested: number;
  transferCategory: 'NORMAL' | 'LP';
}

const transferRequestSchema = z.object({
  hospitalId: z.string().optional(),
  fromPharmacyId: z.string().min(1, 'Source pharmacy is required'),
  notes: z.string().optional(),
});

type TransferRequestFormData = z.infer<typeof transferRequestSchema>;

export default function RequestTransferPage() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [allPharmacies, setAllPharmacies] = useState<Pharmacy[]>([]);
  const [transferItems, setTransferItems] = useState<TransferItem[]>([]);
  const [selectedMedicine, setSelectedMedicine] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [isLP, setIsLP] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userPharmacyType, setUserPharmacyType] = useState<'MAIN' | 'SUB' | null>(null);
  // The main pharmacy that owns the logged-in sub-pharmacy, once resolved
  const [parentPharmacy, setParentPharmacy] = useState<Pharmacy | null>(null);

  const router = useRouter();
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();

  const currentHospitalId = user?.hospitalId || selectedHospital?.id;
  const userPharmacyId = user?.pharmacyId;
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const form = useForm<TransferRequestFormData>({
    resolver: zodResolver(transferRequestSchema),
    defaultValues: {
      hospitalId: '',
      fromPharmacyId: '',
      notes: '',
    },
  });

  const selectedHospitalId = form.watch('hospitalId');

  useEffect(() => {
    fetchData();
  }, [currentHospitalId]);

  useEffect(() => {
    if (isSuperAdmin && selectedHospitalId) {
      const filteredPharmacies = allPharmacies.filter(
        (p) => p.hospitalId === selectedHospitalId
      );
      setPharmacies(filteredPharmacies);
      form.setValue('fromPharmacyId', '');
    }
  }, [selectedHospitalId, allPharmacies, isSuperAdmin]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchMedicines(),
        fetchPharmacies(),
        ...(isSuperAdmin ? [fetchHospitals()] : []),
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHospitals = async () => {
    try {
      const response = await api.get('/hospitals');
      const hospitalList = response.data?.data || response.data || [];
      setHospitals(hospitalList.filter((h: Hospital) => h.status === 'ACTIVE'));
    } catch (error) {
      console.error('Error fetching hospitals:', error);
    }
  };

  // Every active medicine in the catalogue, not just what the source pharmacy
  // happens to stock — this is a request, and the main pharmacy decides what it
  // can actually fulfil. Paged, since the endpoint defaults to 50 per page.
  const fetchMedicines = async () => {
    try {
      if (!currentHospitalId) return;
      const medicineList = await fetchAllMedicines<Medicine>(currentHospitalId);
      setMedicines(medicineList.filter((m) => m.status === 'ACTIVE'));
    } catch (error) {
      console.error('Error fetching medicines:', error);
    }
  };

  const fetchPharmacies = async () => {
    try {
      const response = await api.get('/pharmacies');
      const pharmacyList = response.data || [];
      setAllPharmacies(pharmacyList);

      if (isSuperAdmin) {
        setPharmacies([]);
      } else {
        const userPharmacy = pharmacyList.find((p: Pharmacy) => p.id === userPharmacyId);

        if (userPharmacy) {
          setUserPharmacyType(userPharmacy.type);

          if (userPharmacy.type === 'SUB') {
            // A sub-pharmacy always sources from the main pharmacy that owns
            // it, so resolve the parent from the hierarchy and lock it in
            // rather than offering a choice.
            const parent = userPharmacy.parentPharmacyId
              ? pharmacyList.find((p: Pharmacy) => p.id === userPharmacy.parentPharmacyId)
              : undefined;

            if (parent) {
              setParentPharmacy(parent);
              setPharmacies([parent]);
              form.setValue('fromPharmacyId', parent.id);
            } else {
              // Legacy sub-pharmacies predate the hierarchy and have no parent
              // yet — fall back to choosing from the hospital's main pharmacies
              setParentPharmacy(null);
              const filteredPharmacies = pharmacyList.filter(
                (p: Pharmacy) =>
                  p.hospitalId === userPharmacy.hospitalId &&
                  p.type === 'MAIN' &&
                  p.id !== userPharmacyId
              );
              setPharmacies(filteredPharmacies);
            }
          } else if (userPharmacy.type === 'MAIN') {
            const filteredPharmacies = pharmacyList.filter(
              (p: Pharmacy) =>
                p.hospitalId === userPharmacy.hospitalId &&
                p.type === 'SUB' &&
                p.id !== userPharmacyId
            );
            setPharmacies(filteredPharmacies);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching pharmacies:', error);
    }
  };

  const handleAddItem = () => {
    if (!selectedMedicine || quantity <= 0) return;

    const medicine = medicines.find((m) => m.id === selectedMedicine);
    if (!medicine) return;

    const category: 'NORMAL' | 'LP' = isLP ? 'LP' : 'NORMAL';
    const existingItem = transferItems.find((item) => item.medicineId === selectedMedicine);
    if (existingItem) {
      setTransferItems((items) =>
        items.map((item) =>
          item.medicineId === selectedMedicine
            ? { ...item, qtyRequested: item.qtyRequested + quantity, transferCategory: category }
            : item
        )
      );
    } else {
      const newItem: TransferItem = {
        medicineId: medicine.id,
        medicineName: medicine.name,
        medicineForm: medicine.form,
        medicineStrength: medicine.strength,
        qtyRequested: quantity,
        transferCategory: category,
      };
      setTransferItems([...transferItems, newItem]);
    }

    setSelectedMedicine('');
    setQuantity(1);
  };

  const handleRemoveItem = (medicineId: string) => {
    setTransferItems((items) => items.filter((item) => item.medicineId !== medicineId));
  };

  const handleUpdateQuantity = (medicineId: string, newQuantity: number) => {
    if (newQuantity <= 0) return;
    setTransferItems((items) =>
      items.map((item) =>
        item.medicineId === medicineId ? { ...item, qtyRequested: newQuantity } : item
      )
    );
  };

  const onSubmit = async (data: TransferRequestFormData) => {
    if (transferItems.length === 0) {
      alert('Please add at least one medicine to the transfer request');
      return;
    }

    // No stock check here on purpose: a request may ask for items the source
    // pharmacy is out of. Fulfilment is the main pharmacy's decision at approval.

    let fromPharmacyId: string;
    let toPharmacyId: string;

    if (isSuperAdmin) {
      alert('Super Admin transfer logic needs destination pharmacy selection');
      return;
    } else {
      const userPharmacy = allPharmacies.find((p) => p.id === userPharmacyId);
      if (!userPharmacy || !userPharmacyId) {
        alert('User pharmacy not found');
        return;
      }

      fromPharmacyId = userPharmacyId;
      toPharmacyId = data.fromPharmacyId;

      const targetPharmacy = allPharmacies.find((p) => p.id === toPharmacyId);
      if (!targetPharmacy) {
        alert('Target pharmacy not found');
        return;
      }

      if (targetPharmacy.hospitalId !== userPharmacy.hospitalId) {
        alert('Cannot request to pharmacy in different hospital');
        return;
      }

      if (userPharmacy.type === 'SUB' && targetPharmacy.type !== 'MAIN') {
        alert('Sub-pharmacy can only request to Main pharmacy');
        return;
      }

      // A sub-pharmacy may only transact with the main pharmacy that owns it
      if (
        userPharmacy.type === 'SUB' &&
        userPharmacy.parentPharmacyId &&
        targetPharmacy.id !== userPharmacy.parentPharmacyId
      ) {
        alert('You can only request stock from your own parent main pharmacy');
        return;
      }

      if (userPharmacy.type === 'MAIN' && targetPharmacy.type !== 'SUB') {
        alert('Main pharmacy can only request to Sub-pharmacies');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        fromPharmacyId,
        toPharmacyId,
        items: transferItems.map((item) => ({
          medicineId: item.medicineId,
          qtyRequested: item.qtyRequested,
          transferCategory: item.transferCategory,
        })),
        requestedBy: user?.id,
        notes: data.notes || undefined,
      };

      await api.post('/transfers', payload);

      alert('Transfer request submitted successfully!');
      router.push('/dashboard/transfers');
    } catch (error: any) {
      console.error('Error submitting transfer request:', error);
      alert(error.response?.data?.message || 'Failed to submit transfer request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Request Stock Transfer</h1>
            <p className="text-muted-foreground">
              {isSuperAdmin
                ? 'Create transfer request between pharmacies'
                : userPharmacyType === 'SUB'
                ? 'Request medicines to main pharmacy'
                : 'Request medicines to sub-pharmacies'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Transfer Details Form */}
        <Card>
          <CardHeader>
            <CardTitle>Transfer Details</CardTitle>
            <CardDescription>
              {isSuperAdmin
                ? 'Select hospital and pharmacies for transfer'
                : userPharmacyType === 'SUB'
                ? 'Select main pharmacy to send your request to and add notes (optional)'
                : 'Select sub-pharmacy to send your request to and add notes (optional)'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <div className="grid gap-4">
                {isSuperAdmin && (
                  <FormField
                    control={form.control}
                    name="hospitalId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hospital *</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                          }}
                          value={field.value || ''}
                        >
                          <FormControl>
                            <SearchableSelect
                              options={hospitals.map((h) => ({
                                value: h.id,
                                label: h.name,
                                sub: h.code,
                              }))}
                              value={field.value || ''}
                              onValueChange={(val) => {
                                field.onChange(val);
                              }}
                              placeholder="Select hospital..."
                              searchPlaceholder="Search hospital..."
                            />
                          </FormControl>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="fromPharmacyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {isSuperAdmin
                          ? 'Target Pharmacy *'
                          : userPharmacyType === 'SUB'
                          ? 'Request To (Main Pharmacy) *'
                          : 'Request To (Sub-Pharmacy) *'}
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ''}
                        disabled={(isSuperAdmin && !selectedHospitalId) || !!parentPharmacy}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                isSuperAdmin && !selectedHospitalId
                                  ? 'Select hospital first'
                                  : userPharmacyType === 'SUB'
                                  ? 'Select main pharmacy to request to'
                                  : 'Select sub-pharmacy to request to'
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {pharmacies.length === 0 && (
                            <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                              {isSuperAdmin
                                ? 'Select a hospital first'
                                : userPharmacyType === 'SUB'
                                ? 'No main pharmacies available'
                                : 'No sub-pharmacies available'}
                            </div>
                          )}
                          {pharmacies.map((pharmacy) => (
                            <SelectItem key={pharmacy.id} value={pharmacy.id}>
                              {pharmacy.name} ({pharmacy.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {parentPharmacy && (
                        <p className="text-xs text-muted-foreground">
                          Set automatically from your pharmacy hierarchy —{' '}
                          {parentPharmacy.name} ({parentPharmacy.code}) is your parent main
                          pharmacy.
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Add any additional notes or reasons for this transfer request..."
                          className="min-h-[80px]"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Form>
          </CardContent>
        </Card>

        {/* Add Medicines */}
        <Card>
          <CardHeader>
            <CardTitle>Add Medicines</CardTitle>
            <CardDescription>Select medicines and quantities to request</CardDescription>
          </CardHeader>
          <CardContent>
            {/* LP Toggle */}
            <div
              className={`flex items-center justify-between p-3 rounded-lg border mb-4 transition-colors ${
                isLP ? 'bg-orange-50 border-orange-300' : 'bg-muted border-transparent'
              }`}
            >
              <div>
                <p className="font-medium text-sm">Local Purchase (LP) Stock</p>
                <p className="text-xs text-muted-foreground">
                  {isLP
                    ? 'Items will be requested from LP stock pool'
                    : 'Items will be requested from Normal stock pool'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Normal</span>
                <Switch checked={isLP} onCheckedChange={setIsLP} />
                <span className={`text-xs font-medium ${isLP ? 'text-orange-600' : 'text-muted-foreground'}`}>LP</span>
              </div>
            </div>

            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Medicine</label>
                <SearchableSelect
                  options={medicines.map((m) => ({
                    value: m.id,
                    label: m.name,
                    sub: [m.strength, m.form].filter(Boolean).join(' · '),
                  }))}
                  value={selectedMedicine}
                  onValueChange={setSelectedMedicine}
                  placeholder="Select medicine..."
                  searchPlaceholder="Search medicine by name or strength..."
                />
              </div>

              <div className="w-32">
                <label className="text-sm font-medium mb-2 block">Quantity</label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  placeholder="Qty"
                />
              </div>

              <Button onClick={handleAddItem} disabled={!selectedMedicine || quantity <= 0}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>

          </CardContent>
        </Card>

        {/* Transfer Items Table */}
        {transferItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Transfer Items ({transferItems.length})</CardTitle>
              <CardDescription>Review and adjust quantities as needed</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicine</TableHead>
                    <TableHead>Form & Strength</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Requested Qty</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transferItems.map((item) => {
                    return (
                      <TableRow key={item.medicineId}>
                        <TableCell className="font-medium">{item.medicineName}</TableCell>
                        <TableCell>
                          {item.medicineForm}
                          {item.medicineStrength && ` - ${item.medicineStrength}`}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={item.transferCategory === 'LP' ? 'outline' : 'secondary'}
                            className={
                              item.transferCategory === 'LP'
                                ? 'border-orange-400 text-orange-600'
                                : ''
                            }
                          >
                            {item.transferCategory === 'LP' ? 'LP' : 'Normal'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="1"
                            value={item.qtyRequested}
                            onChange={(e) =>
                              handleUpdateQuantity(item.medicineId, parseInt(e.target.value) || 1)
                            }
                            className="w-24 ml-auto"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveItem(item.medicineId)}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="mt-4 p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <PackagePlus className="h-4 w-4" />
                  Request Summary
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total Items:</span>
                    <span className="ml-2 font-semibold">{transferItems.length}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Quantity:</span>
                    <span className="ml-2 font-semibold">
                      {transferItems.reduce((sum, item) => sum + item.qtyRequested, 0)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            onClick={form.handleSubmit(onSubmit)}
            disabled={submitting || transferItems.length === 0}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <PackagePlus className="h-4 w-4 mr-2" />
                Submit Transfer Request
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
