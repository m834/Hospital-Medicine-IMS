'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';

const prescriptionItemSchema = z.object({
  medicineId: z.string().min(1, 'Medicine is required'),
  qtyPrescribed: z.number().min(1, 'Quantity must be at least 1'),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  duration: z.string().optional(),
});

const prescriptionSchema = z.object({
  nrNumber: z.string().min(1, 'Patient NR Number is required'),
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

export default function CreatePrescriptionPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();
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
    if (selectedHospital?.id) {
      fetchMedicines();
    }
  }, [selectedHospital]);

  const fetchMedicines = async () => {
    if (!selectedHospital?.id) return;
    
    try {
      setLoadingMedicines(true);
      const response = await api.get('/medicines', {
        params: { 
          hospitalId: selectedHospital.id,
          limit: 500, 
          status: 'ACTIVE' 
        },
      });
      setMedicines(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch medicines:', error);
      alert('Failed to load medicines');
    } finally {
      setLoadingMedicines(false);
    }
  };

  const searchPatient = async () => {
    if (!searchNR.trim()) {
      alert('Please enter NR Number');
      return;
    }

    try {
      setSearchingPatient(true);
      const response = await api.get(`/patients`, {
        params: { nrNumber: searchNR.trim() },
      });

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

      // Prepare prescription data with doctorId
      const prescriptionData = {
        ...data,
        doctorId: user.id,
        items: data.items.map((item) => ({
          medicineId: item.medicineId,
          qtyPrescribed: Number(item.qtyPrescribed),
          dosage: item.dosage || undefined,
          frequency: item.frequency || undefined,
          duration: item.duration || undefined,
        })),
      };

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
                Search Patient by NR Number <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter NR Number (e.g., NR-20251128-0001)"
                  value={searchNR}
                  onChange={(e) => setSearchNR(e.target.value)}
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
              {errors.nrNumber && (
                <p className="text-red-500 text-sm mt-1">{errors.nrNumber.message}</p>
              )}
            </div>

            {selectedPatient && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Patient Name</p>
                    <p className="font-semibold">{selectedPatient.fullName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">NR Number</p>
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
                      <select
                        {...register(`items.${index}.medicineId`)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select medicine...</option>
                        {medicines.map((medicine) => (
                          <option key={medicine.id} value={medicine.id}>
                            {medicine.name}
                            {medicine.genericName && ` (${medicine.genericName})`}
                            {medicine.strength && ` - ${medicine.strength}`}
                            {` - ${medicine.form}`}
                          </option>
                        ))}
                      </select>
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
