'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PackagePlus, Loader2, Calendar, DollarSign, Package, Building2, FileSpreadsheet } from 'lucide-react';
import { BulkImportModal } from '@/components/inventory/bulk-import-modal';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import { UserRole } from '@/lib/constants';

interface Medicine {
  id: string;
  name: string;
  genericName?: string;
  strength?: string;
  form: string;
  status?: string;
}

interface Pharmacy {
  id: string;
  name: string;
  code: string;
  type: string;
  status?: string;
}

interface StockBatch {
  id: string;
  batchNo: string;
  medicine: {
    name: string;
    strength?: string;
    form: string;
  };
  pharmacy: {
    name: string;
    code: string;
  };
  qtyReceived: number;
  qtyAvailable: number;
  expiryDate: string;
  purchasePrice: number;
  receivedDate: string;
  status: string;
}

const STORAGE_TYPES = [
  { value: 'ROOM_TEMPERATURE', label: 'Room Temperature' },
  { value: 'COLD_STORAGE', label: 'Cold Storage' },
  { value: 'REFRIGERATED', label: 'Refrigerated' },
];

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
const receiveStockSchema = z.object({
  // Medicine selection - either medicineId OR manual entry
  medicineId: z.string().optional(),
  medicineName: z.string().optional(),
  genericName: z.string().optional(),
  form: z.string().optional(),
  strength: z.string().optional(),
  medicineManufacturer: z.string().optional(),
  
  pharmacyId: z.string().min(1, 'Pharmacy is required'),
  batchNo: z.string().min(3, 'Batch number must be at least 3 characters'),
  qtyReceived: z.number().min(1, 'Quantity must be at least 1'),
  expiryDate: z.string().min(1, 'Expiry date is required'),
  manufacturer: z.string().optional(),
  storageType: z.enum(['ROOM_TEMPERATURE', 'COLD_STORAGE', 'REFRIGERATED'], {
    required_error: 'Storage type is required',
  }),
  purchasePrice: z.number().min(0, 'Purchase price must be non-negative'),
  governmentPrice: z.number().min(0, 'Government price must be non-negative'),
  retailPrice: z.number().min(0, 'Retail price must be non-negative'),
}).refine(
  (data) => data.medicineId || (data.medicineName && data.form),
  {
    message: 'Either select a medicine or enter medicine name with form',
    path: ['medicineId'],
  }
);

type ReceiveStockFormData = z.infer<typeof receiveStockSchema>;

