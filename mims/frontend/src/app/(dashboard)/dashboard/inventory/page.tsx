'use client';

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Package,
  DollarSign,
  AlertTriangle,
  Calendar,
  Loader2,
  Search,
  PackagePlus,
  TrendingDown,
  Clock,
  CheckCircle,
  Bell,
  Info,
  ChevronDown,
  ChevronRight,
  FileDown,
  Pencil,
} from 'lucide-react';
import { SearchableSelect } from '@/components/ui/searchable-select';
import api from '@/lib/api';
import { buildSheetRows, EXPORT_COLUMNS } from '@/lib/inventory-export';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import { useRouter } from 'next/navigation';

interface StockBatch {
  id: string;
  batchNo: string;
  medicine: {
    name: string;
    strength?: string;
    form: string;
  };
  pharmacy: {
    name: string;
    code: string;
  };
  qtyReceived: number;
  qtyAvailable: number;
  expiryDate: string;
  purchasePrice: number;
  governmentPrice: number;
  retailPrice: number;
  receivedDate: string;
  status: string;
  storageType: string;
  category: string;
  manufacturer?: string;
}

interface MedicineGroup {
  key: string;
  medicineName: string;
  medicineStrength?: string;
  medicineForm: string;
  batches: StockBatch[];
  totalQtyAvailable: number;
  totalQtyReceived: number;
  totalValue: number;
  nearestExpiry: string;
}

interface Medicine {
  id: string;
  name: string;
  form: string;
  strength?: string;
}

interface Pharmacy {
  id: string;
  name: string;
  code: string;
}

interface Stats {
  totalBatches: number;
  totalValue: number;
  lowStock: number;
  expiringSoon: number;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'DEPLETED', label: 'Depleted' },
  { value: 'QUARANTINE', label: 'Quarantine' },
];

const STORAGE_TYPES = [
  { value: 'all', label: 'All Storage Types' },
  { value: 'ROOM_TEMPERATURE', label: 'Room Temperature' },
  { value: 'COLD_STORAGE', label: 'Cold Storage' },
  { value: 'REFRIGERATED', label: 'Refrigerated' },
];

