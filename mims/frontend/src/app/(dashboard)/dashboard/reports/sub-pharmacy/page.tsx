'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DateInput } from '@/components/ui/date-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Package, 
  Users, 
  ArrowDownLeft, 
  RefreshCcw, 
  Loader2,
  Activity,
  Pill
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import { MedicineStockBalanceTable } from '@/components/reports/MedicineStockBalanceTable';
import { DetailedIssuanceTable } from '@/components/reports/DetailedIssuanceTable';
import { DetailedTransferTable } from '@/components/reports/DetailedTransferTable';
import { MedicineConsumptionSummaryComponent } from '@/components/reports/MedicineConsumptionSummary';

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
    totalTransfersIn: number;
    totalIssues: number;
  };
  medicineWiseOpening: any[];
  medicineWiseClosing: any[];
  detailedTransfersIn: any[];
  detailedIssues: any[];
  medicineConsumption: any[];
}

export default function SubPharmacyDashboard() {
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
      const params: any = {};
      if (user?.hospitalId && user.role !== 'SUPER_ADMIN') {
        params.hospitalId = user.hospitalId;
      }

      const response = await api.get('/pharmacies', { params });
      const subPharmacies = response.data.filter((p: Pharmacy) => p.type === 'SUB');
      setPharmacies(subPharmacies);

      if (subPharmacies.length > 0 && !selectedPharmacy) {
        setSelectedPharmacy(subPharmacies[0].id);
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
      setDashboardData(response.data);
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

  // Calculate stats
  const uniquePatients = dashboardData?.detailedIssues
    ? new Set(dashboardData.detailedIssues.map((issue: any) => issue.nrNumber)).size
    : 0;

  const totalMedicinesIssued = dashboardData?.detailedIssues
    ? dashboardData.detailedIssues.reduce((sum: number, issue: any) => sum + issue.totalItems, 0)
    : 0;

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sub Pharmacy Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Patient service overview and medicine consumption analytics
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
              <Label htmlFor="pharmacy">Sub Pharmacy</Label>
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
              <DateInput
                id="date"
                value={selectedDate}
                onChange={setSelectedDate}
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
                    <p className="text-xs text-gray-600 mb-1">Transfers In</p>
                    <p className="text-lg font-bold text-purple-600">
                      {dashboardData.summary.totalTransfersIn}
                    </p>
                  </div>
                  <ArrowDownLeft className="h-8 w-8 text-purple-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Patient Issues</p>
                    <p className="text-lg font-bold text-orange-600">
                      {dashboardData.summary.totalIssues}
                    </p>
                  </div>
                  <Activity className="h-8 w-8 text-orange-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Patients Served</p>
                    <p className="text-lg font-bold text-cyan-600">
                      {uniquePatients}
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-cyan-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Medicines Issued</p>
                    <p className="text-lg font-bold text-pink-600">
                      {totalMedicinesIssued}
                    </p>
                  </div>
                  <Pill className="h-8 w-8 text-pink-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Opening Stock */}
          <MedicineStockBalanceTable
            data={dashboardData.medicineWiseOpening}
            title="Current Opening Stock"
            type="opening"
          />

          {/* Transfers Received */}
          {dashboardData.detailedTransfersIn.length > 0 && (
            <DetailedTransferTable data={dashboardData.detailedTransfersIn} direction="IN" />
          )}

          {/* Patient Issuances */}
          {dashboardData.detailedIssues.length > 0 && (
            <DetailedIssuanceTable data={dashboardData.detailedIssues} />
          )}

          {/* Closing Stock */}
          <MedicineStockBalanceTable
            data={dashboardData.medicineWiseClosing}
            title="Current Closing Stock"
            type="closing"
          />

          {/* Medicine Consumption Analytics */}
          {dashboardData.medicineConsumption.length > 0 && (
            <MedicineConsumptionSummaryComponent
              data={dashboardData.medicineConsumption}
              startDate={dashboardData.reportDate}
              endDate={dashboardData.reportDate}
            />
          )}
        </>
      )}

      {/* Empty State */}
      {!dashboardData && !loading && (
        <Card className="p-12 text-center">
          <Package className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Data Loaded</h3>
          <p className="text-gray-500 mb-4">
            Select a sub pharmacy and date, then click "Load Dashboard" to view patient service data
          </p>
        </Card>
      )}
    </div>
  );
}
