'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Package, 
  TrendingUp, 
  TrendingDown, 
  ArrowRightLeft, 
  RefreshCcw, 
  Loader2,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import { MedicineStockBalanceTable } from '@/components/reports/MedicineStockBalanceTable';
import { DetailedTransferTable } from '@/components/reports/DetailedTransferTable';
import { DetailedGRNTable } from '@/components/reports/DetailedGRNTable';
import { Badge } from '@/components/ui/badge';

interface Pharmacy {
  id: string;
  name: string;
  type: string;
}

interface DashboardData {
  pharmacy: {
    id: string;
    name: string;
    type: string;
  };
  hospital: {
    id: string;
    name: string;
  };
  reportDate: string;
  summary: {
    openingBalance: number;
    closingBalance: number;
    totalGRNValue: number;
    totalTransfersOut: number;
    lowStockMedicines: number;
    expiringBatches: number;
  };
  medicineWiseOpening: any[];
  medicineWiseClosing: any[];
  detailedGRNs: any[];
  detailedTransfersOut: any[];
  lowStockItems: Array<{
    medicineId: string;
    medicineName: string;
    currentStock: number;
    reorderLevel: number;
  }>;
  expiringItems: Array<{
    medicineId: string;
    medicineName: string;
    batchNo: string;
    expiryDate: string;
    daysUntilExpiry: number;
  }>;
}