export default function InventoryDashboardPage() {
  const [stockBatches, setStockBatches] = useState<StockBatch[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalBatches: 0,
    totalValue: 0,
    lowStock: 0,
    expiringSoon: 0,
  });
  // Value amounts by category, computed across ALL batches (independent of the
  // active tab) so the cards stay stable when switching tabs. Total = normal + lp
  // (excludes expired stock).
  const [valueBreakdown, setValueBreakdown] = useState({ normal: 0, lp: 0, expired: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'normal' | 'lp' | 'expired'>('normal');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMedicine, setSelectedMedicine] = useState('all');
  const [selectedPharmacy, setSelectedPharmacy] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedStorage, setSelectedStorage] = useState('all');

  // Expanded groups (accordion)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Edit batch dialog
  const [editBatch, setEditBatch] = useState<StockBatch | null>(null);
  const [editForm, setEditForm] = useState({ batchNo: '', expiryDate: '', qtyReceived: 0, qtyAvailable: 0, purchasePrice: 0, storageType: '', status: '' });
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Export dialog
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<Record<string, boolean>>(
    Object.fromEntries(EXPORT_COLUMNS.map(c => [c.key, true]))
  );
  const [exportScope, setExportScope] = useState<'current' | 'normal' | 'lp' | 'both' | 'expired'>('current');
  const [exportLoading, setExportLoading] = useState(false);

  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();
  const router = useRouter();

  const currentHospitalId = selectedHospital?.id || user?.hospitalId;
  const isMasterAdmin = user?.role === 'MASTER_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isHospitalAdmin = user?.role === 'HOSPITAL_ADMIN';
  const isMainManager = user?.role === 'MAIN_PHARMACY_MANAGER';
  const canManageInventory = isMasterAdmin || isSuperAdmin || isHospitalAdmin || isMainManager;
  const userPharmacyId = user?.pharmacyId;

  useEffect(() => {
    if (!isSuperAdmin && !isHospitalAdmin && !isMainManager && userPharmacyId) {
      setSelectedPharmacy(userPharmacyId);
    }
  }, [isSuperAdmin, isHospitalAdmin, isMainManager, userPharmacyId]);

  useEffect(() => {
    const now = new Date();
    const activeBatches = stockBatches.filter(
      batch => new Date(batch.expiryDate) >= now && batch.status !== 'EXPIRED'
    );
    const totalBatches = activeBatches.length;
    const totalValue = activeBatches.reduce((sum, b) => sum + b.qtyAvailable * b.purchasePrice, 0);
    const lowStock = activeBatches.filter(b => b.qtyAvailable < 15).length;
    const expiringSoon = activeBatches.filter(b => {
      const days = Math.ceil((new Date(b.expiryDate).getTime() - now.getTime()) / 86400000);
      return days <= 7 && days > 0;
    }).length;
    setStats({ totalBatches, totalValue, lowStock, expiringSoon });
  }, [stockBatches]);

  useEffect(() => {
    fetchData();
  }, [currentHospitalId, activeTab, selectedMedicine, selectedPharmacy, selectedStatus, selectedStorage, searchQuery]);

  useEffect(() => {
    fetchValueBreakdown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentHospitalId, selectedPharmacy]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchStockBatches(), fetchMedicines(), fetchPharmacies()]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStockBatches = async () => {
    try {
      const params: any = { limit: 500 };
      if (currentHospitalId) params.hospitalId = currentHospitalId;
      if (!isSuperAdmin && !isHospitalAdmin && !isMainManager && userPharmacyId) {
        params.pharmacyId = userPharmacyId;
      } else if (selectedPharmacy !== 'all') {
        params.pharmacyId = selectedPharmacy;
      }
      if (activeTab === 'normal') params.category = 'NORMAL';
      if (activeTab === 'lp') params.category = 'LP';
      if (selectedMedicine !== 'all') params.medicineId = selectedMedicine;
      if (selectedStatus !== 'all') params.status = selectedStatus;
      if (selectedStorage !== 'all') params.storageType = selectedStorage;
      if (searchQuery) params.search = searchQuery;
      if (!params.hospitalId) return;
      const response = await api.get('/inventory/batches', { params });
      setStockBatches(response.data?.data || response.data || []);
    } catch (error) {
      console.error('Error fetching stock batches:', error);
    }
  };

  const fetchMedicines = async () => {
    try {
      const params: any = { limit: 2000, status: 'ACTIVE' };
      if (currentHospitalId) params.hospitalId = currentHospitalId;
      if (!params.hospitalId) return;
      const response = await api.get('/medicines', { params });
      const list = response.data?.data || response.data || [];
      setMedicines(list.filter((m: any) => m.status === 'ACTIVE'));
    } catch (error) {
      console.error('Error fetching medicines:', error);
    }
  };

  const fetchPharmacies = async () => {
    try {
      const params: any = {};
      if (currentHospitalId) params.hospitalId = currentHospitalId;
      if (!params.hospitalId) return;
      const response = await api.get('/pharmacies', { params });
      setPharmacies(response.data || []);
    } catch (error) {
      console.error('Error fetching pharmacies:', error);
    }
  };

  // Value amounts by category across all batches for the hospital / selected
  // pharmacy (ignores the active tab, category and search filters).
  const fetchValueBreakdown = async () => {
    try {
      const params: any = { limit: 2000 };
      if (currentHospitalId) params.hospitalId = currentHospitalId;
      if (!isSuperAdmin && !isHospitalAdmin && !isMainManager && userPharmacyId) {
        params.pharmacyId = userPharmacyId;
      } else if (selectedPharmacy !== 'all') {
        params.pharmacyId = selectedPharmacy;
      }
      if (!params.hospitalId) return;
      const res = await api.get('/inventory/batches', { params });
      const all: StockBatch[] = res.data?.data || res.data || [];
      let normal = 0, lp = 0, expired = 0;
      for (const b of all) {
        const value = b.qtyAvailable * Number(b.purchasePrice);
        if (isExpired(b.expiryDate) || b.status === 'EXPIRED') { expired += value; continue; }
        if (b.category === 'LP') lp += value; else normal += value;
      }
      setValueBreakdown({ normal, lp, expired });
    } catch (error) {
      console.error('Error fetching value breakdown:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getStatusColor = (status: string) =>
    ({ AVAILABLE: 'bg-green-500', EXPIRED: 'bg-red-500', DEPLETED: 'bg-gray-500', QUARANTINE: 'bg-yellow-500' }[status] || 'bg-gray-500');

  const getStorageColor = (storage: string) =>
    ({ ROOM_TEMPERATURE: 'bg-blue-100 text-blue-800', COLD_STORAGE: 'bg-cyan-100 text-cyan-800', REFRIGERATED: 'bg-purple-100 text-purple-800' }[storage] || 'bg-gray-100 text-gray-800');

  const isExpiringSoon = (d: string) => {
    const days = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
    return days <= 7 && days > 0;
  };

  const isExpired = (d: string) => new Date(d) < new Date();

  const getStockLevel = (qty: number) => {
    if (qty > 30) return { level: 'good', color: 'bg-green-500', label: 'Good Stock' };
    if (qty >= 15) return { level: 'medium', color: 'bg-yellow-500', label: 'Medium Stock' };
    return { level: 'low', color: 'bg-red-500', label: 'Low Stock' };
  };

  // Group flat batch list by medicine
  const groupBatches = (batches: StockBatch[]): MedicineGroup[] => {
    const map: Record<string, MedicineGroup> = {};
    for (const batch of batches) {
      const key = `${batch.medicine.name}|${batch.medicine.strength ?? ''}|${batch.medicine.form}`;
      if (!map[key]) {
        map[key] = {
          key,
          medicineName: batch.medicine.name,
          medicineStrength: batch.medicine.strength,
          medicineForm: batch.medicine.form,
          batches: [],
          totalQtyAvailable: 0,
          totalQtyReceived: 0,
          totalValue: 0,
          nearestExpiry: batch.expiryDate,
        };
      }
      const g = map[key];
      g.batches.push(batch);
      g.totalQtyAvailable += batch.qtyAvailable;
      g.totalQtyReceived += batch.qtyReceived;
      g.totalValue += batch.qtyAvailable * Number(batch.purchasePrice);
      if (new Date(batch.expiryDate) < new Date(g.nearestExpiry)) {
        g.nearestExpiry = batch.expiryDate;
      }
    }
    return Object.values(map).sort((a, b) => a.medicineName.localeCompare(b.medicineName));
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Quantity already issued out of this batch — received can only be corrected
  // while this is zero, and available can never be raised above received.
  const editIssuedQty = editBatch ? editBatch.qtyReceived - editBatch.qtyAvailable : 0;

  const openEditBatch = (batch: StockBatch) => {
    setEditBatch(batch);
    setEditError('');
    setEditForm({
      batchNo: batch.batchNo,
      expiryDate: batch.expiryDate.slice(0, 10),
      qtyReceived: batch.qtyReceived,
      qtyAvailable: batch.qtyAvailable,
      purchasePrice: Number(batch.purchasePrice),
      storageType: batch.storageType,
      status: batch.status,
    });
  };

  const handleBatchUpdate = async () => {
    if (!editBatch) return;

    const qtyReceived = Number(editForm.qtyReceived);
    const qtyAvailable = Number(editForm.qtyAvailable);

    if (!Number.isInteger(qtyReceived) || qtyReceived < 0) {
      setEditError('Received quantity must be a whole number of 0 or more');
      return;
    }
    if (!Number.isInteger(qtyAvailable) || qtyAvailable < 0) {
      setEditError('Available quantity must be a whole number of 0 or more');
      return;
    }
    if (qtyAvailable > qtyReceived) {
      setEditError(`Available quantity cannot exceed the received quantity (${qtyReceived})`);
      return;
    }

    setEditError('');
    setEditSaving(true);
    try {
      const payload: any = {
        batchNo: editForm.batchNo,
        expiryDate: editForm.expiryDate,
        qtyAvailable,
        purchasePrice: Number(editForm.purchasePrice),
        storageType: editForm.storageType,
        status: editForm.status,
      };

      // The API rejects any qtyReceived on a batch that has been issued from,
      // so only send it while the batch is untouched.
      if (editIssuedQty === 0) {
        payload.qtyReceived = qtyReceived;
      }

      await api.patch(`/inventory/batches/${editBatch.id}`, payload);
      setEditBatch(null);
      fetchData();
    } catch (err: any) {
      setEditError(err.response?.data?.message || 'Failed to update batch');
    } finally {
      setEditSaving(false);
    }
  };

  // Fetch batches for a specific category (used by export)
  const fetchBatchesForScope = async (category?: 'NORMAL' | 'LP'): Promise<StockBatch[]> => {
    try {
      const params: any = { limit: 2000 };
      if (currentHospitalId) params.hospitalId = currentHospitalId;
      if (!isSuperAdmin && !isHospitalAdmin && !isMainManager && userPharmacyId) {
        params.pharmacyId = userPharmacyId;
      } else if (selectedPharmacy !== 'all') {
        params.pharmacyId = selectedPharmacy;
      }
      if (category) params.category = category;
      const res = await api.get('/inventory/batches', { params });
      return res.data?.data || res.data || [];
    } catch {
      return [];
    }
  };

  // Excel export
  const handleExport = async () => {
    setExportLoading(true);
    try {
      const cols = EXPORT_COLUMNS.filter(c => selectedColumns[c.key]);
      const wb = XLSX.utils.book_new();
      const date = new Date().toISOString().slice(0, 10);

      if (exportScope === 'current') {
        const mode = activeTab === 'expired' ? 'expired' : 'active';
        const label = activeTab === 'normal' ? 'Normal' : activeTab === 'lp' ? 'LP' : 'Expiry';
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildSheetRows(stockBatches, cols, mode)), `Inventory - ${label}`);
        XLSX.writeFile(wb, `inventory_${label.toLowerCase()}_${date}.xlsx`);
      } else if (exportScope === 'expired') {
        const batches = await fetchBatchesForScope();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildSheetRows(batches, cols, 'expired')), 'Inventory - Expiry');
        XLSX.writeFile(wb, `inventory_expiry_${date}.xlsx`);
      } else if (exportScope === 'normal') {
        const batches = await fetchBatchesForScope('NORMAL');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildSheetRows(batches, cols)), 'Inventory - Normal');
        XLSX.writeFile(wb, `inventory_normal_${date}.xlsx`);
      } else if (exportScope === 'lp') {
        const batches = await fetchBatchesForScope('LP');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildSheetRows(batches, cols)), 'Inventory - LP');
        XLSX.writeFile(wb, `inventory_lp_${date}.xlsx`);
      } else {
        // both — two sheets in one file
        const [normalBatches, lpBatches] = await Promise.all([
          fetchBatchesForScope('NORMAL'),
          fetchBatchesForScope('LP'),
        ]);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildSheetRows(normalBatches, cols)), 'Normal Items');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildSheetRows(lpBatches, cols)), 'LP Items');
        XLSX.writeFile(wb, `inventory_all_${date}.xlsx`);
      }
    } finally {
      setExportLoading(false);
      setExportDialogOpen(false);
    }
  };

  if (!currentHospitalId && !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Hospital Selection Required</CardTitle>
            <CardDescription>Please select a hospital to view inventory</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const displayBatches = activeTab === 'expired'
    ? stockBatches.filter(b => isExpired(b.expiryDate) || b.status === 'EXPIRED')
    : stockBatches.filter(b => !isExpired(b.expiryDate) && b.status !== 'EXPIRED');

  const groups = groupBatches(displayBatches);
  const grandTotalValue = groups.reduce((sum, g) => sum + g.totalValue, 0);
  const grandTotalQty = groups.reduce((sum, g) => sum + g.totalQtyAvailable, 0);
  const isActiveTab = activeTab === 'normal' || activeTab === 'lp';
  // total columns: Stock Alert + Medicine + Batches + Total Qty + Nearest Expiry + Total Value + Actions
  const colSpan = isActiveTab ? 7 : 6;

  return (
    <div className="space-y-6">
      <style jsx>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .blink-yellow { animation: blink 2s ease-in-out infinite; }
        .blink-red { animation: blink 1.5s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Dashboard</h1>
          <p className="text-muted-foreground">Monitor stock levels, expiry dates, and batch information</p>
        </div>
        <div className="flex gap-2">
          {canManageInventory && (
            <Button variant="outline" onClick={() => setExportDialogOpen(true)}>
              <FileDown className="mr-2 h-4 w-4" />
              Export to Excel
            </Button>
          )}
          <Button variant="outline" onClick={() => router.push('/dashboard/inventory/alerts')}>
            <Bell className="mr-2 h-4 w-4" />
            View Alerts
          </Button>
          {canManageInventory && (
            <Button onClick={() => router.push('/dashboard/inventory/receive')}>
              <PackagePlus className="mr-2 h-4 w-4" />
              Receive Stock
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Batches</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBatches}</div>
            <p className="text-xs text-muted-foreground">Active stock batches</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              PKR {(valueBreakdown.normal + valueBreakdown.lp + valueBreakdown.expired).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Normal + LP + expired</p>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:bg-orange-50 transition-colors border-orange-200"
          onClick={() => router.push('/dashboard/inventory/alerts')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.lowStock}</div>
            <p className="text-xs text-muted-foreground">Medicines below threshold</p>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:bg-red-50 transition-colors border-red-200"
          onClick={() => router.push('/dashboard/inventory/alerts')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <Clock className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.expiringSoon}</div>
            <p className="text-xs text-muted-foreground">Within 7 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Value breakdown by category */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Normal Stock Value</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              PKR {valueBreakdown.normal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Active Normal items</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">LP Stock Value</CardTitle>
            <Package className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              PKR {valueBreakdown.lp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Active LP (Local Purchase) items</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired Stock Value</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              PKR {valueBreakdown.expired.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Included in total value</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter stock batches by various criteria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search batch number..."
                className="pl-8"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <SearchableSelect
              options={[
                { value: 'all', label: 'All Medicines' },
                ...medicines.map(m => ({
                  value: m.id,
                  label: m.name,
                  sub: [m.strength, m.form].filter(Boolean).join(' · '),
                })),
              ]}
              value={selectedMedicine}
              onValueChange={setSelectedMedicine}
              placeholder="All Medicines"
              searchPlaceholder="Search medicine..."
            />
            <Select
              value={selectedPharmacy}
              onValueChange={setSelectedPharmacy}
              disabled={!isSuperAdmin && !isHospitalAdmin && !isMainManager && !!userPharmacyId}
            >
              <SelectTrigger><SelectValue placeholder="All Pharmacies" /></SelectTrigger>
              <SelectContent>
                {(isSuperAdmin || isHospitalAdmin || isMainManager) && (
                  <SelectItem value="all">All Pharmacies</SelectItem>
                )}
                {pharmacies.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStorage} onValueChange={setSelectedStorage}>
              <SelectTrigger><SelectValue placeholder="All Storage" /></SelectTrigger>
              <SelectContent>
                {STORAGE_TYPES.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'normal' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          onClick={() => setActiveTab('normal')}
        >
          Normal Items
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'lp' ? 'border-orange-500 text-orange-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          onClick={() => setActiveTab('lp')}
        >
          LP Items
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'expired' ? 'border-red-500 text-red-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          onClick={() => setActiveTab('expired')}
        >
          Expiry
          {stockBatches.filter(b => isExpired(b.expiryDate) || b.status === 'EXPIRED').length > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
              {stockBatches.filter(b => isExpired(b.expiryDate) || b.status === 'EXPIRED').length}
            </span>
          )}
        </button>
      </div>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {activeTab === 'normal' && 'Normal Stock Batches'}
                {activeTab === 'lp' && 'LP (Local Purchase) Batches'}
                {activeTab === 'expired' && 'Expired Batches'}
              </CardTitle>
              <CardDescription>
                {activeTab === 'normal' && 'Grouped by medicine — click ℹ to expand batches'}
                {activeTab === 'lp' && 'Local purchase batches grouped by medicine'}
                {activeTab === 'expired' && 'Batches that have passed their expiry date'}
              </CardDescription>
            </div>
            {isActiveTab && (
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">Good (&gt;30)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500 blink-yellow" />
                  <span className="text-muted-foreground">Medium (15-30)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 blink-red" />
                  <span className="text-muted-foreground">Low (&lt;15)</span>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isActiveTab && <TableHead className="w-10">Alert</TableHead>}
                  <TableHead>Medicine</TableHead>
                  <TableHead className="text-center">Batches</TableHead>
                  <TableHead>Total Qty</TableHead>
                  <TableHead>Nearest Expiry</TableHead>
                  <TableHead>Total Value (PKR)</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={colSpan} className="text-center py-8 text-muted-foreground">
                      {activeTab === 'normal' && 'No normal stock batches found'}
                      {activeTab === 'lp' && 'No LP stock batches found'}
                      {activeTab === 'expired' && 'No expired batches found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  groups.map(group => {
                    const isExpanded = expandedGroups.has(group.key);
                    const stockLevel = getStockLevel(group.totalQtyAvailable);
                    const anyExpiringSoon = group.batches.some(b => isExpiringSoon(b.expiryDate));

                    return (
                      <React.Fragment key={group.key}>
                        {/* Medicine group summary row */}
                        <TableRow
                          key={group.key}
                          className={`cursor-pointer hover:bg-muted/50 font-medium ${
                            activeTab === 'expired'
                              ? 'bg-red-50'
                              : anyExpiringSoon
                              ? 'bg-yellow-50'
                              : 'bg-muted/20'
                          }`}
                          onClick={() => toggleGroup(group.key)}
                        >
                          {isActiveTab && (
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <div
                                  className={`w-3 h-3 rounded-full ${stockLevel.color} ${
                                    stockLevel.level === 'medium' ? 'blink-yellow' :
                                    stockLevel.level === 'low' ? 'blink-red' : ''
                                  }`}
                                  title={stockLevel.label}
                                />
                              </div>
                            </TableCell>
                          )}
                          <TableCell>
                            <div>
                              <p className="font-semibold">{group.medicineName}</p>
                              <p className="text-xs text-muted-foreground">
                                {[group.medicineStrength, group.medicineForm].filter(Boolean).join(' · ')}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{group.batches.length}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p className="font-semibold">{group.totalQtyAvailable.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">of {group.totalQtyReceived.toLocaleString()}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              {anyExpiringSoon && <Calendar className="h-3 w-3 text-yellow-600" />}
                              {activeTab === 'expired' && <AlertTriangle className="h-3 w-3 text-red-600" />}
                              {formatDate(group.nearestExpiry)}
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">
                            PKR {group.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={e => { e.stopPropagation(); toggleGroup(group.key); }}
                              className="p-1 rounded hover:bg-muted transition-colors"
                              title={isExpanded ? 'Collapse batches' : 'Expand batches'}
                            >
                              {isExpanded
                                ? <ChevronDown className="h-4 w-4 text-primary" />
                                : <Info className="h-4 w-4 text-muted-foreground" />
                              }
                            </button>
                          </TableCell>
                        </TableRow>

                        {/* Batch detail sub-rows (accordion) */}
                        {isExpanded && group.batches.map(batch => {
                          const batchStockLevel = getStockLevel(batch.qtyAvailable);
                          return (
                            <TableRow
                              key={batch.id}
                              className={`text-sm ${
                                activeTab === 'expired' || isExpired(batch.expiryDate)
                                  ? 'bg-red-50/60'
                                  : isExpiringSoon(batch.expiryDate)
                                  ? 'bg-yellow-50/60'
                                  : 'bg-white'
                              }`}
                            >
                              {isActiveTab && (
                                <TableCell>
                                  <div className="flex items-center gap-1 pl-2">
                                    {batchStockLevel.level === 'good' && <CheckCircle className="h-3 w-3 text-green-500" />}
                                    {batchStockLevel.level === 'medium' && <AlertTriangle className="h-3 w-3 text-yellow-500" />}
                                    {batchStockLevel.level === 'low' && <AlertTriangle className="h-3 w-3 text-red-500" />}
                                  </div>
                                </TableCell>
                              )}
                              <TableCell>
                                <div className="flex items-center gap-2 pl-4 text-muted-foreground">
                                  <ChevronRight className="h-3 w-3 shrink-0" />
                                  <div>
                                    <p className="font-mono text-xs font-medium text-foreground">{batch.batchNo}</p>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <Badge variant="outline" className="text-[10px] px-1 py-0">{batch.pharmacy.code}</Badge>
                                      <Badge variant="outline" className={`text-[10px] px-1 py-0 ${getStorageColor(batch.storageType)}`}>
                                        {batch.storageType.replace(/_/g, ' ')}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className={`${getStatusColor(batch.status)} text-white text-[10px]`}>
                                  {batch.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <p className="font-medium">{batch.qtyAvailable.toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground">of {batch.qtyReceived.toLocaleString()}</p>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  {isExpiringSoon(batch.expiryDate) && <Calendar className="h-3 w-3 text-yellow-600" />}
                                  {(activeTab === 'expired' || isExpired(batch.expiryDate)) && <AlertTriangle className="h-3 w-3 text-red-600" />}
                                  <span>{formatDate(batch.expiryDate)}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-xs space-y-0.5 text-muted-foreground">
                                  <p>P: <span className="text-foreground font-medium">{Number(batch.purchasePrice).toFixed(2)}</span></p>
                                  <p>Total: <span className="text-foreground font-semibold">PKR {(batch.qtyAvailable * Number(batch.purchasePrice)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                                </div>
                              </TableCell>
                              <TableCell>
                                {canManageInventory && (
                                  <button
                                    onClick={e => { e.stopPropagation(); openEditBatch(batch); }}
                                    className="p-1 rounded hover:bg-muted transition-colors"
                                    title="Edit batch"
                                  >
                                    <Pencil className="h-3.5 w-3.5 text-blue-500" />
                                  </button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                )}
                {groups.length > 0 && (
                  <TableRow className="bg-muted/40 border-t-2 font-semibold hover:bg-muted/40">
                    {isActiveTab && <TableCell />}
                    <TableCell className="font-bold">
                      {activeTab === 'expired' ? 'Total Expired' : 'Total'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{displayBatches.length}</Badge>
                    </TableCell>
                    <TableCell className="font-bold">{grandTotalQty.toLocaleString()}</TableCell>
                    <TableCell />
                    <TableCell className={`font-bold ${activeTab === 'expired' ? 'text-red-600' : ''}`}>
                      PKR {grandTotalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Batch Dialog */}
      <Dialog open={!!editBatch} onOpenChange={open => { if (!open) setEditBatch(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Batch Number</label>
              <Input value={editForm.batchNo} onChange={e => setEditForm(f => ({ ...f, batchNo: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Expiry Date</label>
              <DateInput value={editForm.expiryDate} onChange={v => setEditForm(f => ({ ...f, expiryDate: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Received Quantity</label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={editForm.qtyReceived}
                  disabled={editIssuedQty > 0}
                  onChange={e => setEditForm(f => ({ ...f, qtyReceived: Number(e.target.value) }))}
                />
                <p className="text-xs text-muted-foreground">
                  {editIssuedQty > 0
                    ? `Locked — ${editIssuedQty.toLocaleString()} already issued`
                    : 'Nothing issued yet, safe to correct'}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Available Quantity</label>
                <Input
                  type="number"
                  min="0"
                  max={editForm.qtyReceived}
                  step="1"
                  value={editForm.qtyAvailable}
                  onChange={e => setEditForm(f => ({ ...f, qtyAvailable: Number(e.target.value) }))}
                />
                <p className="text-xs text-muted-foreground">
                  Set to 0 to mark the batch depleted
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Purchase Price (PKR)</label>
              <Input type="number" min="0" step="0.01" value={editForm.purchasePrice} onChange={e => setEditForm(f => ({ ...f, purchasePrice: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Storage Type</label>
              <Select value={editForm.storageType} onValueChange={v => setEditForm(f => ({ ...f, storageType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STORAGE_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Status</label>
              <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AVAILABLE">Available</SelectItem>
                  <SelectItem value="DEPLETED">Depleted</SelectItem>
                  <SelectItem value="QUARANTINE">Quarantine</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editError && (
              <div className="rounded-lg border border-destructive p-3 bg-destructive/10">
                <p className="text-sm text-destructive">{editError}</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditBatch(null)}>Cancel</Button>
            <Button onClick={handleBatchUpdate} disabled={editSaving}>
              {editSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Column Selector Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export to Excel</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">

            {/* Scope selector */}
            <div>
              <p className="text-sm font-medium mb-2">What to export</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: 'current', label: 'Current tab' },
                  { value: 'normal', label: 'Normal Items only' },
                  { value: 'lp', label: 'LP Items only' },
                  { value: 'both', label: 'Normal + LP (2 sheets)' },
                  { value: 'expired', label: 'Expiry Items only' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setExportScope(opt.value)}
                    className={`px-3 py-2 text-sm rounded-md border text-left transition-colors ${
                      exportScope === opt.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-muted-foreground/30 hover:bg-muted'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <hr />

            {/* Column selector */}
            <div>
              <p className="text-sm font-medium mb-2">Columns to include</p>
              <div className="space-y-1">
            {EXPORT_COLUMNS.map(col => (
              <label
                key={col.key}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
              >
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    selectedColumns[col.key]
                      ? 'bg-primary border-primary'
                      : 'border-muted-foreground/40'
                  }`}
                  onClick={() =>
                    setSelectedColumns(prev => ({ ...prev, [col.key]: !prev[col.key] }))
                  }
                >
                  {selectedColumns[col.key] && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-sm">{col.label}</span>
              </label>
            ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleExport}
              disabled={exportLoading || !EXPORT_COLUMNS.some(c => selectedColumns[c.key])}
            >
              {exportLoading
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <FileDown className="mr-2 h-4 w-4" />
              }
              {exportLoading ? 'Exporting…' : 'Export'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
