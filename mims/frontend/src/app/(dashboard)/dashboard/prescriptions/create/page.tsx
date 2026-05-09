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

const medicineRowSchema = z.object({
  medicineId: z.string().min(1, 'Required'),
  dosage: z.string().optional(),
  instructions: z.string().optional(),
  category: z.enum(['NORMAL', 'LP']),
});

const prescriptionSchema = z.object({
  nrNumber: z.string().optional(),
  prescriptionType: z.enum(['E_PRESCRIPTION', 'SCANNED', 'WRITTEN']),
  scannedImageUrl: z.string().optional(),
  notes: z.string().optional(),
  medicines: z.array(medicineRowSchema).min(1, 'Add at least one medicine'),
});

type PrescriptionFormData = z.infer<typeof prescriptionSchema>;

interface Patient {
  id: string;
  nrNumber: string;
  fullName: string;
  gender: string;
  mobile: string;
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

  const currentHospitalId = selectedHospital?.id || user?.hospitalId;

  const [searchType, setSearchType] = useState<'MRN' | 'CNIC'>('MRN');
  const [searchNR, setSearchNR] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchingPatient, setSearchingPatient] = useState(false);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loadingMedicines, setLoadingMedicines] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      medicines: [{ medicineId: '', dosage: '', instructions: '', category: 'NORMAL' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'medicines' });
  const prescriptionType = watch('prescriptionType');

  useEffect(() => {
    fetchMedicines();
  }, [currentHospitalId]);

  const formatCnic = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 13);
    const p1 = digits.slice(0, 5);
    const p2 = digits.slice(5, 12);
    const p3 = digits.slice(12, 13);
    if (p3) return `${p1}-${p2}-${p3}`;
    if (p2) return `${p1}-${p2}`;
    return p1;
  };

  const fetchMedicines = async () => {
    if (!currentHospitalId) return;
    setLoadingMedicines(true);
    try {
      const res = await api.get('/medicines', { params: { hospitalId: currentHospitalId, limit: 1000 } });
      setMedicines(res.data.data ?? res.data ?? []);
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
    setSearchingPatient(true);
    try {
      const params = searchType === 'MRN' ? { nrNumber: value } : { cnic: value };
      const res = await api.get('/patients', { params });
      const patients = res.data.data ?? [];
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
    if (!selectedPatient) { setError('Please select a patient first'); return; }
    setError(null);
    setSubmitting(true);
    try {
      const payload: any = {
        nrNumber: selectedPatient.nrNumber,
        prescriptionType: data.prescriptionType,
        scannedImageUrl: data.scannedImageUrl || undefined,
        notes: data.notes || undefined,
        prescriptionMedicines: data.medicines.map((m) => ({
          medicineId: m.medicineId,
          dosage: m.dosage || undefined,
          instructions: m.instructions || undefined,
          category: m.category,
        })),
      };

      if (user?.role === 'DOCTOR' || user?.role === 'DOCTOR_ASSISTANT') {
        payload.doctorId = user.id;
      }

      await api.post('/prescriptions', payload);
      router.push('/dashboard/prescriptions');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create prescription');
    } finally {
      setSubmitting(false);
    }
  };

  const medicineOptions = medicines.map((m) => ({
    value: m.id,
    label: m.name,
    sub: [m.genericName, m.strength, m.form].filter(Boolean).join(' · '),
  }));

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Create Prescription</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Prescription is created as Active. Medicines are dispensed separately via the dispatch flow.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Patient Search */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Patient</h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex gap-2 flex-1">
              <select
                value={searchType}
                onChange={(e) => { setSearchType(e.target.value as 'MRN' | 'CNIC'); setSearchNR(''); }}
                className="w-28 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="MRN">MRN</option>
                <option value="CNIC">CNIC</option>
              </select>
              <input
                type="text"
                placeholder={searchType === 'MRN' ? 'MRN-YYYYMMDD-XXXX' : '12345-1234567-1'}
                value={searchNR}
                onChange={(e) => setSearchNR(searchType === 'CNIC' ? formatCnic(e.target.value) : e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchPatient())}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
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
            <h2 className="text-sm font-semibold text-gray-700">Medicines</h2>
            <button
              type="button"
              onClick={() => append({ medicineId: '', dosage: '', instructions: '', category: 'NORMAL' })}
              className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              + Add Row
            </button>
          </div>

          {loadingMedicines ? (
            <p className="text-sm text-gray-400 py-4 text-center">Loading medicines...</p>
          ) : (
            <div className="space-y-3">
              {/* Header */}
              <div className="grid grid-cols-[1fr_120px_160px_90px_28px] gap-2 text-xs font-medium text-gray-500 px-1">
                <span>Medicine</span>
                <span>Dosage</span>
                <span>Instructions</span>
                <span className="text-center">Category</span>
                <span />
              </div>

              {fields.map((field, index) => {
                const selectedMedId = watch(`medicines.${index}.medicineId`);
                const category = watch(`medicines.${index}.category`) ?? 'NORMAL';

                return (
                  <div key={field.id} className="grid grid-cols-[1fr_120px_160px_90px_28px] gap-2 items-start">
                    {/* Medicine select */}
                    <div>
                      <SearchableSelect
                        options={medicineOptions}
                        value={selectedMedId || ''}
                        onValueChange={(val) =>
                          setValue(`medicines.${index}.medicineId`, val, { shouldValidate: true })
                        }
                        placeholder="Select medicine..."
                        searchPlaceholder="Search by name or generic..."
                      />
                      {errors.medicines?.[index]?.medicineId && (
                        <p className="text-red-500 text-xs mt-0.5">
                          {errors.medicines[index]?.medicineId?.message}
                        </p>
                      )}
                    </div>

                    {/* Dosage */}
                    <input
                      type="text"
                      {...register(`medicines.${index}.dosage`)}
                      placeholder="e.g. 1 tablet"
                      className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />

                    {/* Instructions */}
                    <input
                      type="text"
                      {...register(`medicines.${index}.instructions`)}
                      placeholder="e.g. after meals"
                      className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />

                    {/* Category toggle */}
                    <div className="flex items-center justify-center gap-1 pt-1">
                      <span className="text-xs text-gray-400">N</span>
                      <input
                        type="checkbox"
                        checked={category === 'LP'}
                        onChange={(e) =>
                          setValue(`medicines.${index}.category`, e.target.checked ? 'LP' : 'NORMAL')
                        }
                        className="w-8 h-4 appearance-none bg-gray-200 rounded-full relative cursor-pointer transition-colors checked:bg-orange-400 before:content-[''] before:absolute before:w-4 before:h-4 before:rounded-full before:bg-white before:shadow before:transition-transform checked:before:translate-x-4"
                      />
                      <span className={`text-xs ${category === 'LP' ? 'text-orange-600 font-medium' : 'text-gray-400'}`}>
                        LP
                      </span>
                    </div>

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => fields.length > 1 && remove(index)}
                      disabled={fields.length === 1}
                      className="text-gray-400 hover:text-red-600 disabled:opacity-30 text-lg leading-none pt-1"
                    >
                      ×
                    </button>
                  </div>
                );
              })}

              {errors.medicines && typeof errors.medicines.message === 'string' && (
                <p className="text-red-500 text-sm">{errors.medicines.message}</p>
              )}
            </div>
          )}
        </div>

        {/* Type + Notes */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Prescription Type</label>
              <select
                {...register('prescriptionType')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="E_PRESCRIPTION">E-Prescription</option>
                <option value="WRITTEN">Written</option>
                <option value="SCANNED">Scanned</option>
              </select>
            </div>

            {prescriptionType === 'SCANNED' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Scanned Image URL</label>
                <input
                  type="text"
                  {...register('scannedImageUrl')}
                  placeholder="Image URL or upload path"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div className={prescriptionType === 'SCANNED' ? '' : 'sm:col-span-1'}>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Notes <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                {...register('notes')}
                placeholder="Additional notes..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
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
            {submitting ? 'Creating...' : 'Create Prescription'}
          </button>
        </div>
      </form>
    </div>
  );
}
