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
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { PackagePlus, Loader2, Calendar, DollarSign, Package, Building2, FileSpreadsheet, Plus, Trash2, Save } from 'lucide-react';
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
  quantityPerPack?: number; // tablets per strip
  stripsPerBox?: number;   // strips per box
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
  qtyReceived: z.number().min(0, 'Quantity must be non-negative'),
  expiryDate: z.string().min(1, 'Expiry date is required'),
  manufacturer: z.string().optional(),
  storageType: z.enum(['ROOM_TEMPERATURE', 'COLD_STORAGE', 'REFRIGERATED'], {
    required_error: 'Storage type is required',
  }),
  purchasePrice: z.number().min(0, 'Price must be non-negative'),
  // Box-based receiving for tablets/capsules
  receiveByBox: z.boolean().optional(),
  boxCount: z.number().int().min(1).optional(),
  stripsPerBoxInput: z.number().int().min(1).optional(),
  tabletsPerStripInput: z.number().int().min(1).optional(),
}).refine(
  (data) => data.medicineId || (data.medicineName && data.form),
  {
    message: 'Either select a medicine or enter medicine name with form',
    path: ['medicineId'],
  }
).refine(
  (data) => !!data.receiveByBox || data.qtyReceived >= 1,
  {
    message: 'Quantity must be at least 1',
    path: ['qtyReceived'],
  }
);

type ReceiveStockFormData = z.infer<typeof receiveStockSchema>;

interface StockItem extends ReceiveStockFormData {
  tempId: string;
  isLP: boolean;
}

