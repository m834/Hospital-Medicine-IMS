'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, ChevronDown, ChevronRight, Loader2, Plus } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/searchable-select';
import api from '@/lib/api';
import { fetchAllMedicines } from '@/lib/medicines';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import { formatMRN } from '@/lib/mrn';

interface MedicineInfo {
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

interface PrescriptionMedicine {
  id: string;
  medicineId: string;
  dosage?: string;
  instructions?: string;
  category: 'NORMAL' | 'LP';
  addedAt: string;
  medicine: MedicineInfo;
  addedByUser?: { id: string; fullName: string };
}

interface DispatchHistoryItem {
  id: string;
  quantityDispatched: number;
  prescriptionMedicine: { medicine: MedicineInfo };
}

interface PrescriptionDispatch {
  id: string;
  dispatchedAt: string;
  notes?: string;
  dispatcher: { id: string; fullName: string };
  items: DispatchHistoryItem[];
}

interface LegacyItem {
  id: string;
  qtyPrescribed: number;
  dosage?: string;
  frequency?: string;
  duration?: string;
  status: string;
  medicine: MedicineInfo;
}

interface PrescriptionDetail {
  id: string;
  nrNumber: string;
  prescriptionType: string;
  status: string;
  notes?: string;
  createdAt: string;
  patient: { id: string; nrNumber: string; fullName: string; gender: string; mobile: string };
  doctor?: { id: string; fullName: string; email: string } | null;
  items: LegacyItem[];
  medicines: PrescriptionMedicine[];
  dispatches: PrescriptionDispatch[];
  visit?: { id: string; visitDate: string; visitNumber: string; visitType: string } | null;
}

function StatusBadge({ status }: { status: string }) {
  return status === 'ACTIVE' ? (
    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Active</span>
  ) : status === 'COMPLETED' ? (
    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">Completed</span>
  ) : (
    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>
  );
}

const DISPATCH_ROLES = ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'MAIN_PHARMACY_MANAGER', 'PHARMACY_STAFF', 'SUB_PHARMACY_MANAGER'];
const ALL_ROLES = [...DISPATCH_ROLES, 'DOCTOR', 'DOCTOR_ASSISTANT'];

