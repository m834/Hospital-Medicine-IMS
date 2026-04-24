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
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Package, FileText, User } from 'lucide-react';

interface DetailedGRNItem {
  medicineId: string;
  medicineName: string;
  genericName: string | null;
  form: string;
  strength: string | null;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  purchasePrice: number;
  governmentPrice: number;
  retailPrice: number;
  storageType: string;
  totalValue: number;
}

interface DetailedGRN {
  grnId: string;
  grnNumber: string;
  receivedDate: string;
  receivedBy: string;
  invoiceNumber: string | null;
  supplierName: string | null;
  totalItems: number;
  totalValue: number;
  items: DetailedGRNItem[];
}

interface DetailedGRNTableProps {
  data: DetailedGRN[];
}

export function DetailedGRNTable({ data }: DetailedGRNTableProps) {
  const [expandedGRNs, setExpandedGRNs] = useState<Set<string>>(new Set());

  const toggleGRN = (grnId: string) => {
    const newExpanded = new Set(expandedGRNs);
    if (newExpanded.has(grnId)) {
      newExpanded.delete(grnId);
    } else {
      newExpanded.add(grnId);
    }
    setExpandedGRNs(newExpanded);
  };

  const formatCurrency = (value: number) => {
    return `PKR ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
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

  const totalGRNs = data.length;
  const totalItems = data.reduce((sum, grn) => sum + grn.totalItems, 0);
  const totalValue = data.reduce((sum, grn) => sum + grn.totalValue, 0);

  if (data.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center">
        <Package className="h-12 w-12 mx-auto text-gray-400 mb-3" />
        <h3 className="text-lg font-semibold text-gray-700 mb-1">Detailed GRNs</h3>
        <p className="text-gray-500">No goods receipts recorded</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-indigo-50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Detailed Goods Receipt Notes (GRNs)</h3>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-gray-600">Total GRNs:</span>
              <span className="ml-2 font-semibold">{totalGRNs}</span>
            </div>
            <div>
              <span className="text-gray-600">Total Items:</span>
              <span className="ml-2 font-semibold">{totalItems}</span>
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
            <TableHead>GRN Number</TableHead>
            <TableHead>Received Date/Time</TableHead>
            <TableHead>Invoice</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Received By</TableHead>
            <TableHead className="text-right">Items</TableHead>
            <TableHead className="text-right">Total Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((grn) => (
            <>
              {/* GRN Row */}
              <TableRow
                key={grn.grnId}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => toggleGRN(grn.grnId)}
              >
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    {expandedGRNs.has(grn.grnId) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <span className="font-mono font-medium">{grn.grnNumber}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{formatDate(grn.receivedDate)}</p>
                    <p className="text-xs text-gray-500">{formatTime(grn.receivedDate)}</p>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {grn.invoiceNumber || <span className="text-gray-400">-</span>}
                </TableCell>
                <TableCell>{grn.supplierName || <span className="text-gray-400">-</span>}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{grn.receivedBy}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary">{grn.totalItems}</Badge>
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(grn.totalValue)}
                </TableCell>
              </TableRow>

              {/* GRN Items (Expanded) */}
              {expandedGRNs.has(grn.grnId) && (
                <TableRow>
                  <TableCell colSpan={8} className="bg-gray-50 p-0">
                    <div className="p-4">
                      <h4 className="text-sm font-semibold mb-3 text-gray-700">
                        Received Medicines ({grn.totalItems} items)
                      </h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Medicine</TableHead>
                            <TableHead>Form</TableHead>
                            <TableHead>Strength</TableHead>
                            <TableHead>Batch No</TableHead>
                            <TableHead>Expiry Date</TableHead>
                            <TableHead>Storage</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead className="text-right">Purchase Price</TableHead>
                            <TableHead className="text-right">Govt Price</TableHead>
                            <TableHead className="text-right">Retail Price</TableHead>
                            <TableHead className="text-right">Total Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {grn.items.map((item, index) => (
                            <TableRow key={`${item.medicineId}-${index}`}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{item.medicineName}</p>
                                  {item.genericName && (
                                    <p className="text-xs text-gray-500">{item.genericName}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{item.form}</Badge>
                              </TableCell>
                              <TableCell>{item.strength || '-'}</TableCell>
                              <TableCell className="font-mono text-sm">{item.batchNo}</TableCell>
                              <TableCell>{formatDate(item.expiryDate)}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={getStorageColor(item.storageType)}>
                                  {item.storageType.replace('_', ' ')}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {item.quantity.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(item.purchasePrice)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(item.governmentPrice)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(item.retailPrice)}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(item.totalValue)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>

                      {/* Summary Card */}
                      <div className="mt-4 bg-white border rounded-lg p-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Total Items</p>
                            <p className="text-lg font-semibold">{grn.totalItems}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Total Quantity</p>
                            <p className="text-lg font-semibold">
                              {grn.items
                                .reduce((sum, item) => sum + item.quantity, 0)
                                .toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Total Value</p>
                            <p className="text-lg font-semibold">{formatCurrency(grn.totalValue)}</p>
                          </div>
                        </div>
                      </div>
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