export default function ReceiveStockPage() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [recentBatches, setRecentBatches] = useState<StockBatch[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [manualEntry, setManualEntry] = useState(false);
  const [isLP, setIsLP] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();

  // Master Admin & Super Admin must select hospital, others use their hospitalId
  const currentHospitalId = selectedHospital?.id || user?.hospitalId;

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
      receiveByBox: false,
      boxCount: 1,
      stripsPerBoxInput: undefined,
      tabletsPerStripInput: undefined,
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
      const params: any = { limit: 2000, status: 'ACTIVE' };
      
      // Add hospitalId if available
      if (currentHospitalId) {
        params.hospitalId = currentHospitalId;
      }
      
      if (!params.hospitalId) {
        console.warn('No hospital selected');
        return;
      }
      
      const response = await api.get('/medicines', { params });
      const medicineList = response.data?.data || response.data || [];
      setMedicines(medicineList.filter((m: Medicine) => m.status === 'ACTIVE'));
      
      console.log('Fetched medicines:', medicineList.length, 'for hospital:', currentHospitalId);
    } catch (error) {
      console.error('Error fetching medicines:', error);
    }
  };

  const fetchPharmacies = async () => {
    try {
      const params: any = {};
      
      // Add hospitalId if available
      if (currentHospitalId) {
        params.hospitalId = currentHospitalId;
      }
      
      if (!params.hospitalId) {
        console.warn('No hospital selected');
        return;
      }
      
      const response = await api.get('/pharmacies', { params });
      const pharmacyList = response.data || [];
      // Only show MAIN pharmacies for receiving stock
      setPharmacies(pharmacyList.filter((p: Pharmacy) => p.type === 'MAIN' && p.status === 'ACTIVE'));
      
      console.log('Fetched pharmacies:', pharmacyList.length, 'for hospital:', currentHospitalId);
    } catch (error) {
      console.error('Error fetching pharmacies:', error);
    }
  };

  const fetchRecentBatches = async () => {
    setLoadingData(true);
    try {
      const params: any = { limit: 10, sortBy: 'receivedDate', sortOrder: 'desc' };
      
      if (currentHospitalId) {
        params.hospitalId = currentHospitalId;
      }
      
      if (!params.hospitalId) {
        console.warn('No hospital selected');
        setLoadingData(false);
        return;
      }
      
      const response = await api.get('/inventory/batches', { params });
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
      const timestamp = Date.now().toString().slice(-4); // Use timestamp for uniqueness
      const random = Math.random().toString(36).substring(2, 4).toUpperCase();

      const batchNo = `${pharmacy.code}-${medicine.name.substring(0, 3).toUpperCase()}-${year}${month}-${timestamp}${random}`;
      form.setValue('batchNo', batchNo);
    }
  };

  const addItemToList = (data: ReceiveStockFormData) => {
    // Validate that we have either medicineId or manual entry
    if (!data.medicineId && !data.medicineName) {
      alert('Please select a medicine or enter medicine details manually');
      return;
    }

    // Generate unique batch number if empty
    if (!data.batchNo) {
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.random().toString(36).substring(2, 4).toUpperCase();
      const pharmacy = pharmacies.find(p => p.id === data.pharmacyId);
      const pharmacyCode = pharmacy?.code || 'UNK';
      data.batchNo = `${pharmacyCode}-${timestamp}-${random}`;
    }

    // If receiving by box, calculate total tablets as qtyReceived
    if (data.receiveByBox && data.boxCount && data.stripsPerBoxInput && data.tabletsPerStripInput) {
      data.qtyReceived = data.boxCount * data.stripsPerBoxInput * data.tabletsPerStripInput;
    }

    const newItem: StockItem = {
      ...data,
      tempId: Date.now().toString() + Math.random().toString(36).substring(7),
      isLP,
    };
    setItems([...items, newItem]);
    
    
    // Reset form for next item
    form.reset({
      medicineId: '',
      medicineName: '',
      genericName: '',
      form: '',
      strength: '',
      medicineManufacturer: '',
      pharmacyId: data.pharmacyId, // Keep the same pharmacy selected
      batchNo: '',
      qtyReceived: 0,
      expiryDate: '',
      manufacturer: '',
      storageType: 'ROOM_TEMPERATURE',
      purchasePrice: 0,
      receiveByBox: false,
      boxCount: 1,
      stripsPerBoxInput: undefined,
      tabletsPerStripInput: undefined,
    });
  };

  const removeItem = (tempId: string) => {
    setItems(items.filter(item => item.tempId !== tempId));
  };

  const resolveOrCreateMedicineId = async (item: StockItem): Promise<string> => {
    // Already has a medicine ID — no lookup needed
    if (item.medicineId && item.medicineId.trim() !== '') return item.medicineId;

    // Search for an existing medicine with the same name + form
    const searchRes = await api.get('/medicines', {
      params: {
        hospitalId: currentHospitalId,
        name: item.medicineName,
        form: item.form,
        limit: 10,
      },
    });
    const existing: Medicine[] = searchRes.data?.data || searchRes.data || [];
    const match = existing.find(
      m =>
        m.name.toLowerCase() === (item.medicineName ?? '').toLowerCase() &&
        m.form === item.form &&
        (item.strength ? m.strength === item.strength : true)
    );
    if (match) return match.id;

    // Not found — create it
    const createPayload: any = {
      hospitalId: currentHospitalId,
      name: item.medicineName,
      form: item.form,
    };
    if (item.strength) createPayload.strength = item.strength;
    if (item.genericName) createPayload.genericName = item.genericName;
    if (item.medicineManufacturer) createPayload.manufacturer = item.medicineManufacturer;

    const createRes = await api.post('/medicines', createPayload);
    const newMedicine: Medicine = createRes.data;
    setMedicines(prev => [...prev, newMedicine]);
    return newMedicine.id;
  };

  const saveAllItems = async () => {
    if (items.length === 0) {
      alert('Please add at least one item to save');
      return;
    }

    setLoading(true);
    let successCount = 0;
    let failedItems: { item: StockItem; error: string }[] = [];

    try {
      // Process items sequentially to better track errors
      for (const item of items) {
        try {
          let medicineId: string;
          try {
            medicineId = await resolveOrCreateMedicineId(item);
          } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Failed to resolve medicine';
            failedItems.push({ item, error: errorMessage });
            continue;
          }

          const cleanData: any = {
            medicineId,
            pharmacyId: item.pharmacyId,
            batchNo: item.batchNo,
            qtyReceived: Number(item.qtyReceived),
            expiryDate: item.expiryDate,
            storageType: item.storageType,
            purchasePrice: Number(item.purchasePrice),
            category: item.isLP ? 'LP' : 'NORMAL',
          };

          if (item.manufacturer && item.manufacturer.trim() !== '') {
            cleanData.manufacturer = item.manufacturer;
          }

          await api.post('/inventory/batches', cleanData);
          successCount++;
        } catch (err: any) {
          const errorMessage = err.response?.data?.message || 'Unknown error';
          console.error('Failed to save item:', err.response?.data);
          failedItems.push({ item, error: errorMessage });
        }
      }

      // Clear successfully added items
      if (successCount > 0) {
        fetchRecentBatches();
      }

      // Show results
      if (failedItems.length === 0) {
        alert(`Successfully received all ${successCount} stock batch(es)!`);
        setItems([]);
      } else if (successCount === 0) {
        alert(`Failed to receive all items:\n${failedItems.map((f, i) => `${i + 1}. ${f.error}`).join('\n')}`);
      } else {
        const failedInfo = failedItems.map((f, i) => {
          const medicine = medicines.find(m => m.id === f.item.medicineId);
          const medicineName = medicine?.name || f.item.medicineName || 'Unknown';
          return `${i + 1}. ${medicineName}: ${f.error}`;
        }).join('\n');
        
        alert(`Partially successful:\n✓ ${successCount} succeeded\n✗ ${failedItems.length} failed\n\nFailed items:\n${failedInfo}`);
        
        // Remove successful items, keep failed ones
        const failedTempIds = failedItems.map(f => f.item.tempId);
        setItems(items.filter(item => failedTempIds.includes(item.tempId)));
      }
    } catch (err: any) {
      console.error('Unexpected error:', err);
      alert('An unexpected error occurred while saving items');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: ReceiveStockFormData) => {
    // Add item to list instead of submitting immediately
    addItemToList(data);
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
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
          {user?.role === 'SUPER_ADMIN' && selectedHospital && (
            <p className="text-sm text-blue-600 font-medium mt-1">
              📍 {selectedHospital.name}
            </p>
          )}
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
        hospitalId={currentHospitalId}
        onSuccess={() => {
          fetchRecentBatches();
          alert('Bulk import completed successfully!');
        }}
      />

      <div className="grid gap-6">
        {/* Receive Stock Form */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <PackagePlus className="h-5 w-5" />
                  Receive New Stock Batch
                </CardTitle>
                <CardDescription>
                  Add stock items in one line - click Add Item for each entry
                </CardDescription>
              </div>
              {items.length > 0 && (
                <Button onClick={saveAllItems} disabled={loading} size="lg">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  Save All ({items.length})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Warning if no medicines available */}
            {!loadingData && medicines.length === 0 && !manualEntry && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 font-medium">
                  ⚠️ No medicines found for this hospital
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Please add medicines first or enable "Manual Medicine Entry" mode above.
                </p>
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* Toggles row */}
                <div className="flex items-center gap-3">
                  {/* Manual entry toggle */}
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg flex-1">
                    <div>
                      <p className="font-medium text-sm">Manual Medicine Entry</p>
                      <p className="text-xs text-muted-foreground">
                        For new medicines not in the system
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant={manualEntry ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setManualEntry(!manualEntry);
                        if (!manualEntry) {
                          form.setValue('medicineId', '');
                        } else {
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

                  {/* LP toggle */}
                  <div className={`flex items-center justify-between p-3 rounded-lg border flex-1 transition-colors ${isLP ? 'bg-orange-50 border-orange-300' : 'bg-muted border-transparent'}`}>
                    <div>
                      <p className="font-medium text-sm">Local Purchase (LP)</p>
                      <p className="text-xs text-muted-foreground">
                        Mark this batch as a local purchase
                      </p>
                    </div>
                    <Switch
                      checked={isLP}
                      onCheckedChange={setIsLP}
                    />
                  </div>
                </div>

                {/* Inline Form Fields */}
                <div className="grid grid-cols-12 gap-3 items-end">
                  {/* Medicine Selection or Manual Entry */}
                  {!manualEntry ? (
                    <FormField
                      control={form.control}
                      name="medicineId"
                      render={({ field }) => (
                        <FormItem className="col-span-3">
                          <FormLabel>Medicine *</FormLabel>
                          <FormControl>
                            <SearchableSelect
                              options={medicines.map((m) => ({
                                value: m.id,
                                label: m.name,
                                sub: [m.strength, m.form].filter(Boolean).join(' · '),
                              }))}
                              value={field.value || ''}
                              onValueChange={field.onChange}
                              placeholder="Select medicine..."
                              searchPlaceholder="Search medicine by name or strength..."
                            />
                          </FormControl>
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
                          <FormItem className="col-span-2">
                            <FormLabel>Medicine *</FormLabel>
                            <FormControl>
                              <Input placeholder="Name" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="form"
                        render={({ field }) => (
                          <FormItem className="col-span-1">
                            <FormLabel>Form *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Form" />
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
                    </>
                  )}

                  {/* Pharmacy */}
                  <FormField
                    control={form.control}
                    name="pharmacyId"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Pharmacy *</FormLabel>
                        <FormControl>
                          <SearchableSelect
                            options={pharmacies.map((p) => ({
                              value: p.id,
                              label: p.name ?? p.code,
                              sub: p.code,
                            }))}
                            value={field.value || ''}
                            onValueChange={field.onChange}
                            placeholder="Select pharmacy..."
                            searchPlaceholder="Search pharmacy..."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Batch Number */}
                  <FormField
                    control={form.control}
                    name="batchNo"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Batch No *</FormLabel>
                        <FormControl>
                          <Input placeholder="Auto" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Quantity / Box-based input */}
                  {(() => {
                    const selectedMedId = form.watch('medicineId');
                    const selectedMed = medicines.find(m => m.id === selectedMedId);
                    const isTabletCapsule = selectedMed?.form === 'TABLET' || selectedMed?.form === 'CAPSULE' || form.watch('form') === 'TABLET' || form.watch('form') === 'CAPSULE';
                    const receiveByBox = form.watch('receiveByBox');
                    const boxCount = form.watch('boxCount') || 0;
                    const stripsPerBoxVal = form.watch('stripsPerBoxInput') || 0;
                    const tabletsPerStripVal = form.watch('tabletsPerStripInput') || 0;
                    const totalTablets = receiveByBox ? boxCount * stripsPerBoxVal * tabletsPerStripVal : 0;

                    return isTabletCapsule ? (
                      <>
                        {/* Toggle receive by box */}
                        <div className="col-span-1 flex flex-col justify-end">
                          <label className="text-xs font-medium mb-1">By Box?</label>
                          <button
                            type="button"
                            onClick={() => {
                              const next = !receiveByBox;
                              form.setValue('receiveByBox', next);
                              if (next && selectedMed) {
                                if (selectedMed.stripsPerBox) form.setValue('stripsPerBoxInput', selectedMed.stripsPerBox);
                                if (selectedMed.quantityPerPack) form.setValue('tabletsPerStripInput', selectedMed.quantityPerPack);
                              }
                            }}
                            className={`px-2 py-1.5 text-xs rounded border ${receiveByBox ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                          >
                            {receiveByBox ? 'ON' : 'OFF'}
                          </button>
                        </div>

                        {receiveByBox ? (
                          <>
                            <FormField control={form.control} name="boxCount" render={({ field }) => (
                              <FormItem className="col-span-1">
                                <FormLabel>Boxes *</FormLabel>
                                <FormControl>
                                  <Input type="number" min="1" placeholder="0" {...field} value={field.value ?? 1} onChange={e => field.onChange(Number(e.target.value))} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="stripsPerBoxInput" render={({ field }) => (
                              <FormItem className="col-span-1">
                                <FormLabel>Strips/Box</FormLabel>
                                <FormControl>
                                  <Input type="number" min="1" placeholder="10" {...field} value={field.value ?? ''} readOnly className="bg-muted cursor-not-allowed" onChange={e => field.onChange(Number(e.target.value))} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="tabletsPerStripInput" render={({ field }) => (
                              <FormItem className="col-span-1">
                                <FormLabel>Tabs/Strip</FormLabel>
                                <FormControl>
                                  <Input type="number" min="1" placeholder="10" {...field} value={field.value ?? ''} readOnly className="bg-muted cursor-not-allowed" onChange={e => field.onChange(Number(e.target.value))} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <div className="col-span-1 flex flex-col justify-end">
                              <label className="text-xs font-medium text-muted-foreground mb-1">Total Tabs</label>
                              <div className="px-2 py-1.5 text-sm font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded">
                                {totalTablets > 0 ? totalTablets : '—'}
                              </div>
                            </div>
                          </>
                        ) : (
                          <FormField control={form.control} name="qtyReceived" render={({ field }) => (
                            <FormItem className="col-span-1">
                              <FormLabel>Qty *</FormLabel>
                              <FormControl>
                                <Input type="number" min="1" placeholder="0" {...field} value={field.value ?? 0} onChange={(e) => field.onChange(Number(e.target.value))} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        )}
                      </>
                    ) : (
                      <FormField control={form.control} name="qtyReceived" render={({ field }) => (
                        <FormItem className="col-span-1">
                          <FormLabel>Qty *</FormLabel>
                          <FormControl>
                            <Input type="number" min="1" placeholder="0" {...field} value={field.value ?? 0} onChange={(e) => field.onChange(Number(e.target.value))} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    );
                  })()}

                  {/* Expiry Date */}
                  <FormField
                    control={form.control}
                    name="expiryDate"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Expiry *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Purchase Price */}
                  <FormField
                    control={form.control}
                    name="purchasePrice"
                    render={({ field }) => (
                      <FormItem className="col-span-1">
                        <FormLabel>Price *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0"
                            {...field}
                            value={field.value ?? 0}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Add Item Button */}
                  <div className="col-span-1">
                    <Button type="submit" className="w-full">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Additional Fields Row (Optional) */}
                <div className="grid grid-cols-12 gap-3">
                  <FormField
                    control={form.control}
                    name="storageType"
                    render={({ field }) => (
                      <FormItem className="col-span-3">
                        <FormLabel>Storage Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || 'ROOM_TEMPERATURE'}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
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

                  <FormField
                    control={form.control}
                    name="manufacturer"
                    render={({ field }) => (
                      <FormItem className="col-span-3">
                        <FormLabel>Manufacturer</FormLabel>
                        <FormControl>
                          <Input placeholder="Optional" {...field} value={field.value || ''} />
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
              </form>
            </Form>

            {/* Added Items List */}
            {items.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Items to Receive ({items.length})
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Medicine</TableHead>
                        <TableHead>Pharmacy</TableHead>
                        <TableHead>Batch No</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Expiry</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => {
                        const medicine = medicines.find(m => m.id === item.medicineId);
                        const pharmacy = pharmacies.find(p => p.id === item.pharmacyId);
                        const medicineName = medicine?.name || item.medicineName;
                        const pharmacyCode = pharmacy?.code || item.pharmacyId;

                        return (
                          <TableRow key={item.tempId}>
                            <TableCell className="font-medium">
                              {medicineName}
                              {medicine?.strength && ` (${medicine.strength})`}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{pharmacyCode}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{item.batchNo}</TableCell>
                            <TableCell>{item.qtyReceived}</TableCell>
                            <TableCell className="text-sm">{formatDate(item.expiryDate)}</TableCell>
                            <TableCell className="font-mono text-sm">PKR {Number(item.purchasePrice).toFixed(2)}</TableCell>
                            <TableCell>
                              {item.isLP ? (
                                <Badge className="bg-orange-500 text-white">LP</Badge>
                              ) : (
                                <Badge variant="outline">Normal</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeItem(item.tempId)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Info moved to bottom or can be removed */}
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