export default function PrescriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();

  const currentHospitalId = selectedHospital?.id || user?.hospitalId;
  const pharmacyId = user?.pharmacyId;
  const canDispatch = DISPATCH_ROLES.includes(user?.role || '');
  const canEdit = ALL_ROLES.includes(user?.role || '');

  const [loading, setLoading] = useState(true);
  const [prescription, setPrescription] = useState<PrescriptionDetail | null>(null);

  // Dispatch checklist state
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const [dispatching, setDispatching] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Dispatch history expand state
  const [historyOpen, setHistoryOpen] = useState<Record<string, boolean>>({});

  // Add medicine panel state
  const [showAdd, setShowAdd] = useState(false);
  const [allMedicines, setAllMedicines] = useState<MedicineInfo[]>([]);
  const [availability, setAvailability] = useState<Record<string, Availability>>({});
  const [selectedMedId, setSelectedMedId] = useState('');
  const [addDosage, setAddDosage] = useState('');
  const [addInstructions, setAddInstructions] = useState('');
  const [addCategory, setAddCategory] = useState<'NORMAL' | 'LP'>('NORMAL');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (id) fetchPrescription();
  }, [id]);

  // Catalogue plus live stock for the user's own pharmacy. Adding a medicine
  // this pharmacy does not hold only produces an item that cannot be
  // dispatched, so the picker is built from stock rather than the catalogue.
  useEffect(() => {
    if (!currentHospitalId) return;
    Promise.all([
      fetchAllMedicines<MedicineInfo>(currentHospitalId),
      pharmacyId
        ? api.get(`/inventory/availability/${pharmacyId}`)
        : Promise.resolve({ data: [] as Availability[] }),
    ])
      .then(([medicineList, availRes]) => {
        setAllMedicines(medicineList);
        const map: Record<string, Availability> = {};
        (availRes.data ?? []).forEach((a: Availability) => { map[a.medicineId] = a; });
        setAvailability(map);
      })
      .catch(() => {});
  }, [currentHospitalId, pharmacyId]);

  // Remaining stock for a medicine in one pool, live from pharmacy inventory.
  const remainingFor = (medicineId: string, category: 'NORMAL' | 'LP') => {
    const a = availability[medicineId];
    if (!a) return 0;
    return category === 'LP' ? a.lpStock : a.normalStock;
  };

  // Normal and LP are separate stock pools, so the picker only offers what this
  // pharmacy holds in the pool being added to.
  const optionsByCategory = useMemo(() => {
    const build = (pool: 'NORMAL' | 'LP') =>
      allMedicines
        .filter((m) => {
          const a = availability[m.id];
          if (!a) return false;
          return (pool === 'LP' ? a.lpStock : a.normalStock) > 0;
        })
        .map((m) => ({
          value: m.id,
          label: m.name,
          sub: [m.genericName, m.strength, m.form].filter(Boolean).join(' · '),
        }));

    return { NORMAL: build('NORMAL'), LP: build('LP') };
  }, [allMedicines, availability]);

  // A medicine stocked as Normal may not exist as LP, so switching pool drops a
  // selection that has no stock in the pool being switched to.
  function handleAddCategoryChange(next: 'NORMAL' | 'LP') {
    setAddCategory(next);
    if (selectedMedId && remainingFor(selectedMedId, next) <= 0) setSelectedMedId('');
  }

  async function fetchPrescription() {
    setLoading(true);
    try {
      const res = await api.get(`/prescriptions/${id}`);
      const data: PrescriptionDetail = res.data;
      setPrescription(data);
      // Initialise qty=1 for every medicine row
      const initQtys: Record<string, number> = {};
      (data.medicines ?? []).forEach((m) => { initQtys[m.id] = 1; });
      setQtys(initQtys);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to load prescription',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  function toggleCheck(pmId: string) {
    setChecked((prev) => ({ ...prev, [pmId]: !prev[pmId] }));
    setItemErrors((prev) => { const n = { ...prev }; delete n[pmId]; return n; });
  }

  async function handleDispatch() {
    const items = Object.entries(checked)
      .filter(([, v]) => v)
      .map(([pmId]) => ({ prescriptionMedicineId: pmId, quantityDispatched: qtys[pmId] || 1 }));

    if (items.length === 0) {
      toast({ title: 'No medicines selected', description: 'Check at least one medicine to dispatch', variant: 'destructive' });
      return;
    }

    setDispatching(true);
    try {
      const res = await api.post(`/prescriptions/${id}/dispatch`, { items });
      const results: Array<{ prescriptionMedicineId: string; success: boolean; quantityDispatched?: number; error?: string }> =
        res.data.results ?? [];

      const newErrors: Record<string, string> = {};
      const successIds: string[] = [];
      results.forEach((r) => {
        if (r.success) successIds.push(r.prescriptionMedicineId);
        else if (r.error) newErrors[r.prescriptionMedicineId] = r.error;
      });

      setItemErrors(newErrors);

      if (successIds.length > 0) {
        setChecked((prev) => { const n = { ...prev }; successIds.forEach((sid) => delete n[sid]); return n; });
        setQtys((prev) => { const n = { ...prev }; successIds.forEach((sid) => { n[sid] = 1; }); return n; });
        toast({ title: `${successIds.length} medicine(s) dispatched` });
        await fetchPrescription();
      }

      if (Object.keys(newErrors).length > 0) {
        toast({
          title: 'Some items failed',
          description: `${Object.keys(newErrors).length} item(s) had stock issues — see details below`,
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({ title: 'Dispatch failed', description: err.response?.data?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setDispatching(false);
    }
  }

  async function handleComplete() {
    if (!confirm('Mark this prescription as Completed? No further dispatches will be possible.')) return;
    setCompleting(true);
    try {
      await api.patch(`/prescriptions/${id}/complete`);
      toast({ title: 'Prescription completed' });
      await fetchPrescription();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Failed to complete', variant: 'destructive' });
    } finally {
      setCompleting(false);
    }
  }

  async function handleAddMedicine() {
    if (!selectedMedId) {
      toast({ title: 'Select a medicine first', variant: 'destructive' });
      return;
    }
    setAdding(true);
    try {
      await api.post(`/prescriptions/${id}/medicines`, {
        medicineId: selectedMedId,
        dosage: addDosage || undefined,
        instructions: addInstructions || undefined,
        category: addCategory,
      });
      toast({ title: 'Medicine added to prescription' });
      resetAddPanel();
      await fetchPrescription();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Failed to add medicine', variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  }

  function resetAddPanel() {
    setShowAdd(false);
    setSelectedMedId('');
    setAddDosage('');
    setAddInstructions('');
    setAddCategory('NORMAL');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!prescription) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-gray-600 hover:text-gray-900 mb-4 text-sm">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          Prescription not found.
        </div>
      </div>
    );
  }

  const isActive = prescription.status === 'ACTIVE';
  const hasNewStyle = (prescription.medicines?.length ?? 0) > 0;
  const hasLegacy = !hasNewStyle && (prescription.items?.length ?? 0) > 0;
  const checkedCount = Object.values(checked).filter(Boolean).length;

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl space-y-6">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-1 text-gray-600 hover:text-gray-900 text-sm">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-800">
            Prescription — {prescription.patient.fullName}
          </h1>
          <StatusBadge status={prescription.status} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
          <span>MRN: {formatMRN(prescription.nrNumber)}</span>
          {prescription.visit?.visitDate && (
            <span>Visit: {format(new Date(prescription.visit.visitDate), 'dd MMM yyyy')}</span>
          )}
          {prescription.doctor && <span>Dr. {prescription.doctor.fullName}</span>}
          <span>Created: {format(new Date(prescription.createdAt), 'dd MMM yyyy')}</span>
        </div>
        {prescription.notes && (
          <p className="mt-1 text-sm text-gray-600 italic">{prescription.notes}</p>
        )}
      </div>

      {/* ── NEW-STYLE: medicines[] ── */}
      {hasNewStyle && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">
              Medicines ({prescription.medicines.length})
            </h2>
          </div>

          {prescription.medicines.length === 0 ? (
            <p className="px-6 py-8 text-center text-gray-400 text-sm">No medicines added yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {prescription.medicines.map((pm) => (
                <div key={pm.id} className="px-6 py-4">
                  <div className="flex items-start gap-3">
                    {/* Checkbox — only for active + dispatch role */}
                    {isActive && canDispatch ? (
                      <input
                        type="checkbox"
                        checked={!!checked[pm.id]}
                        onChange={() => toggleCheck(pm.id)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 cursor-pointer shrink-0"
                      />
                    ) : (
                      <div className="w-4 shrink-0" />
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">
                          {pm.medicine.name}
                          {pm.medicine.strength ? ` ${pm.medicine.strength}` : ''}
                        </span>
                        <span className="text-xs text-gray-400">{pm.medicine.form}</span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            pm.category === 'LP'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {pm.category}
                        </span>
                      </div>
                      {(pm.dosage || pm.instructions) && (
                        <p className="text-sm text-gray-500 mt-0.5">
                          {[pm.dosage, pm.instructions].filter(Boolean).join(' — ')}
                        </p>
                      )}
                      {itemErrors[pm.id] && (
                        <p className="mt-1 text-sm text-red-600 bg-red-50 px-2 py-1 rounded">
                          {itemErrors[pm.id]}
                        </p>
                      )}
                    </div>

                    {/* Qty — only when checked */}
                    {isActive && canDispatch && checked[pm.id] && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <label className="text-xs text-gray-500 whitespace-nowrap">Qty:</label>
                        <input
                          type="number"
                          min={1}
                          value={qtys[pm.id] ?? 1}
                          onChange={(e) =>
                            setQtys((prev) => ({
                              ...prev,
                              [pm.id]: Math.max(1, parseInt(e.target.value) || 1),
                            }))
                          }
                          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action bar (only for ACTIVE) */}
          {isActive && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center gap-3">
              {canEdit && (
                <button
                  onClick={() => setShowAdd((v) => !v)}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Medicine
                </button>
              )}

              {canDispatch && (
                <button
                  onClick={handleDispatch}
                  disabled={dispatching || checkedCount === 0}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {dispatching && <Loader2 className="h-4 w-4 animate-spin" />}
                  Dispatch Selected ({checkedCount})
                </button>
              )}

              {canDispatch && (
                <button
                  onClick={handleComplete}
                  disabled={completing}
                  className="ml-auto flex items-center gap-1.5 px-4 py-2 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {completing && <Loader2 className="h-4 w-4 animate-spin" />}
                  Complete Prescription
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ADD MEDICINE PANEL ── */}
      {showAdd && isActive && (
        <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Add Medicine to Prescription</h3>

          {/* Pool first — it decides which medicines the picker can offer */}
          <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-3 mb-1">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <select
                value={addCategory}
                onChange={(e) => handleAddCategoryChange(e.target.value as 'NORMAL' | 'LP')}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="NORMAL">Normal</option>
                <option value="LP">LP (Local Purchase)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Medicine</label>
              <SearchableSelect
                options={optionsByCategory[addCategory]}
                value={selectedMedId}
                onValueChange={setSelectedMedId}
                placeholder={addCategory === 'LP' ? 'Select LP medicine...' : 'Select Normal medicine...'}
                searchPlaceholder="Search by name or generic..."
                emptyMessage="No medicine in stock in this pharmacy."
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            {!pharmacyId
              ? 'Your account has no pharmacy assigned, so no stock can be shown.'
              : selectedMedId
                ? `${remainingFor(selectedMedId, addCategory)} in stock`
                : `${optionsByCategory[addCategory].length} medicine(s) in stock in this pharmacy`}
          </p>

          {selectedMedId && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Dosage</label>
                <input
                  type="text"
                  placeholder="e.g. 1 tablet"
                  value={addDosage}
                  onChange={(e) => setAddDosage(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Instructions</label>
                <input
                  type="text"
                  placeholder="e.g. after meals"
                  value={addInstructions}
                  onChange={(e) => setAddInstructions(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleAddMedicine}
              disabled={!selectedMedId || adding}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {adding ? 'Adding...' : 'Add'}
            </button>
            <button
              onClick={resetAddPanel}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── LEGACY: items[] (PENDING / ISSUED / etc.) ── */}
      {hasLegacy && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">Prescribed Items</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Medicine', 'Form', 'Qty', 'Dosage', 'Frequency', 'Duration', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {prescription.items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {item.medicine.name}
                      {item.medicine.strength ? ` ${item.medicine.strength}` : ''}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{item.medicine.form}</td>
                    <td className="px-4 py-3 text-sm">{item.qtyPrescribed}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{item.dosage || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{item.frequency || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{item.duration || '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          item.status === 'ISSUED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── DISPATCH HISTORY ── */}
      {(prescription.dispatches?.length ?? 0) > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">
              Dispatch History ({prescription.dispatches.length} round{prescription.dispatches.length !== 1 ? 's' : ''})
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {prescription.dispatches.map((d, idx) => {
              const roundNumber = prescription.dispatches.length - idx;
              const expanded = !!historyOpen[d.id];
              return (
                <div key={d.id}>
                  <button
                    onClick={() => setHistoryOpen((prev) => ({ ...prev, [d.id]: !prev[d.id] }))}
                    className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50 text-left"
                  >
                    <div className="flex items-center gap-2">
                      {expanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                      )}
                      <span className="text-sm font-medium text-gray-800">
                        Round {roundNumber} — {format(new Date(d.dispatchedAt), 'dd MMM yyyy, h:mm a')} — by{' '}
                        {d.dispatcher.fullName}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {d.items.length} item{d.items.length !== 1 ? 's' : ''}
                    </span>
                  </button>

                  {expanded && (
                    <div className="px-6 pb-4 pl-14">
                      {d.notes && (
                        <p className="text-sm text-gray-500 italic mb-2">{d.notes}</p>
                      )}
                      <ul className="space-y-1">
                        {d.items.map((item) => (
                          <li key={item.id} className="text-sm flex items-center gap-2">
                            <span className="text-gray-300">•</span>
                            <span className="font-medium text-gray-800">
                              {item.prescriptionMedicine.medicine.name}
                            </span>
                            {item.prescriptionMedicine.medicine.strength && (
                              <span className="text-gray-500">
                                {item.prescriptionMedicine.medicine.strength}
                              </span>
                            )}
                            <span className="text-gray-600">× {item.quantityDispatched}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
