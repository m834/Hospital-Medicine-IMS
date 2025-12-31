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

  // Transform report data into consolidated medicine-wise stock format
  const transformToConsolidatedData = () => {
    if (!reportData) {
      console.log('No report data available');
      return [];
    }

    console.log('=== TRANSFORMATION DEBUG ===');
    console.log('Full Report Data:', JSON.stringify(reportData, null, 2));
    console.log('Medicine Wise Opening:', reportData.medicineWiseOpening);
    console.log('Medicine Wise Closing:', reportData.medicineWiseClosing);
    console.log('Detailed Transfers Out:', reportData.detailedTransfersOut);
    console.log('Detailed Issues:', reportData.detailedIssues);
    console.log('Sub Pharmacies:', subPharmacies);
    console.log('===========================');

    const medicineMap = new Map();

    // Process opening stock
    reportData.medicineWiseOpening?.forEach((medicine: any) => {
      const key = medicine.medicineId;
      if (!medicineMap.has(key)) {
        medicineMap.set(key, {
          medicineId: medicine.medicineId,
          medicineName: medicine.medicineName,
          strength: medicine.strength,
          form: medicine.form,
          openingStock: medicine.totalQuantity || 0,
          openingStockValue: medicine.totalValue || 0,
          transfersToSubPharmacies: [],
          patientTransfers: 0,
          closingStock: 0,
          closingStockValue: 0,
        });
      }
    });
    console.log('After opening stock:', medicineMap.size, 'medicines');

    // Process transfers out (to sub-pharmacies)
    // Note: Backend naming is from requester's perspective, not source
    // In detailedTransfersOut: fromPharmacy = requester, toPharmacy = source
    const allTransfers = [
      ...(reportData.detailedTransfersOut || []),
      ...(reportData.detailedTransfersIn || []),
    ];
    
    allTransfers.forEach((transfer: any) => {
      // Main Pharmacy is the source if it's in toPharmacyId (backward naming)
      // This means Main is sending to fromPharmacy (the requester)
      const isMainPharmacySource = transfer.toPharmacyId === reportData.pharmacy.id;
      
      if (isMainPharmacySource) {
        // Main Pharmacy is sending to fromPharmacy (the requester/destination)
        const destinationPharmacy = subPharmacies.find((sp) => sp.id === transfer.fromPharmacyId);
        
        if (destinationPharmacy) {
          console.log('Found transfer to sub-pharmacy:', destinationPharmacy.name);
          
          transfer.items?.forEach((item: any) => {
            const key = item.medicineId;
            if (!medicineMap.has(key)) {
              medicineMap.set(key, {
                medicineId: item.medicineId,
                medicineName: item.medicineName,
                strength: item.strength,
                form: item.form,
                openingStock: 0,
                openingStockValue: 0,
                transfersToSubPharmacies: [],
                patientTransfers: 0,
                closingStock: 0,
                closingStockValue: 0,
              });
            }

            const medicine = medicineMap.get(key);
            
            // Calculate total quantity transferred from batch mappings
            const totalQty = item.batchMappings?.reduce((sum: number, mapping: any) => {
              return sum + (mapping.qtyTransferred || 0);
            }, 0) || item.qtyApproved || item.qtyRequested || 0;

            console.log(`  ${item.medicineName}: ${totalQty} units to ${destinationPharmacy.name}`);

            const existingTransfer = medicine.transfersToSubPharmacies.find(
              (t: any) => t.subPharmacyId === destinationPharmacy.id
            );

            if (existingTransfer) {
              existingTransfer.quantity += totalQty;
            } else {
              medicine.transfersToSubPharmacies.push({
                subPharmacyId: destinationPharmacy.id,
                subPharmacyName: destinationPharmacy.name,
                quantity: totalQty,
              });
            }
          });
        } else {
          console.log('Transfer destination not a sub-pharmacy:', transfer.fromPharmacyName);
        }
      }
    });
    console.log('After transfers out:', medicineMap.size, 'medicines');

    // Process patient transfers (issues)
    reportData.detailedIssues?.forEach((issue: any) => {
      issue.items?.forEach((item: any) => {
        const key = item.medicineId;
        if (!medicineMap.has(key)) {
          medicineMap.set(key, {
            medicineId: item.medicineId,
            medicineName: item.medicineName,
            strength: item.strength,
            form: item.form,
            openingStock: 0,
            openingStockValue: 0,
            transfersToSubPharmacies: [],
            patientTransfers: 0,
            closingStock: 0,
            closingStockValue: 0,
          });
        }

        const medicine = medicineMap.get(key);
        medicine.patientTransfers += item.qtyIssued || 0;
      });
    });

    // Process closing stock
    reportData.medicineWiseClosing?.forEach((medicine: any) => {
      const key = medicine.medicineId;
      if (medicineMap.has(key)) {
        const med = medicineMap.get(key);
        med.closingStock = medicine.totalQuantity || 0;
        med.closingStockValue = medicine.totalValue || 0;
      } else {
        medicineMap.set(key, {
          medicineId: medicine.medicineId,
          medicineName: medicine.medicineName,
          strength: medicine.strength,
          form: medicine.form,
          openingStock: 0,
          openingStockValue: 0,
          transfersToSubPharmacies: [],
          patientTransfers: 0,
          closingStock: medicine.totalQuantity || 0,
          closingStockValue: medicine.totalValue || 0,
        });
      }
    });

    const result = Array.from(medicineMap.values());
    console.log('Final consolidated data:', result.length, 'medicines', result);
    return result;
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

          {/* Debug Info - Remove after testing */}
          {reportData && transformToConsolidatedData().length === 0 && (
            <Card className="border-yellow-500 bg-yellow-50">
              <CardHeader>
                <CardTitle className="text-yellow-800">Debug Information</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-yellow-900">
                <div className="space-y-2">
                  <p><strong>Opening Stock Items:</strong> {reportData.medicineWiseOpening?.length || 0}</p>
                  <p><strong>Closing Stock Items:</strong> {reportData.medicineWiseClosing?.length || 0}</p>
                  <p><strong>Transfers Out:</strong> {reportData.detailedTransfersOut?.length || 0}</p>
                  <p><strong>Issues:</strong> {reportData.detailedIssues?.length || 0}</p>
                  <p><strong>Sub Pharmacies:</strong> {subPharmacies.length}</p>
                  <p className="mt-4 text-xs">Check browser console (F12) for detailed data</p>
                </div>
              </CardContent>
            </Card>
          )}

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
