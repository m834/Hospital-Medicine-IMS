'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import {
  useExpenditures,
  useExpenditureTotals,
  useCreateExpenditure,
  useUpdateExpenditure,
  useDeleteExpenditure,
  EXPENDITURE_TYPE_LABELS,
  Expenditure,
  ExpenditureType,
  ExpenditureFilter,
} from '@/hooks/use-expenditure';
import { UserRole } from '@/lib/constants';
import {
  Pencil,
  Trash2,
  PlusCircle,
  TrendingUp,
  CalendarDays,
  BarChart3,
  X,
  Loader2,
} from 'lucide-react';

const EXPENDITURE_TYPES = Object.entries(EXPENDITURE_TYPE_LABELS) as [ExpenditureType, string][];

const TYPE_BADGE_COLORS: Record<ExpenditureType, string> = {
  DAILY_WAGES: 'bg-blue-100 text-blue-800',
  ELECTRICITY: 'bg-yellow-100 text-yellow-800',
  MAINTENANCE: 'bg-orange-100 text-orange-800',
  PURCHASE: 'bg-green-100 text-green-800',
  MISCELLANEOUS: 'bg-gray-100 text-gray-800',
  RENT: 'bg-purple-100 text-purple-800',
  SUPPLIES: 'bg-teal-100 text-teal-800',
  OTHER: 'bg-rose-100 text-rose-800',
};

function formatCurrency(amount: number | string | undefined) {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
  }).format(num);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const emptyForm = {
  date: new Date().toISOString().split('T')[0],
  type: '' as ExpenditureType | '',
  amount: '',
  description: '',
};

