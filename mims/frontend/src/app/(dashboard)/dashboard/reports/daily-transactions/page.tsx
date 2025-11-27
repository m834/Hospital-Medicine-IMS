'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, Printer, Loader2, Package, TrendingUp, TrendingDown, ArrowRightLeft } from 'lucide-react';
import { exportToExcel, exportToPDF } from '@/lib/export-utils';
import { MedicineStockBalanceTable } from '@/components/reports/MedicineStockBalanceTable';
import { DetailedIssuanceTable } from '@/components/reports/DetailedIssuanceTable';
import { DetailedTransferTable } from '@/components/reports/DetailedTransferTable';
import { DetailedGRNTable } from '@/components/reports/DetailedGRNTable';

interface Pharmacy {
  id: string;
  name: string;
  type: string;
}

interface ReportData {
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
    totalTransfersIn: number;
    totalIssues: number;
    totalTransfersOut: number;
  };
  medicineWiseOpening: any[];
  medicineWiseClosing: any[];
  detailedGRNs: any[];
  detailedTransfersIn: any[];
  detailedIssues: any[];
  detailedTransfersOut: any[];
  medicineConsumption: any[];
}

export default function DailyTransactionsPage() {
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState<string>('');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isHospitalAdmin = user?.role === 'HOSPITAL_ADMIN';

  useEffect(() => {
    if (user && (isSuperAdmin || user.hospitalId)) {
      fetchPharmacies();
    }
  }, [user, selectedHospital, isSuperAdmin]);

  const fetchPharmacies = async () => {
    try {
      const hospitalId = isSuperAdmin ? selectedHospital?.id : user?.hospitalId;
      if (!hospitalId) return;

      const params: any = { hospitalId };
      const response = await api.get('/pharmacies', { params });
      setPharmacies(response.data);

      if (response.data.length > 0 && !selectedPharmacy) {
        setSelectedPharmacy(response.data[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching pharmacies:', err);
    }
  };

  const fetchReport = async () => {
    if (!selectedPharmacy) {
      setError('Please select a pharmacy');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const hospitalId = isSuperAdmin ? selectedHospital?.id : user?.hospitalId;
      
      if (!hospitalId) {
        setError('Hospital not selected');
        return;
      }

      const params: any = {
        pharmacyId: selectedPharmacy,
        hospitalId,
        date: date,
      };

      const response = await api.get('/reports/detailed-daily', { params });
      setReportData(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load report');
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    exportToPDF();
  };

  const handleExport = () => {
    if (reportData) {
      try {
        exportToExcel(reportData);
      } catch (error) {
        alert('Failed to export data. Please try again.');
      }
    }
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null) return 'Nu. 0.00';
    return `Nu. ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
          <h1 className="text-3xl font-bold">Daily Transactions Report</h1>
          <p className="text-gray-600 mt-1">
            Comprehensive daily medicine-wise transactions with batch-level details
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint} disabled={!reportData}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={!reportData}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="pharmacy">Pharmacy</Label>
              <Select
                value={selectedPharmacy}
                onValueChange={setSelectedPharmacy}
                disabled={!pharmacies.length}
              >
                <SelectTrigger>
                  <SelectValue placeholder={pharmacies.length ? 'Select pharmacy' : 'Loading...'} />
                </SelectTrigger>
                <SelectContent>
                  {pharmacies.map((pharmacy) => (
                    <SelectItem key={pharmacy.id} value={pharmacy.id}>
                      {pharmacy.name} ({pharmacy.type})
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
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={fetchReport}
                disabled={loading || !selectedPharmacy}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Generate Report'
                )}
              </Button>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Content */}
      {reportData && (
        <>
          {/* Report Header */}
          <Card>
            <CardHeader>
              <CardTitle>{reportData.pharmacy.name} - Daily Report</CardTitle>
              <p className="text-sm text-gray-600">
                {reportData.hospital.name} | {formatDate(reportData.reportDate)}
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Opening Balance</p>
                        <p className="text-lg font-bold text-blue-600">
                          {formatCurrency(reportData.summary?.openingBalance)}
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
                        <p className="text-xs text-gray-600 mb-1">Closing Balance</p>
                        <p className="text-lg font-bold text-green-600">
                          {formatCurrency(reportData.summary?.closingBalance)}
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
                        <p className="text-xs text-gray-600 mb-1">GRN Value</p>
                        <p className="text-lg font-bold text-indigo-600">
                          {formatCurrency(reportData.summary?.totalGRNValue)}
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
                        <p className="text-xs text-gray-600 mb-1">Transfers In</p>
                        <p className="text-lg font-bold text-purple-600">
                          {reportData.summary?.totalTransfersIn || 0}
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
                        <p className="text-xs text-gray-600 mb-1">Issues</p>
                        <p className="text-lg font-bold text-orange-600">
                          {reportData.summary?.totalIssues || 0}
                        </p>
                      </div>
                      <TrendingDown className="h-8 w-8 text-orange-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Transfers Out</p>
                        <p className="text-lg font-bold text-pink-600">
                          {reportData.summary?.totalTransfersOut || 0}
                        </p>
                      </div>
                      <ArrowRightLeft className="h-8 w-8 text-pink-400" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Opening Stock */}
          <MedicineStockBalanceTable
            data={reportData.medicineWiseOpening || []}
            title="Medicine-Wise Opening Stock"
            type="opening"
          />

          {/* GRNs */}
          {reportData.detailedGRNs && reportData.detailedGRNs.length > 0 && (
            <DetailedGRNTable data={reportData.detailedGRNs} />
          )}

          {/* Transfers In */}
          {reportData.detailedTransfersIn && reportData.detailedTransfersIn.length > 0 && (
            <DetailedTransferTable data={reportData.detailedTransfersIn} direction="IN" />
          )}

          {/* Issues */}
          {reportData.detailedIssues && reportData.detailedIssues.length > 0 && (
            <DetailedIssuanceTable data={reportData.detailedIssues} />
          )}

          {/* Transfers Out */}
          {reportData.detailedTransfersOut && reportData.detailedTransfersOut.length > 0 && (
            <DetailedTransferTable data={reportData.detailedTransfersOut} direction="OUT" />
          )}

          {/* Closing Stock */}
          <MedicineStockBalanceTable
            data={reportData.medicineWiseClosing || []}
            title="Medicine-Wise Closing Stock"
            type="closing"
          />
        </>
      )}

      {/* Empty State */}
      {!reportData && !loading && !error && (
        <Card className="p-12 text-center">
          <Package className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Report Generated</h3>
          <p className="text-gray-500">
            Select a pharmacy and date, then click "Generate Report" to view detailed transactions
          </p>
        </Card>
      )}
    </div>
  );
}
