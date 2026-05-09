'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight, Info, Loader2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PrescriptionSummary {
  id: string;
  nrNumber: string;
  status: 'ACTIVE' | 'COMPLETED';
  notes?: string;
  createdAt: string;
  patient: { id: string; nrNumber: string; fullName: string; gender: string; mobile: string };
  doctor?: { id: string; fullName: string; email: string } | null;
  medicines: { id: string }[];
  visit?: { id: string; visitDate: string; visitNumber: string } | null;
}

interface MedicineInfo {
  id: string;
  name: string;
  genericName?: string;
  strength?: string;
  form: string;
}

interface PrescriptionMedicine {
  id: string;
  medicineId: string;
  dosage?: string;
  instructions?: string;
  category: 'NORMAL' | 'LP';
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

interface PrescriptionDetail extends PrescriptionSummary {
  medicines: PrescriptionMedicine[];
  dispatches: PrescriptionDispatch[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DISPATCH_ROLES = ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'MAIN_PHARMACY_MANAGER', 'PHARMACY_STAFF', 'SUB_PHARMACY_MANAGER'];
const ALL_ROLES = [...DISPATCH_ROLES, 'DOCTOR', 'DOCTOR_ASSISTANT'];
const CREATE_ROLES = ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'DOCTOR_ASSISTANT', 'MAIN_PHARMACY_MANAGER', 'SUB_PHARMACY_MANAGER'];

function StatusBadge({ status }: { status: string }) {
  return status === 'ACTIVE' ? (
    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">Active</span>
  ) : (
    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">Completed</span>
  );
}

// ─── ExpandedPanel — manages all dispatch/add-medicine state per prescription ─

function ExpandedPanel({
  detail,
  onRefresh,
  canDispatch,
  canEdit,
  hospitalId,
}: {
  detail: PrescriptionDetail;
  onRefresh: () => void;
  canDispatch: boolean;
  canEdit: boolean;
  hospitalId?: string;
}) {
  const { toast } = useToast();
  const isActive = detail.status === 'ACTIVE';

  // Checklist state
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [qtys, setQtys] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    detail.medicines.forEach((m) => { init[m.id] = 1; });
    return init;
  });
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const [dispatching, setDispatching] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Add medicine state
  const [showAdd, setShowAdd] = useState(false);
  const [medSearch, setMedSearch] = useState('');
  const [medResults, setMedResults] = useState<MedicineInfo[]>([]);
  const [medSearching, setMedSearching] = useState(false);
  const [selectedMed, setSelectedMed] = useState<MedicineInfo | null>(null);
  const [addDosage, setAddDosage] = useState('');
  const [addInstructions, setAddInstructions] = useState('');
  const [addCategory, setAddCategory] = useState<'NORMAL' | 'LP'>('NORMAL');
  const [adding, setAdding] = useState(false);

  // Dispatch history expand
  const [historyOpen, setHistoryOpen] = useState<Record<string, boolean>>({});

  // Debounced medicine search
  useEffect(() => {
    if (!medSearch.trim() || selectedMed) {
      if (!selectedMed) setMedResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setMedSearching(true);
      try {
        const res = await api.get('/medicines', { params: { search: medSearch, hospitalId, limit: 10 } });
        setMedResults(res.data.data ?? res.data ?? []);
      } catch {
        setMedResults([]);
      } finally {
        setMedSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [medSearch, selectedMed, hospitalId]);

  function toggleCheck(pmId: string) {
    setChecked((p) => ({ ...p, [pmId]: !p[pmId] }));
    setItemErrors((p) => { const n = { ...p }; delete n[pmId]; return n; });
  }

  async function handleDispatch() {
    const items = Object.entries(checked)
      .filter(([, v]) => v)
      .map(([pmId]) => ({ prescriptionMedicineId: pmId, quantityDispatched: qtys[pmId] || 1 }));

    if (items.length === 0) {
      toast({ title: 'No medicines selected', variant: 'destructive' });
      return;
    }
    setDispatching(true);
    try {
      const res = await api.post(`/prescriptions/${detail.id}/dispatch`, { items });
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
        setChecked((p) => { const n = { ...p }; successIds.forEach((s) => delete n[s]); return n; });
        setQtys((p) => { const n = { ...p }; successIds.forEach((s) => { n[s] = 1; }); return n; });
        toast({ title: `${successIds.length} medicine(s) dispatched` });
        onRefresh();
      }
      if (Object.keys(newErrors).length > 0) {
        toast({
          title: 'Some items failed',
          description: `${Object.keys(newErrors).length} item(s) had stock issues`,
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
      await api.patch(`/prescriptions/${detail.id}/complete`);
      toast({ title: 'Prescription completed' });
      onRefresh();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Failed', variant: 'destructive' });
    } finally {
      setCompleting(false);
    }
  }

  async function handleAddMedicine() {
    if (!selectedMed) return;
    setAdding(true);
    try {
      await api.post(`/prescriptions/${detail.id}/medicines`, {
        medicineId: selectedMed.id,
        dosage: addDosage || undefined,
        instructions: addInstructions || undefined,
        category: addCategory,
      });
      toast({ title: 'Medicine added' });
      resetAdd();
      onRefresh();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Failed', variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  }

  function resetAdd() {
    setShowAdd(false);
    setMedSearch('');
    setMedResults([]);
    setSelectedMed(null);
    setAddDosage('');
    setAddInstructions('');
    setAddCategory('NORMAL');
  }

  const lastDispatch = detail.dispatches?.[0];
  const checkedCount = Object.values(checked).filter(Boolean).length;

  return (
    <div className="border-t border-blue-100 bg-blue-50/40 px-6 py-4 space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm">
        <div>
          <span className="text-xs text-gray-500 block">Visit</span>
          <span className="font-medium text-gray-800">
            {detail.visit?.visitNumber || detail.visit?.id?.slice(0, 8) || '—'}
          </span>
        </div>
        <div>
          <span className="text-xs text-gray-500 block">Prescribed by</span>
          <span className="font-medium text-gray-800">{detail.doctor?.fullName || '—'}</span>
        </div>
        <div>
          <span className="text-xs text-gray-500 block">Medicines</span>
          <span className="font-medium text-gray-800">
            {detail.medicines.map((m) => m.medicine.name).join(', ') || '—'}
            {detail.medicines.length > 0 && (
              <span className="text-gray-400 text-xs ml-1">({detail.medicines.length} total)</span>
            )}
          </span>
        </div>
        <div>
          <span className="text-xs text-gray-500 block">Last Dispatch</span>
          <span className="font-medium text-gray-800">
            {lastDispatch
              ? `${format(new Date(lastDispatch.dispatchedAt), 'dd MMM yyyy')} — by ${lastDispatch.dispatcher.fullName}`
              : 'No dispatches yet'}
          </span>
        </div>
        <div>
          <span className="text-xs text-gray-500 block">Total Rounds</span>
          <span className="font-medium text-gray-800">
            {detail.dispatches?.length ?? 0} dispatch{detail.dispatches?.length !== 1 ? 'es' : ''} so far
          </span>
        </div>
      </div>

      {/* Medicine checklist — ACTIVE only */}
      {isActive && detail.medicines.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {detail.medicines.map((pm) => (
            <div key={pm.id} className="px-4 py-3 flex items-start gap-3">
              {canDispatch ? (
                <input
                  type="checkbox"
                  checked={!!checked[pm.id]}
                  onChange={() => toggleCheck(pm.id)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 cursor-pointer shrink-0"
                />
              ) : (
                <div className="w-4 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900 text-sm">
                    {pm.medicine.name}{pm.medicine.strength ? ` ${pm.medicine.strength}` : ''}
                  </span>
                  <span className="text-xs text-gray-400">{pm.medicine.form}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${pm.category === 'LP' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                    {pm.category}
                  </span>
                </div>
                {(pm.dosage || pm.instructions) && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {[pm.dosage, pm.instructions].filter(Boolean).join(' — ')}
                  </p>
                )}
                {itemErrors[pm.id] && (
                  <p className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                    {itemErrors[pm.id]}
                  </p>
                )}
              </div>
              {canDispatch && checked[pm.id] && (
                <div className="flex items-center gap-1 shrink-0">
                  <label className="text-xs text-gray-500">Qty:</label>
                  <input
                    type="number"
                    min={1}
                    value={qtys[pm.id] ?? 1}
                    onChange={(e) => setQtys((p) => ({ ...p, [pm.id]: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="w-16 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isActive && detail.medicines.length === 0 && (
        <p className="text-sm text-gray-400 italic">No medicines on this prescription yet.</p>
      )}

      {/* Action buttons */}
      {isActive && (
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Medicine
            </button>
          )}
          {canDispatch && (
            <button
              onClick={handleDispatch}
              disabled={dispatching || checkedCount === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {dispatching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Dispatch Now ({checkedCount})
            </button>
          )}
          {canDispatch && (
            <button
              onClick={handleComplete}
              disabled={completing}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {completing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Mark as Completed
            </button>
          )}
        </div>
      )}

      {/* Add medicine inline panel */}
      {showAdd && isActive && (
        <div className="bg-white rounded-lg border border-blue-200 p-4">
          <h4 className="text-sm font-semibold text-gray-800 mb-3">Add Medicine</h4>
          <div className="relative mb-3">
            <input
              type="text"
              placeholder="Search medicine..."
              value={medSearch}
              onChange={(e) => {
                setMedSearch(e.target.value);
                if (selectedMed) setSelectedMed(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 pr-8"
            />
            {medSearching && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-gray-400" />}
          </div>
          {medResults.length > 0 && !selectedMed && (
            <div className="border border-gray-200 rounded-lg mb-3 divide-y divide-gray-100 max-h-40 overflow-y-auto">
              {medResults.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelectedMed(m);
                    setMedSearch(`${m.name}${m.strength ? ` ${m.strength}` : ''}`);
                    setMedResults([]);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                >
                  <span className="font-medium">{m.name}</span>
                  {m.strength && <span className="text-gray-500"> {m.strength}</span>}
                  <span className="text-gray-400 ml-2">{m.form}</span>
                </button>
              ))}
            </div>
          )}
          {selectedMed && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
              <input type="text" placeholder="Dosage (e.g. 1 tablet)" value={addDosage}
                onChange={(e) => setAddDosage(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              <input type="text" placeholder="Instructions (e.g. after meals)" value={addInstructions}
                onChange={(e) => setAddInstructions(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              <select value={addCategory} onChange={(e) => setAddCategory(e.target.value as 'NORMAL' | 'LP')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                <option value="NORMAL">Normal</option>
                <option value="LP">LP</option>
              </select>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleAddMedicine} disabled={!selectedMed || adding}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {adding ? 'Adding...' : 'Add'}
            </button>
            <button onClick={resetAdd}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Dispatch history */}
      {(detail.dispatches?.length ?? 0) > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-2 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Dispatch History ({detail.dispatches.length} round{detail.dispatches.length !== 1 ? 's' : ''})
            </span>
          </div>
          {detail.dispatches.map((d, idx) => {
            const roundNumber = detail.dispatches.length - idx;
            const open = !!historyOpen[d.id];
            return (
              <div key={d.id} className="border-b border-gray-100 last:border-0">
                <button
                  onClick={() => setHistoryOpen((p) => ({ ...p, [d.id]: !p[d.id] }))}
                  className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50 text-left"
                >
                  <div className="flex items-center gap-2">
                    {open ? <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                    <span className="text-sm text-gray-700">
                      Round {roundNumber} — {format(new Date(d.dispatchedAt), 'dd MMM yyyy, h:mm a')} — by {d.dispatcher.fullName}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{d.items.length} item{d.items.length !== 1 ? 's' : ''}</span>
                </button>
                {open && (
                  <ul className="px-4 pb-2 pl-10 space-y-0.5">
                    {d.items.map((item) => (
                      <li key={item.id} className="text-sm text-gray-600 flex gap-2">
                        <span className="text-gray-300">•</span>
                        <span className="font-medium">{item.prescriptionMedicine.medicine.name}</span>
                        {item.prescriptionMedicine.medicine.strength && (
                          <span className="text-gray-500">{item.prescriptionMedicine.medicine.strength}</span>
                        )}
                        <span>× {item.quantityDispatched}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PrescriptionsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();
  const { toast } = useToast();

  const currentHospitalId = selectedHospital?.id || user?.hospitalId;

  const canCreate = CREATE_ROLES.includes(user?.role || '');
  const canDispatch = DISPATCH_ROLES.includes(user?.role || '');
  const canEdit = ALL_ROLES.includes(user?.role || '');

  const [prescriptions, setPrescriptions] = useState<PrescriptionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchNR, setSearchNR] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 50;

  // Expand / detail state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, PrescriptionDetail>>({});
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);

  useEffect(() => {
    if (currentHospitalId) fetchPrescriptions();
  }, [currentHospitalId, searchNR, statusFilter, page]);

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      const params: any = { page, limit };
      if (currentHospitalId) params.hospitalId = currentHospitalId;
      if (searchNR) params.nrNumber = searchNR;
      if (statusFilter) params.status = statusFilter;
      if (!params.hospitalId) { setLoading(false); return; }
      const res = await api.get('/prescriptions', { params });
      setPrescriptions(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch {
      toast({ title: 'Failed to load prescriptions', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (rxId: string) => {
    if (expandedId === rxId) { setExpandedId(null); return; }
    setExpandedId(rxId);
    if (!detailCache[rxId]) {
      setLoadingDetailId(rxId);
      try {
        const res = await api.get(`/prescriptions/${rxId}`);
        setDetailCache((p) => ({ ...p, [rxId]: res.data }));
      } catch {
        toast({ title: 'Failed to load prescription detail', variant: 'destructive' });
      } finally {
        setLoadingDetailId(null);
      }
    }
  };

  const refreshDetail = async (rxId: string) => {
    try {
      const res = await api.get(`/prescriptions/${rxId}`);
      setDetailCache((p) => ({ ...p, [rxId]: res.data }));
    } catch {}
    fetchPrescriptions();
  };

  return (
    <div className="container mx-auto py-6 px-4">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Prescriptions</h1>
          <p className="text-gray-600 mt-1">Active and completed patient prescriptions</p>
        </div>
        {canCreate && (
          <button
            onClick={() => router.push('/dashboard/prescriptions/create')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            + New Prescription
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search by MRN</label>
            <input
              type="text"
              placeholder="Enter MRN..."
              value={searchNR}
              onChange={(e) => { setSearchNR(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setSearchNR(''); setStatusFilter(''); setPage(1); }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors w-full text-sm"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Loading prescriptions...
          </div>
        ) : prescriptions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No prescriptions found.{' '}
            {canCreate && 'Create one to get started.'}
          </div>
        ) : (
          <>
            {prescriptions.map((rx, rxIdx) => {
              const isExpanded = expandedId === rx.id;
              const isLoadingThis = loadingDetailId === rx.id;
              const detail = detailCache[rx.id];
              const medCount = rx.medicines?.length ?? 0;

              return (
                <div key={rx.id} className={rxIdx > 0 ? 'border-t border-gray-200' : ''}>
                  {/* Summary row */}
                  <div
                    className={`flex items-center px-5 py-3.5 gap-4 transition-colors ${isExpanded ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    {/* Patient */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 text-sm">{rx.patient.fullName}</span>
                        <span className="text-xs text-gray-400">{rx.nrNumber}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {rx.patient.mobile}
                        {rx.patient.gender && <span className="ml-2">{rx.patient.gender}</span>}
                      </div>
                    </div>

                    {/* Visit date */}
                    <div className="hidden sm:block text-sm text-gray-500 shrink-0 w-28">
                      {rx.visit?.visitDate
                        ? format(new Date(rx.visit.visitDate), 'dd MMM yyyy')
                        : format(new Date(rx.createdAt), 'dd MMM yyyy')}
                    </div>

                    {/* Medicines count */}
                    <div className="hidden md:block text-sm text-gray-500 shrink-0 w-24">
                      {medCount} medicine{medCount !== 1 ? 's' : ''}
                    </div>

                    {/* Status */}
                    <div className="shrink-0">
                      <StatusBadge status={rx.status} />
                    </div>

                    {/* Info toggle */}
                    <button
                      onClick={() => handleToggle(rx.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors shrink-0 ${
                        isExpanded
                          ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <Info className="h-3.5 w-3.5" />
                      )}
                      Info
                    </button>
                  </div>

                  {/* Expanded panel */}
                  {isExpanded && (
                    isLoadingThis ? (
                      <div className="border-t border-blue-100 bg-blue-50/40 px-6 py-6 flex items-center gap-2 text-gray-400">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading details...
                      </div>
                    ) : detail ? (
                      <ExpandedPanel
                        key={detail.id}
                        detail={detail}
                        onRefresh={() => refreshDetail(rx.id)}
                        canDispatch={canDispatch}
                        canEdit={canEdit}
                        hospitalId={currentHospitalId}
                      />
                    ) : null
                  )}
                </div>
              );
            })}

            {/* Pagination */}
            {total > limit && (
              <div className="bg-gray-50 px-5 py-3 flex items-center justify-between border-t border-gray-200">
                <span className="text-sm text-gray-600">
                  Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * limit >= total}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
