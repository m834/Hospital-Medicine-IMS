'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calendar, Package, ArrowRight, User } from 'lucide-react';

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
  transfersToSubPharmacies: SubPharmacyTransfer[];
  patientTransfers: number;
  closingStock: number;
  batchDetails?: any[];
}

interface TransferFrequencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  medicine: MedicineStockData;
  subPharmacies: Array<{ id: string; name: string }>;
}

export function TransferFrequencyModal({
  isOpen,
  onClose,
  medicine,
  subPharmacies,
}: TransferFrequencyModalProps) {
  const totalSubPharmacyTransfers = medicine.transfersToSubPharmacies.reduce(
    (sum, t) => sum + t.quantity,
    0
  );

  const getTotalTransfers = () => {
    return totalSubPharmacyTransfers + medicine.patientTransfers;
  };

  const getPercentage = (quantity: number) => {
    const total = getTotalTransfers();
    if (total === 0) return '0%';
    return `${((quantity / total) * 100).toFixed(1)}%`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            Transfer Frequency Details
          </DialogTitle>
          <DialogDescription>
            Detailed breakdown of transfers for{' '}
            <span className="font-semibold text-gray-900">
              {medicine.medicineName}
              {medicine.strength && ` ${medicine.strength}`} ({medicine.form})
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-4 w-4 text-blue-600" />
                <p className="text-sm text-blue-700 font-medium">Opening Stock</p>
              </div>
              <p className="text-2xl font-bold text-blue-900">
                {medicine.openingStock.toLocaleString()}
              </p>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowRight className="h-4 w-4 text-purple-600" />
                <p className="text-sm text-purple-700 font-medium">Total Transfers</p>
              </div>
              <p className="text-2xl font-bold text-purple-900">
                {getTotalTransfers().toLocaleString()}
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-4 w-4 text-green-600" />
                <p className="text-sm text-green-700 font-medium">Closing Stock</p>
              </div>
              <p className="text-2xl font-bold text-green-900">
                {medicine.closingStock.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Transfer Breakdown */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-600" />
              Transfer Breakdown
            </h3>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Destination</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Percentage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Sub-Pharmacy Transfers */}
                {medicine.transfersToSubPharmacies.map((transfer) => (
                  <TableRow key={transfer.subPharmacyId}>
                    <TableCell className="font-medium">{transfer.subPharmacyName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                        <ArrowRight className="h-3 w-3 mr-1" />
                        Sub-Pharmacy Transfer
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-blue-600">
                      {transfer.quantity.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{getPercentage(transfer.quantity)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}

                {/* Patient Transfers */}
                {medicine.patientTransfers > 0 && (
                  <TableRow>
                    <TableCell className="font-medium">Direct Patient Issuance</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                        <User className="h-3 w-3 mr-1" />
                        Patient Transfer
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-orange-600">
                      {medicine.patientTransfers.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{getPercentage(medicine.patientTransfers)}</Badge>
                    </TableCell>
                  </TableRow>
                )}

                {/* No Transfers */}
                {getTotalTransfers() === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                      No transfers recorded for this medicine
                    </TableCell>
                  </TableRow>
                )}

                {/* Total Row */}
                {getTotalTransfers() > 0 && (
                  <TableRow className="bg-gray-50 font-bold border-t-2">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className="text-right">{getTotalTransfers().toLocaleString()}</TableCell>
                    <TableCell className="text-right">100%</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Visual Frequency Bar */}
          {getTotalTransfers() > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 text-gray-700">Visual Distribution</h3>
              <div className="flex h-8 rounded-lg overflow-hidden border border-gray-300">
                {medicine.transfersToSubPharmacies.map((transfer, index) => {
                  const percentage = (transfer.quantity / getTotalTransfers()) * 100;
                  if (percentage === 0) return null;
                  
                  return (
                    <div
                      key={transfer.subPharmacyId}
                      className="bg-blue-500 flex items-center justify-center text-white text-xs font-medium"
                      style={{ width: `${percentage}%` }}
                      title={`${transfer.subPharmacyName}: ${transfer.quantity} (${percentage.toFixed(1)}%)`}
                    >
                      {percentage > 8 && `${percentage.toFixed(0)}%`}
                    </div>
                  );
                })}
                {medicine.patientTransfers > 0 && (() => {
                  const percentage = (medicine.patientTransfers / getTotalTransfers()) * 100;
                  return (
                    <div
                      className="bg-orange-500 flex items-center justify-center text-white text-xs font-medium"
                      style={{ width: `${percentage}%` }}
                      title={`Patient Transfers: ${medicine.patientTransfers} (${percentage.toFixed(1)}%)`}
                    >
                      {percentage > 8 && `${percentage.toFixed(0)}%`}
                    </div>
                  );
                })()}
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-600">
                <span>Distribution of total {getTotalTransfers()} units transferred</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
