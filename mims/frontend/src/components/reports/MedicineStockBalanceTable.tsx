'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MedicineBatchDetail {
  batchId: string;
  batchNo: string;
  expiryDate: string;
  qtyAvailable: number;
  purchasePrice: number;
  governmentPrice: number;
  retailPrice: number;
  storageType: string;
}

interface MedicineStockBalance {
  medicineId: string;
  medicineName: string;
  genericName: string | null;
  form: string;
  strength: string | null;
  totalQuantity: number;
  totalValue: number;
  batchCount: number;
  batches: MedicineBatchDetail[];
}

interface MedicineStockBalanceTableProps {
  data: MedicineStockBalance[];
  title: string;
  type: 'opening' | 'closing';
}

export function MedicineStockBalanceTable({ data, title, type }: MedicineStockBalanceTableProps) {
  const [expandedMedicines, setExpandedMedicines] = useState<Set<string>>(new Set());

  const toggleMedicine = (medicineId: string) => {
    const newExpanded = new Set(expandedMedicines);
    if (newExpanded.has(medicineId)) {
      newExpanded.delete(medicineId);
    } else {
      newExpanded.add(medicineId);
    }
    setExpandedMedicines(newExpanded);
  };

  const formatCurrency = (value: number) => {
    return `Nu. ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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
    return daysUntilExpiry <= 90 && daysUntilExpiry > 0;
  };

  const isExpired = (expiryDate: string) => {
    return new Date(expiryDate) < new Date();
  };

  const totalQuantity = data.reduce((sum, med) => sum + med.totalQuantity, 0);
  const totalValue = data.reduce((sum, med) => sum + med.totalValue, 0);

  if (data.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center">
        <Package className="h-12 w-12 mx-auto text-gray-400 mb-3" />
        <h3 className="text-lg font-semibold text-gray-700 mb-1">{title}</h3>
        <p className="text-gray-500">No stock available</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className={`p-4 ${type === 'opening' ? 'bg-blue-50' : 'bg-green-50'}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-gray-600">Total Medicines:</span>
              <span className="ml-2 font-semibold">{data.length}</span>
            </div>
            <div>
              <span className="text-gray-600">Total Quantity:</span>
              <span className="ml-2 font-semibold">{totalQuantity.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-gray-600">Total Value:</span>
              <span className="ml-2 font-semibold">{formatCurrency(totalValue)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>Medicine</TableHead>
            <TableHead>Form</TableHead>
            <TableHead>Strength</TableHead>
            <TableHead className="text-right">Total Qty</TableHead>
            <TableHead className="text-right">Batches</TableHead>
            <TableHead className="text-right">Total Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((medicine) => (
            <>
              {/* Medicine Row */}
              <TableRow
                key={medicine.medicineId}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => toggleMedicine(medicine.medicineId)}
              >
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    {expandedMedicines.has(medicine.medicineId) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{medicine.medicineName}</p>
                    {medicine.genericName && (
                      <p className="text-xs text-gray-500">{medicine.genericName}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{medicine.form}</Badge>
                </TableCell>
                <TableCell>{medicine.strength || '-'}</TableCell>
                <TableCell className="text-right font-medium">
                  {medicine.totalQuantity.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary">{medicine.batchCount}</Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(medicine.totalValue)}
                </TableCell>
              </TableRow>

              {/* Batch Details (Expanded) */}
              {expandedMedicines.has(medicine.medicineId) && (
                <TableRow>
                  <TableCell colSpan={7} className="bg-gray-50 p-0">
                    <div className="p-4">
                      <h4 className="text-sm font-semibold mb-3 text-gray-700">
                        Batch Details ({medicine.batchCount} batches)
                      </h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Batch No</TableHead>
                            <TableHead>Expiry Date</TableHead>
                            <TableHead>Storage</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead className="text-right">Purchase Price</TableHead>
                            <TableHead className="text-right">Govt Price</TableHead>
                            <TableHead className="text-right">Retail Price</TableHead>
                            <TableHead className="text-right">Batch Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {medicine.batches.map((batch) => (
                            <TableRow
                              key={batch.batchId}
                              className={
                                isExpired(batch.expiryDate)
                                  ? 'bg-red-50'
                                  : isExpiringSoon(batch.expiryDate)
                                  ? 'bg-yellow-50'
                                  : ''
                              }
                            >
                              <TableCell className="font-mono text-sm">
                                {batch.batchNo}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  {formatDate(batch.expiryDate)}
                                  {isExpired(batch.expiryDate) && (
                                    <Badge variant="destructive" className="text-xs">
                                      Expired
                                    </Badge>
                                  )}
                                  {isExpiringSoon(batch.expiryDate) &&
                                    !isExpired(batch.expiryDate) && (
                                      <Badge variant="outline" className="text-xs bg-yellow-100">
                                        Expiring Soon
                                      </Badge>
                                    )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={getStorageColor(batch.storageType)}>
                                  {batch.storageType.replace('_', ' ')}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {batch.qtyAvailable.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(batch.purchasePrice)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(batch.governmentPrice)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(batch.retailPrice)}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(batch.qtyAvailable * batch.purchasePrice)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