export default function ExpenditurePage() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();
  const hospitalId = selectedHospital?.id || user?.hospitalId || '';

  const canManage =
    user?.role === UserRole.MASTER_ADMIN ||
    user?.role === UserRole.SUPER_ADMIN ||
    user?.role === UserRole.HOSPITAL_ADMIN;

  // Selected date for totals (default today)
  const [totalsDate, setTotalsDate] = useState(new Date().toISOString().split('T')[0]);

  // Filter state for list
  const [filter, setFilter] = useState<ExpenditureFilter>({});
  const [filterType, setFilterType] = useState<ExpenditureType | 'ALL'>('ALL');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');

  // Form state
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Data hooks
  const { data: expenditures = [], isLoading: isListLoading, refetch } = useExpenditures(hospitalId, filter);
  const { data: totals, isLoading: isTotalsLoading } = useExpenditureTotals(hospitalId, totalsDate);
  const createMutation = useCreateExpenditure(hospitalId);
  const updateMutation = useUpdateExpenditure(hospitalId);
  const deleteMutation = useDeleteExpenditure(hospitalId);

  // Apply filter
  const applyFilter = () => {
    const newFilter: ExpenditureFilter = {};
    if (filterType !== 'ALL') newFilter.type = filterType;
    if (filterStart) newFilter.startDate = filterStart;
    if (filterEnd) newFilter.endDate = filterEnd;
    setFilter(newFilter);
  };

  const clearFilter = () => {
    setFilterType('ALL');
    setFilterStart('');
    setFilterEnd('');
    setFilter({});
  };

  // Open add form
  const openAdd = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(true);
  };

  // Open edit form
  const openEdit = (exp: Expenditure) => {
    setForm({
      date: exp.date.split('T')[0],
      type: exp.type,
      amount: String(exp.amount),
      description: exp.description || '',
    });
    setEditingId(exp.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  // Submit form
  const handleSubmit = async () => {
    if (!form.type) {
      toast({ title: 'Validation Error', description: 'Please select an expenditure type.', variant: 'destructive' });
      return;
    }
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      toast({ title: 'Validation Error', description: 'Please enter a valid amount.', variant: 'destructive' });
      return;
    }

    const payload = {
      date: form.date,
      type: form.type as ExpenditureType,
      amount: Number(form.amount),
      description: form.description || undefined,
    };

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, dto: payload });
        toast({ title: 'Updated', description: 'Expenditure record updated successfully.' });
      } else {
        await createMutation.mutateAsync(payload);
        toast({ title: 'Added', description: 'Expenditure record added successfully.' });
      }
      closeForm();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.response?.data?.message || 'Something went wrong.',
        variant: 'destructive',
      });
    }
  };

  // Delete record
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: 'Deleted', description: 'Expenditure record deleted.' });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.response?.data?.message || 'Failed to delete.',
        variant: 'destructive',
      });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenditure Management</h1>
          <p className="text-sm text-gray-500 mt-1">Track and manage daily hospital expenses</p>
        </div>
        {canManage && (
          <Button onClick={openAdd} className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            Add Expense
          </Button>
        )}
      </div>

      {/* Totals Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium text-gray-700">View totals for date:</Label>
          <Input
            type="date"
            value={totalsDate}
            onChange={(e) => setTotalsDate(e.target.value)}
            className="w-44"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Daily Total */}
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <CalendarDays className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Today's Total</p>
                  {isTotalsLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mt-1" />
                  ) : (
                    <p className="text-xl font-bold text-gray-900">
                      {formatCurrency(totals?.daily?.total ?? 0)}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(totalsDate)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Total */}
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Monthly Total</p>
                  {isTotalsLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mt-1" />
                  ) : (
                    <p className="text-xl font-bold text-gray-900">
                      {formatCurrency(totals?.monthly?.total ?? 0)}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {totals ? new Date(totalsDate).toLocaleDateString('en-PK', { month: 'long', year: 'numeric' }) : '—'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Yearly Total */}
          <Card className="border-l-4 border-l-violet-500">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-50 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Yearly Total</p>
                  {isTotalsLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mt-1" />
                  ) : (
                    <p className="text-xl font-bold text-gray-900">
                      {formatCurrency(totals?.yearly?.total ?? 0)}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {totals ? `Year ${new Date(totalsDate).getFullYear()}` : '—'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="border border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-gray-800">
                {editingId ? 'Edit Expenditure' : 'Add New Expenditure'}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={closeForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Date */}
              <div className="space-y-1.5">
                <Label htmlFor="exp-date">Date <span className="text-red-500">*</span></Label>
                <Input
                  id="exp-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>

              {/* Type */}
              <div className="space-y-1.5">
                <Label htmlFor="exp-type">Expenditure Type <span className="text-red-500">*</span></Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v as ExpenditureType })}
                >
                  <SelectTrigger id="exp-type">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENDITURE_TYPES.map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <Label htmlFor="exp-amount">Amount (PKR) <span className="text-red-500">*</span></Label>
                <Input
                  id="exp-amount"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="exp-desc">Description / Reason <span className="text-gray-400 text-xs">(optional)</span></Label>
                <Input
                  id="exp-desc"
                  type="text"
                  placeholder="Brief description..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button onClick={handleSubmit} disabled={isSaving} className="flex items-center gap-2">
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingId ? 'Update Expense' : 'Add Expense'}
              </Button>
              <Button variant="outline" onClick={closeForm} disabled={isSaving}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Bar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-gray-800">Expense Records</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">From Date</Label>
              <Input
                type="date"
                value={filterStart}
                onChange={(e) => setFilterStart(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">To Date</Label>
              <Input
                type="date"
                value={filterEnd}
                onChange={(e) => setFilterEnd(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">Type</Label>
              <Select value={filterType} onValueChange={(v) => setFilterType(v as ExpenditureType | 'ALL')}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  {EXPENDITURE_TYPES.map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={applyFilter} size="sm" variant="secondary">Apply Filter</Button>
            <Button onClick={clearFilter} size="sm" variant="ghost">Clear</Button>
          </div>

          {/* Table */}
          {isListLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : expenditures.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="mx-auto h-10 w-10 text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">No expenditure records found.</p>
              {canManage && (
                <Button variant="outline" size="sm" className="mt-3" onClick={openAdd}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add First Expense
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Type</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Amount</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Description</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Added By</th>
                    {canManage && (
                      <th className="text-center px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {expenditures.map((exp, idx) => (
                    <tr
                      key={exp.id}
                      className={`border-b transition-colors hover:bg-gray-50 ${idx % 2 === 0 ? '' : 'bg-gray-50/40'}`}
                    >
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap font-medium">
                        {formatDate(exp.date)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE_COLORS[exp.type]}`}>
                          {EXPENDITURE_TYPE_LABELS[exp.type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800 whitespace-nowrap">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                        {exp.description || <span className="text-gray-300 italic">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {exp.creator?.fullName || '—'}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEdit(exp)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-700 hover:border-red-300"
                              onClick={() => handleDelete(exp.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                {/* Summary row */}
                <tfoot>
                  <tr className="bg-gray-100 font-semibold border-t-2">
                    <td className="px-4 py-3 text-gray-700" colSpan={2}>
                      Total ({expenditures.length} record{expenditures.length !== 1 ? 's' : ''})
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {formatCurrency(
                        expenditures.reduce((sum, e) => sum + parseFloat(String(e.amount)), 0)
                      )}
                    </td>
                    <td colSpan={canManage ? 3 : 2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
