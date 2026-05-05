'use client';

import { useState, useEffect } from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
} from 'lucide-react';
import api from '@/lib/api';
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
}

interface Medicine {
  id: string;
  name: string;
  form: string;
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
  { value: 'EXPIRED', label: 'Expired' },
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
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMedicine, setSelectedMedicine] = useState('all');
  const [selectedPharmacy, setSelectedPharmacy] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedStorage, setSelectedStorage] = useState('all');

  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();
  const router = useRouter();

  // Master Admin & Super Admin must select hospital, others use their hospitalId
  const currentHospitalId = selectedHospital?.id || user?.hospitalId;
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isHospitalAdmin = user?.role === 'HOSPITAL_ADMIN';
  const isMainManager = user?.role === 'MAIN_PHARMACY_MANAGER';
  const userPharmacyId = user?.pharmacyId;

  // Auto-set pharmacy filter for non-admin users with a pharmacy
  useEffect(() => {
    if (!isSuperAdmin && !isHospitalAdmin && !isMainManager && userPharmacyId) {
      setSelectedPharmacy(userPharmacyId);
    }
  }, [isSuperAdmin, isHospitalAdmin, isMainManager, userPharmacyId]);

  // Calculate stats whenever stockBatches changes
  useEffect(() => {
    const totalBatches = stockBatches.length;
    
    const totalValue = stockBatches.reduce((sum, batch) => {
      return sum + (batch.qtyAvailable * batch.purchasePrice);
    }, 0);
    
    // Count batches with low stock (qty < 15)
    const lowStock = stockBatches.filter(batch => batch.qtyAvailable < 15).length;
    
    // Count batches expiring within 7 days
    const expiringSoon = stockBatches.filter(batch => {
      const daysUntilExpiry = Math.ceil(
        (new Date(batch.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
    }).length;
    
    setStats({
      totalBatches,
      totalValue,
      lowStock,
      expiringSoon,
    });
  }, [stockBatches]);

  useEffect(() => {
    // Always fetch data - Super Admin can view all hospitals' data
    fetchData();
  }, [currentHospitalId, selectedMedicine, selectedPharmacy, selectedStatus, selectedStorage, searchQuery]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchStockBatches(),
        fetchMedicines(),
        fetchPharmacies(),
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStockBatches = async () => {
    try {
      const params: any = { limit: 100 };
      
      // Add hospitalId if available
      if (currentHospitalId) {
        params.hospitalId = currentHospitalId;
      }
      
      // For non-admin users with a pharmacy, ALWAYS filter by their pharmacy
      if (!isSuperAdmin && !isHospitalAdmin && !isMainManager && userPharmacyId) {
        params.pharmacyId = userPharmacyId;
      } else if (selectedPharmacy !== 'all') {
        // For admins or main managers, use the selected pharmacy filter
        params.pharmacyId = selectedPharmacy;
      }
      
      if (selectedMedicine !== 'all') params.medicineId = selectedMedicine;
      if (selectedStatus !== 'all') params.status = selectedStatus;
      if (selectedStorage !== 'all') params.storageType = selectedStorage;
      if (searchQuery) params.search = searchQuery;

      if (!params.hospitalId) {
        console.warn('No hospital selected');
        return;
      }

      const response = await api.get('/inventory/batches', { params });
      const batches = response.data?.data || response.data || [];
      setStockBatches(batches);
    } catch (error) {
      console.error('Error fetching stock batches:', error);
    }
  };

  const fetchMedicines = async () => {
    try {
      const params: any = {};
      if (currentHospitalId) {
        params.hospitalId = currentHospitalId;
      }
      if (!params.hospitalId) {
        console.warn('No hospital selected');
        return;
      }
      const response = await api.get('/medicines', { params });
      const medicineList = response.data?.data || response.data || [];
      setMedicines(medicineList.filter((m: any) => m.status === 'ACTIVE'));
    } catch (error) {
      console.error('Error fetching medicines:', error);
    }
  };

  const fetchPharmacies = async () => {
    try {
      const params: any = {};
      if (currentHospitalId) {
        params.hospitalId = currentHospitalId;
      }
      if (!params.hospitalId) {
        console.warn('No hospital selected');
        return;
      }
      const response = await api.get('/pharmacies', { params });
      setPharmacies(response.data || []);
    } catch (error) {
      console.error('Error fetching pharmacies:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      AVAILABLE: 'bg-green-500',
      EXPIRED: 'bg-red-500',
      DEPLETED: 'bg-gray-500',
      QUARANTINE: 'bg-yellow-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  const getStorageColor = (storage: string) => {
    const colors: { [key: string]: string } = {
      ROOM_TEMPERATURE: 'bg-blue-100 text-blue-800',
      COLD_STORAGE: 'bg-cyan-100 text-cyan-800',
      REFRIGERATED: 'bg-purple-100 text-purple-800',
    };
    return colors[storage] || 'bg-gray-100 text-gray-800';
  };

  const isExpiringSoon = (expiryDate: string) => {
    const daysUntilExpiry = Math.ceil(
      (new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  };

  const isExpired = (expiryDate: string) => {
    return new Date(expiryDate) < new Date();
  };

  // Calculate stock level based on absolute quantity thresholds
  // Low Stock: < 15
  // Medium Stock: 15-30
  // Good Stock: > 30
  const getStockLevel = (qtyAvailable: number) => {
    if (qtyAvailable > 30) {
      return { level: 'good', color: 'bg-green-500', label: 'Good Stock', qty: qtyAvailable };
    } else if (qtyAvailable >= 15) {
      return { level: 'medium', color: 'bg-yellow-500', label: 'Medium Stock', qty: qtyAvailable };
    } else {
      return { level: 'low', color: 'bg-red-500', label: 'Low Stock', qty: qtyAvailable };
    }
  };

  if (!currentHospitalId && !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Hospital Selection Required</CardTitle>
            <CardDescription>
              Please select a hospital from the dropdown to view inventory
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add custom styles for blinking animation */}
      <style jsx>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .blink-yellow {
          animation: blink 2s ease-in-out infinite;
        }
        .blink-red {
          animation: blink 1.5s ease-in-out infinite;
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor stock levels, expiry dates, and batch information
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/dashboard/inventory/alerts')}>
            <Bell className="mr-2 h-4 w-4" />
            View Alerts
          </Button>
          <Button onClick={() => router.push('/dashboard/inventory/receive')}>
            <PackagePlus className="mr-2 h-4 w-4" />
            Receive Stock
          </Button>
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
            <div className="text-2xl font-bold">PKR {stats.totalValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Based on purchase price</p>
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
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select value={selectedMedicine} onValueChange={setSelectedMedicine}>
              <SelectTrigger>
                <SelectValue placeholder="All Medicines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Medicines</SelectItem>
                {medicines.map((medicine) => (
                  <SelectItem key={medicine.id} value={medicine.id}>
                    {medicine.name} - {medicine.form}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={selectedPharmacy} 
              onValueChange={setSelectedPharmacy}
              disabled={!isSuperAdmin && !isHospitalAdmin && !isMainManager && !!userPharmacyId}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Pharmacies" />
              </SelectTrigger>
              <SelectContent>
                {(isSuperAdmin || isHospitalAdmin || isMainManager) && (
                  <SelectItem value="all">All Pharmacies</SelectItem>
                )}
                {pharmacies.map((pharmacy) => (
                  <SelectItem key={pharmacy.id} value={pharmacy.id}>
                    {pharmacy.name} ({pharmacy.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStorage} onValueChange={setSelectedStorage}>
              <SelectTrigger>
                <SelectValue placeholder="All Storage" />
              </SelectTrigger>
              <SelectContent>
                {STORAGE_TYPES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stock Batches Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Stock Batches</CardTitle>
              <CardDescription>
                All stock batches organized in FIFO order (First In, First Out)
              </CardDescription>
            </div>
            {/* Stock Level Legend */}
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
                  <TableHead>Stock Alert</TableHead>
                  <TableHead>Batch No</TableHead>
                  <TableHead>Medicine</TableHead>
                  <TableHead>Pharmacy</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Prices (PKR)</TableHead>
                  <TableHead>Total Amount (PKR)</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockBatches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No stock batches found
                    </TableCell>
                  </TableRow>
                ) : (
                  stockBatches.map((batch) => {
                    const stockLevel = getStockLevel(batch.qtyAvailable);
                    
                    return (
                      <TableRow
                        key={batch.id}
                        className={
                          isExpired(batch.expiryDate)
                            ? 'bg-red-50'
                            : isExpiringSoon(batch.expiryDate)
                            ? 'bg-yellow-50'
                            : ''
                        }
                      >
                        {/* Stock Level Indicator */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-4 h-4 rounded-full ${stockLevel.color} ${
                                stockLevel.level === 'medium' ? 'blink-yellow' :
                                stockLevel.level === 'low' ? 'blink-red' : ''
                              }`}
                              title={stockLevel.label}
                            />
                            {stockLevel.level === 'good' && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                            {stockLevel.level === 'medium' && (
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            )}
                            {stockLevel.level === 'low' && (
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{batch.batchNo}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{batch.medicine.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {batch.medicine.strength} • {batch.medicine.form}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{batch.pharmacy.code}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStorageColor(batch.storageType)}>
                          {batch.storageType.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p className="font-medium">{batch.qtyAvailable.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">
                            of {batch.qtyReceived.toLocaleString()}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {isExpired(batch.expiryDate) && (
                            <AlertTriangle className="h-3 w-3 text-red-600" />
                          )}
                          {isExpiringSoon(batch.expiryDate) && !isExpired(batch.expiryDate) && (
                            <Calendar className="h-3 w-3 text-yellow-600" />
                          )}
                          <span className="text-sm">{formatDate(batch.expiryDate)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-0.5">
                          <p>P: {Number(batch.purchasePrice).toFixed(2)}</p>
                          <p>G: {Number(batch.governmentPrice).toFixed(2)}</p>
                          <p>R: {Number(batch.retailPrice).toFixed(2)}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-sm">
                          PKR {(batch.qtyAvailable * batch.purchasePrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(batch.receivedDate)}</TableCell>
                      <TableCell>
                        <Badge className={`${getStatusColor(batch.status)} text-white`}>
                          {batch.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
