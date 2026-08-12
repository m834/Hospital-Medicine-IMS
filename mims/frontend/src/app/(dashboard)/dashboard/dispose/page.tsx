'use client';

/**
 * Dispose — stock write-offs, kept separate from Inventory.
 *
 * Two tabs: build a disposal of several items at once (the same add-to-list
 * shape as Receive Stock), and review the append-only record of what has
 * already been written off.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  Plus,
  Trash2,
  Search,
  FileDown,
  PackageX,
  ShieldAlert,
  CheckCircle,
  ClipboardList,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DateInput } from '@/components/ui/date-input';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import api from '@/lib/api';
import { format } from 'date-fns';

const REASONS = [
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'BROKEN', label: 'Broken' },
  { value: 'CONTAMINATED', label: 'Contaminated' },
  { value: 'RECALLED', label: 'Recalled' },
  { value: 'OTHER', label: 'Other' },
] as const;

const REASON_LABEL: Record<string, string> = Object.fromEntries(
  REASONS.map((r) => [r.value, r.label]),
);

// Reasons are facts, not severities — colour groups them quietly
const REASON_STYLE: Record<string, string> = {
  EXPIRED: 'bg-amber-100 text-amber-900',
  DAMAGED: 'bg-rose-100 text-rose-900',
  BROKEN: 'bg-rose-100 text-rose-900',
  CONTAMINATED: 'bg-purple-100 text-purple-900',
  RECALLED: 'bg-blue-100 text-blue-900',
  OTHER: 'bg-slate-100 text-slate-900',
};

interface Batch {
  id: string;
  batchNo: string;
  qtyAvailable: number;
  expiryDate: string;
  category: 'NORMAL' | 'LP';
  status: string;
  medicine: { id: string; name: string; strength?: string; form: string };
}

interface PendingItem {
  id: string;
  batch: Batch;
  quantity: number;
  reason: string;
  note: string;
}

/**
 * The same templates the prescription screen uses. A template item names a
 * medicine; a disposal item needs a batch, so applying one has to choose the
 * batch — see pickBatchForDisposal.
 */
interface TemplateItem {
  medicine: { id: string; name: string };
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

interface DisposalRow {
  disposalId: string;
  disposedAt: string;
  disposedBy: string | null;
  medicineName: string;
  medicineStrength?: string | null;
  medicineForm: string;
  batchNo: string;
  expiryDate: string;
  category: 'NORMAL' | 'LP';
  quantity: number;
  reason: string;
  note?: string | null;
}

interface DisposalReport {
  rows: DisposalRow[];
  totalQuantity: number;
  totalRecords: number;
}

const toIsoDate = (value: string): string | undefined => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
};

