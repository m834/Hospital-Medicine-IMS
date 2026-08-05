'use client';

import { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import { fetchAllMedicines } from '@/lib/medicines';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Plus, Pencil, Trash2, ClipboardList, ArrowLeft } from 'lucide-react';

type DosageFrequency = 'OD' | 'BID' | 'TDS' | 'SOS' | '';
const FREQ_QTY: Record<Exclude<DosageFrequency, ''>, number | null> = { OD: 1, BID: 2, TDS: 3, SOS: null };

interface Medicine {
  id: string;
  name: string;
  genericName?: string;
  strength?: string;
  form: string;
}

interface Pharmacy {
  id: string;
  name: string;
}

interface TemplateItem {
  medicine: { id: string; name: string };
  dosageFrequency: DosageFrequency | null;
  quantity: number | null;
  category: 'NORMAL' | 'LP';
  instructions?: string | null;
}

interface Template {
  id: string;
  name: string;
  description?: string | null;
  pharmacy?: { id: string; name: string };
  creator?: { id: string; fullName: string };
  items: TemplateItem[];
}

interface EditorRow {
  medicineId: string;
  dosageFrequency: DosageFrequency;
  quantity: number;
  category: 'NORMAL' | 'LP';
}

interface EditorState {
  id?: string;
  name: string;
  description: string;
  pharmacyId: string;
  rows: EditorRow[];
}

interface Availability {
  medicineId: string;
  normalStock: number;
  lpStock: number;
  totalStock: number;
}

const emptyRow = (): EditorRow => ({ medicineId: '', dosageFrequency: '', quantity: 1, category: 'NORMAL' });

