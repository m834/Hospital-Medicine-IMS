'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import { SearchableSelect } from '@/components/ui/searchable-select';

const PHARMACIST_ROLES = ['MAIN_PHARMACY_MANAGER', 'SUB_PHARMACY_MANAGER', 'PHARMACY_STAFF'];

const prescriptionItemSchema = z.object({
  medicineId: z.string().min(1, 'Medicine is required'),
  qtyPrescribed: z.number().min(1, 'Quantity must be at least 1'),
  transferCategory: z.enum(['NORMAL', 'LP']),
});

const prescriptionSchema = z.object({
  nrNumber: z.string().optional(),
  prescriptionType: z.enum(['E_PRESCRIPTION', 'SCANNED', 'WRITTEN']),
  scannedImageUrl: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(prescriptionItemSchema).min(1, 'At least one medicine is required'),
});

type PrescriptionFormData = z.infer<typeof prescriptionSchema>;

interface Patient {
  id: string;
  nrNumber: string;
  fullName: string;
  gender: string;
  mobile: string;
  visitType: string;
  department?: string;
}

interface MedicineStockInfo {
  id: string;
  name: string;
  genericName?: string;
  strength?: string;
  form: string;
  normalStock: number;
  lpStock: number;
}

export default function CreatePrescriptionPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();
  const [searchType, setSearchType] = useState<'MRN' | 'CNIC'>('MRN');
  const [searchNR, setSearchNR] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchingPatient, setSearchingPatient] = useState(false);
  const [medicineStock, setMedicineStock] = useState<Map<string, MedicineStockInfo>>(new Map());
  const [loadingMedicines, setLoadingMedicines] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPharmacist = PHARMACIST_ROLES.includes(user?.role || '');

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PrescriptionFormData>({
    resolver: zodResolver(prescriptionSchema),
    defaultValues: {
      prescriptionType: 'E_PRESCRIPTION',
      items: [{ medicineId: '', qtyPrescribed: 1, transferCategory: 'NORMAL' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const prescriptionType = watch('prescriptionType');

  useEffect(() => {
    fetchMedicines();
  }, [selectedHospital]);

  const formatCnic = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 13);
    const part1 = digits.slice(0, 5);
    const part2 = digits.slice(5, 12);
    const part3 = digits.slice(12, 13);
    if (part3) return `${part1}-${part2}-${part3}`;
    if (part2) return `${part1}-${part2}`;
    return part1;
  };

  const fetchMedicines = async () => {
    try {
      setLoadingMedicines(true);
      const today = new Date();
      const params: any = {
        status: 'AVAILABLE',
        expiringAfter: today.toISOString(),
        sortBy: 'expiryDate',
        sortOrder: 'asc',
        limit: 2000,
      };
      if (user?.pharmacyId) params.pharmacyId = user.pharmacyId;

      // Fetch both NORMAL and LP batches in parallel
      const [normalResponse, lpResponse] = await Promise.all([
        api.get('/inventory/batches', { params: { ...params, category: 'NORMAL' } }),
        api.get('/inventory/batches', { params: { ...params, category: 'LP' } }),
      ]);

      const normalBatches = (normalResponse.data.data || []) as Array<{
        id: string;
        qtyAvailable: number;
        expiryDate: string;
        status: string;
        medicine: {
          id: string;
          name: string;
          genericName?: string;
          strength?: string;
          form: string;
        };
      }>;
      const lpBatches = (lpResponse.data.data || []) as typeof normalBatches;

      const stockMap = new Map<string, MedicineStockInfo>();

      normalBatches
        .filter((b) => b.qtyAvailable > 0 && new Date(b.expiryDate) >= today)
        .forEach((b) => {
          const existing = stockMap.get(b.medicine.id);
          if (existing) {
            existing.normalStock += b.qtyAvailable;
          } else {
            stockMap.set(b.medicine.id, {
              ...b.medicine,
              normalStock: b.qtyAvailable,
              lpStock: 0,
            });
          }
        });

      lpBatches
        .filter((b) => b.qtyAvailable > 0 && new Date(b.expiryDate) >= today)
        .forEach((b) => {
          const existing = stockMap.get(b.medicine.id);
          if (existing) {
            existing.lpStock += b.qtyAvailable;
          } else {
            stockMap.set(b.medicine.id, {
              ...b.medicine,
              normalStock: 0,
              lpStock: b.qtyAvailable,
            });
          }
        });

      setMedicineStock(stockMap);
    } catch {
      setError('Failed to load medicines. Please refresh.');
    } finally {
      setLoadingMedicines(false);
    }
  };

  const searchPatient = async () => {
    const value = searchNR.trim();
    if (!value) return;
    setError(null);
    try {
      setSearchingPatient(true);
      const params = searchType === 'MRN' ? { nrNumber: value } : { cnic: value };
      const response = await api.get('/patients', { params });
      const patients = response.data.data || [];
      if (patients.length === 0) {
        setError('Patient not found');
        setSelectedPatient(null);
        return;
      }
      const patient = patients[0];
      setSelectedPatient(patient);
      setValue('nrNumber', patient.nrNumber);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to search patient');
      setSelectedPatient(null);
    } finally {
      setSearchingPatient(false);
    }
  };

  const onSubmit = async (data: PrescriptionFormData) => {
    if (!user?.id) { setError('User not authenticated'); return; }
    if (!selectedPatient) { setError('Please select a patient first'); return; }
    setError(null);

    // Validate per-category stock for pharmacists
    if (isPharmacist) {
      for (const item of data.items) {
        const info = medicineStock.get(item.medicineId);
        if (!info) continue;
        const available =
          item.transferCategory === 'LP' ? info.lpStock : info.normalStock;
        if (available < item.qtyPrescribed) {
          const medName = info.name;
          const cat = item.transferCategory === 'LP' ? 'LP' : 'Normal';
          setError(
            `Insufficient ${cat} stock for ${medName}. Available: ${available}, Requested: ${item.qtyPrescribed}`
          );
          return;
        }
      }
    }

    try {
      setSubmitting(true);

      const prescriptionData: any = {
        ...data,
        items: data.items.map((item) => ({
          medicineId: item.medicineId,
          qtyPrescribed: Number(item.qtyPrescribed),
          transferCategory: item.transferCategory ?? 'NORMAL',
        })),
      };

      if (user.role === 'DOCTOR' || user.role === 'DOCTOR_ASSISTANT') {
        prescriptionData.doctorId = user.id;
      }

      if (isPharmacist) prescriptionData.autoIssue = true;

      await api.post('/prescriptions', prescriptionData);

      router.push('/dashboard/prescriptions');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to process prescription');
    } finally {
      setSubmitting(false);
    }
  };

  const medicines = Array.from(medicineStock.values());

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-800">
          {isPharmacist ? 'Issue & Dispense Medicine' : 'Create Prescription'}
        </h1>
        {isPharmacist && (
          <p className="text-sm text-gray-500 mt-0.5">
            Medicine will be deducted from your pharmacy's inventory upon submission.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Patient Search */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex gap-2 flex-1">
              <select
                value={searchType}
                onChange={(e) => {
                  setSearchType(e.target.value as 'MRN' | 'CNIC');
                  setSearchNR('');
                }}
                className="w-28 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="MRN">MRN</option>
                <option value="CNIC">CNIC</option>
              </select>
              <input
                type="text"
                placeholder={searchType === 'MRN' ? 'MRN-YYYYMMDD-XXXX' : '12345-1234567-1'}
                value={searchNR}
                onChange={(e) =>
                  setSearchNR(
                    searchType === 'CNIC' ? formatCnic(e.target.value) : e.target.value
                  )
                }
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchPatient())}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={searchPatient}
              disabled={searchingPatient || !searchNR.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
            >
              {searchingPatient ? 'Searching...' : 'Search'}
            </button>
          </div>

          {selectedPatient && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
              <span className="font-semibold text-blue-900">{selectedPatient.fullName}</span>
              <span className="text-blue-700">{selectedPatient.nrNumber}</span>
              <span className="text-blue-600">{selectedPatient.gender}</span>
              <span className="text-blue-600">{selectedPatient.mobile}</span>
              {selectedPatient.department && (
                <span className="text-blue-600">{selectedPatient.department}</span>
              )}
            </div>
          )}
        </div>

        {/* Medicines */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-semibold text-gray-800">Medicines</h2>
            <button
              type="button"
              onClick={() => append({ medicineId: '', qtyPrescribed: 1, transferCategory: 'NORMAL' })}
              className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              + Add
            </button>
          </div>

          {loadingMedicines ? (
            <p className="text-sm text-gray-400 py-4 text-center">Loading medicines...</p>
          ) : (
            <div className="space-y-2">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_64px_80px_100px_100px_32px] gap-2 text-xs font-medium text-gray-500 px-1">
                <span>Medicine</span>
                <span className="text-center">Qty</span>
                <span className="text-center">Normal</span>
                <span className="text-center">LP</span>
                <span className="text-center">LP Toggle</span>
                <span />
              </div>

              {fields.map((field, index) => {
                const selectedMedId = watch(`items.${index}.medicineId`);
                const qty = watch(`items.${index}.qtyPrescribed`) || 0;
                const category = watch(`items.${index}.transferCategory`) ?? 'NORMAL';
                const info = medicineStock.get(selectedMedId);

                const normalStock = info?.normalStock ?? null;
                const lpStock = info?.lpStock ?? null;
                const activeStock = category === 'LP' ? lpStock : normalStock;
                const stockWarning = activeStock !== null && qty > activeStock;

                return (
                  <div
                    key={field.id}
                    className="grid grid-cols-[1fr_64px_80px_100px_100px_32px] gap-2 items-center"
                  >
                    {/* Medicine Select */}
                    <div>
                      <SearchableSelect
                        options={medicines.map((m) => ({
                          value: m.id,
                          label: m.name,
                          sub: [m.genericName, m.strength, m.form].filter(Boolean).join(' · '),
                        }))}
                        value={selectedMedId || ''}
                        onValueChange={(val) =>
                          setValue(`items.${index}.medicineId`, val, { shouldValidate: true })
                        }
                        placeholder="Select medicine..."
                        searchPlaceholder="Search by name, generic or strength..."
                      />
                      {errors.items?.[index]?.medicineId && (
                        <p className="text-red-500 text-xs mt-0.5">
                          {errors.items[index]?.medicineId?.message}
                        </p>
                      )}
                    </div>

                    {/* Quantity */}
                    <div>
                      <input
                        type="number"
                        {...register(`items.${index}.qtyPrescribed`, { valueAsNumber: true })}
                        min="1"
                        className={`w-full px-2 py-2 border rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          stockWarning ? 'border-red-400 bg-red-50' : 'border-gray-300'
                        }`}
                      />
                      {errors.items?.[index]?.qtyPrescribed && (
                        <p className="text-red-500 text-xs mt-0.5">
                          {errors.items[index]?.qtyPrescribed?.message}
                        </p>
                      )}
                    </div>

                    {/* Normal Stock */}
                    <div className="text-center text-xs">
                      {normalStock === null ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <span
                          className={
                            category === 'NORMAL' && stockWarning
                              ? 'text-red-600 font-medium'
                              : 'text-green-700'
                          }
                        >
                          {normalStock}
                        </span>
                      )}
                    </div>

                    {/* LP Stock */}
                    <div className="text-center text-xs">
                      {lpStock === null ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <span
                          className={
                            category === 'LP' && stockWarning
                              ? 'text-red-600 font-medium'
                              : 'text-orange-600'
                          }
                        >
                          {lpStock}
                        </span>
                      )}
                    </div>

                    {/* LP Toggle */}
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-xs text-gray-400">N</span>
                      <input
                        type="checkbox"
                        checked={category === 'LP'}
                        onChange={(e) =>
                          setValue(
                            `items.${index}.transferCategory`,
                            e.target.checked ? 'LP' : 'NORMAL'
                          )
                        }
                        className="w-8 h-4 appearance-none bg-gray-200 rounded-full relative cursor-pointer transition-colors checked:bg-orange-400 before:content-[''] before:absolute before:w-4 before:h-4 before:rounded-full before:bg-white before:shadow before:transition-transform checked:before:translate-x-4"
                        title={`Currently: ${category} stock`}
                      />
                      <span className={`text-xs ${category === 'LP' ? 'text-orange-600 font-medium' : 'text-gray-400'}`}>LP</span>
                    </div>

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => fields.length > 1 && remove(index)}
                      disabled={fields.length === 1}
                      className="text-gray-400 hover:text-red-600 disabled:opacity-30 text-lg leading-none"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                );
              })}

              {errors.items && typeof errors.items.message === 'string' && (
                <p className="text-red-500 text-sm">{errors.items.message}</p>
              )}
            </div>
          )}
        </div>

        {/* Type + Notes */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!isPharmacist && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Prescription Type
                </label>
                <select
                  {...register('prescriptionType')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="E_PRESCRIPTION">E-Prescription</option>
                  <option value="WRITTEN">Written</option>
                  <option value="SCANNED">Scanned</option>
                </select>
              </div>
            )}

            {prescriptionType === 'SCANNED' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Scanned Image URL
                </label>
                <input
                  type="text"
                  {...register('scannedImageUrl')}
                  placeholder="Image URL or upload path"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}

            <div className={!isPharmacist ? '' : 'sm:col-span-2'}>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Notes <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                {...register('notes')}
                placeholder="Additional notes or instructions..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => router.push('/dashboard/prescriptions')}
            className="px-5 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !selectedPatient}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
          >
            {submitting
              ? isPharmacist
                ? 'Dispensing...'
                : 'Creating...'
              : isPharmacist
              ? 'Issue & Dispense'
              : 'Create Prescription'}
          </button>
        </div>
      </form>
    </div>
  );
}
