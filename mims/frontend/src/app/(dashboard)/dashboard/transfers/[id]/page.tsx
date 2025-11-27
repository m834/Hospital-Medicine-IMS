'use client';

import { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  ArrowLeft,
  Package,
  Building2,
  User,
  Calendar,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  Truck,
  Wrench,
} from 'lucide-react';
import api from '@/lib/api';
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/auth.store';

interface TransferItem {
  id: string;
  medicine: {
    id: string;
    name: string;
    form: string;
    strength?: string;
  };
  qtyRequested: number;
  qtyApproved?: number;
  qtyDispatched?: number;
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
  dispatcher?: {
    fullName: string;
  };
  items: TransferItem[];
  notes?: string;
  rejectionReason?: string;
  createdAt: string;
  approvedAt?: string;
  dispatchedAt?: string;
  receivedAt?: string;
}

export default function TransferDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const transferId = params?.id as string;
  const { user } = useAuthStore();

  const [transfer, setTransfer] = useState<TransferRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState(false);

  useEffect(() => {
    if (transferId) {
      fetchTransferDetails();
    }
  }, [transferId]);

  const fetchTransferDetails = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/transfers/${transferId}`);
      setTransfer(response.data);
    } catch (error) {
      console.error('Error fetching transfer details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFixReceivedStock = async () => {
    if (!confirm('This will create stock batches in the destination pharmacy for this transfer. Continue?')) {
      return;
    }

    setFixing(true);
    try {
      const response = await api.post(`/transfers/${transferId}/fix-received`);
      alert(response.data.message || 'Stock batches created successfully!');
      await fetchTransferDetails(); // Refresh the transfer details
    } catch (error: any) {
      console.error('Error fixing transfer:', error);
      alert(error.response?.data?.message || 'Failed to fix transfer');
    } finally {
      setFixing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      PENDING: { variant: 'secondary' as const, icon: Clock, label: 'Pending Approval' },
      APPROVED: { variant: 'default' as const, icon: CheckCircle, label: 'Approved' },
      REJECTED: { variant: 'destructive' as const, icon: XCircle, label: 'Rejected' },
      DISPATCHED: { variant: 'default' as const, icon: Truck, label: 'Dispatched' },
      RECEIVED: { variant: 'default' as const, icon: CheckCircle, label: 'Received' },
      CANCELLED: { variant: 'outline' as const, icon: XCircle, label: 'Cancelled' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="text-lg px-4 py-2">
        <Icon className="h-4 w-4 mr-2" />
        {config.label}
      </Badge>
    );
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
          <Button onClick={() => router.back()} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
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
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Transfer Request Details</h1>
            <p className="text-muted-foreground mt-1">
              Request #{transfer.requestNumber}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {transfer.status === 'DISPATCHED' && (
              <Button
                onClick={() => router.push(`/dashboard/transfers/receive/${transfer.id}`)}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Receive Transfer
              </Button>
            )}
            {transfer.status === 'RECEIVED' && user?.role === 'SUPER_ADMIN' && (
              <Button
                variant="outline"
                onClick={handleFixReceivedStock}
                disabled={fixing}
              >
                {fixing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Fixing...
                  </>
                ) : (
                  <>
                    <Wrench className="h-4 w-4 mr-2" />
                    Fix Stock (Admin)
                  </>
                )}
              </Button>
            )}
            {getStatusBadge(transfer.status)}
          </div>
        </div>
      </div>

      {/* Request Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              From Pharmacy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{transfer.fromPharmacy.name}</p>
            <p className="text-sm text-muted-foreground">Code: {transfer.fromPharmacy.code}</p>
            <Badge variant="outline" className="mt-2">{transfer.fromPharmacy.type}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              To Pharmacy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{transfer.toPharmacy.name}</p>
            <p className="text-sm text-muted-foreground">Code: {transfer.toPharmacy.code}</p>
            <Badge variant="outline" className="mt-2">{transfer.toPharmacy.type}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Requested By
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{transfer.requester.fullName}</p>
            <p className="text-sm text-muted-foreground">{transfer.requester.email}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Request Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">
              {format(new Date(transfer.createdAt), 'PPP')}
            </p>
            <p className="text-sm text-muted-foreground">
              {format(new Date(transfer.createdAt), 'p')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      {(transfer.approver || transfer.dispatcher) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {transfer.approver && transfer.approvedAt && (
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold">Approved by {transfer.approver.fullName}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(transfer.approvedAt), 'PPP p')}
                    </p>
                  </div>
                </div>
              )}

              {transfer.dispatcher && transfer.dispatchedAt && (
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                    <Truck className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold">Dispatched by {transfer.dispatcher.fullName}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(transfer.dispatchedAt), 'PPP p')}
                    </p>
                  </div>
                </div>
              )}

              {transfer.receivedAt && (
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                    <Package className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold">Received</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(transfer.receivedAt), 'PPP p')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {transfer.notes && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Request Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{transfer.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Rejection Reason */}
      {transfer.rejectionReason && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-red-700">
              <XCircle className="h-5 w-5" />
              Rejection Reason
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700">{transfer.rejectionReason}</p>
          </CardContent>
        </Card>
      )}

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transfer Items</CardTitle>
          <CardDescription>
            {transfer.items.length} item(s) in this transfer request
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medicine</TableHead>
                <TableHead>Form & Strength</TableHead>
                <TableHead className="text-right">Requested</TableHead>
                {transfer.status !== 'PENDING' && transfer.status !== 'REJECTED' && (
                  <TableHead className="text-right">Approved</TableHead>
                )}
                {(transfer.status === 'DISPATCHED' || transfer.status === 'RECEIVED') && (
                  <TableHead className="text-right">Dispatched</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfer.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.medicine.name}</TableCell>
                  <TableCell>
                    {item.medicine.form}
                    {item.medicine.strength && ` - ${item.medicine.strength}`}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {item.qtyRequested}
                  </TableCell>
                  {transfer.status !== 'PENDING' && transfer.status !== 'REJECTED' && (
                    <TableCell className="text-right font-semibold text-green-600">
                      {item.qtyApproved || 0}
                    </TableCell>
                  )}
                  {(transfer.status === 'DISPATCHED' || transfer.status === 'RECEIVED') && (
                    <TableCell className="text-right font-semibold text-blue-600">
                      {item.qtyDispatched || 0}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