export default function MedicineTemplatesPage() {
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();
  const currentHospitalId = selectedHospital?.id || user?.hospitalId;

  const [templates, setTemplates] = useState<Template[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Record<string, Availability>>({});

  useEffect(() => {
    void loadAll();
  }, [currentHospitalId]);

  const loadAll = async () => {
    if (!currentHospitalId) return;
    setLoading(true);
    try {
      const [tplRes, allMedicines, phRes] = await Promise.all([
        api.get('/medicine-templates', { params: { hospitalId: currentHospitalId } }),
        fetchAllMedicines<Medicine>(currentHospitalId),
        api.get('/pharmacies', { params: { hospitalId: currentHospitalId } }),
      ]);
      setTemplates(tplRes.data ?? []);
      setMedicines(allMedicines);
      setPharmacies(phRes.data ?? []);
    } catch {
      setError('Failed to load templates. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  // A template belongs to a pharmacy, so its rows are limited to what that
  // pharmacy actually stocks — same rule the prescription screen applies.
  const editorPharmacyId = editor?.pharmacyId || user?.pharmacyId || '';

  useEffect(() => {
    if (!editorPharmacyId) {
      setAvailability({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/inventory/availability/${editorPharmacyId}`);
        if (cancelled) return;
        const map: Record<string, Availability> = {};
        (res.data ?? []).forEach((a: Availability) => { map[a.medicineId] = a; });
        setAvailability(map);
      } catch {
        if (!cancelled) setAvailability({});
      }
    })();
    return () => { cancelled = true; };
  }, [editorPharmacyId]);

  // Normal and LP are separate stock pools, so each row only offers medicines
  // stocked in the pool it is set to. Built once per catalogue/stock change
  // rather than per row — the catalogue runs to thousands.
  const optionsByCategory = useMemo(() => {
    const build = (pool: 'NORMAL' | 'LP') =>
      medicines
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
  }, [medicines, availability]);

  // An existing template may reference a medicine the pharmacy has since run
  // out of. Keep that selection visible and labelled rather than letting the
  // field render blank, which looks like the template lost its medicine.
  const optionsForRow = (row: EditorRow) => {
    const base = optionsByCategory[row.category];
    if (!row.medicineId || base.some((o) => o.value === row.medicineId)) return base;

    const selected = medicines.find((m) => m.id === row.medicineId);
    if (!selected) return base;

    return [
      {
        value: selected.id,
        label: selected.name,
        sub: `Not in stock for ${row.category === 'LP' ? 'LP' : 'Normal'}`,
      },
      ...base,
    ];
  };

  // Switching a row's pool: a medicine stocked as Normal may not exist as LP,
  // so drop a selection that has no stock in the pool being switched to.
  const handleCategoryChange = (index: number, next: 'NORMAL' | 'LP') => {
    const row = editor?.rows[index];
    const a = row?.medicineId ? availability[row.medicineId] : undefined;
    const stockInNext = a ? (next === 'LP' ? a.lpStock : a.normalStock) : 0;
    updateRow(index, { category: next, ...(stockInNext > 0 ? {} : { medicineId: '' }) });
  };

  const startCreate = () => {
    setError(null);
    setEditor({
      name: '',
      description: '',
      pharmacyId: user?.pharmacyId || '',
      rows: [emptyRow()],
    });
  };

  const startEdit = (t: Template) => {
    setError(null);
    setEditor({
      id: t.id,
      name: t.name,
      description: t.description || '',
      pharmacyId: t.pharmacy?.id || user?.pharmacyId || '',
      rows: t.items.map((it) => ({
        medicineId: it.medicine.id,
        dosageFrequency: (it.dosageFrequency ?? '') as DosageFrequency,
        quantity: it.quantity ?? 1,
        category: it.category ?? 'NORMAL',
      })),
    });
  };

  const updateRow = (index: number, patch: Partial<EditorRow>) => {
    setEditor((e) => {
      if (!e) return e;
      const rows = e.rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
      return { ...e, rows };
    });
  };

  const handleFreqChange = (index: number, freq: DosageFrequency) => {
    const mapped = freq && freq !== 'SOS' ? FREQ_QTY[freq] : null;
    updateRow(index, mapped != null ? { dosageFrequency: freq, quantity: mapped } : { dosageFrequency: freq });
  };

  const saveTemplate = async () => {
    if (!editor) return;
    if (!editor.name.trim()) { setError('Template title is required'); return; }
    const rows = editor.rows.filter((r) => r.medicineId);
    if (rows.length === 0) { setError('Add at least one medicine'); return; }
    // Admins with no assigned pharmacy must pick which pharmacy owns the template.
    const needsPharmacy = !user?.pharmacyId;
    if (needsPharmacy && !editor.pharmacyId) { setError('Select a pharmacy for this template'); return; }

    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        name: editor.name.trim(),
        description: editor.description.trim() || undefined,
        items: rows.map((r) => ({
          medicineId: r.medicineId,
          dosageFrequency: r.dosageFrequency || undefined,
          quantity: r.quantity,
          category: r.category,
        })),
      };
      if (editor.pharmacyId) payload.pharmacyId = editor.pharmacyId;

      if (editor.id) {
        await api.patch(`/medicine-templates/${editor.id}`, payload);
      } else {
        await api.post('/medicine-templates', payload);
      }
      setEditor(null);
      await loadAll();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (t: Template) => {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    try {
      await api.delete(`/medicine-templates/${t.id}`);
      await loadAll();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete template');
    }
  };

  // ---- Editor view ----
  if (editor) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        <button
          onClick={() => setEditor(null)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back to templates
        </button>
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          {editor.id ? 'Edit Template' : 'New Template'}
        </h1>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Template Title *</label>
              <input
                type="text"
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                placeholder="e.g. Flu Standard"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {!user?.pharmacyId && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Pharmacy *</label>
                <select
                  value={editor.pharmacyId}
                  onChange={(e) => setEditor({ ...editor, pharmacyId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select pharmacy...</option>
                  {pharmacies.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className={user?.pharmacyId ? 'sm:col-span-1' : 'sm:col-span-2'}>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Description <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={editor.description}
                onChange={(e) => setEditor({ ...editor, description: e.target.value })}
                placeholder="What is this template for?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Medicine rows */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-sm font-semibold text-gray-700">Medicines</h2>
              <button
                type="button"
                onClick={() => setEditor({ ...editor, rows: [...editor.rows, emptyRow()] })}
                className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700"
              >
                + Add Row
              </button>
            </div>

            <div className="grid grid-cols-[1fr_120px_90px_90px_28px] gap-2 text-xs font-medium text-gray-500 px-1 mb-1">
              <span>Medicine</span>
              <span>Frequency</span>
              <span className="text-center">Quantity</span>
              <span className="text-center">Category</span>
              <span />
            </div>

            <div className="space-y-2">
              {editor.rows.map((row, index) => (
                <div key={index} className="grid grid-cols-[1fr_120px_90px_90px_28px] gap-2 items-center">
                  <SearchableSelect
                    options={optionsForRow(row)}
                    value={row.medicineId}
                    onValueChange={(val) => updateRow(index, { medicineId: val })}
                    placeholder={
                      row.category === 'LP' ? 'Select LP medicine...' : 'Select Normal medicine...'
                    }
                    searchPlaceholder="Search by name or generic..."
                  />
                  <select
                    value={row.dosageFrequency}
                    onChange={(e) => handleFreqChange(index, e.target.value as DosageFrequency)}
                    className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">—</option>
                    <option value="OD">OD (×1/day)</option>
                    <option value="BID">BID (×2/day)</option>
                    <option value="TDS">TDS (×3/day)</option>
                    <option value="SOS">SOS (if needed)</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={row.quantity}
                    onChange={(e) => updateRow(index, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                    disabled={!!row.dosageFrequency && row.dosageFrequency !== 'SOS'}
                    className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
                  />
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-xs text-gray-400">N</span>
                    <input
                      type="checkbox"
                      checked={row.category === 'LP'}
                      onChange={(e) => handleCategoryChange(index, e.target.checked ? 'LP' : 'NORMAL')}
                      className="w-8 h-4 appearance-none bg-gray-200 rounded-full relative cursor-pointer transition-colors checked:bg-orange-400 before:content-[''] before:absolute before:w-4 before:h-4 before:rounded-full before:bg-white before:shadow before:transition-transform checked:before:translate-x-4"
                    />
                    <span className={`text-xs ${row.category === 'LP' ? 'text-orange-600 font-medium' : 'text-gray-400'}`}>LP</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditor({ ...editor, rows: editor.rows.length > 1 ? editor.rows.filter((_, i) => i !== index) : editor.rows })}
                    disabled={editor.rows.length === 1}
                    className="text-gray-400 hover:text-red-600 disabled:opacity-30 text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button
              onClick={() => setEditor(null)}
              className="px-5 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={saveTemplate}
              disabled={saving}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300"
            >
              {saving ? 'Saving...' : editor.id ? 'Save Changes' : 'Create Template'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- List view ----
  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-indigo-600" /> Prescription Templates
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Reusable medicine sets. Apply a template on the Create Prescription screen to add all its
            medicines in one click.
          </p>
        </div>
        <button
          onClick={startCreate}
          className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> New Template
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 py-10 text-center">Loading templates...</p>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 py-12 text-center">
          <ClipboardList className="h-10 w-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No templates yet. Create your first one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-col">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-800 truncate">{t.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t.items.length} medicine{t.items.length === 1 ? '' : 's'}
                    {t.pharmacy?.name ? ` · ${t.pharmacy.name}` : ''}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => startEdit(t)} className="p-1.5 text-gray-400 hover:text-indigo-600" title="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => deleteTemplate(t)} className="p-1.5 text-gray-400 hover:text-red-600" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {t.description && <p className="text-xs text-gray-500 mt-2 line-clamp-2">{t.description}</p>}
              <ul className="mt-3 space-y-1 text-xs text-gray-600">
                {t.items.slice(0, 5).map((it, i) => (
                  <li key={i} className="truncate">
                    • {it.medicine.name}
                    {it.dosageFrequency ? ` — ${it.dosageFrequency}` : ''}
                    {it.category === 'LP' ? ' (LP)' : ''}
                  </li>
                ))}
                {t.items.length > 5 && <li className="text-gray-400">+ {t.items.length - 5} more</li>}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
