'use client';

/**
 * Bulk Prescription Entry by Ward (indoor patients)
 *
 * Same fields, same stock rules and the same records as the single-patient
 * form — only the entry point and layout differ. Each patient block holds as
 * many medicines as needed and is saved as ONE prescription, exactly as the
 * normal flow produces.
 *
 * A ward is a Room, and each room belongs to a sub-pharmacy; the dropdown
 * lists only the rooms this pharmacy looks after.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  Search,
  CheckCircle,
  ClipboardList,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import api from '@/lib/api';
import { fetchAllMedicines } from '@/lib/medicines';
import { formatMRN } from '@/lib/mrn';

type DosageFrequency = 'OD' | 'BID' | 'TDS' | 'SOS';

// Frequency -> default issue quantity, matching the single-patient form
const FREQ_QTY: Record<DosageFrequency, number | null> = { OD: 1, BID: 2, TDS: 3, SOS: null };

interface Room {
  id: string;
  roomNumber: string;
  roomType: string;
  department?: { name: string } | null;
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
  items: TemplateItem[];
}

interface MedicineRow {
  id: string;
  medicineId: string;
  dosageFrequency: DosageFrequency | '';
  quantity: number;
  category: 'NORMAL' | 'LP';
  instructions: string;
}

interface PatientBlock {
  id: string;
  mrn: string;
  patientName: string | null;
  patientNrNumber: string | null;
  lookupState: 'idle' | 'loading' | 'found' | 'missing';
  medicines: MedicineRow[];
  notice: string | null;
}

const uid = () => Math.random().toString(36).slice(2);

const newMedicine = (): MedicineRow => ({
  id: uid(),
  medicineId: '',
  dosageFrequency: '',
  quantity: 1,
  category: 'NORMAL',
  instructions: '',
});

const newPatient = (): PatientBlock => ({
  id: uid(),
  mrn: '',
  patientName: null,
  patientNrNumber: null,
  lookupState: 'idle',
  medicines: [newMedicine()],
  notice: null,
});

export default function WardPrescriptionPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();

  const currentHospitalId = selectedHospital?.id || user?.hospitalId;
  const pharmacyId = user?.pharmacyId;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [availability, setAvailability] = useState<Record<string, Availability>>({});
  const [templates, setTemplates] = useState<Template[]>([]);
  const [patients, setPatients] = useState<PatientBlock[]>([newPatient()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!currentHospitalId) return;
      setLoading(true);
      try {
        const [roomRes, allMedicines, availRes, templateRes] = await Promise.all([
          api.get('/rooms', { params: { hospitalId: currentHospitalId, pharmacyId, limit: 200 } }),
          fetchAllMedicines<Medicine>(currentHospitalId),
          pharmacyId
            ? api.get(`/inventory/availability/${pharmacyId}`)
            : Promise.resolve({ data: [] as Availability[] }),
          api
            .get('/medicine-templates', { params: { hospitalId: currentHospitalId } })
            // Templates are optional — a failure here must not block prescribing
            .catch(() => ({ data: [] as Template[] })),
        ]);

        setRooms(roomRes.data?.data ?? roomRes.data ?? []);
        setMedicines(allMedicines);
        setTemplates(templateRes.data ?? []);

        const map: Record<string, Availability> = {};
        (availRes.data ?? []).forEach((a: Availability) => { map[a.medicineId] = a; });
        setAvailability(map);
      } catch {
        setError('Failed to load wards / medicines. Please refresh.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [currentHospitalId, pharmacyId]);

  const updatePatient = (id: string, patch: Partial<PatientBlock>) =>
    setPatients((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const updateMedicine = (patientId: string, rowId: string, patch: Partial<MedicineRow>) =>
    setPatients((ps) =>
      ps.map((p) =>
        p.id === patientId
          ? { ...p, medicines: p.medicines.map((m) => (m.id === rowId ? { ...m, ...patch } : m)) }
          : p,
      ),
    );

  const remainingFor = (medicineId: string, category: 'NORMAL' | 'LP') => {
    const a = availability[medicineId];
    if (!a) return 0;
    return category === 'LP' ? a.lpStock : a.normalStock;
  };

  // Same rule as the prescription form: only medicines stocked in the row's pool
  const optionsFor = (category: 'NORMAL' | 'LP') =>
    medicines
      .filter((m) => remainingFor(m.id, category) > 0)
      .map((m) => ({
        value: m.id,
        label: m.name,
        sub: [m.genericName, m.strength, m.form].filter(Boolean).join(' · '),
      }));

  // Type is read from the selected medicine, never typed by the user
  const typeOf = (medicineId: string) => medicines.find((m) => m.id === medicineId)?.form ?? '';

  const lookupPatient = useCallback(async (block: PatientBlock) => {
    const value = block.mrn.trim();
    if (!value) return;
    updatePatient(block.id, { lookupState: 'loading' });
    try {
      const res = await api.get('/patients', { params: { nrNumber: value } });
      const patient = (res.data?.data ?? [])[0];
      if (!patient) {
        updatePatient(block.id, { lookupState: 'missing', patientName: null, patientNrNumber: null });
        return;
      }
      updatePatient(block.id, {
        lookupState: 'found',
        patientName: patient.fullName,
        patientNrNumber: patient.nrNumber,
      });
    } catch {
      updatePatient(block.id, { lookupState: 'missing', patientName: null, patientNrNumber: null });
    }
  }, []);

  const handleFrequency = (patientId: string, rowId: string, freq: string) => {
    const f = freq as DosageFrequency | '';
    const mapped = f && f !== 'SOS' ? FREQ_QTY[f] : null;
    updateMedicine(patientId, rowId, { dosageFrequency: f, ...(mapped ? { quantity: mapped } : {}) });
  };

  /**
   * Drop a template's medicines into one patient. Only items actually in this
   * pharmacy's stock for their own pool are added — the same rule the
   * single-patient form applies — and anything skipped is reported.
   */
  const applyTemplate = (patientId: string, templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    const inStock = template.items.filter(
      (it) => remainingFor(it.medicine.id, it.category ?? 'NORMAL') > 0,
    );
    const skipped = template.items.filter(
      (it) => remainingFor(it.medicine.id, it.category ?? 'NORMAL') <= 0,
    );

    const rows: MedicineRow[] = inStock.map((it) => {
      const freq = (it.dosageFrequency ?? '') as DosageFrequency | '';
      const qty = it.quantity ?? (freq && freq !== 'SOS' ? FREQ_QTY[freq] ?? 1 : 1);
      return {
        id: uid(),
        medicineId: it.medicine.id,
        dosageFrequency: freq,
        quantity: qty ?? 1,
        category: (it.category ?? 'NORMAL') as 'NORMAL' | 'LP',
        instructions: '',
      };
    });

    setPatients((ps) =>
      ps.map((p) => {
        if (p.id !== patientId) return p;

        // Replace a single blank starter row; otherwise append
        const isBlankStart = p.medicines.length === 1 && !p.medicines[0].medicineId;
        const medicinesNext = rows.length > 0
          ? (isBlankStart ? rows : [...p.medicines, ...rows])
          : p.medicines;

        let notice =
          rows.length > 0
            ? `Added ${rows.length} medicine${rows.length > 1 ? 's' : ''} from "${template.name}"`
            : `No medicines added from "${template.name}"`;
        if (skipped.length > 0) {
          notice += ` — ${skipped.length} skipped (out of stock: ${skipped.map((s) => s.medicine.name).join(', ')})`;
        }

        return { ...p, medicines: medicinesNext, notice };
      }),
    );
  };

  const handleSave = async () => {
    setError(null);
    setResult(null);

    if (!selectedRoom) { setError('Select a ward first'); return; }
    if (!pharmacyId) { setError('Your account has no pharmacy assigned — dispensing is unavailable.'); return; }

    // A patient counts only if identified and carrying at least one medicine
    const ready = patients
      .map((p) => ({ ...p, medicines: p.medicines.filter((m) => m.medicineId) }))
      .filter((p) => p.mrn.trim() && p.medicines.length > 0);

    if (ready.length === 0) { setError('Add at least one patient with a medicine'); return; }

    const unresolved = ready.find((p) => p.lookupState !== 'found' || !p.patientNrNumber);
    if (unresolved) { setError(`MR number "${unresolved.mrn}" has not been matched to a patient`); return; }

    for (const p of ready) {
      const over = p.medicines.find((m) => remainingFor(m.medicineId, m.category) < m.quantity);
      if (over) {
        const name = medicines.find((m) => m.id === over.medicineId)?.name ?? 'medicine';
        setError(`${name} exceeds available ${over.category} stock for ${p.mrn}`);
        return;
      }
    }

    const roomNumber = rooms.find((r) => r.id === selectedRoom)?.roomNumber ?? '';

    setSaving(true);
    const failures: string[] = [];
    let created = 0;

    // One prescription per patient, with all their medicines
    for (const p of ready) {
      try {
        await api.post('/prescriptions', {
          nrNumber: p.patientNrNumber,
          prescriptionType: 'E_PRESCRIPTION',
          notes: `Ward entry — room ${roomNumber}`.trim(),
          prescriptionMedicines: p.medicines.map((m) => ({
            medicineId: m.medicineId,
            dosageFrequency: m.dosageFrequency || undefined,
            quantity: m.quantity,
            category: m.category,
            instructions: m.instructions || undefined,
          })),
        });
        created += 1;
      } catch (err: any) {
        failures.push(`${formatMRN(p.patientNrNumber ?? p.mrn)}: ${err.response?.data?.message ?? 'failed'}`);
      }
    }

    setSaving(false);

    if (failures.length === 0) {
      setResult(`Created ${created} prescription${created === 1 ? '' : 's'}.`);
      setPatients([newPatient()]);
      return;
    }

    // Partial success is reported honestly rather than swallowed
    setError(
      `${created} prescription${created === 1 ? '' : 's'} created, ${failures.length} failed — ${failures.join('; ')}`,
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalMedicines = patients.reduce(
    (sum, p) => sum + p.medicines.filter((m) => m.medicineId).length,
    0,
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Ward round header — teal marks indoor care, distinct from OPD blue */}
      <div className="border-b border-teal-900/10 bg-gradient-to-r from-teal-700 via-teal-600 to-blue-600">
        <div className="container mx-auto max-w-7xl px-6 py-5">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="text-white/90 hover:bg-white/15 hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-100">
                Ward round
              </p>
              <h1 className="text-2xl font-bold text-white">Add Prescription by Ward</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl p-6">

      <Card className="mb-6 border-teal-200/70 shadow-sm">
        <CardHeader className="rounded-t-lg border-b border-teal-100 bg-teal-50/60">
          <CardTitle className="text-base text-teal-900">Ward</CardTitle>
          <CardDescription className="text-teal-800/70">
            {rooms.length === 0
              ? 'No wards are assigned to your pharmacy yet — an administrator assigns rooms to a sub-pharmacy.'
              : 'Select the ward these patients are admitted to'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="max-w-md">
            <SearchableSelect
              options={rooms.map((r) => ({
                value: r.id,
                label: `${r.roomNumber} (${r.roomType})`,
                sub: r.department?.name,
              }))}
              value={selectedRoom}
              onValueChange={setSelectedRoom}
              placeholder="Select ward..."
              searchPlaceholder="Search ward..."
            />
          </div>
        </CardContent>
      </Card>

      {selectedRoom && (
        <>
          {patients.map((patient, index) => {
            const identified = patient.lookupState === 'found';
            return (
            <div key={patient.id} className="relative mb-4 pl-12">
              {/* Ward-round spine: the number is the order you walk the beds,
                  and the marker carries whether that patient is identified yet */}
              <div
                aria-hidden
                className="absolute left-[18px] top-0 h-full w-px bg-gradient-to-b from-teal-300 via-slate-200 to-transparent"
              />
              <div
                aria-hidden
                className={`absolute left-0 top-5 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold tabular-nums ring-4 ring-slate-50 transition-colors ${
                  identified
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-slate-400 ring-4 ring-slate-50 border border-slate-300'
                }`}
              >
                {index + 1}
              </div>

            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-slate-50/80 pb-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <CardTitle className="text-base text-slate-900">Patient {index + 1}</CardTitle>
                    <CardDescription>
                      All medicines below are saved as one prescription
                    </CardDescription>
                  </div>

                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        MR Number
                      </label>
                      <div className="flex gap-1">
                        <Input
                          className="w-48"
                          placeholder="MR number"
                          value={patient.mrn}
                          onChange={(e) =>
                            updatePatient(patient.id, { mrn: e.target.value, lookupState: 'idle' })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); void lookupPatient(patient); }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          title="Find patient"
                          onClick={() => void lookupPatient(patient)}
                        >
                          {patient.lookupState === 'loading'
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Search className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Load Template
                      </label>
                      <select
                        value=""
                        disabled={templates.length === 0}
                        onChange={(e) => {
                          if (e.target.value) applyTemplate(patient.id, e.target.value);
                          e.target.value = '';
                        }}
                        className="h-10 w-56 rounded-lg border border-gray-300 px-2 text-sm disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">
                          {templates.length === 0 ? 'No templates' : 'Select template...'}
                        </option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.items.length})
                          </option>
                        ))}
                      </select>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title="Remove patient"
                      disabled={patients.length === 1}
                      onClick={() => setPatients((ps) => ps.filter((p) => p.id !== patient.id))}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>

                {patient.lookupState === 'found' && (
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-900">
                      {patient.patientName}
                    </span>
                    <span className="font-mono text-xs text-emerald-700">
                      {formatMRN(patient.patientNrNumber ?? '')}
                    </span>
                  </div>
                )}
                {patient.lookupState === 'missing' && (
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-sm text-rose-800">
                    No patient with that MR number
                  </div>
                )}
                {patient.notice && (
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
                    <span className="flex items-center gap-2">
                      <ClipboardList className="h-3.5 w-3.5" />
                      {patient.notice}
                    </span>
                    <button
                      type="button"
                      onClick={() => updatePatient(patient.id, { notice: null })}
                      className="text-indigo-500 hover:text-indigo-700"
                    >
                      ×
                    </button>
                  </div>
                )}
              </CardHeader>

              <CardContent>
                <div className="overflow-x-auto">
                  <div className="min-w-[900px] space-y-2">
                    <div className="grid grid-cols-[1fr_110px_120px_90px_90px_1fr_36px] gap-2 rounded-md bg-slate-100/70 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <span>Medicine</span>
                      <span>Type</span>
                      <span>Frequency</span>
                      <span className="text-center">Quantity</span>
                      <span className="text-center">Category</span>
                      <span>Instructions</span>
                      <span />
                    </div>

                    {patient.medicines.map((row) => {
                      const remaining = row.medicineId ? remainingFor(row.medicineId, row.category) : null;
                      const overStock = remaining !== null && row.quantity > remaining;

                      return (
                        <div
                          key={row.id}
                          className={`grid grid-cols-[1fr_110px_120px_90px_90px_1fr_36px] items-start gap-2 rounded-md px-2 py-1.5 transition-colors ${
                            row.category === 'LP'
                              ? 'bg-orange-50/70 ring-1 ring-inset ring-orange-200'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <SearchableSelect
                            options={optionsFor(row.category)}
                            value={row.medicineId}
                            onValueChange={(v) => updateMedicine(patient.id, row.id, { medicineId: v })}
                            placeholder={row.category === 'LP' ? 'LP medicine...' : 'Normal medicine...'}
                            searchPlaceholder="Search medicine..."
                          />

                          {/* Read from the medicine, never entered by hand */}
                          <Input
                            value={typeOf(row.medicineId)}
                            readOnly
                            placeholder="—"
                            className="bg-muted"
                          />

                          <select
                            value={row.dosageFrequency}
                            onChange={(e) => handleFrequency(patient.id, row.id, e.target.value)}
                            className="h-10 w-full rounded-lg border border-gray-300 px-2 text-sm focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">—</option>
                            <option value="OD">OD (×1/day)</option>
                            <option value="BID">BID (×2/day)</option>
                            <option value="TDS">TDS (×3/day)</option>
                            <option value="SOS">SOS (if needed)</option>
                          </select>

                          <div>
                            <Input
                              type="number"
                              min={1}
                              value={row.quantity}
                              disabled={!!row.dosageFrequency && row.dosageFrequency !== 'SOS'}
                              onChange={(e) =>
                                updateMedicine(patient.id, row.id, {
                                  quantity: Math.max(1, Number(e.target.value) || 1),
                                })
                              }
                              className={`text-center ${overStock ? 'border-red-400 text-red-600' : ''}`}
                            />
                            {remaining !== null && (
                              <p
                                className={`mt-1 text-center text-xs font-semibold tabular-nums ${
                                  overStock
                                    ? 'text-rose-600'
                                    : remaining <= row.quantity * 2
                                      ? 'text-amber-600'
                                      : 'text-emerald-600'
                                }`}
                              >
                                {remaining} left
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-center gap-1 pt-2">
                            <span className="text-xs text-gray-400">N</span>
                            <input
                              type="checkbox"
                              checked={row.category === 'LP'}
                              onChange={(e) => {
                                const next = e.target.checked ? 'LP' : 'NORMAL';
                                // Pools hold different medicines, so drop a selection
                                // with no stock in the pool being switched to
                                const keep = row.medicineId && remainingFor(row.medicineId, next) > 0;
                                updateMedicine(patient.id, row.id, {
                                  category: next,
                                  ...(keep ? {} : { medicineId: '' }),
                                });
                              }}
                              className="relative h-4 w-8 cursor-pointer appearance-none rounded-full bg-gray-200 transition-colors before:absolute before:h-4 before:w-4 before:rounded-full before:bg-white before:shadow before:transition-transform checked:bg-orange-400 checked:before:translate-x-4"
                            />
                            <span className={`text-xs ${row.category === 'LP' ? 'font-medium text-orange-600' : 'text-gray-400'}`}>
                              LP
                            </span>
                          </div>

                          <Input
                            placeholder="Optional"
                            value={row.instructions}
                            onChange={(e) =>
                              updateMedicine(patient.id, row.id, { instructions: e.target.value })
                            }
                          />

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={patient.medicines.length === 1}
                            onClick={() =>
                              setPatients((ps) =>
                                ps.map((p) =>
                                  p.id === patient.id
                                    ? { ...p, medicines: p.medicines.filter((m) => m.id !== row.id) }
                                    : p,
                                ),
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() =>
                    setPatients((ps) =>
                      ps.map((p) =>
                        p.id === patient.id ? { ...p, medicines: [...p.medicines, newMedicine()] } : p,
                      ),
                    )
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Medicine
                </Button>
              </CardContent>
            </Card>
            </div>
            );
          })}

          <div className="pl-12">
            <Button
              type="button"
              variant="outline"
              className="border-dashed border-teal-300 text-teal-800 hover:bg-teal-50"
              onClick={() => setPatients((ps) => [...ps, newPatient()])}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add Patient
            </Button>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border-l-4 border-l-rose-500 border border-rose-200 bg-rose-50 p-3">
              <p className="text-sm font-medium text-rose-900">{error}</p>
            </div>
          )}
          {result && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border-l-4 border-l-emerald-500 border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-900">
              <CheckCircle className="h-4 w-4" />
              {result}
            </div>
          )}

          {/* Stays in reach however long the ward list grows */}
          <div className="sticky bottom-0 z-30 -mx-6 mt-6 border-t border-slate-200 bg-white/95 px-6 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold tabular-nums text-slate-900">{patients.length}</span>
                  <span className="text-slate-500">patient{patients.length === 1 ? '' : 's'}</span>
                </span>
                <span className="h-6 w-px bg-slate-200" />
                <span className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold tabular-nums text-slate-900">{totalMedicines}</span>
                  <span className="text-slate-500">medicine{totalMedicines === 1 ? '' : 's'}</span>
                </span>
                <Badge className="bg-teal-100 text-teal-900 hover:bg-teal-100">
                  {patients.length} prescription{patients.length === 1 ? '' : 's'} will be created
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => router.push('/dashboard/prescriptions')}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {saving ? 'Saving...' : 'Save Prescriptions'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
