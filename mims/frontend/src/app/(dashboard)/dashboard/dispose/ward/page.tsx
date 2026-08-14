'use client';

/**
 * Dispose by Ward — the disposal counterpart to Add Prescription by Ward.
 *
 * The single-item Dispose screen builds a queue one row at a time, which suits
 * writing off the odd damaged strip. A ward sweep — an expiry check across a
 * whole ward's pharmacy — is a different shape of work: many lines entered in
 * one pass. Every row is editable at once here, and the lot is saved as ONE
 * disposal transaction, matching how the records actually store.
 *
 * Stock has no ward. A StockBatch carries a pharmacyId; a Room carries the
 * pharmacy it belongs to. Choosing a ward therefore chooses whose shelves are
 * being written off — it is not a filter on the stock, and the page says so.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, Loader2, Plus, Trash2, CheckCircle } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import api from '@/lib/api';
import { REASONS, DisposalBatch, DisposalRoom } from '@/lib/disposal';

interface ItemRow {
  id: string;
  medicineId: string;
  batchId: string;
  quantity: number;
  reason: string;
  note: string;
}

const uid = () => Math.random().toString(36).slice(2);
const newRow = (): ItemRow => ({
  id: uid(),
  medicineId: '',
  batchId: '',
  quantity: 1,
  reason: '',
  note: '',
});

const DISPOSE_ROLES = [
  'SUPER_ADMIN',
  'MASTER_ADMIN',
  'HOSPITAL_ADMIN',
  'MAIN_PHARMACY_MANAGER',
  'SUB_PHARMACY_MANAGER',
];

export default function DisposeByWardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();

  const currentHospitalId = user?.hospitalId || selectedHospital?.id;
  const userPharmacyId = user?.pharmacyId;
  const canDispose = DISPOSE_ROLES.includes(user?.role ?? '');

  const [rooms, setRooms] = useState<DisposalRoom[]>([]);
  const [selectedWardId, setSelectedWardId] = useState('');
  const [batches, setBatches] = useState<DisposalBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [rows, setRows] = useState<ItemRow[]>([newRow()]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const selectedWard = rooms.find((r) => r.id === selectedWardId) ?? null;
  // A pharmacy user is pinned to their own by the server; an admin follows the
  // ward they picked.
  const effectivePharmacyId = userPharmacyId || selectedWard?.pharmacy?.id || '';

  // Only wards backed by a pharmacy can point at stock. A pharmacy user sees
  // only their own wards — the server refuses a write-off against anyone else's
  // stock, so offering more would only invite a rejected save.
  const loadRooms = useCallback(async () => {
    if (!currentHospitalId) return;
    try {
      const params: any = { hospitalId: currentHospitalId, limit: 200 };
      if (userPharmacyId) params.pharmacyId = userPharmacyId;
      const res = await api.get('/rooms', { params });
      const list: DisposalRoom[] = res.data?.data ?? res.data ?? [];
      setRooms(list.filter((r) => r.pharmacy?.id));
    } catch {
      setRooms([]);
    }
  }, [currentHospitalId, userPharmacyId]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  const loadBatches = useCallback(async () => {
    if (!currentHospitalId || !effectivePharmacyId) {
      setBatches([]);
      return;
    }
    setLoadingBatches(true);
    try {
      const res = await api.get('/inventory/batches', {
        params: { hospitalId: currentHospitalId, pharmacyId: effectivePharmacyId, limit: 2000 },
      });
      const list: DisposalBatch[] = res.data?.data ?? res.data ?? [];
      // Only stock actually on the shelf can be written off
      setBatches(list.filter((b) => b.qtyAvailable > 0));
    } catch {
      setBatches([]);
    } finally {
      setLoadingBatches(false);
    }
  }, [currentHospitalId, effectivePharmacyId]);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  const formatDay = (v: string) => format(new Date(v), 'dd/MM/yyyy');

  // One entry per medicine, however many batches it has
  const medicineOptions = useMemo(
    () =>
      Array.from(new Map(batches.map((b) => [b.medicine.id, b.medicine])).values()).map((m) => ({
        value: m.id,
        label: m.name,
        sub: [m.strength, m.form].filter(Boolean).join(' · '),
      })),
    [batches],
  );

  const updateRow = (id: string, patch: Partial<ItemRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  /**
   * What is left in a batch for this row: its stock less what the OTHER rows
   * have already claimed. Counting sibling rows is what stops two lines each
   * passing on their own and overdrawing the batch together.
   */
  const remainingFor = (row: ItemRow): number | null => {
    const batch = batches.find((b) => b.id === row.batchId);
    if (!batch) return null;
    const claimedElsewhere = rows
      .filter((r) => r.id !== row.id && r.batchId === batch.id)
      .reduce((sum, r) => sum + (r.quantity || 0), 0);
    return batch.qtyAvailable - claimedElsewhere;
  };

  const handleWardChange = (wardId: string) => {
    const hasEntries = rows.some((r) => r.batchId);
    if (hasEntries && !window.confirm('Changing ward clears the items you have entered. Continue?')) return;
    setSelectedWardId(wardId);
    setRows([newRow()]);
    setError('');
    setSaved('');
  };

  const handleSave = async () => {
    setError('');
    setSaved('');

    if (!effectivePharmacyId) { setError('Select a ward first'); return; }

    const filled = rows.filter((r) => r.batchId);
    if (filled.length === 0) { setError('Add at least one item to dispose'); return; }

    for (const row of filled) {
      const batch = batches.find((b) => b.id === row.batchId);
      const medicineName = batch?.medicine.name ?? 'item';
      if (!Number.isInteger(row.quantity) || row.quantity < 1) {
        setError(`${medicineName}: enter a whole quantity of 1 or more`); return;
      }
      if (!row.reason) { setError(`${medicineName}: select a reason`); return; }
      if (row.reason === 'OTHER' && !row.note.trim()) {
        setError(`${medicineName}: describe the reason when choosing Other`); return;
      }
      const remaining = remainingFor(row);
      if (remaining !== null && row.quantity > remaining) {
        setError(`${medicineName}: only ${remaining} left in batch ${batch?.batchNo}`); return;
      }
    }

    setSaving(true);
    try {
      // One transaction for the whole ward sweep, matching how the records
      // store and so a rejected line cannot leave earlier batches decremented.
      await api.post('/inventory/disposals', {
        items: filled.map((r) => ({
          batchId: r.batchId,
          quantity: r.quantity,
          reason: r.reason,
          note: r.note.trim() || undefined,
        })),
        notes: notes.trim() || undefined,
      });

      const total = filled.reduce((sum, r) => sum + r.quantity, 0);
      setSaved(`Disposed ${total} unit${total === 1 ? '' : 's'} across ${filled.length} item${filled.length === 1 ? '' : 's'}.`);
      setRows([newRow()]);
      setNotes('');
      await loadBatches();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to record the disposal');
    } finally {
      setSaving(false);
    }
  };

  if (!canDispose) {
    return (
      <div className="p-6">
        <Card className="border-red-200">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            You do not have permission to dispose stock.
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalUnits = rows.reduce((sum, r) => sum + (r.batchId ? r.quantity || 0 : 0), 0);
  const filledCount = rows.filter((r) => r.batchId).length;

  return (
    <div className="p-6">
      <Button variant="ghost" onClick={() => router.push('/dashboard/dispose')} className="mb-3 gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to Dispose
      </Button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dispose by Ward</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Write off several items from one ward&apos;s pharmacy in a single pass.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {saved && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle className="h-4 w-4" /> {saved}
        </div>
      )}

      <Card className="mb-4 border-orange-200/70">
        <CardHeader className="rounded-t-lg border-b border-orange-100 bg-orange-50/60">
          <CardTitle className="text-base text-orange-950">Ward</CardTitle>
          <CardDescription className="text-orange-900/70">
            {selectedWard
              ? `Writing off stock held by ${selectedWard.pharmacy?.name}. Stock belongs to the pharmacy, not the ward.`
              : 'Pick the ward whose pharmacy you are writing off from'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="max-w-md">
            <Select value={selectedWardId} onValueChange={handleWardChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select ward" />
              </SelectTrigger>
              <SelectContent>
                {rooms.length === 0 && (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    No wards are assigned to a pharmacy
                  </div>
                )}
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.roomNumber}
                    {r.department?.name ? ` · ${r.department.name}` : ''}
                    {r.pharmacy?.name ? ` — ${r.pharmacy.name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Items</CardTitle>
          <CardDescription>
            {selectedWardId
              ? 'Every row is saved as one disposal'
              : 'Select a ward above to load its stock'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {loadingBatches ? (
            <div className="flex min-h-[120px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !selectedWardId ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No ward selected.
            </p>
          ) : batches.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              This ward&apos;s pharmacy has no stock available to dispose.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <div className="min-w-[1200px] space-y-2">
                  <div className="grid grid-cols-[1.4fr_1.5fr_90px_90px_150px_1fr_36px] gap-3 px-1 text-xs font-medium text-muted-foreground">
                    <span>Medicine</span>
                    <span>Batch</span>
                    <span className="text-center">Quantity</span>
                    <span className="text-center">Remaining</span>
                    <span>Reason</span>
                    <span>Note</span>
                    <span />
                  </div>

                  {rows.map((row) => {
                    const batchesForRow = batches.filter((b) => b.medicine.id === row.medicineId);
                    const remaining = remainingFor(row);
                    const over = remaining !== null && row.quantity > remaining;

                    return (
                      <div
                        key={row.id}
                        className="grid grid-cols-[1.4fr_1.5fr_90px_90px_150px_1fr_36px] items-center gap-3"
                      >
                        <SearchableSelect
                          options={medicineOptions}
                          value={row.medicineId}
                          onValueChange={(v) => updateRow(row.id, { medicineId: v, batchId: '' })}
                          placeholder="Select medicine..."
                          searchPlaceholder="Search medicine..."
                        />

                        <Select
                          value={row.batchId}
                          onValueChange={(v) => updateRow(row.id, { batchId: v })}
                          disabled={!row.medicineId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={row.medicineId ? 'Select batch' : 'Medicine first'} />
                          </SelectTrigger>
                          <SelectContent>
                            {batchesForRow.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.batchNo} · exp {formatDay(b.expiryDate)} · {b.qtyAvailable} · {b.category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Input
                          type="number"
                          min={1}
                          value={row.quantity}
                          onChange={(e) => updateRow(row.id, { quantity: Number(e.target.value) || 1 })}
                          className="text-center"
                        />

                        <div
                          className={`flex h-10 items-center justify-center rounded-md border px-2 text-sm tabular-nums ${
                            remaining === null
                              ? 'bg-muted text-muted-foreground'
                              : over
                              ? 'border-red-300 bg-red-50 font-semibold text-red-700'
                              : 'bg-muted font-medium'
                          }`}
                        >
                          {remaining ?? '—'}
                        </div>

                        <Select value={row.reason} onValueChange={(v) => updateRow(row.id, { reason: v })}>
                          <SelectTrigger><SelectValue placeholder="Reason" /></SelectTrigger>
                          <SelectContent>
                            {REASONS.map((r) => (
                              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Input
                          placeholder={row.reason === 'OTHER' ? 'Required for Other' : 'Optional'}
                          value={row.note}
                          onChange={(e) => updateRow(row.id, { note: e.target.value })}
                        />

                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={rows.length === 1}
                          onClick={() => setRows((rs) => rs.filter((r) => r.id !== row.id))}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="mt-3 gap-1.5"
                onClick={() => setRows((rs) => [...rs, newRow()])}
              >
                <Plus className="h-3.5 w-3.5" /> Add Item
              </Button>

              <div className="mt-4 space-y-1">
                <label className="text-sm font-medium">Disposal note (optional)</label>
                <Input
                  placeholder="Applies to the whole disposal"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4">
                <div className="text-sm text-orange-900/80">
                  <span className="text-lg font-bold tabular-nums text-orange-950">
                    {totalUnits.toLocaleString()}
                  </span>{' '}
                  unit{totalUnits === 1 ? '' : 's'} across {filledCount} item
                  {filledCount === 1 ? '' : 's'}
                </div>
                <Button onClick={handleSave} disabled={saving || filledCount === 0} className="gap-2">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Record Disposal
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
