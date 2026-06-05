'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
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
import { ConsolidatedMedicineStockTable } from '@/components/reports/ConsolidatedMedicineStockTable';
import { DetailedIssuanceTable } from '@/components/reports/DetailedIssuanceTable';
import { DetailedTransferTable } from '@/components/reports/DetailedTransferTable';
import { DetailedGRNTable } from '@/components/reports/DetailedGRNTable';

interface Pharmacy {
  id: string;
  name: string;
  type: string;
}

interface SubPharmacy {
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
    stockReceived: number;
    stockIssued: number;
    stockTransferred: number;
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
  const [subPharmacies, setSubPharmacies] = useState<SubPharmacy[]>([]);
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
      const allPharmacies = response.data;
      setPharmacies(allPharmacies);

      // Separate main and sub pharmacies
      const mainPharmacies = allPharmacies.filter((p: Pharmacy) => p.type === 'MAIN');
      const subs = allPharmacies.filter((p: Pharmacy) => p.type === 'SUB');
      setSubPharmacies(subs);

      if (mainPharmacies.length > 0 && !selectedPharmacy) {
        setSelectedPharmacy(mainPharmacies[0].id);
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

  // ── Normalizers: map backend field names → component interface field names ──

  const normalizeIssues = (issues: any[]) =>
    issues.map((issue) => ({
      issueId: issue.id,
      issueDate: issue.issuedAt,
      nrNumber: issue.patientNrNumber,
      patientName: issue.patientName,
      age: issue.patientAge ?? null,
      gender: issue.patientGender,
      visitType: issue.visitType,
      issuedBy: issue.issuedBy || '—',
      totalItems: issue.itemCount ?? issue.items?.length ?? 0,
      totalAmount: issue.totalAmount,
      items: (issue.items || []).map((item: any) => ({
        medicineId: item.medicineId,
        medicineName: item.medicineName,
        genericName: item.genericName ?? null,
        form: item.form,
        strength: item.strength ?? null,
        batchId: item.issueItemId ?? item.medicineId,
        batchNo: item.batchNo,
        expiryDate: item.expiryDate,
        quantity: item.qtyIssued,
        unitPrice: item.unitPrice,
        totalPrice: item.totalAmount,
      })),
    }));

  const normalizeTransfers = (transfers: any[]) =>
    transfers.map((t) => ({
      transferId: t.id,
      requestedAt: t.requestedAt,
      approvedAt: t.approvedAt ?? null,
      dispatchedAt: t.dispatchedAt ?? null,
      receivedAt: t.receivedAt ?? null,
      status: t.status,
      fromPharmacy: t.fromPharmacyName,
      toPharmacy: t.toPharmacyName,
      requester: t.requestedBy || '—',
      approver: t.approvedBy ?? null,
      totalItems: t.itemCount ?? t.items?.length ?? 0,
      items: (t.items || []).map((item: any) => ({
        medicineId: item.medicineId,
        medicineName: item.medicineName,
        genericName: item.genericName ?? null,
        form: item.form,
        strength: item.strength ?? null,
        totalQuantity: item.qtyApproved ?? item.qtyRequested ?? 0,
        batchMappings: (item.batchMappings || []).map((m: any, idx: number) => ({
          sourceBatchId: `src-${idx}`,
          sourceBatchNo: m.sourceBatchNo,
          sourceExpiry: m.sourceExpiryDate,
          destinationBatchId: m.destinationBatchNo ? `dst-${idx}` : null,
          destinationBatchNo: m.destinationBatchNo || null,
          destinationExpiry: m.destinationExpiryDate ?? null,
          quantity: m.qtyTransferred,
        })),
      })),
    }));

  const normalizeGRNs = (grns: any[]) =>
    grns.map((grn) => ({
      grnId: grn.id,
      grnNumber: grn.grnNumber,
      receivedDate: grn.receivedDate,
      receivedBy: grn.receivedBy || '—',
      invoiceNumber: grn.invoiceNumber ?? null,
      supplierName: grn.supplierName ?? null,
      totalItems: grn.itemCount ?? grn.items?.length ?? 0,
      totalValue: grn.totalValue,
      items: (grn.items || []).map((item: any) => ({
        medicineId: item.medicineId,
        medicineName: item.medicineName,
        genericName: item.genericName ?? null,
        form: item.form,
        strength: item.strength ?? null,
        batchNo: item.batchNo,
        expiryDate: item.expiryDate,
        quantity: item.qtyReceived,
        purchasePrice: item.purchasePrice,
        governmentPrice: item.governmentPrice,
        retailPrice: item.retailPrice,
        storageType: item.storageType,
        totalValue: item.totalValue,
      })),
    }));

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

  // Transform report data into consolidated medicine-wise stock format
  const transformToConsolidatedData = () => {
    if (!reportData) return [];

    const medicineMap = new Map<string, any>();

    const ensure = (medicine: any) => {
      const key = medicine.medicineId;
      if (!medicineMap.has(key)) {
        medicineMap.set(key, {
          medicineId: medicine.medicineId,
          medicineName: medicine.medicineName,
          strength: medicine.strength ?? '',
          form: medicine.form ?? '',
          openingStock: 0,
          openingStockValue: 0,
          transfersToSubPharmacies: [],
          patientTransfers: 0,
          closingStock: 0,
          closingStockValue: 0,
        });
      }
      return medicineMap.get(key);
    };

    // Opening stock
    (reportData.medicineWiseOpening || []).forEach((med: any) => {
      const m = ensure(med);
      m.openingStock = med.totalQuantity || 0;
      m.openingStockValue = med.totalValue || 0;
    });

    // Closing stock
    (reportData.medicineWiseClosing || []).forEach((med: any) => {
      const m = ensure(med);
      m.closingStock = med.totalQuantity || 0;
      m.closingStockValue = med.totalValue || 0;
    });

    // Transfers from this pharmacy to sub-pharmacies
    // In this system: sub pharmacies are the requesters (fromPharmacyId) and Main is the provider (toPharmacyId)
    // Physical stock flows from Main to Sub; these appear in detailedTransfersIn
    (reportData.detailedTransfersIn || []).forEach((transfer: any) => {
      const destination = subPharmacies.find(
        (sp) => sp.id === transfer.fromPharmacyId
      );
      if (!destination) return;

      (transfer.items || []).forEach((item: any) => {
        const m = ensure(item);
        const qty =
          (item.batchMappings || []).reduce(
            (s: number, bm: any) => s + (bm.qtyTransferred || 0),
            0
          ) ||
          item.qtyApproved ||
          item.qtyRequested ||
          0;

        const existing = m.transfersToSubPharmacies.find(
          (t: any) => t.subPharmacyId === destination.id
        );
        if (existing) {
          existing.quantity += qty;
        } else {
          m.transfersToSubPharmacies.push({
            subPharmacyId: destination.id,
            subPharmacyName: destination.name,
            quantity: qty,
          });
        }
      });
    });

    // Patient issuances
    (reportData.detailedIssues || []).forEach((issue: any) => {
      (issue.items || []).forEach((item: any) => {
        const m = ensure(item);
        m.patientTransfers += item.qtyIssued || 0;
      });
    });

    return Array.from(medicineMap.values());
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
              <Label htmlFor="pharmacy">Main Pharmacy</Label>
              <Select
                value={selectedPharmacy}
                onValueChange={setSelectedPharmacy}
                disabled={!pharmacies.length}
              >
                <SelectTrigger>
                  <SelectValue placeholder={pharmacies.length ? 'Select main pharmacy' : 'Loading...'} />
                </SelectTrigger>
                <SelectContent>
                  {pharmacies.filter(p => p.type === 'MAIN').map((pharmacy) => (
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
                value={date}
                onChange={setDate}
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                        <p className="text-xs text-gray-600 mb-1">Stock Received</p>
                        <p className="text-lg font-bold text-indigo-600">
                          {formatCurrency(reportData.summary?.stockReceived)}
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
                        <p className="text-xs text-gray-600 mb-1">Stock Issued</p>
                        <p className="text-lg font-bold text-orange-600">
                          {formatCurrency(reportData.summary?.stockIssued)}
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
                        <p className="text-xs text-gray-600 mb-1">Stock Transferred</p>
                        <p className="text-lg font-bold text-pink-600">
                          {formatCurrency(reportData.summary?.stockTransferred)}
                        </p>
                      </div>
                      <ArrowRightLeft className="h-8 w-8 text-pink-400" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Consolidated Medicine-Wise Stock Report */}
          <ConsolidatedMedicineStockTable
            data={transformToConsolidatedData()}
            subPharmacies={subPharmacies}
            title="Medicine-Wise Stock Report"
            showValues={true}
          />

          {/* GRNs */}
          {reportData.detailedGRNs && reportData.detailedGRNs.length > 0 && (
            <DetailedGRNTable data={normalizeGRNs(reportData.detailedGRNs)} />
          )}

          {/* Transfers In */}
          {reportData.detailedTransfersIn && reportData.detailedTransfersIn.length > 0 && (
            <DetailedTransferTable data={normalizeTransfers(reportData.detailedTransfersIn)} direction="IN" />
          )}

          {/* Issues */}
          {reportData.detailedIssues && reportData.detailedIssues.length > 0 && (
            <DetailedIssuanceTable data={normalizeIssues(reportData.detailedIssues)} />
          )}

          {/* Transfers Out */}
          {reportData.detailedTransfersOut && reportData.detailedTransfersOut.length > 0 && (
            <DetailedTransferTable data={normalizeTransfers(reportData.detailedTransfersOut)} direction="OUT" />
          )}
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
