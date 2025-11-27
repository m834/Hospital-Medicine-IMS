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
import { Download, Printer, RefreshCcw, FileText, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import { exportToExcel, exportToPDF } from '@/lib/export-utils';
import { MedicineStockBalanceTable } from '@/components/reports/MedicineStockBalanceTable';
import { DetailedIssuanceTable } from '@/components/reports/DetailedIssuanceTable';
import { DetailedTransferTable } from '@/components/reports/DetailedTransferTable';
import { DetailedGRNTable } from '@/components/reports/DetailedGRNTable';
import { MedicineConsumptionSummaryComponent } from '@/components/reports/MedicineConsumptionSummary';

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

export default function DetailedDailyReportPage() {
  const { user } = useAuthStore();
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPharmacies, setLoadingPharmacies] = useState(false);

  // Fetch pharmacies on mount
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
      setPharmacies(response.data);

      // Auto-select first pharmacy if available
      if (response.data.length > 0 && !selectedPharmacy) {
        setSelectedPharmacy(response.data[0].id);
      }
    } catch (error) {
      console.error('Error fetching pharmacies:', error);
    } finally {
      setLoadingPharmacies(false);
    }
  };

  const generateReport = async () => {
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
      setReportData(response.data);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report. Please try again.');
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
          <h1 className="text-3xl font-bold">Detailed Daily Report</h1>
          <p className="text-gray-600 mt-1">
            Comprehensive medicine-wise daily transactions with batch-level details
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
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Report Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="pharmacy">Pharmacy</Label>
              <Select value={selectedPharmacy} onValueChange={setSelectedPharmacy} disabled={loadingPharmacies}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingPharmacies ? 'Loading...' : 'Select pharmacy'} />
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
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="flex items-end">
              <Button onClick={generateReport} disabled={loading || !selectedPharmacy} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Generate Report
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      {reportData && (
        <>
          {/* Summary Header */}
          <Card>
            <CardHeader>
              <CardTitle>
                {reportData.pharmacy.name} - Daily Report
              </CardTitle>
              <p className="text-sm text-gray-600">
                {reportData.hospital.name} | {formatDate(reportData.reportDate)}
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-6 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Opening Balance</p>
                  <p className="text-lg font-bold text-blue-600">
                    {formatCurrency(reportData.summary.openingBalance)}
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Closing Balance</p>
                  <p className="text-lg font-bold text-green-600">
                    {formatCurrency(reportData.summary.closingBalance)}
                  </p>
                </div>
                <div className="p-4 bg-indigo-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">GRN Value</p>
                  <p className="text-lg font-bold text-indigo-600">
                    {formatCurrency(reportData.summary.totalGRNValue)}
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Transfers In</p>
                  <p className="text-lg font-bold text-purple-600">
                    {reportData.summary.totalTransfersIn}
                  </p>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Issues</p>
                  <p className="text-lg font-bold text-orange-600">
                    {reportData.summary.totalIssues}
                  </p>
                </div>
                <div className="p-4 bg-pink-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Transfers Out</p>
                  <p className="text-lg font-bold text-pink-600">
                    {reportData.summary.totalTransfersOut}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Opening Stock */}
          <MedicineStockBalanceTable
            data={reportData.medicineWiseOpening}
            title="Medicine-Wise Opening Stock"
            type="opening"
          />

          {/* GRNs */}
          {reportData.detailedGRNs.length > 0 && (
            <DetailedGRNTable data={reportData.detailedGRNs} />
          )}

          {/* Transfers In */}
          {reportData.detailedTransfersIn.length > 0 && (
            <DetailedTransferTable data={reportData.detailedTransfersIn} direction="IN" />
          )}

          {/* Issues */}
          {reportData.detailedIssues.length > 0 && (
            <DetailedIssuanceTable data={reportData.detailedIssues} />
          )}

          {/* Transfers Out */}
          {reportData.detailedTransfersOut.length > 0 && (
            <DetailedTransferTable data={reportData.detailedTransfersOut} direction="OUT" />
          )}

          {/* Closing Stock */}
          <MedicineStockBalanceTable
            data={reportData.medicineWiseClosing}
            title="Medicine-Wise Closing Stock"
            type="closing"
          />

          {/* Consumption Summary */}
          {reportData.medicineConsumption.length > 0 && (
            <MedicineConsumptionSummaryComponent
              data={reportData.medicineConsumption}
              startDate={reportData.reportDate}
              endDate={reportData.reportDate}
            />
          )}
        </>
      )}

      {/* Empty State */}
      {!reportData && !loading && (
        <Card className="p-12 text-center">
          <FileText className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Report Generated</h3>
          <p className="text-gray-500 mb-4">
            Select a pharmacy and date, then click "Generate Report" to view detailed daily transactions
          </p>
        </Card>
      )}
    </div>
  );
}
