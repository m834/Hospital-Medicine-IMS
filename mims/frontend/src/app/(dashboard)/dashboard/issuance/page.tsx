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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Package,
  ArrowRight,
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
    type: string;
  };
  toPharmacy: {
    id: string;
    name: string;
    code: string;
    type: string;
  };
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISPATCHED' | 'RECEIVED' | 'CANCELLED';
  requester: {
    fullName: string;
  };
  items: Array<{
    id: string;
    medicine: {
      name: string;
      form: string;
      strength?: string;
    };
    qtyRequested: number;
    qtyApproved?: number;
  }>;
  notes?: string;
  createdAt: string;
}

export default function IssuancePage() {
  const [pendingRequests, setPendingRequests] = useState<TransferRequest[]>([]);
  const [approvedRequests, setApprovedRequests] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
  const [mainPharmacyId, setMainPharmacyId] = useState<string | null>(null);

  const router = useRouter();
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();

  const currentHospitalId = user?.hospitalId || selectedHospital?.id;
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // Fetch Main Pharmacy ID when hospital is selected (for Super Admin)
  useEffect(() => {
    async function fetchMainPharmacy() {
      if (!currentHospitalId) {
        setMainPharmacyId(null);
        return;
      }

      try {
        // Fetch pharmacies for the selected hospital
        const response = await api.get('/pharmacies', {
          params: { hospitalId: currentHospitalId },
        });

        const pharmacies = response.data || [];
        
        // Find the MAIN pharmacy
        const mainPharmacy = pharmacies.find((p: any) => p.type === 'MAIN');
        
        if (mainPharmacy) {
          setMainPharmacyId(mainPharmacy.id);
        } else {
          setMainPharmacyId(null);
        }
      } catch (error) {
        console.error('Error fetching main pharmacy:', error);
        setMainPharmacyId(null);
      }
    }

    if (isSuperAdmin && currentHospitalId) {
      fetchMainPharmacy();
    } else {
      // For regular users, use their pharmacy ID
      setMainPharmacyId(user?.pharmacyId || null);
    }
  }, [currentHospitalId, isSuperAdmin, user?.pharmacyId]);

  useEffect(() => {
    fetchTransferRequests();
  }, [mainPharmacyId]);

  const fetchTransferRequests = async () => {
    setLoading(true);
    try {
      // If no pharmacy ID, set empty and return
      if (!mainPharmacyId) {
        setPendingRequests([]);
        setApprovedRequests([]);
        setLoading(false);
        return;
      }

      // Fetch transfers where current pharmacy is the destination (toPharmacy - Main Pharmacy)
      const response = await api.get('/transfers', {
        params: {
          toPharmacyId: mainPharmacyId,
          limit: 100,
        },
      });

      const transfers = response.data?.data || response.data || [];

      // Separate pending and approved transfers
      setPendingRequests(transfers.filter((t: TransferRequest) => t.status === 'PENDING'));
      setApprovedRequests(
        transfers.filter((t: TransferRequest) => t.status === 'APPROVED')
      );
    } catch (error) {
      console.error('Error fetching transfer requests:', error);
      setPendingRequests([]);
      setApprovedRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      PENDING: { variant: 'secondary' as const, icon: Clock, label: 'Pending Approval' },
      APPROVED: { variant: 'default' as const, icon: CheckCircle, label: 'Approved' },
      REJECTED: { variant: 'destructive' as const, icon: XCircle, label: 'Rejected' },
      DISPATCHED: { variant: 'default' as const, icon: Package, label: 'Dispatched' },
      RECEIVED: { variant: 'default' as const, icon: CheckCircle, label: 'Received' },
      CANCELLED: { variant: 'outline' as const, icon: XCircle, label: 'Cancelled' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getTotalItems = (transfer: TransferRequest) => {
    return transfer.items.reduce((sum, item) => sum + item.qtyRequested, 0);
  };

  const handleApprove = (transferId: string) => {
    router.push(`/dashboard/issuance/approve/${transferId}`);
  };

  const handleDispatch = (transferId: string) => {
    router.push(`/dashboard/issuance/dispatch/${transferId}`);
  };

  const handleViewDetails = (transferId: string) => {
    router.push(`/dashboard/transfers/${transferId}`);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading transfer requests...</p>
        </div>
      </div>
    );
  }

  // Show message if no pharmacy available
  if (!mainPharmacyId) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {isSuperAdmin 
              ? 'Please select a hospital from the dropdown above' 
              : 'No pharmacy assigned to your account'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Medicine Issuance</h1>
        <p className="text-muted-foreground">
          Approve and fulfill transfer requests from sub-pharmacies
        </p>
      </div>

      {/* Info Card */}
      <Card className="mb-6 border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">How it works:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Sub-pharmacies submit transfer requests for medicines they need</li>
                <li>Review and approve/reject requests based on stock availability</li>
                <li>Dispatch approved requests by selecting batches (FIFO)</li>
                <li>Stock is automatically deducted and transferred to sub-pharmacy</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'pending' | 'approved')}>
        <TabsList>
          <TabsTrigger value="pending">
            <Clock className="h-4 w-4 mr-2" />
            Pending Requests ({pendingRequests.length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            <CheckCircle className="h-4 w-4 mr-2" />
            Approved ({approvedRequests.length})
          </TabsTrigger>
        </TabsList>

        {/* Pending Requests Tab */}
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Transfer Requests</CardTitle>
              <CardDescription>
                Review and approve requests from sub-pharmacies
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingRequests.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No pending requests</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request #</TableHead>
                      <TableHead>From Pharmacy</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-mono font-semibold">
                          {request.requestNumber}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{request.fromPharmacy.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {request.fromPharmacy.code}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{request.requester.fullName}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold">{request.items.length} medicines</span>
                            <span className="text-xs text-muted-foreground">
                              Total: {getTotalItems(request)} units
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">
                              {format(new Date(request.createdAt), 'MMM dd, yyyy')}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(request.createdAt), 'HH:mm')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(request.id)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            <Button size="sm" onClick={() => handleApprove(request.id)}>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Review
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
        </TabsContent>

        {/* Approved Requests Tab */}
        <TabsContent value="approved">
          <Card>
            <CardHeader>
              <CardTitle>Approved Requests - Ready to Dispatch</CardTitle>
              <CardDescription>
                Select batches and dispatch medicines to sub-pharmacies
              </CardDescription>
            </CardHeader>
            <CardContent>
              {approvedRequests.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No approved requests waiting for dispatch</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request #</TableHead>
                      <TableHead>From Pharmacy</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Approved Qty</TableHead>
                      <TableHead>Date Approved</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvedRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-mono font-semibold">
                          {request.requestNumber}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{request.fromPharmacy.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {request.fromPharmacy.code}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold">{request.items.length} medicines</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold">
                            {request.items.reduce((sum, item) => sum + (item.qtyApproved || 0), 0)}{' '}
                            units
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">
                              {format(new Date(request.createdAt), 'MMM dd, yyyy')}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(request.createdAt), 'HH:mm')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(request.id)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            <Button size="sm" onClick={() => handleDispatch(request.id)}>
                              <ArrowRight className="h-4 w-4 mr-1" />
                              Dispatch
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
