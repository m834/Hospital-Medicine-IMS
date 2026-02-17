'use client';

import React, { useState } from 'react';
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
import { ChevronDown, ChevronRight, ArrowRight, Package, Clock } from 'lucide-react';

interface TransferBatchDetail {
  sourceBatchId: string;
  sourceBatchNo: string;
  sourceExpiry: string;
  destinationBatchId: string | null;
  destinationBatchNo: string | null;
  destinationExpiry: string | null;
  quantity: number;
}

interface DetailedTransferItem {
  medicineId: string;
  medicineName: string;
  genericName: string | null;
  form: string;
  strength: string | null;
  totalQuantity: number;
  batchMappings: TransferBatchDetail[];
}

interface DetailedTransfer {
  transferId: string;
  requestedAt: string;
  approvedAt: string | null;
  dispatchedAt: string | null;
  receivedAt: string | null;
  status: string;
  fromPharmacy: string;
  toPharmacy: string;
  requester: string;
  approver: string | null;
  totalItems: number;
  items: DetailedTransferItem[];
}

interface DetailedTransferTableProps {
  data: DetailedTransfer[];
  direction: 'IN' | 'OUT';
}

export function DetailedTransferTable({ data, direction }: DetailedTransferTableProps) {
  const [expandedTransfers, setExpandedTransfers] = useState<Set<string>>(new Set());

  const toggleTransfer = (transferId: string) => {
    const newExpanded = new Set(expandedTransfers);
    if (newExpanded.has(transferId)) {
      newExpanded.delete(transferId);
    } else {
      newExpanded.add(transferId);
    }
    setExpandedTransfers(newExpanded);
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

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-blue-100 text-blue-800',
      DISPATCHED: 'bg-purple-100 text-purple-800',
      RECEIVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const totalTransfers = data.length;
  const totalItems = data.reduce((sum, transfer) => sum + (transfer.totalItems || 0), 0);
  const totalQuantity = data.reduce(
    (sum, transfer) => sum + (transfer.items?.reduce((itemSum, item) => itemSum + (item.totalQuantity || 0), 0) || 0),
    0
  );

  const title = direction === 'IN' ? 'Transfers Received (IN)' : 'Transfers Sent (OUT)';
  const bgColor = direction === 'IN' ? 'bg-green-50' : 'bg-purple-50';

  if (data.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center">
        <Package className="h-12 w-12 mx-auto text-gray-400 mb-3" />
        <h3 className="text-lg font-semibold text-gray-700 mb-1">{title}</h3>
        <p className="text-gray-500">No transfers recorded</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className={`p-4 ${bgColor}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-gray-600">Total Transfers:</span>
              <span className="ml-2 font-semibold">{totalTransfers}</span>
            </div>
            <div>
              <span className="text-gray-600">Total Items:</span>
              <span className="ml-2 font-semibold">{totalItems}</span>
            </div>
            <div>
              <span className="text-gray-600">Total Quantity:</span>
              <span className="ml-2 font-semibold">{totalQuantity.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>Transfer Route</TableHead>
            <TableHead>Timeline</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Requester</TableHead>
            <TableHead>Approver</TableHead>
            <TableHead className="text-right">Items</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((transfer) => (
            <React.Fragment key={transfer.transferId}>
              {/* Transfer Row */}
              <TableRow
                key={transfer.transferId}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => toggleTransfer(transfer.transferId)}
              >
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    {expandedTransfers.has(transfer.transferId) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{transfer.fromPharmacy}</span>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-sm">{transfer.toPharmacy}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-600">
                        Requested: {formatDate(transfer.requestedAt)} {formatTime(transfer.requestedAt)}
                      </p>
                      {transfer.receivedAt && (
                        <p className="text-xs text-gray-600">
                          Received: {formatDate(transfer.receivedAt)} {formatTime(transfer.receivedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={getStatusColor(transfer.status)}>
                    {transfer.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{transfer.requester}</TableCell>
                <TableCell className="text-sm">{transfer.approver || '-'}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary">{transfer.totalItems}</Badge>
                </TableCell>
              </TableRow>

              {/* Transfer Items (Expanded) */}
              {expandedTransfers.has(transfer.transferId) && (
                <TableRow>
                  <TableCell colSpan={7} className="bg-gray-50 p-0">
                    <div className="p-4">
                      {/* Timeline Progress */}
                      <div className="mb-4 p-3 bg-white rounded-lg border">
                        <h4 className="text-sm font-semibold mb-2 text-gray-700">Transfer Timeline</h4>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex flex-col items-center">
                            <div className="w-3 h-3 rounded-full bg-green-500 mb-1"></div>
                            <span className="text-gray-600">Requested</span>
                            <span className="font-medium">{formatDate(transfer.requestedAt)}</span>
                          </div>
                          <div className="flex-1 h-0.5 bg-gray-300 mx-2"></div>
                          <div className="flex flex-col items-center">
                            <div
                              className={`w-3 h-3 rounded-full mb-1 ${
                                transfer.approvedAt ? 'bg-green-500' : 'bg-gray-300'
                              }`}
                            ></div>
                            <span className="text-gray-600">Approved</span>
                            <span className="font-medium">
                              {transfer.approvedAt ? formatDate(transfer.approvedAt) : '-'}
                            </span>
                          </div>
                          <div className="flex-1 h-0.5 bg-gray-300 mx-2"></div>
                          <div className="flex flex-col items-center">
                            <div
                              className={`w-3 h-3 rounded-full mb-1 ${
                                transfer.dispatchedAt ? 'bg-green-500' : 'bg-gray-300'
                              }`}
                            ></div>
                            <span className="text-gray-600">Dispatched</span>
                            <span className="font-medium">
                              {transfer.dispatchedAt ? formatDate(transfer.dispatchedAt) : '-'}
                            </span>
                          </div>
                          <div className="flex-1 h-0.5 bg-gray-300 mx-2"></div>
                          <div className="flex flex-col items-center">
                            <div
                              className={`w-3 h-3 rounded-full mb-1 ${
                                transfer.receivedAt ? 'bg-green-500' : 'bg-gray-300'
                              }`}
                            ></div>
                            <span className="text-gray-600">Received</span>
                            <span className="font-medium">
                              {transfer.receivedAt ? formatDate(transfer.receivedAt) : '-'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Items List */}
                      <h4 className="text-sm font-semibold mb-3 text-gray-700">
                        Transferred Medicines ({transfer.totalItems} items)
                      </h4>
                      {transfer.items.map((item) => (
                        <div key={item.medicineId} className="mb-4 border rounded-lg overflow-hidden">
                          <div className="bg-gray-100 p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{item.medicineName}</p>
                                {item.genericName && (
                                  <p className="text-xs text-gray-500">{item.genericName}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <Badge variant="outline">{item.form}</Badge>
                                {item.strength && <span className="text-sm">{item.strength}</span>}
                                <div className="text-right">
                                  <p className="text-xs text-gray-600">Total Quantity</p>
                                  <p className="font-semibold">{item.totalQuantity.toLocaleString()}</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Batch Mappings */}
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Source Batch</TableHead>
                                <TableHead>Source Expiry</TableHead>
                                <TableHead className="text-center">
                                  <ArrowRight className="h-4 w-4 inline" />
                                </TableHead>
                                <TableHead>Destination Batch</TableHead>
                                <TableHead>Destination Expiry</TableHead>
                                <TableHead className="text-right">Quantity</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {item.batchMappings.map((mapping, index) => (
                                <TableRow key={`${mapping.sourceBatchId}-${index}`}>
                                  <TableCell className="font-mono text-sm">
                                    {mapping.sourceBatchNo}
                                  </TableCell>
                                  <TableCell>{formatDate(mapping.sourceExpiry)}</TableCell>
                                  <TableCell className="text-center">
                                    <ArrowRight className="h-4 w-4 text-gray-400 inline" />
                                  </TableCell>
                                  <TableCell className="font-mono text-sm">
                                    {mapping.destinationBatchNo || (
                                      <span className="text-gray-400 italic">Not created yet</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {mapping.destinationExpiry ? (
                                      formatDate(mapping.destinationExpiry)
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {mapping.quantity.toLocaleString()}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