export default function MainPharmacyDashboard() {
  const { user } = useAuthStore();
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPharmacies, setLoadingPharmacies] = useState(false);

  useEffect(() => {
    fetchPharmacies();
  }, []);

  const fetchPharmacies = async () => {
    try {
      setLoadingPharmacies(true);
      const params: any = { type: 'MAIN' };
      if (user?.hospitalId && user.role !== 'SUPER_ADMIN') {
        params.hospitalId = user.hospitalId;
      }

      const response = await api.get('/pharmacies', { params });
      const mainPharmacies = response.data.filter((p: Pharmacy) => p.type === 'MAIN');
      setPharmacies(mainPharmacies);

      if (mainPharmacies.length > 0 && !selectedPharmacy) {
        setSelectedPharmacy(mainPharmacies[0].id);
      }
    } catch (error) {
      console.error('Error fetching pharmacies:', error);
    } finally {
      setLoadingPharmacies(false);
    }
  };

  const loadDashboard = async () => {
    if (!selectedPharmacy) {
      alert('Please select a pharmacy');
      return;
    }

    try {
      setLoading(true);
      const params: any = {
        pharmacyId: selectedPharmacy,
        date: selectedDate,
      };

      if (user?.hospitalId && user.role !== 'SUPER_ADMIN') {
        params.hospitalId = user.hospitalId;
      }

      const response = await api.get('/reports/detailed-daily', { params });
      const data = response.data;

      // Calculate low stock and expiring items from the data
      const lowStock = data.medicineWiseClosing.filter((med: any) => {
        // Assume reorder level is when stock is less than 100 units
        return med.totalQuantity < 100;
      });

      const expiring = data.medicineWiseClosing.flatMap((med: any) =>
        med.batches
          .filter((batch: any) => {
            const daysUntilExpiry = Math.ceil(
              (new Date(batch.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
            );
            return daysUntilExpiry <= 90 && daysUntilExpiry > 0;
          })
          .map((batch: any) => ({
            medicineId: med.medicineId,
            medicineName: med.medicineName,
            batchNo: batch.batchNo,
            expiryDate: batch.expiryDate,
            daysUntilExpiry: Math.ceil(
              (new Date(batch.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
            ),
          }))
      );

      setDashboardData({
        ...data,
        summary: {
          ...data.summary,
          lowStockMedicines: lowStock.length,
          expiringBatches: expiring.length,
        },
        lowStockItems: lowStock.map((med: any) => ({
          medicineId: med.medicineId,
          medicineName: med.medicineName,
          currentStock: med.totalQuantity,
          reorderLevel: 100,
        })),
        expiringItems: expiring,
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
      alert('Failed to load dashboard. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null) return 'PKR 0.00';
    return `PKR ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Main Pharmacy Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Comprehensive overview of main pharmacy operations and inventory
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Dashboard Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="pharmacy">Main Pharmacy</Label>
              <Select value={selectedPharmacy} onValueChange={setSelectedPharmacy} disabled={loadingPharmacies}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingPharmacies ? 'Loading...' : 'Select pharmacy'} />
                </SelectTrigger>
                <SelectContent>
                  {pharmacies.map((pharmacy) => (
                    <SelectItem key={pharmacy.id} value={pharmacy.id}>
                      {pharmacy.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="date">Report Date</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="flex items-end">
              <Button onClick={loadDashboard} disabled={loading || !selectedPharmacy} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Load Dashboard
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Content */}
      {dashboardData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Opening Stock</p>
                    <p className="text-lg font-bold text-blue-600">
                      {formatCurrency(dashboardData.summary.openingBalance)}
                    </p>
                  </div>
                  <Package className="h-8 w-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Closing Stock</p>
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(dashboardData.summary.closingBalance)}
                    </p>
                  </div>
                  <Package className="h-8 w-8 text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">GRN Received</p>
                    <p className="text-lg font-bold text-indigo-600">
                      {formatCurrency(dashboardData.summary.totalGRNValue)}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-indigo-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Transfers Out</p>
                    <p className="text-lg font-bold text-purple-600">
                      {dashboardData.summary.totalTransfersOut}
                    </p>
                  </div>
                  <ArrowRightLeft className="h-8 w-8 text-purple-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Low Stock</p>
                    <p className="text-lg font-bold text-orange-600">
                      {dashboardData.summary.lowStockMedicines}
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-orange-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Expiring Soon</p>
                    <p className="text-lg font-bold text-red-600">
                      {dashboardData.summary.expiringBatches}
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Alerts Section */}
          {(dashboardData.lowStockItems.length > 0 || dashboardData.expiringItems.length > 0) && (
            <div className="grid grid-cols-2 gap-4">
              {/* Low Stock Alert */}
              {dashboardData.lowStockItems.length > 0 && (
                <Card className="border-orange-200 bg-orange-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-800">
                      <AlertTriangle className="h-5 w-5" />
                      Low Stock Medicines ({dashboardData.lowStockItems.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {dashboardData.lowStockItems.slice(0, 10).map((item) => (
                        <div key={item.medicineId} className="flex items-center justify-between p-2 bg-white rounded">
                          <span className="text-sm font-medium">{item.medicineName}</span>
                          <Badge variant="outline" className="bg-orange-100 text-orange-800">
                            {item.currentStock} units
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Expiring Soon Alert */}
              {dashboardData.expiringItems.length > 0 && (
                <Card className="border-red-200 bg-red-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-800">
                      <AlertTriangle className="h-5 w-5" />
                      Expiring Soon ({dashboardData.expiringItems.length} batches)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {dashboardData.expiringItems.slice(0, 10).map((item, index) => (
                        <div key={`${item.medicineId}-${index}`} className="flex items-center justify-between p-2 bg-white rounded">
                          <div>
                            <p className="text-sm font-medium">{item.medicineName}</p>
                            <p className="text-xs text-gray-600">Batch: {item.batchNo}</p>
                          </div>
                          <Badge variant="outline" className="bg-red-100 text-red-800">
                            {item.daysUntilExpiry} days
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Opening Stock */}
          <MedicineStockBalanceTable
            data={dashboardData.medicineWiseOpening}
            title="Current Opening Stock"
            type="opening"
          />

          {/* GRNs */}
          {dashboardData.detailedGRNs.length > 0 && (
            <DetailedGRNTable data={dashboardData.detailedGRNs} />
          )}

          {/* Transfers to Sub-Pharmacies */}
          {dashboardData.detailedTransfersOut.length > 0 && (
            <DetailedTransferTable data={dashboardData.detailedTransfersOut} direction="OUT" />
          )}

          {/* Closing Stock */}
          <MedicineStockBalanceTable
            data={dashboardData.medicineWiseClosing}
            title="Current Closing Stock"
            type="closing"
          />
        </>
      )}

      {/* Empty State */}
      {!dashboardData && !loading && (
        <Card className="p-12 text-center">
          <Package className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Data Loaded</h3>
          <p className="text-gray-500 mb-4">
            Select a main pharmacy and date, then click "Load Dashboard" to view comprehensive operations data
          </p>
        </Card>
      )}
    </div>
  );
}