export default function ReceiveStockPage() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [recentBatches, setRecentBatches] = useState<StockBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [manualEntry, setManualEntry] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();

  const currentHospitalId = user?.hospitalId || selectedHospital?.id;

  const form = useForm<ReceiveStockFormData>({
    resolver: zodResolver(receiveStockSchema),
    defaultValues: {
      medicineId: '',
      medicineName: '',
      genericName: '',
      form: '',
      strength: '',
      medicineManufacturer: '',
      pharmacyId: '',
      batchNo: '',
      qtyReceived: 0,
      expiryDate: '',
      manufacturer: '',
      storageType: 'ROOM_TEMPERATURE',
      purchasePrice: 0,
      governmentPrice: 0,
      retailPrice: 0,
    },
  });

  useEffect(() => {
    if (currentHospitalId) {
      fetchMedicines();
      fetchPharmacies();
      fetchRecentBatches();
    }
  }, [currentHospitalId]);

  // Auto-generate batch number when medicine and pharmacy are selected
  useEffect(() => {
    const medicineId = form.watch('medicineId');
    const pharmacyId = form.watch('pharmacyId');

    if (medicineId && pharmacyId) {
      generateBatchNumber(medicineId, pharmacyId);
    }
  }, [form.watch('medicineId'), form.watch('pharmacyId')]);

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
      // Only show MAIN pharmacies for receiving stock
      setPharmacies(pharmacyList.filter((p: Pharmacy) => p.type === 'MAIN' && p.status === 'ACTIVE'));
    } catch (error) {
      console.error('Error fetching pharmacies:', error);
    }
  };

  const fetchRecentBatches = async () => {
    setLoadingData(true);
    try {
      const response = await api.get('/inventory/batches', {
        params: { limit: 10, sortBy: 'receivedDate', sortOrder: 'desc' },
      });
      const batches = response.data?.data || response.data || [];
      setRecentBatches(batches);
    } catch (error) {
      console.error('Error fetching recent batches:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const generateBatchNumber = (medicineId: string, pharmacyId: string) => {
    const medicine = medicines.find((m) => m.id === medicineId);
    const pharmacy = pharmacies.find((p) => p.id === pharmacyId);

    if (medicine && pharmacy) {
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();

      const batchNo = `${pharmacy.code}-${medicine.name.substring(0, 3).toUpperCase()}-${year}${month}-${random}`;
      form.setValue('batchNo', batchNo);
    }
  };

  const onSubmit = async (data: ReceiveStockFormData) => {
    setLoading(true);
    try {
      // Clean up the data - remove empty strings
      const cleanData: any = {
        ...data,
        qtyReceived: Number(data.qtyReceived),
        purchasePrice: Number(data.purchasePrice),
        governmentPrice: Number(data.governmentPrice),
        retailPrice: Number(data.retailPrice),
      };

      // Remove empty string values for optional fields
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] === '' || cleanData[key] === null) {
          delete cleanData[key];
        }
      });

      await api.post('/inventory/batches', cleanData);

      // Reset form and refresh data
      form.reset({
        medicineId: '',
        medicineName: '',
        genericName: '',
        form: '',
        strength: '',
        medicineManufacturer: '',
        pharmacyId: '',
        batchNo: '',
        qtyReceived: 0,
        expiryDate: '',
        manufacturer: '',
        storageType: 'ROOM_TEMPERATURE',
        purchasePrice: 0,
        governmentPrice: 0,
        retailPrice: 0,
      });
      setManualEntry(false); // Reset to default mode
      fetchRecentBatches();

      alert('Stock batch received successfully!');
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to receive stock';
      console.error('Error receiving stock:', errorMessage);
      form.setError('root', {
        type: 'manual',
        message: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      AVAILABLE: 'bg-green-500',
      EXPIRED: 'bg-red-500',
      DEPLETED: 'bg-gray-500',
      QUARANTINE: 'bg-yellow-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  if (!currentHospitalId) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Hospital Selection Required</CardTitle>
            <CardDescription>
              Please select a hospital from the dropdown to receive stock
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Receive Stock</h1>
          <p className="text-muted-foreground">
            Create stock batches for medicines received from vendors (GRN)
          </p>
        </div>
        <Button onClick={() => setBulkImportOpen(true)} variant="outline">
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Bulk Import Excel
        </Button>
      </div>

      {/* Bulk Import Modal */}
      <BulkImportModal
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        pharmacies={pharmacies}
        onSuccess={() => {
          fetchRecentBatches();
          alert('Bulk import completed successfully!');
        }}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Receive Stock Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PackagePlus className="h-5 w-5" />
                Receive New Stock Batch
              </CardTitle>
              <CardDescription>
                Enter details of the stock received from vendor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {/* Toggle for manual entry */}
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Manual Medicine Entry</p>
                      <p className="text-xs text-muted-foreground">
                        For bulk imports or new medicines not in the system
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant={manualEntry ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setManualEntry(!manualEntry);
                        if (!manualEntry) {
                          // Switching to manual entry - clear medicineId
                          form.setValue('medicineId', '');
                        } else {
                          // Switching to dropdown - clear manual fields
                          form.setValue('medicineName', '');
                          form.setValue('genericName', '');
                          form.setValue('form', '');
                          form.setValue('strength', '');
                          form.setValue('medicineManufacturer', '');
                        }
                      }}
                    >
                      {manualEntry ? 'Enabled' : 'Disabled'}
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Medicine Selection or Manual Entry */}
                    {!manualEntry ? (
                      <FormField
                        control={form.control}
                        name="medicineId"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Medicine *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select medicine" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {medicines.map((medicine) => (
                                  <SelectItem key={medicine.id} value={medicine.id}>
                                    {medicine.name} {medicine.strength && `(${medicine.strength})`} - {medicine.form}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <>
                        <FormField
                          control={form.control}
                          name="medicineName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Medicine Name *</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Paracetamol" {...field} value={field.value || ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="form"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Form *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ''}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select form" />
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

                        <FormField
                          control={form.control}
                          name="strength"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Strength</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., 500mg" {...field} value={field.value || ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="genericName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Generic Name</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Acetaminophen" {...field} value={field.value || ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="medicineManufacturer"
                          render={({ field }) => (
                            <FormItem className="col-span-2">
                              <FormLabel>Medicine Manufacturer</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., GSK" {...field} value={field.value || ''} />
                              </FormControl>
                              <FormDescription>
                                For creating new medicine record
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    {/* Pharmacy Select */}
                    <FormField
                      control={form.control}
                      name="pharmacyId"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Main Pharmacy *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select pharmacy" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {pharmacies.map((pharmacy) => (
                                <SelectItem key={pharmacy.id} value={pharmacy.id}>
                                  {pharmacy.name} ({pharmacy.code})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Only main pharmacies can receive stock directly
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Batch Number */}
                    <FormField
                      control={form.control}
                      name="batchNo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Batch Number *</FormLabel>
                          <FormControl>
                            <Input placeholder="Auto-generated" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormDescription>
                            Auto-generated when medicine and pharmacy are selected
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Quantity Received */}
                    <FormField
                      control={form.control}
                      name="qtyReceived"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantity Received *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              placeholder="100"
                              {...field}
                              value={field.value ?? 0}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Expiry Date */}
                    <FormField
                      control={form.control}
                      name="expiryDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expiry Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value || ''} />
                          </FormControl>
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
                            <Input placeholder="GSK, Pfizer, etc." {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Storage Type */}
                    <FormField
                      control={form.control}
                      name="storageType"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Storage Type *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || 'ROOM_TEMPERATURE'}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select storage type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {STORAGE_TYPES.map((type) => (
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

                    {/* Purchase Price */}
                    <FormField
                      control={form.control}
                      name="purchasePrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Purchase Price (PKR) *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              {...field}
                              value={field.value ?? 0}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>Cost per unit</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Government Price */}
                    <FormField
                      control={form.control}
                      name="governmentPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Government Price (PKR) *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              {...field}
                              value={field.value ?? 0}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>Subsidized price</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Retail Price */}
                    <FormField
                      control={form.control}
                      name="retailPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Retail Price (PKR) *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              {...field}
                              value={field.value ?? 0}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>Market price</FormDescription>
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

                  <Button type="submit" disabled={loading} className="w-full">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {loading ? 'Receiving Stock...' : 'Receive Stock Batch'}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Quick Info */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Package className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Batch Number</p>
                  <p className="text-xs text-muted-foreground">
                    Auto-generated based on pharmacy code and medicine
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Expiry Date</p>
                  <p className="text-xs text-muted-foreground">
                    FIFO system uses this for automatic batch selection
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-purple-600 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Pricing</p>
                  <p className="text-xs text-muted-foreground">
                    Purchase, Government, and Retail prices tracked separately
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Main Pharmacy Only</p>
                  <p className="text-xs text-muted-foreground">
                    Stock received at main pharmacy, then transferred to sub-pharmacies
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Batches */}
      <Card>
        <CardHeader>
          <CardTitle>Recently Received Batches</CardTitle>
          <CardDescription>Latest 10 stock batches received</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingData ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch No</TableHead>
                  <TableHead>Medicine</TableHead>
                  <TableHead>Pharmacy</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentBatches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No batches received yet
                    </TableCell>
                  </TableRow>
                ) : (
                  recentBatches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-mono text-sm">{batch.batchNo}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{batch.medicine.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {batch.medicine.strength} • {batch.medicine.form}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{batch.pharmacy.code}</Badge>
                      </TableCell>
                      <TableCell>
                        {batch.qtyAvailable} / {batch.qtyReceived}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(batch.expiryDate)}</TableCell>
                      <TableCell className="font-mono text-sm">
                        PKR {Number(batch.purchasePrice).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(batch.receivedDate)}</TableCell>
                      <TableCell>
                        <Badge className={`${getStatusColor(batch.status)} text-white`}>
                          {batch.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
