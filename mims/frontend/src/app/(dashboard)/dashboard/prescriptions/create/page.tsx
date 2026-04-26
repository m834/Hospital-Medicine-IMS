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

const prescriptionItemSchema = z.object({
  medicineId: z.string().min(1, 'Medicine is required'),
  qtyPrescribed: z.number().min(1, 'Quantity must be at least 1'),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  duration: z.string().optional(),
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

interface Medicine {
  id: string;
  name: string;
  genericName?: string;
  strength?: string;
  form: string;
}

interface StockBatch {
  id: string;
  qtyAvailable: number;
  expiryDate: string;
  status: string;
  medicine: Medicine;
}

export default function CreatePrescriptionPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();
  const [searchType, setSearchType] = useState<'MRN' | 'CNIC'>('MRN');
  const [searchNR, setSearchNR] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchingPatient, setSearchingPatient] = useState(false);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loadingMedicines, setLoadingMedicines] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      items: [{ medicineId: '', qtyPrescribed: 1, dosage: '', frequency: '', duration: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

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

      if (user?.pharmacyId) {
        params.pharmacyId = user.pharmacyId;
      }

      const response = await api.get('/inventory/batches', { params });
      const batches: StockBatch[] = response.data.data || [];

      const availableMedicines = new Map<string, { medicine: Medicine; expiryDate: string }>();

      batches
        .filter((batch) => batch.qtyAvailable > 0 && new Date(batch.expiryDate) >= today)
        .forEach((batch) => {
          const existing = availableMedicines.get(batch.medicine.id);
          if (!existing || new Date(batch.expiryDate) < new Date(existing.expiryDate)) {
            availableMedicines.set(batch.medicine.id, {
              medicine: batch.medicine,
              expiryDate: batch.expiryDate,
            });
          }
        });

      setMedicines(Array.from(availableMedicines.values()).map((entry) => entry.medicine));
    } catch (error: any) {
      console.error('Failed to fetch medicines:', error);
      alert('Failed to load medicines');
    } finally {
      setLoadingMedicines(false);
    }
  };

  const searchPatient = async () => {
    if (!searchNR.trim()) {
      alert(`Please enter ${searchType === 'MRN' ? 'MRN' : 'CNIC'}`);
      return;
    }

    try {
      setSearchingPatient(true);
      const params =
        searchType === 'MRN'
          ? { nrNumber: searchNR.trim() }
          : { cnic: searchNR.trim() };

      const response = await api.get(`/patients`, { params });

      const patients = response.data.data || [];
      if (patients.length === 0) {
        alert('Patient not found');
        setSelectedPatient(null);
        return;
      }

      const patient = patients[0];
      setSelectedPatient(patient);
      setValue('nrNumber', patient.nrNumber);
    } catch (error: any) {
      console.error('Failed to search patient:', error);
      alert(error.response?.data?.message || 'Failed to search patient');
      setSelectedPatient(null);
    } finally {
      setSearchingPatient(false);
    }
  };

  const onSubmit = async (data: PrescriptionFormData) => {
    if (!user?.id) {
      alert('User not authenticated');
      return;
    }

    try {
      setSubmitting(true);

      // Prepare prescription data
      const prescriptionData: any = {
        ...data,
        items: data.items.map((item) => ({
          medicineId: item.medicineId,
          qtyPrescribed: Number(item.qtyPrescribed),
          dosage: item.dosage || undefined,
          frequency: item.frequency || undefined,
          duration: item.duration || undefined,
        })),
      };

      // Only include doctorId if the user is a doctor
      if (user.role === 'DOCTOR' || user.role === 'DOCTOR_ASSISTANT') {
        prescriptionData.doctorId = user.id;
      }

      const response = await api.post('/prescriptions', prescriptionData);

      alert('Prescription created successfully!');
      router.push('/dashboard/prescriptions');
    } catch (error: any) {
      console.error('Failed to create prescription:', error);
      alert(error.response?.data?.message || 'Failed to create prescription');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Create Prescription</h1>
        <p className="text-gray-600 mt-1">Create a new prescription for a patient</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Patient Search Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Patient Information</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search Patient by {searchType === 'MRN' ? 'MRN' : 'CNIC'}
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value as 'MRN' | 'CNIC')}
                  className="w-full sm:w-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="MRN">MRN</option>
                  <option value="CNIC">CNIC</option>
                </select>
                <input
                  type="text"
                  placeholder={
                    searchType === 'MRN'
                      ? 'Enter MRN (e.g., MRN-20251128-0001)'
                      : 'Enter CNIC (e.g., 12345-1234567-1)'
                  }
                  value={searchNR}
                  onChange={(e) =>
                    setSearchNR(
                      searchType === 'CNIC' ? formatCnic(e.target.value) : e.target.value,
                    )
                  }
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), searchPatient())}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={searchPatient}
                  disabled={searchingPatient}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                >
                  {searchingPatient ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>

            {selectedPatient && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Patient Name</p>
                    <p className="font-semibold">{selectedPatient.fullName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">MRN</p>
                    <p className="font-semibold">{selectedPatient.nrNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Gender</p>
                    <p className="font-semibold">{selectedPatient.gender}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Mobile</p>
                    <p className="font-semibold">{selectedPatient.mobile}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Visit Type</p>
                    <p className="font-semibold">{selectedPatient.visitType}</p>
                  </div>
                  {selectedPatient.department && (
                    <div>
                      <p className="text-sm text-gray-600">Department</p>
                      <p className="font-semibold">{selectedPatient.department}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Prescription Details Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Prescription Details</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prescription Type <span className="text-red-500">*</span>
              </label>
              <select
                {...register('prescriptionType')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="E_PRESCRIPTION">E-Prescription</option>
                <option value="WRITTEN">Written Prescription</option>
                <option value="SCANNED">Scanned Prescription</option>
              </select>
              {errors.prescriptionType && (
                <p className="text-red-500 text-sm mt-1">{errors.prescriptionType.message}</p>
              )}
            </div>

            {prescriptionType === 'SCANNED' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scanned Image URL
                </label>
                <input
                  type="text"
                  {...register('scannedImageUrl')}
                  placeholder="Enter image URL or upload path"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {errors.scannedImageUrl && (
                  <p className="text-red-500 text-sm mt-1">{errors.scannedImageUrl.message}</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
              </label>
              <textarea
                {...register('notes')}
                rows={3}
                placeholder="Any additional notes or instructions..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {errors.notes && (
                <p className="text-red-500 text-sm mt-1">{errors.notes.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Medicines Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Prescribed Medicines</h2>
            <button
              type="button"
              onClick={() =>
                append({ medicineId: '', qtyPrescribed: 1, dosage: '', frequency: '', duration: '' })
              }
              className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
            >
              + Add Medicine
            </button>
          </div>

          {loadingMedicines ? (
            <p className="text-gray-500 text-center py-4">Loading medicines...</p>
          ) : (
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-medium text-gray-700">Medicine #{index + 1}</h3>
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Medicine <span className="text-red-500">*</span>
                      </label>
                      <SearchableSelect
                        options={medicines.map((m) => ({
                          value: m.id,
                          label: m.name,
                          sub: [m.genericName, m.strength, m.form].filter(Boolean).join(' · '),
                        }))}
                        value={watch(`items.${index}.medicineId`) || ''}
                        onValueChange={(val) => setValue(`items.${index}.medicineId`, val, { shouldValidate: true })}
                        placeholder="Select medicine..."
                        searchPlaceholder="Search medicine by name, generic or strength..."
                      />
                      {errors.items?.[index]?.medicineId && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors.items[index]?.medicineId?.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantity <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        {...register(`items.${index}.qtyPrescribed`, { valueAsNumber: true })}
                        min="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      {errors.items?.[index]?.qtyPrescribed && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors.items[index]?.qtyPrescribed?.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Dosage
                      </label>
                      <input
                        type="text"
                        {...register(`items.${index}.dosage`)}
                        placeholder="e.g., 500mg"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Frequency
                      </label>
                      <input
                        type="text"
                        {...register(`items.${index}.frequency`)}
                        placeholder="e.g., Twice daily"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Duration
                      </label>
                      <input
                        type="text"
                        {...register(`items.${index}.duration`)}
                        placeholder="e.g., 7 days"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {errors.items && typeof errors.items.message === 'string' && (
                <p className="text-red-500 text-sm">{errors.items.message}</p>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-end">
          <button
            type="button"
            onClick={() => router.push('/dashboard/prescriptions')}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !selectedPatient}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
          >
            {submitting ? 'Creating...' : 'Create Prescription'}
          </button>
        </div>
      </form>
    </div>
  );
}
