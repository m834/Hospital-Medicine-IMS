'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Loader2,
  ArrowLeft,
  Package,
  Building2,
  Calendar,
  Truck,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import { format } from 'date-fns';

interface StockBatch {
  id: string;
  batchNumber: string;
  qtyAvailable: number;
  expiryDate: string;
  receivedDate: string;
  purchasePrice: number;
  category?: 'NORMAL' | 'LP';
}

interface TransferItem {
  id: string;
  medicine: {
    id: string;
    name: string;
    form: string;
    strength?: string;
  };
  qtyRequested: number;
  qtyApproved: number;
  transferCategory?: 'NORMAL' | 'LP';
  selectedBatches?: Array<{
    batchId: string;
    quantity: number;
  }>;
}

interface TransferRequest {
  id: string;
  requestNumber: string;
  fromPharmacy: {
    id: string;
    name: string;
    code: string;
    type: string;
  };
  toPharmacy: {
    id: string;
    name: string;
    code: string;
    type: string;
  };
  status: string;
  requester: {
    fullName: string;
    email: string;
  };
  approver?: {
    fullName: string;
  };
  items: TransferItem[];
  createdAt: string;
  approvedAt?: string;
}

export default function DispatchTransferPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuthStore();
  const transferId = params?.id as string;

  const [transfer, setTransfer] = useState<TransferRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [availableBatches, setAvailableBatches] = useState<Record<string, StockBatch[]>>({});
  const [selectedBatches, setSelectedBatches] = useState<
    Record<string, Array<{ batchId: string; quantity: number }>>
  >({});
  // Per-item LP toggles (keyed by item id)
  const [itemLPToggle, setItemLPToggle] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (transferId) {
      fetchTransferDetails();
    }
  }, [transferId]);

  const fetchTransferDetails = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/transfers/${transferId}`);
      const data = response.data;

      if (data.status !== 'APPROVED') {
        alert('This transfer request has not been approved yet');
        router.push('/dashboard/issuance');
        return;
      }

      setTransfer(data);

      // Initialize LP toggles based on stored transferCategory
      const initialToggles: Record<string, boolean> = {};
      data.items.forEach((item: TransferItem) => {
        initialToggles[item.id] = item.transferCategory === 'LP';
      });
      setItemLPToggle(initialToggles);

      await fetchAvailableBatches(data.items, data.toPharmacy.id, initialToggles);
    } catch (error) {
      console.error('Error fetching transfer details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableBatches = async (
    items: TransferItem[],
    pharmacyId: string,
    lpToggles: Record<string, boolean>
  ) => {
    try {
      const batches: Record<string, StockBatch[]> = {};

      await Promise.all(
        items.map(async (item) => {
          try {
            const category = lpToggles[item.id] ? 'LP' : 'NORMAL';
            const response = await api.get(
              `/inventory/batches/available/${item.medicine.id}/${pharmacyId}`,
              { params: { category } }
            );
            batches[item.id] = response.data || [];
          } catch (error) {
            console.error(`Error fetching batches for ${item.medicine.name}:`, error);
            batches[item.id] = [];
          }
        })
      );

      setAvailableBatches(batches);
      autoSelectBatches(items, batches);
    } catch (error) {
      console.error('Error fetching available batches:', error);
    }
  };

  const refetchBatchesForItem = async (item: TransferItem, isLP: boolean) => {
    if (!transfer) return;
    const category = isLP ? 'LP' : 'NORMAL';
    try {
      const response = await api.get(
        `/inventory/batches/available/${item.medicine.id}/${transfer.toPharmacy.id}`,
        { params: { category } }
      );
      const batches = response.data || [];
      setAvailableBatches((prev) => ({ ...prev, [item.id]: batches }));

      // Auto-select from new batches for this item
      let remaining = item.qtyApproved;
      const itemSelected: Array<{ batchId: string; quantity: number }> = [];
      for (const batch of batches) {
        if (remaining <= 0) break;
        const qtyToTake = Math.min(batch.qtyAvailable, remaining);
        itemSelected.push({ batchId: batch.id, quantity: qtyToTake });
        remaining -= qtyToTake;
      }
      setSelectedBatches((prev) => ({ ...prev, [item.id]: itemSelected }));
    } catch (error) {
      console.error(`Error refetching batches for ${item.medicine.name}:`, error);
    }
  };

  const handleLPToggle = (item: TransferItem, value: boolean) => {
    setItemLPToggle((prev) => ({ ...prev, [item.id]: value }));
    refetchBatchesForItem(item, value);
  };

  const autoSelectBatches = (
    items: TransferItem[],
    batches: Record<string, StockBatch[]>
  ) => {
    const selected: Record<string, Array<{ batchId: string; quantity: number }>> = {};

    items.forEach((item) => {
      const itemBatches = batches[item.id] || [];
      let remaining = item.qtyApproved;
      const itemSelected: Array<{ batchId: string; quantity: number }> = [];

      for (const batch of itemBatches) {
        if (remaining <= 0) break;
        const qtyToTake = Math.min(batch.qtyAvailable, remaining);
        itemSelected.push({ batchId: batch.id, quantity: qtyToTake });
        remaining -= qtyToTake;
      }

      selected[item.id] = itemSelected;
    });

    setSelectedBatches(selected);
  };

  const handleBatchQuantityChange = (itemId: string, batchId: string, value: string) => {
    const numValue = parseInt(value) || 0;

    setSelectedBatches((prev) => {
      const itemBatches = prev[itemId] || [];
      const existingBatchIndex = itemBatches.findIndex((b) => b.batchId === batchId);

      if (existingBatchIndex >= 0) {
        const updated = [...itemBatches];
        if (numValue === 0) {
          updated.splice(existingBatchIndex, 1);
        } else {
          updated[existingBatchIndex] = { batchId, quantity: numValue };
        }
        return { ...prev, [itemId]: updated };
      } else if (numValue > 0) {
        return { ...prev, [itemId]: [...itemBatches, { batchId, quantity: numValue }] };
      }

      return prev;
    });
  };

  const getTotalSelectedQty = (itemId: string) => {
    const batches = selectedBatches[itemId] || [];
    return batches.reduce((sum, b) => sum + b.quantity, 0);
  };

  const handleDispatch = async () => {
    if (!transfer) return;

    const errors: string[] = [];

    transfer.items.forEach((item) => {
      const selectedQty = getTotalSelectedQty(item.id);
      if (selectedQty !== item.qtyApproved) {
        errors.push(
          `${item.medicine.name}: Selected ${selectedQty} but approved ${item.qtyApproved}`
        );
      }
    });

    if (errors.length > 0) {
      alert(
        'Please ensure selected quantities match approved quantities:\n\n' + errors.join('\n')
      );
      return;
    }

    if (!confirm('Dispatch this transfer? Stock will be deducted from batches.')) {
      return;
    }

    setSubmitting(true);
    try {
      const dispatchData = {
        items: transfer.items.map((item) => ({
          itemId: item.id,
          batches: selectedBatches[item.id] || [],
        })),
        dispatchedBy: user?.id,
      };

      await api.post(`/transfers/${transferId}/dispatch`, dispatchData);

      alert('Transfer dispatched successfully!');
      router.push('/dashboard/issuance');
    } catch (error: any) {
      console.error('Error dispatching transfer:', error);
      alert(error.response?.data?.message || 'Failed to dispatch transfer');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading transfer details...</p>
        </div>
      </div>
    );
  }

  if (!transfer) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Transfer request not found</p>
          <Button onClick={() => router.push('/dashboard/issuance')} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Issuance
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/dashboard/issuance')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Issuance
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dispatch Transfer</h1>
            <p className="text-muted-foreground mt-1">Request #{transfer.requestNumber}</p>
          </div>

          <Badge variant="default" className="text-lg px-4 py-2 bg-green-600">
            <CheckCircle className="h-4 w-4 mr-2" />
            APPROVED
          </Badge>
        </div>
      </div>

      {/* Transfer Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              From (Source)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{transfer.fromPharmacy.name}</p>
            <p className="text-sm text-muted-foreground">{transfer.fromPharmacy.code}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              To (Destination)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{transfer.toPharmacy.name}</p>
            <p className="text-sm text-muted-foreground">{transfer.toPharmacy.code}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Approved Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">
              {transfer.approvedAt ? format(new Date(transfer.approvedAt), 'PPP') : 'N/A'}
            </p>
            <p className="text-sm text-muted-foreground">
              {transfer.approver?.fullName || 'N/A'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Items to Dispatch */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Batches for Dispatch</CardTitle>
          <CardDescription>
            Toggle LP to switch between Normal and LP stock pools per medicine. Oldest batches are
            auto-selected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transfer.items.map((item) => {
            const itemBatches = availableBatches[item.id] || [];
            const totalSelected = getTotalSelectedQty(item.id);
            const isComplete = totalSelected === item.qtyApproved;
            const isLPItem = itemLPToggle[item.id] ?? false;

            return (
              <div key={item.id} className="mb-8 last:mb-0">
                <div className="flex items-start justify-between mb-4 gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{item.medicine.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {item.medicine.form}
                      {item.medicine.strength && ` - ${item.medicine.strength}`}
                    </p>
                  </div>

                  {/* LP toggle per item */}
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                      isLPItem
                        ? 'bg-orange-50 border-orange-300'
                        : 'bg-muted border-transparent'
                    }`}
                  >
                    <span className="text-xs text-muted-foreground">Normal</span>
                    <Switch
                      checked={isLPItem}
                      onCheckedChange={(val) => handleLPToggle(item, val)}
                    />
                    <span
                      className={`text-xs font-medium ${
                        isLPItem ? 'text-orange-600' : 'text-muted-foreground'
                      }`}
                    >
                      LP
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        isLPItem ? 'border-orange-400 text-orange-600' : ''
                      }
                    >
                      {isLPItem ? 'LP' : 'Normal'} Stock
                    </Badge>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Approved Quantity</p>
                    <p className="text-2xl font-bold">{item.qtyApproved}</p>
                    <div className="mt-1">
                      {isComplete ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Complete ({totalSelected})
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Selected: {totalSelected} / {item.qtyApproved}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {itemBatches.length === 0 ? (
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <p className="text-red-700 dark:text-red-300 text-sm">
                      No available {isLPItem ? 'LP' : 'Normal'} batches found for this medicine
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Batch Number</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Available</TableHead>
                        <TableHead className="text-right">Expiry Date</TableHead>
                        <TableHead className="text-right">Received Date</TableHead>
                        <TableHead className="text-right">Dispatch Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itemBatches.map((batch) => {
                        const selected = selectedBatches[item.id]?.find(
                          (b) => b.batchId === batch.id
                        );
                        const selectedQty = selected?.quantity || 0;

                        return (
                          <TableRow key={batch.id}>
                            <TableCell className="font-medium">
                              {batch.batchNumber || (batch as any).batchNo}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  batch.category === 'LP'
                                    ? 'border-orange-400 text-orange-600'
                                    : ''
                                }
                              >
                                {batch.category === 'LP' ? 'LP' : 'Normal'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{batch.qtyAvailable}</TableCell>
                            <TableCell className="text-right">
                              {format(new Date(batch.expiryDate), 'PP')}
                            </TableCell>
                            <TableCell className="text-right">
                              {format(new Date(batch.receivedDate), 'PP')}
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min="0"
                                max={batch.qtyAvailable}
                                value={selectedQty}
                                onChange={(e) =>
                                  handleBatchQuantityChange(item.id, batch.id, e.target.value)
                                }
                                className="w-24 ml-auto"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4 justify-end">
        <Button
          variant="outline"
          onClick={() => router.push('/dashboard/issuance')}
          disabled={submitting}
        >
          Cancel
        </Button>

        <Button
          onClick={handleDispatch}
          disabled={submitting}
          className="bg-green-600 hover:bg-green-700"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Dispatching...
            </>
          ) : (
            <>
              <Truck className="h-4 w-4 mr-2" />
              Dispatch Transfer
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