export default function DisposePage() {
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();
  const currentHospitalId = user?.hospitalId || selectedHospital?.id;
  const pharmacyId = user?.pharmacyId;

  const canDispose = ['SUPER_ADMIN', 'MASTER_ADMIN', 'HOSPITAL_ADMIN', 'MAIN_PHARMACY_MANAGER', 'SUB_PHARMACY_MANAGER']
    .includes(user?.role ?? '');

  // --- Dispose Items tab ---
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [selectedMedicineId, setSelectedMedicineId] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  // --- Templates ---
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [templateReason, setTemplateReason] = useState('');
  const [templateNote, setTemplateNote] = useState('');
  const [templateError, setTemplateError] = useState('');
  const [templateNotice, setTemplateNotice] = useState<string | null>(null);

  // --- Disposed List tab ---
  const [report, setReport] = useState<DisposalReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [applied, setApplied] = useState<{ from?: string; to?: string }>({});

  const loadBatches = useCallback(async () => {
    if (!currentHospitalId) return;
    setLoadingBatches(true);
    try {
      const params: any = { hospitalId: currentHospitalId, limit: 2000 };
      if (pharmacyId) params.pharmacyId = pharmacyId;
      const res = await api.get('/inventory/batches', { params });
      const list: Batch[] = res.data?.data ?? res.data ?? [];
      // Only stock that is actually on the shelf can be written off
      setBatches(list.filter((b) => b.qtyAvailable > 0));
    } catch {
      setBatches([]);
    } finally {
      setLoadingBatches(false);
    }
  }, [currentHospitalId, pharmacyId]);

  const loadReport = useCallback(async (range: { from?: string; to?: string }) => {
    setLoadingReport(true);
    try {
      const res = await api.get('/inventory/disposals', { params: range });
      setReport(res.data ?? null);
    } catch {
      setReport(null);
    } finally {
      setLoadingReport(false);
    }
  }, []);

  // Shared with the prescription screen — there is one set of templates per
  // pharmacy, not a separate disposal set.
  const loadTemplates = useCallback(async () => {
    if (!currentHospitalId) return;
    try {
      const res = await api.get('/medicine-templates', { params: { hospitalId: currentHospitalId } });
      setTemplates(res.data ?? []);
    } catch {
      // Optional convenience — a failure here must not block writing stock off
      setTemplates([]);
    }
  }, [currentHospitalId]);

  useEffect(() => {
    void loadBatches();
    void loadReport({});
    void loadTemplates();
  }, [loadBatches, loadReport, loadTemplates]);

  // One entry per medicine, however many batches it has
  const medicineOptions = Array.from(
    new Map(batches.map((b) => [b.medicine.id, b.medicine])).values(),
  ).map((m) => ({
    value: m.id,
    label: m.name,
    sub: [m.strength, m.form].filter(Boolean).join(' · '),
  }));

  const batchesForMedicine = batches.filter((b) => b.medicine.id === selectedMedicineId);
  const selectedBatch = batches.find((b) => b.id === selectedBatchId) ?? null;

  const formatDay = (v: string) => format(new Date(v), 'dd/MM/yyyy');
  const formatWhen = (v: string) => format(new Date(v), 'dd/MM/yyyy HH:mm');

  const addItem = () => {
    setFormError('');

    if (!selectedBatch) { setFormError('Select a medicine and batch'); return; }
    if (!Number.isInteger(quantity) || quantity < 1) {
      setFormError('Enter a whole quantity of 1 or more'); return;
    }
    if (!reason) { setFormError('Select a reason'); return; }
    if (reason === 'OTHER' && !note.trim()) {
      setFormError('Describe the reason when choosing Other'); return;
    }

    // Quantities already queued against this batch count towards its stock
    const queued = pending
      .filter((p) => p.batch.id === selectedBatch.id)
      .reduce((sum, p) => sum + p.quantity, 0);

    if (queued + quantity > selectedBatch.qtyAvailable) {
      setFormError(
        `Only ${selectedBatch.qtyAvailable - queued} left in batch ${selectedBatch.batchNo}` +
          (queued ? ` (${queued} already in this disposal)` : ''),
      );
      return;
    }

    setPending((p) => [
      ...p,
      {
        id: Math.random().toString(36).slice(2),
        batch: selectedBatch,
        quantity,
        reason,
        note: note.trim(),
      },
    ]);

    setSelectedBatchId('');
    setQuantity(1);
    setReason('');
    setNote('');
  };

  /**
   * A template names a medicine; a disposal is always of a specific physical
   * batch. Of the batches this pharmacy holds in the item's pool, take the one
   * closest to expiring — disposal is overwhelmingly expiry-driven, and it is
   * the same expiry-first rule the rest of the app allocates by.
   */
  const pickBatchForDisposal = (medicineId: string, category: 'NORMAL' | 'LP') =>
    batches
      .filter((b) => b.medicine.id === medicineId && b.category === category)
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())[0];

  /**
   * Queue every medicine in a template that this pharmacy actually holds.
   * Rows land in the pending list like manually added ones and can be adjusted
   * or removed before saving; nothing leaves stock until the disposal is saved.
   */
  const applyTemplate = (template: Template) => {
    setTemplateError('');

    if (!templateReason) { setTemplateError('Choose a reason for these items'); return; }
    if (templateReason === 'OTHER' && !templateNote.trim()) {
      setTemplateError('Describe the reason when choosing Other'); return;
    }

    // Running tally, so several template items landing on the same batch —
    // and anything already queued — cannot together exceed what it holds.
    const claimed = new Map<string, number>();
    pending.forEach((p) => claimed.set(p.batch.id, (claimed.get(p.batch.id) ?? 0) + p.quantity));

    const added: PendingItem[] = [];
    const skipped: string[] = [];

    for (const item of template.items) {
      const category = item.category ?? 'NORMAL';
      const batch = pickBatchForDisposal(item.medicine.id, category);

      if (!batch) { skipped.push(item.medicine.name); continue; }

      const alreadyClaimed = claimed.get(batch.id) ?? 0;
      const room = batch.qtyAvailable - alreadyClaimed;
      if (room <= 0) { skipped.push(item.medicine.name); continue; }

      // The template's quantity is a starting point, never more than the batch
      // actually holds. It stays editable in the queued list.
      const quantity = Math.min(item.quantity ?? 1, room);
      claimed.set(batch.id, alreadyClaimed + quantity);

      added.push({
        id: Math.random().toString(36).slice(2),
        batch,
        quantity,
        reason: templateReason,
        note: templateNote.trim(),
      });
    }

    if (added.length > 0) setPending((p) => [...p, ...added]);

    setTemplateDialogOpen(false);
    setExpandedTemplateId(null);
    setTemplateReason('');
    setTemplateNote('');

    let notice = added.length > 0
      ? `Queued ${added.length} item${added.length === 1 ? '' : 's'} from "${template.name}"`
      : `Nothing queued from "${template.name}"`;
    if (skipped.length > 0) {
      notice += ` — ${skipped.length} skipped (no stock: ${skipped.join(', ')})`;
    }
    setTemplateNotice(notice);
  };

  /**
   * Queued quantities are editable, since a templated quantity is a starting
   * point rather than a decision. Capped against the batch, counting what other
   * queued rows have already claimed from it.
   */
  const updatePendingQuantity = (id: string, next: number) => {
    setPending((rows) =>
      rows.map((row) => {
        if (row.id !== id) return row;
        const claimedElsewhere = rows
          .filter((r) => r.id !== id && r.batch.id === row.batch.id)
          .reduce((sum, r) => sum + r.quantity, 0);
        const ceiling = row.batch.qtyAvailable - claimedElsewhere;
        return { ...row, quantity: Math.max(1, Math.min(next, ceiling)) };
      }),
    );
  };

  const save = async () => {
    if (pending.length === 0) { setFormError('Add at least one item'); return; }

    setFormError('');
    setSaving(true);
    setSaved(null);
    try {
      await api.post('/inventory/disposals', {
        items: pending.map((p) => ({
          batchId: p.batch.id,
          quantity: p.quantity,
          reason: p.reason,
          note: p.note || undefined,
        })),
        notes: notes.trim() || undefined,
      });

      const total = pending.reduce((sum, p) => sum + p.quantity, 0);
      setSaved(`Disposed ${total} unit${total === 1 ? '' : 's'} across ${pending.length} item${pending.length === 1 ? '' : 's'}.`);
      setPending([]);
      setNotes('');
      setSelectedMedicineId('');
      setTemplateNotice(null);
      await Promise.all([loadBatches(), loadReport(applied)]);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to record the disposal');
    } finally {
      setSaving(false);
    }
  };

  const applyFilter = () => {
    const range = { from: toIsoDate(fromDate), to: toIsoDate(toDate) };
    setApplied(range);
    void loadReport(range);
  };

  const clearFilter = () => {
    setFromDate('');
    setToDate('');
    setApplied({});
    void loadReport({});
  };

  const rangeLabel =
    applied.from || applied.to
      ? `${applied.from ?? 'start'} to ${applied.to ?? 'today'}`
      : 'All time';

  const exportCsv = () => {
    if (!report || report.rows.length === 0) return;
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Date/Time', 'Medicine', 'Strength', 'Form', 'Batch', 'Expiry', 'Category', 'Quantity', 'Reason', 'Note', 'Disposed By'];
    const lines = report.rows.map((r) =>
      [
        formatWhen(r.disposedAt), r.medicineName, r.medicineStrength ?? '', r.medicineForm,
        r.batchNo, formatDay(r.expiryDate), r.category, r.quantity,
        REASON_LABEL[r.reason] ?? r.reason, r.note ?? '', r.disposedBy ?? '',
      ].map(escape).join(','),
    );
    const csv = [
      '"Disposed Items"', `"Period","${rangeLabel}"`,
      `"Total disposed","${report.totalQuantity}"`, '',
      header.map(escape).join(','), ...lines,
    ].join('\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `disposed-items-${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const pendingTotal = pending.reduce((sum, p) => sum + p.quantity, 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-orange-900/10 bg-gradient-to-r from-orange-700 via-orange-600 to-amber-500">
        <div className="container mx-auto max-w-7xl px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-100">
            Stock write-off
          </p>
          <h1 className="text-2xl font-bold text-white">Dispose</h1>
          <p className="mt-1 text-sm text-orange-50/80">
            Remove expired, damaged or recalled stock and keep an auditable record
          </p>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl p-6">
        <Tabs defaultValue="dispose">
          <TabsList className="mb-4">
            <TabsTrigger value="dispose">Dispose Items</TabsTrigger>
            <TabsTrigger value="list">
              Disposed List
              {report && <Badge variant="secondary" className="ml-2">{report.totalRecords}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* ---------------- Dispose Items ---------------- */}
          <TabsContent value="dispose">
            {!canDispose ? (
              <Card>
                <CardContent className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-center">
                  <ShieldAlert className="h-10 w-10 text-muted-foreground" />
                  <p className="font-medium">You cannot dispose stock</p>
                  <p className="text-sm text-muted-foreground">
                    Disposal is available to pharmacy managers and administrators.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="mb-4 border-orange-200/70 shadow-sm">
                  <CardHeader className="rounded-t-lg border-b border-orange-100 bg-orange-50/60">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base text-orange-950">Add Item</CardTitle>
                        <CardDescription className="text-orange-900/70">
                          Add as many items as you need, then record them together
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => {
                          setExpandedTemplateId(null);
                          setTemplateError('');
                          setTemplateDialogOpen(true);
                        }}
                        disabled={templates.length === 0}
                        title={
                          templates.length === 0
                            ? 'No templates available'
                            : 'Queue the medicines from a template'
                        }
                      >
                        <ClipboardList className="h-3.5 w-3.5" /> Select Template
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-5">
                    {templateNotice && (
                      <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
                        <span>{templateNotice}</span>
                        <button
                          type="button"
                          onClick={() => setTemplateNotice(null)}
                          className="text-indigo-500 hover:text-indigo-700"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    {loadingBatches ? (
                      <div className="flex min-h-[120px] items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : batches.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        No stock available to dispose.
                      </p>
                    ) : (
                      <>
                        {/* One row: medicine, batch, quantity, reason, note, add */}
                        <div className="overflow-x-auto">
                        <div className="grid min-w-[1100px] grid-cols-[1.5fr_1.6fr_100px_150px_1fr_auto] items-end gap-3">
                          <div className="space-y-1">
                            <label className="text-sm font-medium">Medicine</label>
                            <SearchableSelect
                              options={medicineOptions}
                              value={selectedMedicineId}
                              onValueChange={(v) => { setSelectedMedicineId(v); setSelectedBatchId(''); }}
                              placeholder="Select medicine..."
                              searchPlaceholder="Search medicine..."
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-sm font-medium">Batch</label>
                            <Select
                              value={selectedBatchId}
                              onValueChange={setSelectedBatchId}
                              disabled={!selectedMedicineId}
                            >
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={selectedMedicineId ? 'Select batch' : 'Select medicine first'}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {batchesForMedicine.map((b) => (
                                  <SelectItem key={b.id} value={b.id}>
                                    {b.batchNo} · exp {formatDay(b.expiryDate)} · {b.qtyAvailable} · {b.category}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-sm font-medium">Quantity</label>
                            <Input
                              type="number"
                              min={1}
                              max={selectedBatch?.qtyAvailable}
                              value={quantity}
                              onChange={(e) => setQuantity(Number(e.target.value))}
                            />

                          </div>

                          <div className="space-y-1">
                            <label className="text-sm font-medium">Reason</label>
                            <Select value={reason} onValueChange={setReason}>
                              <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                              <SelectContent>
                                {REASONS.map((r) => (
                                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-sm font-medium">
                              Note {reason === 'OTHER' ? '' : '(optional)'}
                            </label>
                            <Input
                              placeholder={reason === 'OTHER' ? 'Describe the reason' : 'Extra detail'}
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                            />
                          </div>

                          <Button onClick={addItem} className="bg-orange-600 hover:bg-orange-700">
                            <Plus className="mr-2 h-4 w-4" />
                            Add
                          </Button>
                        </div>
                        </div>

                        {formError && (
                          <div className="mt-3 rounded-lg border-l-4 border-l-rose-500 border border-rose-200 bg-rose-50 p-3">
                            <p className="text-sm font-medium text-rose-900">{formError}</p>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">
                      Items to Dispose
                      <Badge variant="secondary" className="ml-2">{pending.length}</Badge>
                    </CardTitle>
                    <CardDescription>
                      Nothing leaves stock until you record the disposal
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {saved && (
                      <div className="mb-4 flex items-center gap-2 rounded-lg border-l-4 border-l-emerald-500 border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-900">
                        <CheckCircle className="h-4 w-4" />
                        {saved}
                      </div>
                    )}

                    {pending.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        No items added yet.
                      </p>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Medicine</TableHead>
                                <TableHead>Batch</TableHead>
                                <TableHead>Expiry</TableHead>
                                <TableHead className="text-right">Quantity</TableHead>
                                <TableHead>Reason</TableHead>
                                <TableHead />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {pending.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell>
                                    <p className="font-medium">{item.batch.medicine.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {[item.batch.medicine.strength, item.batch.medicine.form].filter(Boolean).join(' · ')}
                                    </p>
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">{item.batch.batchNo}</TableCell>
                                  <TableCell className="text-sm">{formatDay(item.batch.expiryDate)}</TableCell>
                                  <TableCell className="text-right">
                                    {/* Editable: a templated quantity is a
                                        starting point, and correcting it should
                                        not mean deleting the row and re-adding */}
                                    <Input
                                      type="number"
                                      min={1}
                                      max={item.batch.qtyAvailable}
                                      value={item.quantity}
                                      onChange={(e) =>
                                        updatePendingQuantity(item.id, parseInt(e.target.value, 10) || 1)
                                      }
                                      className="ml-auto h-8 w-24 text-right tabular-nums"
                                    />
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      of {item.batch.qtyAvailable.toLocaleString()}
                                    </p>
                                  </TableCell>
                                  <TableCell>
                                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${REASON_STYLE[item.reason]}`}>
                                      {REASON_LABEL[item.reason]}
                                    </span>
                                    {item.note && (
                                      <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setPending((p) => p.filter((x) => x.id !== item.id))}
                                    >
                                      <Trash2 className="h-4 w-4 text-red-600" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

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
                              {pendingTotal.toLocaleString()}
                            </span>{' '}
                            unit{pendingTotal === 1 ? '' : 's'} across {pending.length} item
                            {pending.length === 1 ? '' : 's'}
                            <p className="mt-1 text-xs">
                              Recorded against your account. Disposals cannot be edited or deleted —
                              a correction is a separate adjustment.
                            </p>
                          </div>
                          <Button
                            onClick={save}
                            disabled={saving}
                            className="bg-orange-600 hover:bg-orange-700"
                          >
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Record Disposal
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ---------------- Disposed List ---------------- */}
          <TabsContent value="list">
            <Card className="mb-4 border-orange-200/70 shadow-sm">
              <CardHeader className="rounded-t-lg border-b border-orange-100 bg-orange-50/60">
                <CardTitle className="text-base text-orange-950">Filter</CardTitle>
                <CardDescription className="text-orange-900/70">
                  Leave both dates blank for everything ever written off
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-5">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">From</label>
                    <DateInput value={fromDate} onChange={setFromDate} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">To</label>
                    <DateInput value={toDate} onChange={setToDate} />
                  </div>
                  <Button onClick={applyFilter} disabled={loadingReport}>
                    <Search className="mr-2 h-4 w-4" />
                    Apply
                  </Button>
                  {(applied.from || applied.to) && (
                    <Button variant="outline" onClick={clearFilter} disabled={loadingReport}>
                      Clear
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="ml-auto"
                    onClick={exportCsv}
                    disabled={loadingReport || !report || report.rows.length === 0}
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Showing: {rangeLabel}</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Write-offs</CardTitle>
                <CardDescription>
                  Newest first. These records cannot be edited or removed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingReport ? (
                  <div className="flex min-h-[200px] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : !report || report.rows.length === 0 ? (
                  <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-center">
                    <PackageX className="h-10 w-10 text-muted-foreground" />
                    <p className="font-medium">No disposals recorded</p>
                    <p className="text-sm text-muted-foreground">
                      {applied.from || applied.to
                        ? 'Nothing was written off in the selected date range.'
                        : 'Items you dispose will appear here.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date/Time</TableHead>
                          <TableHead>Medicine</TableHead>
                          <TableHead>Batch</TableHead>
                          <TableHead>Expiry</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Disposed By</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.rows.map((row, i) => (
                          <TableRow key={`${row.disposalId}-${i}`}>
                            <TableCell className="whitespace-nowrap text-sm">
                              {formatWhen(row.disposedAt)}
                            </TableCell>
                            <TableCell>
                              <p className="font-medium">{row.medicineName}</p>
                              <p className="text-xs text-muted-foreground">
                                {[row.medicineStrength, row.medicineForm].filter(Boolean).join(' · ')}
                              </p>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{row.batchNo}</TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {formatDay(row.expiryDate)}
                            </TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">
                              {row.quantity.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${REASON_STYLE[row.reason] ?? REASON_STYLE.OTHER}`}>
                                {REASON_LABEL[row.reason] ?? row.reason}
                              </span>
                              {row.note && (
                                <p className="mt-1 text-xs text-muted-foreground">{row.note}</p>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">{row.disposedBy ?? '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    <div className="mt-4 flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 p-4">
                      <span className="text-sm text-orange-900/80">
                        Total disposed ({report.totalRecords} record{report.totalRecords === 1 ? '' : 's'})
                      </span>
                      <span className="text-lg font-bold tabular-nums text-orange-950">
                        {report.totalQuantity.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Template picker: choose the reason once, then expand a template to see
          which of its medicines this pharmacy can actually write off. */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Select a Template</DialogTitle>
            <DialogDescription>
              Queues the batch closest to expiring for each medicine. Quantities stay
              editable, and nothing leaves stock until you record the disposal.
            </DialogDescription>
          </DialogHeader>

          {/* One reason covers the whole template — a template sweep is a single
              act (an expiry check, a recall), not a per-item judgement. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Reason</label>
              <Select value={templateReason} onValueChange={setTemplateReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Note {templateReason === 'OTHER' ? '' : <span className="text-muted-foreground">(optional)</span>}
              </label>
              <Input
                placeholder="Applies to every item added"
                value={templateNote}
                onChange={(e) => setTemplateNote(e.target.value)}
              />
            </div>
          </div>

          {templateError && (
            <p className="text-sm text-red-600">{templateError}</p>
          )}

          <div className="max-h-[45vh] overflow-y-auto">
            {templates.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No templates available.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {templates.map((t) => {
                  const expanded = expandedTemplateId === t.id;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setExpandedTemplateId(expanded ? null : t.id)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-3 text-left hover:bg-gray-50"
                      >
                        {expanded ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-gray-800">{t.name}</span>
                          <span className="block text-xs text-gray-500">
                            {t.items.length} medicine{t.items.length === 1 ? '' : 's'}
                            {t.pharmacy?.name ? ` · ${t.pharmacy.name}` : ''}
                          </span>
                        </span>
                      </button>

                      {expanded && (
                        <div className="mb-3 ml-6 overflow-hidden rounded-lg border border-gray-100">
                          <div className="divide-y divide-gray-100">
                            {t.items.map((it, i) => {
                              const category = it.category ?? 'NORMAL';
                              const batch = pickBatchForDisposal(it.medicine.id, category);
                              return (
                                <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                                  <div className="min-w-0">
                                    <span className="block truncate text-gray-800">{it.medicine.name}</span>
                                    <span className="block text-xs text-gray-500">
                                      {it.quantity ? `Qty ${it.quantity}` : 'Qty 1'}
                                      {category === 'LP' ? ' · LP' : ''}
                                      {batch ? ` · batch ${batch.batchNo} exp ${formatDay(batch.expiryDate)}` : ''}
                                    </span>
                                  </div>
                                  <span
                                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                                      batch ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                                    }`}
                                  >
                                    {batch ? `Holds ${batch.qtyAvailable}` : 'No stock'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex justify-end bg-gray-50 px-3 py-2">
                            <Button size="sm" onClick={() => applyTemplate(t)}>
                              Add to disposal
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
