'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import { TransferFrequencyModal } from '@/components/reports/TransferFrequencyModal';

interface SubPharmacyTransfer {
  subPharmacyId: string;
  subPharmacyName: string;
  quantity: number;
}

interface MedicineStockData {
  medicineId: string;
  medicineName: string;
  strength?: string;
  form: string;
  openingStock: number;
  openingStockValue?: number;
  transfersToSubPharmacies: SubPharmacyTransfer[];
  patientTransfers: number;
  closingStock: number;
  closingStockValue?: number;
  batchDetails?: any[];
}

interface ConsolidatedMedicineStockTableProps {
  data: MedicineStockData[];
  subPharmacies: Array<{ id: string; name: string }>;
  title?: string;
  showValues?: boolean;
}

export function ConsolidatedMedicineStockTable({
  data,
  subPharmacies,
  title = 'Medicine-Wise Stock Report',
  showValues = true,
}: ConsolidatedMedicineStockTableProps) {
  const [selectedMedicine, setSelectedMedicine] = useState<MedicineStockData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleViewTransferFrequency = (medicine: MedicineStockData) => {
    setSelectedMedicine(medicine);
    setIsModalOpen(true);
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null) return 'Nu. 0.00';
    return `Nu. ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getTotalTransfers = (medicine: MedicineStockData) => {
    return medicine.transfersToSubPharmacies.reduce((sum, t) => sum + t.quantity, 0);
  };

  const getTransferQuantityForSubPharmacy = (medicine: MedicineStockData, subPharmacyId: string) => {
    const transfer = medicine.transfersToSubPharmacies.find(t => t.subPharmacyId === subPharmacyId);
    return transfer ? transfer.quantity : 0;
  };

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-500 py-8">No stock data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[250px]">Medicine Name</TableHead>
                  <TableHead className="text-right">Opening Stock</TableHead>
                  {showValues && (
                    <TableHead className="text-right">Opening Value</TableHead>
                  )}
                  {subPharmacies.map((subPharmacy) => (
                    <TableHead key={subPharmacy.id} className="text-right">
                      Transfer to {subPharmacy.name}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Total Transfers</TableHead>
                  <TableHead className="text-right">Patient Transfers</TableHead>
                  <TableHead className="text-right">Closing Stock</TableHead>
                  {showValues && (
                    <TableHead className="text-right">Closing Value</TableHead>
                  )}
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((medicine, index) => {
                  const totalTransfers = getTotalTransfers(medicine);
                  
                  return (
                    <TableRow key={`${medicine.medicineId}-${index}`}>
                      <TableCell className="font-medium">
                        <div>
                          <p className="font-semibold">{medicine.medicineName}</p>
                          {medicine.strength && (
                            <p className="text-sm text-gray-600">
                              {medicine.strength} - {medicine.form}
                            </p>
                          )}
                          {!medicine.strength && (
                            <p className="text-sm text-gray-600">{medicine.form}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {medicine.openingStock.toLocaleString()}
                      </TableCell>
                      {showValues && (
                        <TableCell className="text-right">
                          {formatCurrency(medicine.openingStockValue)}
                        </TableCell>
                      )}
                      {subPharmacies.map((subPharmacy) => {
                        const qty = getTransferQuantityForSubPharmacy(medicine, subPharmacy.id);
                        return (
                          <TableCell key={subPharmacy.id} className="text-right">
                            {qty > 0 ? (
                              <span className="text-blue-600 font-medium">{qty.toLocaleString()}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right font-semibold">
                        {totalTransfers > 0 ? (
                          <span className="text-purple-600">{totalTransfers.toLocaleString()}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {medicine.patientTransfers > 0 ? (
                          <span className="text-orange-600 font-medium">
                            {medicine.patientTransfers.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {medicine.closingStock.toLocaleString()}
                      </TableCell>
                      {showValues && (
                        <TableCell className="text-right">
                          {formatCurrency(medicine.closingStockValue)}
                        </TableCell>
                      )}
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewTransferFrequency(medicine)}
                          disabled={totalTransfers === 0 && medicine.patientTransfers === 0}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {/* Summary Row */}
                <TableRow className="bg-gray-50 font-bold border-t-2">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">
                    {data.reduce((sum, m) => sum + m.openingStock, 0).toLocaleString()}
                  </TableCell>
                  {showValues && (
                    <TableCell className="text-right">
                      {formatCurrency(data.reduce((sum, m) => sum + (m.openingStockValue || 0), 0))}
                    </TableCell>
                  )}
                  {subPharmacies.map((subPharmacy) => (
                    <TableCell key={`total-${subPharmacy.id}`} className="text-right">
                      {data
                        .reduce((sum, m) => sum + getTransferQuantityForSubPharmacy(m, subPharmacy.id), 0)
                        .toLocaleString()}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    {data.reduce((sum, m) => sum + getTotalTransfers(m), 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {data.reduce((sum, m) => sum + m.patientTransfers, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {data.reduce((sum, m) => sum + m.closingStock, 0).toLocaleString()}
                  </TableCell>
                  {showValues && (
                    <TableCell className="text-right">
                      {formatCurrency(data.reduce((sum, m) => sum + (m.closingStockValue || 0), 0))}
                    </TableCell>
                  )}
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedMedicine && (
        <TransferFrequencyModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedMedicine(null);
          }}
          medicine={selectedMedicine}
          subPharmacies={subPharmacies}
        />
      )}
    </>
  );
}
