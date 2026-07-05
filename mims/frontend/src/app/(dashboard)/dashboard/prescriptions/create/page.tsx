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

type DosageFrequency = 'OD' | 'BID' | 'TDS' | 'SOS';

// Frequency → default issue quantity. SOS is manual (null).
const FREQ_QTY: Record<DosageFrequency, number | null> = { OD: 1, BID: 2, TDS: 3, SOS: null };

const medicineRowSchema = z.object({
  medicineId: z.string().min(1, 'Required'),
  dosageFrequency: z.enum(['OD', 'BID', 'TDS', 'SOS', '']).optional(),
  quantity: z.coerce.number().int().min(1, 'Min 1'),
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

interface Availability {
  medicineId: string;
  normalStock: number;
  lpStock: number;
  totalStock: number;
}

interface TemplateItem {
  medicine: { id: string; name: string };
  dosageFrequency: DosageFrequency | null;
  quantity: number | null;
  category: 'NORMAL' | 'LP';
}

interface Template {
  id: string;
  name: string;
  description?: string | null;
  pharmacy?: { id: string; name: string };
  items: TemplateItem[];
}

export default function CreatePrescriptionPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();

  const currentHospitalId = selectedHospital?.id || user?.hospitalId;
  const pharmacyId = user?.pharmacyId;

  const [searchType, setSearchType] = useState<'MRN' | 'CNIC'>('MRN');
  const [searchNR, setSearchNR] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchingPatient, setSearchingPatient] = useState(false);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [availability, setAvailability] = useState<Record<string, Availability>>({});
  const [loadingMedicines, setLoadingMedicines] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [templateNotice, setTemplateNotice] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useForm<PrescriptionFormData>({
    resolver: zodResolver(prescriptionSchema),
    defaultValues: {
      prescriptionType: 'E_PRESCRIPTION',
      medicines: [{ medicineId: '', dosageFrequency: '', quantity: 1, category: 'NORMAL' }],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'medicines' });
  const prescriptionType = watch('prescriptionType');

  useEffect(() => {
    loadMedicines();
    loadTemplates();
  }, [currentHospitalId, pharmacyId]);

  // Load pharmacy-owned prescription templates the user is allowed to see.
  const loadTemplates = async () => {
    if (!currentHospitalId) return;
    try {
      const res = await api.get('/medicine-templates', { params: { hospitalId: currentHospitalId } });
      setTemplates(res.data ?? []);
    } catch {
      // Templates are optional — a failure here should not block prescribing.
      setTemplates([]);
    }
  };

  // Drop every medicine in the chosen template into the rows in one go.
  const applyTemplate = (template: Template) => {
    setTemplateMenuOpen(false);
    const rows = template.items.map((it) => {
      const freq = (it.dosageFrequency ?? '') as DosageFrequency | '';
      const qty = it.quantity ?? (freq && freq !== 'SOS' ? FREQ_QTY[freq] ?? 1 : 1);
      return {
        medicineId: it.medicine.id,
        dosageFrequency: freq,
        quantity: qty ?? 1,
        category: (it.category ?? 'NORMAL') as 'NORMAL' | 'LP',
      };
    });
    if (rows.length === 0) return;

    // Replace the lone blank starter row; otherwise append to what's there.
    const current = getValues('medicines');
    const isBlankStart = current.length === 1 && !current[0]?.medicineId;
    replace(isBlankStart ? rows : [...current, ...rows]);
    setTemplateNotice(`Added ${rows.length} medicine${rows.length > 1 ? 's' : ''} from "${template.name}"`);
  };

  const formatCnic = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 13);
    const p1 = digits.slice(0, 5);
    const p2 = digits.slice(5, 12);
    const p3 = digits.slice(12, 13);
    if (p3) return `${p1}-${p2}-${p3}`;
    if (p2) return `${p1}-${p2}`;
    return p1;
  };

  // Load medicine catalogue + live pharmacy stock, then keep only in-stock medicines.
  const loadMedicines = async () => {
    if (!currentHospitalId) return;
    setLoadingMedicines(true);
    try {
      const [medRes, availRes] = await Promise.all([
        api.get('/medicines', { params: { hospitalId: currentHospitalId, limit: 1000 } }),
        pharmacyId
          ? api.get(`/inventory/availability/${pharmacyId}`)
          : Promise.resolve({ data: [] as Availability[] }),
      ]);
      setMedicines(medRes.data.data ?? medRes.data ?? []);
      const map: Record<string, Availability> = {};
      (availRes.data ?? []).forEach((a: Availability) => { map[a.medicineId] = a; });
      setAvailability(map);
    } catch {
      setError('Failed to load medicines / stock. Please refresh.');
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

  // Remaining stock for a given medicine + category (live from pharmacy inventory).
  const remainingFor = (medicineId: string, category: 'NORMAL' | 'LP'): number | null => {
    if (!medicineId) return null;
    const a = availability[medicineId];
    if (!a) return 0;
    return category === 'LP' ? a.lpStock : a.normalStock;
  };

  const handleFreqChange = (index: number, freq: string) => {
    setValue(`medicines.${index}.dosageFrequency`, freq as DosageFrequency | '');
    const mapped = freq ? FREQ_QTY[freq as DosageFrequency] : undefined;
    if (mapped != null) {
      setValue(`medicines.${index}.quantity`, mapped, { shouldValidate: true });
    }
  };

  const onSubmit = async (data: PrescriptionFormData) => {
    if (!selectedPatient) { setError('Please select a patient first'); return; }
    if (!pharmacyId) { setError('Your account has no pharmacy assigned — dispensing is unavailable.'); return; }

    // Block rows that exceed live stock before hitting the server.
    const overStock = data.medicines.find(
      (m) => (remainingFor(m.medicineId, m.category) ?? 0) < m.quantity,
    );
    if (overStock) {
      setError('One or more medicines exceed available stock. Adjust the quantity.');
      return;
    }

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
          dosageFrequency: m.dosageFrequency || undefined,
          quantity: m.quantity,
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

  // Only medicines that currently have stock in this pharmacy.
  const medicineOptions = medicines
    .filter((m) => (availability[m.id]?.totalStock ?? 0) > 0)
    .map((m) => ({
      value: m.id,
      label: m.name,
      sub: [m.genericName, m.strength, m.form].filter(Boolean).join(' · '),
    }));

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Create Prescription</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          The first dose is dispensed and deducted from inventory when you create the prescription.
          Further doses can be dispatched later from the prescriptions list.
        </p>
      </div>

      {!pharmacyId && (
        <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
          Your account has no pharmacy assigned, so live stock and dispensing are unavailable on this screen.
        </div>
      )}

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
            <div className="flex items-center gap-2">
              {/* Select Template — fills all its medicines in one click */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setTemplateMenuOpen((o) => !o)}
                  disabled={templates.length === 0}
                  className="px-3 py-1 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  title={templates.length === 0 ? 'No templates available' : 'Load medicines from a template'}
                >
                  Select Template ▾
                </button>
                {templateMenuOpen && templates.length > 0 && (
                  <div className="absolute right-0 z-20 mt-1 w-72 max-h-72 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => applyTemplate(t)}
                        className="w-full text-left px-3 py-2 hover:bg-indigo-50 transition-colors"
                      >
                        <span className="block text-sm font-medium text-gray-800">{t.name}</span>
                        <span className="block text-xs text-gray-500">
                          {t.items.length} medicine{t.items.length === 1 ? '' : 's'}
                          {t.pharmacy?.name ? ` · ${t.pharmacy.name}` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => append({ medicineId: '', dosageFrequency: '', quantity: 1, category: 'NORMAL' })}
                className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                + Add Row
              </button>
            </div>
          </div>

          {templateNotice && (
            <div className="mb-3 flex items-center justify-between bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-md px-3 py-2 text-xs">
              <span>{templateNotice}</span>
              <button type="button" onClick={() => setTemplateNotice(null)} className="text-indigo-500 hover:text-indigo-700">×</button>
            </div>
          )}

          {loadingMedicines ? (
            <p className="text-sm text-gray-400 py-4 text-center">Loading medicines...</p>
          ) : (
            <div className="space-y-3">
              {/* Header */}
              <div className="grid grid-cols-[1fr_120px_90px_90px_90px_28px] gap-2 text-xs font-medium text-gray-500 px-1">
                <span>Medicine</span>
                <span>Frequency</span>
                <span className="text-center">Quantity</span>
                <span className="text-center">Remaining</span>
                <span className="text-center">Category</span>
                <span />
              </div>

              {fields.map((field, index) => {
                const selectedMedId = watch(`medicines.${index}.medicineId`);
                const category = watch(`medicines.${index}.category`) ?? 'NORMAL';
                const freq = watch(`medicines.${index}.dosageFrequency`) ?? '';
                const quantity = watch(`medicines.${index}.quantity`) ?? 1;
                const remaining = remainingFor(selectedMedId, category);
                const qtyDisabled = !!freq && freq !== 'SOS';
                const overStock = remaining !== null && quantity > remaining;

                return (
                  <div key={field.id} className="grid grid-cols-[1fr_120px_90px_90px_90px_28px] gap-2 items-start">
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

                    {/* Frequency */}
                    <select
                      value={freq}
                      onChange={(e) => handleFreqChange(index, e.target.value)}
                      className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">—</option>
                      <option value="OD">OD (×1/day)</option>
                      <option value="BID">BID (×2/day)</option>
                      <option value="TDS">TDS (×3/day)</option>
                      <option value="SOS">SOS (if needed)</option>
                    </select>

                    {/* Quantity */}
                    <input
                      type="number"
                      min={1}
                      {...register(`medicines.${index}.quantity`, { valueAsNumber: true })}
                      disabled={qtyDisabled}
                      className={`w-full px-2 py-2 border rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed ${
                        overStock ? 'border-red-400 text-red-600' : 'border-gray-300'
                      }`}
                    />

                    {/* Remaining */}
                    <div className="flex items-center justify-center pt-2">
                      {selectedMedId ? (
                        <span className={`text-sm font-semibold ${
                          remaining && remaining > 0 ? 'text-green-600' : 'text-red-500'
                        }`}>
                          {remaining ?? '—'}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-300">—</span>
                      )}
                    </div>

                    {/* Category toggle */}
                    <div className="flex items-center justify-center gap-1 pt-2">
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
                      className="text-gray-400 hover:text-red-600 disabled:opacity-30 text-lg leading-none pt-2"
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
            disabled={submitting || !selectedPatient || !pharmacyId}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
          >
            {submitting ? 'Creating...' : 'Create & Dispense First Dose'}
          </button>
        </div>
      </form>
    </div>
  );
}
