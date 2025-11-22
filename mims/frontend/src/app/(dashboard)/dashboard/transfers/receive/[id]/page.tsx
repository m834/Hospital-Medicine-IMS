'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Package, 
  CheckCircle, 
  Loader2,
  AlertCircle,
  Calendar,
  MapPin,
  User,
  Truck
} from 'lucide-react';
import api from '@/lib/api';
import { format } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TransferItem {
  id: string;
  medicine: {
    id: string;
    genericName: string;
    brandName?: string;
    strength?: string;
    dosageForm?: string;
  };
  qtyRequested: number;
  qtyApproved: number;
  qtyDispatched: number;
  batchMappings: Array<{
    id: string;
    qty: number;
    sourceBatch: {
      batchNo: string;
      expiryDate: string;
      manufacturer?: string;
      qtyAvailable: number;
    };
  }>;
}

interface TransferRequest {
  id: string;
  requestNumber: string;
  status: string;
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
  requester: {
    id: string;
    fullName: string;
    email: string;
  };
  approver?: {
    id: string;
    fullName: string;
    email: string;
  };
  createdAt: string;
  approvedAt?: string;
  dispatchedAt?: string;
  notes?: string;
  items: TransferItem[];
}

export default function ReceiveTransferPage() {
  const params = useParams();
  const router = useRouter();
  const transferId = params?.id as string;

  const [transfer, setTransfer] = useState<TransferRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReceiving, setIsReceiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTransfer();
  }, [transferId]);

  const fetchTransfer = async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`/transfers/${transferId}`);
      setTransfer(response.data);
    } catch (error: any) {
      console.error('Error fetching transfer:', error);
      setError(error.response?.data?.message || 'Failed to load transfer request');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReceive = async () => {
    try {
      setIsReceiving(true);
      setError(null);

      await api.post(`/transfers/${transferId}/receive`);

      // Show success and redirect
      alert('Transfer received successfully! Stock has been added to your pharmacy.');
      router.push('/dashboard/transfers');
    } catch (error: any) {
      console.error('Error receiving transfer:', error);
      setError(error.response?.data?.message || 'Failed to receive transfer');
    } finally {
      setIsReceiving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!transfer) {
    return (
      <div className="container mx-auto py-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Transfer request not found or you don't have permission to view it.
          </AlertDescription>
        </Alert>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.back()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
      </div>
    );
  }

  const canReceive = transfer.status === 'DISPATCHED';

  return (
    <div className="container mx-auto py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Receive Transfer
              </h1>
              <p className="text-muted-foreground">
                Transfer Request #{transfer.requestNumber}
              </p>
            </div>
          </div>
        </div>

        <Badge
          variant={
            transfer.status === 'DISPATCHED'
              ? 'default'
              : transfer.status === 'RECEIVED'
              ? 'secondary'
              : 'outline'
          }
          className="text-sm px-3 py-1"
        >
          <Truck className="mr-1 h-3 w-3" />
          {transfer.status}
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Transfer Information */}
      <Card>
        <CardHeader>
          <CardTitle>Transfer Information</CardTitle>
          <CardDescription>
            Review the transfer details before receiving
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* From/To */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <MapPin className="h-4 w-4" />
                From Pharmacy
              </div>
              <div className="pl-6">
                <p className="font-medium">{transfer.fromPharmacy.name}</p>
                <p className="text-sm text-muted-foreground">
                  {transfer.fromPharmacy.code} • {transfer.fromPharmacy.type}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <MapPin className="h-4 w-4" />
                To Pharmacy (Receiving)
              </div>
              <div className="pl-6">
                <p className="font-medium">{transfer.toPharmacy.name}</p>
                <p className="text-sm text-muted-foreground">
                  {transfer.toPharmacy.code} • {transfer.toPharmacy.type}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t my-4" />

          {/* Timeline */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Requested by:</span>
              <span>{transfer.requester.fullName}</span>
              <span className="text-muted-foreground">
                on {format(new Date(transfer.createdAt), 'PPp')}
              </span>
            </div>

            {transfer.approver && transfer.approvedAt && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="font-medium">Approved by:</span>
                <span>{transfer.approver.fullName}</span>
                <span className="text-muted-foreground">
                  on {format(new Date(transfer.approvedAt), 'PPp')}
                </span>
              </div>
            )}

            {transfer.dispatchedAt && (
              <div className="flex items-center gap-2 text-sm">
                <Truck className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Dispatched:</span>
                <span className="text-muted-foreground">
                  {format(new Date(transfer.dispatchedAt), 'PPp')}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Items to Receive */}
      <Card>
        <CardHeader>
          <CardTitle>Items to Receive</CardTitle>
          <CardDescription>
            {transfer.items.length} medicine(s) being transferred
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medicine</TableHead>
                <TableHead className="text-center">Requested</TableHead>
                <TableHead className="text-center">Approved</TableHead>
                <TableHead className="text-center">Dispatched</TableHead>
                <TableHead>Batch Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfer.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.medicine.genericName}</p>
                      {item.medicine.brandName && (
                        <p className="text-sm text-muted-foreground">
                          {item.medicine.brandName}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {item.medicine.strength} {item.medicine.dosageForm}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {item.qtyRequested}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.qtyApproved}
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {item.qtyDispatched}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm">
                      {item.batchMappings.map((mapping) => (
                        <div
                          key={mapping.id}
                          className="flex items-center gap-2 text-xs"
                        >
                          <Package className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono">
                            {mapping.sourceBatch.batchNo}
                          </span>
                          <span>× {mapping.qty}</span>
                          <span className="text-muted-foreground">
                            Exp: {format(new Date(mapping.sourceBatch.expiryDate), 'MMM yyyy')}
                          </span>
                          {mapping.sourceBatch.manufacturer && (
                            <span className="text-muted-foreground">
                              ({mapping.sourceBatch.manufacturer})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Notes */}
      {transfer.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {transfer.notes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-6 border-t">
        <Button
          variant="outline"
          onClick={() => router.back()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {canReceive ? (
          <Button
            size="lg"
            onClick={handleReceive}
            disabled={isReceiving}
            className="gap-2"
          >
            {isReceiving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Receiving...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Confirm Receipt
              </>
            )}
          </Button>
        ) : (
          <Badge variant="secondary" className="text-sm px-4 py-2">
            {transfer.status === 'RECEIVED' 
              ? 'Already Received' 
              : `Cannot receive - Status: ${transfer.status}`}
          </Badge>
        )}
      </div>

      {canReceive && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            By confirming receipt, the dispatched stock will be added to your pharmacy inventory.
            The batches will maintain their expiry dates and other details from the source pharmacy.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
