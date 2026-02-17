'use client';

import { useState, useEffect } from 'react';
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
  PackagePlus,
  Loader2,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  Package,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import api from '@/lib/api';
import { format } from 'date-fns';

interface TransferRequest {
  id: string;
  requestNumber: string;
  fromPharmacy: {
    id: string;
    name: string;
    code: string;
  };
  toPharmacy: {
    id: string;
    name: string;
    code: string;
  };
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISPATCHED' | 'RECEIVED' | 'CANCELLED';
  items: Array<{
    medicine: {
      name: string;
      form: string;
    };
    qtyRequested: number;
    qtyApproved?: number;
    qtyDispatched?: number;
    qtyReceived?: number;
  }>;
  notes?: string;
  createdAt: string;
  approvedAt?: string;
  dispatchedAt?: string;
  receivedAt?: string;
}

export default function TransfersPage() {
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all');

  const router = useRouter();
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();

  // Master Admin & Super Admin must select hospital, others use their hospitalId
  const currentHospitalId = selectedHospital?.id || user?.hospitalId;
  const userPharmacyId = user?.pharmacyId;

  useEffect(() => {
    if (currentHospitalId) {
      fetchTransfers();
    }
  }, [currentHospitalId, filter]);

  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 100 };
      
      // Add hospitalId if available
      if (currentHospitalId) {
        params.hospitalId = currentHospitalId;
      }
      
      if (!params.hospitalId) {
        console.warn('No hospital selected');
        setLoading(false);
        return;
      }
      
      const response = await api.get('/transfers', { params });
      const transferList = response.data?.data || response.data || [];
      
      // Filter based on user's pharmacy
      let filteredTransfers = transferList;
      if (filter === 'sent') {
        filteredTransfers = transferList.filter(
          (t: TransferRequest) => t.fromPharmacy.id === userPharmacyId
        );
      } else if (filter === 'received') {
        filteredTransfers = transferList.filter(
          (t: TransferRequest) => t.toPharmacy.id === userPharmacyId
        );
      }
      
      setTransfers(filteredTransfers);
    } catch (error) {
      console.error('Error fetching transfers:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      PENDING: { variant: 'secondary' as const, icon: Clock },
      APPROVED: { variant: 'default' as const, icon: CheckCircle },
      REJECTED: { variant: 'destructive' as const, icon: XCircle },
      DISPATCHED: { variant: 'default' as const, icon: Truck },
      RECEIVED: { variant: 'default' as const, icon: Package },
      CANCELLED: { variant: 'outline' as const, icon: XCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant}>
        <Icon className="h-3 w-3 mr-1" />
        {status}
      </Badge>
    );
  };

  const getTotalItems = (transfer: TransferRequest) => {
    return transfer.items.reduce((sum, item) => sum + item.qtyRequested, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Stock Transfers</h1>
          <p className="text-muted-foreground">
            Manage inter-pharmacy medicine transfers
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/transfers/request')}>
          <PackagePlus className="h-4 w-4 mr-2" />
          Request Transfer
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
        >
          All Transfers
        </Button>
        <Button
          variant={filter === 'received' ? 'default' : 'outline'}
          onClick={() => setFilter('received')}
        >
          <ArrowDownLeft className="h-4 w-4 mr-2" />
          Incoming
        </Button>
        <Button
          variant={filter === 'sent' ? 'default' : 'outline'}
          onClick={() => setFilter('sent')}
        >
          <ArrowUpRight className="h-4 w-4 mr-2" />
          Outgoing
        </Button>
      </div>

      {/* Transfers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transfer Requests</CardTitle>
          <CardDescription>
            {filter === 'all' && 'All transfer requests'}
            {filter === 'received' && 'Transfers to your pharmacy'}
            {filter === 'sent' && 'Transfers from your pharmacy'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transfers.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No transfer requests found</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => router.push('/dashboard/transfers/request')}
              >
                <PackagePlus className="h-4 w-4 mr-2" />
                Create First Transfer Request
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request #</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((transfer) => (
                  <TableRow key={transfer.id}>
                    <TableCell className="font-mono">{transfer.requestNumber}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{transfer.fromPharmacy.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {transfer.fromPharmacy.code}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{transfer.toPharmacy.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {transfer.toPharmacy.code}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold">{transfer.items.length} medicines</span>
                        <span className="text-xs text-muted-foreground">
                          Total: {getTotalItems(transfer)} units
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">
                          {format(new Date(transfer.createdAt), 'MMM dd, yyyy')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(transfer.createdAt), 'HH:mm')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {transfer.status === 'DISPATCHED' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => router.push(`/dashboard/transfers/receive/${transfer.id}`)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Receive
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/dashboard/transfers/${transfer.id}`)}
                        >
                          View Details
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
