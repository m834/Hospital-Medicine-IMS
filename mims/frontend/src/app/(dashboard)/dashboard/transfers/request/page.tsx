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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import api from '@/lib/api';

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
}

interface TransferItem {
  medicineId: string;
  medicineName: string;
  medicineForm: string;
  medicineStrength?: string;
  qtyRequested: number;
  availableStock?: number;
}

interface StockInfo {
  medicineId: string;
  totalStock: number;
}

const transferRequestSchema = z.object({
  hospitalId: z.string().optional(), // For Super Admin only
  fromPharmacyId: z.string().min(1, 'Source pharmacy is required'),
  notes: z.string().optional(),
});

type TransferRequestFormData = z.infer<typeof transferRequestSchema>;

export default function RequestTransferPage() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [allPharmacies, setAllPharmacies] = useState<Pharmacy[]>([]); // Store all pharmacies
  const [transferItems, setTransferItems] = useState<TransferItem[]>([]);
  const [selectedMedicine, setSelectedMedicine] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stockInfo, setStockInfo] = useState<Map<string, number>>(new Map());
  const [userPharmacyType, setUserPharmacyType] = useState<'MAIN' | 'SUB' | null>(null);

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
  const selectedFromPharmacy = form.watch('fromPharmacyId');

  useEffect(() => {
    fetchData();
  }, [currentHospitalId]);

  useEffect(() => {
    // Filter pharmacies when hospital changes (for Super Admin)
    if (isSuperAdmin && selectedHospitalId) {
      // For Super Admin: show both MAIN and SUB pharmacies of selected hospital
      const filteredPharmacies = allPharmacies.filter(
        (p) => p.hospitalId === selectedHospitalId
      );
      setPharmacies(filteredPharmacies);
      // Reset pharmacy selection when hospital changes
      form.setValue('fromPharmacyId', '');
    }
  }, [selectedHospitalId, allPharmacies, isSuperAdmin]);

  useEffect(() => {
    // Fetch stock info when source pharmacy changes
    if (selectedFromPharmacy && transferItems.length > 0) {
      fetchStockAvailability();
    }
  }, [selectedFromPharmacy]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchMedicines(), 
        fetchPharmacies(),
        ...(isSuperAdmin ? [fetchHospitals()] : [])
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

  const fetchMedicines = async () => {
    try {
      const response = await api.get('/medicines');
      const medicineList = response.data?.data || response.data || [];
      setMedicines(medicineList.filter((m: Medicine) => m.status === 'ACTIVE'));
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
        // For Super Admin, don't filter yet - wait for hospital selection
        setPharmacies([]);
      } else {
        // For regular users, determine what pharmacies they can request TO based on their pharmacy type
        const userPharmacy = pharmacyList.find((p: Pharmacy) => p.id === userPharmacyId);
        
        if (userPharmacy) {
          // Store user pharmacy type for UI labels
          setUserPharmacyType(userPharmacy.type);
          
          if (userPharmacy.type === 'SUB') {
            // Sub-pharmacy requests TO Main pharmacy (asking main to provide stock)
            const filteredPharmacies = pharmacyList.filter(
              (p: Pharmacy) => 
                p.hospitalId === userPharmacy.hospitalId && 
                p.type === 'MAIN' &&
                p.id !== userPharmacyId
            );
            setPharmacies(filteredPharmacies);
          } else if (userPharmacy.type === 'MAIN') {
            // Main pharmacy can request TO Sub pharmacies (asking sub to provide stock)
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

  const fetchStockAvailability = async () => {
    if (!selectedFromPharmacy) return;

    try {
      const medicineIds = transferItems.map((item) => item.medicineId);
      const stockPromises = medicineIds.map((medicineId) =>
        api.get(`/inventory/batches/stock-level/${medicineId}/${selectedFromPharmacy}`)
      );

      const responses = await Promise.all(stockPromises);
      const newStockInfo = new Map<string, number>();

      responses.forEach((response) => {
        const data = response.data;
        if (data?.medicineId && data?.totalStock !== undefined) {
          newStockInfo.set(data.medicineId, data.totalStock);
        }
      });

      setStockInfo(newStockInfo);

      // Update transfer items with available stock
      setTransferItems((items) =>
        items.map((item) => ({
          ...item,
          availableStock: newStockInfo.get(item.medicineId) || 0,
        }))
      );
    } catch (error) {
      console.error('Error fetching stock availability:', error);
    }
  };

  const handleAddItem = () => {
    if (!selectedMedicine || quantity <= 0) return;

    const medicine = medicines.find((m) => m.id === selectedMedicine);
    if (!medicine) return;

    // Check if medicine already added
    const existingItem = transferItems.find((item) => item.medicineId === selectedMedicine);
    if (existingItem) {
      // Update quantity
      setTransferItems((items) =>
        items.map((item) =>
          item.medicineId === selectedMedicine
            ? { ...item, qtyRequested: item.qtyRequested + quantity }
            : item
        )
      );
    } else {
      // Add new item
      const newItem: TransferItem = {
        medicineId: medicine.id,
        medicineName: medicine.name,
        medicineForm: medicine.form,
        medicineStrength: medicine.strength,
        qtyRequested: quantity,
        availableStock: stockInfo.get(medicine.id) || 0,
      };
      setTransferItems([...transferItems, newItem]);
    }

    // Reset selection
    setSelectedMedicine('');
    setQuantity(1);

    // Fetch stock for new item if source pharmacy selected
    if (selectedFromPharmacy) {
      fetchStockAvailability();
    }
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

    // Determine source and destination for transfer
    // The user's pharmacy is always the REQUESTER (FROM pharmacy - asking for stock)
    // The selected pharmacy is being asked to PROVIDE the stock (TO pharmacy - will give stock)
    
    let fromPharmacyId: string;
    let toPharmacyId: string;
    
    if (isSuperAdmin) {
      alert('Super Admin transfer logic needs destination pharmacy selection');
      return;
    } else {
      // For regular users (Sub or Main Pharmacy Manager)
      const userPharmacy = allPharmacies.find((p) => p.id === userPharmacyId);
      if (!userPharmacy || !userPharmacyId) {
        alert('User pharmacy not found');
        return;
      }
      
      // User's pharmacy is the one making the request (FROM - the requester)
      fromPharmacyId = userPharmacyId;
      
      // Selected pharmacy is being asked to provide stock (TO - the provider)
      toPharmacyId = data.fromPharmacyId;
      
      // Validate the transfer
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
      
      if (userPharmacy.type === 'MAIN' && targetPharmacy.type !== 'SUB') {
        alert('Main pharmacy can only request to Sub-pharmacies');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        fromPharmacyId, // Requester: user's pharmacy making the request
        toPharmacyId,   // Provider: selected pharmacy being asked to provide stock
        items: transferItems.map((item) => ({
          medicineId: item.medicineId,
          qtyRequested: item.qtyRequested,
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
                ? "Create transfer request between pharmacies" 
                : userPharmacyType === 'SUB'
                ? "Request medicines to main pharmacy"
                : "Request medicines to sub-pharmacies"}
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
                ? "Select hospital and pharmacies for transfer" 
                : userPharmacyType === 'SUB'
                ? "Select main pharmacy to send your request to and add notes (optional)"
                : "Select sub-pharmacy to send your request to and add notes (optional)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <div className="grid gap-4">
                {/* Hospital Selection - Super Admin Only */}
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
                            <SelectTrigger>
                              <SelectValue placeholder="Select hospital first" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {hospitals.map((hospital) => (
                              <SelectItem key={hospital.id} value={hospital.id}>
                                {hospital.name} ({hospital.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
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
                        onValueChange={(value) => {
                          field.onChange(value);
                          // Re-fetch stock when target pharmacy changes
                          if (transferItems.length > 0) {
                            fetchStockAvailability();
                          }
                        }}
                        value={field.value || ''}
                        disabled={isSuperAdmin && !selectedHospitalId}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue 
                              placeholder={
                                isSuperAdmin && !selectedHospitalId
                                  ? "Select hospital first"
                                  : userPharmacyType === 'SUB'
                                  ? "Select main pharmacy to request to"
                                  : "Select sub-pharmacy to request to"
                              } 
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {pharmacies.length === 0 && (
                            <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                              {isSuperAdmin 
                                ? "Select a hospital first" 
                                : userPharmacyType === 'SUB'
                                ? "No main pharmacies available"
                                : "No sub-pharmacies available"}
                            </div>
                          )}
                          {pharmacies.map((pharmacy) => (
                            <SelectItem key={pharmacy.id} value={pharmacy.id}>
                              {pharmacy.name} ({pharmacy.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Medicine</label>
                <Select value={selectedMedicine} onValueChange={setSelectedMedicine}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select medicine" />
                  </SelectTrigger>
                  <SelectContent>
                    {medicines.map((medicine) => (
                      <SelectItem key={medicine.id} value={medicine.id}>
                        {medicine.name} {medicine.strength && `- ${medicine.strength}`} (
                        {medicine.form})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

            {selectedFromPharmacy && (
              <p className="text-sm text-muted-foreground mt-2">
                Stock availability will be shown after adding items
              </p>
            )}
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
                    <TableHead className="text-right">Requested Qty</TableHead>
                    {selectedFromPharmacy && <TableHead className="text-right">Available Stock</TableHead>}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transferItems.map((item) => {
                    const available = item.availableStock || 0;
                    const requested = item.qtyRequested;
                    const hasStock = available >= requested;

                    return (
                      <TableRow key={item.medicineId}>
                        <TableCell className="font-medium">{item.medicineName}</TableCell>
                        <TableCell>
                          {item.medicineForm}
                          {item.medicineStrength && ` - ${item.medicineStrength}`}
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
                        {selectedFromPharmacy && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {hasStock ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-red-600" />
                              )}
                              <span className={hasStock ? 'text-green-600' : 'text-red-600'}>
                                {available}
                              </span>
                            </div>
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(item.medicineId)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {selectedFromPharmacy && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <PackagePlus className="h-4 w-4" />
                    Stock Availability Summary
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
                    <div className="col-span-2">
                      {transferItems.every((item) => (item.availableStock || 0) >= item.qtyRequested) ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          All items available in stock
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Some items have insufficient stock
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )}
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
