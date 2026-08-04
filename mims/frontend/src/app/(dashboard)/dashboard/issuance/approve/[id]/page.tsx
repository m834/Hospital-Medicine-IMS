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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Package,
  Building2,
  User,
  Calendar,
  FileText,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import api from '@/lib/api';
import { format } from 'date-fns';

interface AlternativeStock {
  pharmacyId: string;
  pharmacyName: string;
  pharmacyCode: string;
  quantity: number;
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
  qtyApproved?: number;
  availableStock?: number;
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
  items: TransferItem[];
  notes?: string;
  createdAt: string;
}

export default function ApproveTransferPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();
  const transferId = params?.id as string;

  const [transfer, setTransfer] = useState<TransferRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [approvedQuantities, setApprovedQuantities] = useState<Record<string, number>>({});
  const [rejectionReason, setRejectionReason] = useState('');
  const [stockLevels, setStockLevels] = useState<Record<string, number>>({});
  const [alternativeStocks, setAlternativeStocks] = useState<Record<string, AlternativeStock[]>>({});
  const [requestingFromAlt, setRequestingFromAlt] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (transferId) {
      fetchTransferDetails();
    }
  }, [transferId]);

  const fetchTransferDetails = async () => {
    setLoading(true);
    try {
      // Fetch transfer request details
      const response = await api.get(`/transfers/${transferId}`);
      const data = response.data;
      
      setTransfer(data);

      // Initialize approved quantities with requested quantities
      const initialQuantities: Record<string, number> = {};
      data.items.forEach((item: TransferItem) => {
        initialQuantities[item.id] = item.qtyRequested;
      });
      setApprovedQuantities(initialQuantities);

      // Fetch stock levels for each medicine
      await fetchStockLevels(data.items, data.toPharmacy.id);
    } catch (error) {
      console.error('Error fetching transfer details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStockLevels = async (items: TransferItem[], pharmacyId: string) => {
    try {
      const levels: Record<string, number> = {};
      
      // Fetch stock level for each medicine
      await Promise.all(
        items.map(async (item) => {
          try {
            const response = await api.get(
              `/inventory/batches/stock-level/${item.medicine.id}/${pharmacyId}`
            );
            // The endpoint returns normalStock / lpStock / totalStock — there
            // is no totalQty, so reading it made every item show 0 / Out of Stock.
            levels[item.medicine.id] = response.data?.totalStock ?? 0;
          } catch (error) {
            console.error(`Error fetching stock for ${item.medicine.name}:`, error);
            levels[item.medicine.id] = 0;
          }
        })
      );

      setStockLevels(levels);

      // Check alternative sources for out-of-stock items
      await checkAlternativeStocks(items, levels, pharmacyId);
    } catch (error) {
      console.error('Error fetching stock levels:', error);
    }
  };

  const checkAlternativeStocks = async (
    items: TransferItem[],
    currentStockLevels: Record<string, number>,
    mainPharmacyId: string
  ) => {
    try {
      const alternatives: Record<string, AlternativeStock[]> = {};

      // Get hospital ID - we need to fetch it from the pharmacy
      let hospitalId = selectedHospital?.id || user?.hospitalId;

      if (!hospitalId && transfer) {
        // Fetch pharmacy details to get hospitalId
        try {
          const pharmacyResponse = await api.get(`/pharmacies/${transfer.toPharmacy.id}`);
          hospitalId = pharmacyResponse.data?.hospitalId;
        } catch (error) {
          console.error('Error fetching pharmacy details:', error);
        }
      }

      if (!hospitalId) return;

      // Fetch all sub-pharmacies in the same hospital
      const pharmaciesResponse = await api.get('/pharmacies', {
        params: { hospitalId },
      });
      const subPharmacies = pharmaciesResponse.data?.filter(
        (p: any) => p.type === 'SUB' && p.id !== mainPharmacyId
      ) || [];

      // Check each medicine that's out of stock or low
      for (const item of items) {
        const mainStock = currentStockLevels[item.medicine.id] || 0;
        
        // Only check alternatives if main pharmacy has less than requested
        if (mainStock < item.qtyRequested) {
          const alternativeSources: AlternativeStock[] = [];

          // Check stock in each sub-pharmacy
          await Promise.all(
            subPharmacies.map(async (pharmacy: any) => {
              try {
                const response = await api.get(
                  `/inventory/batches/stock-level/${item.medicine.id}/${pharmacy.id}`
                );
                const quantity = response.data?.totalStock ?? 0;

                // Only include if they have more than 10 units
                if (quantity > 10) {
                  alternativeSources.push({
                    pharmacyId: pharmacy.id,
                    pharmacyName: pharmacy.name,
                    pharmacyCode: pharmacy.code,
                    quantity,
                  });
                }
              } catch (error) {
                console.error(`Error checking ${pharmacy.name}:`, error);
              }
            })
          );

          // Sort by quantity descending
          alternativeSources.sort((a, b) => b.quantity - a.quantity);
          
          if (alternativeSources.length > 0) {
            alternatives[item.medicine.id] = alternativeSources;
          }
        }
      }

      setAlternativeStocks(alternatives);
    } catch (error) {
      console.error('Error checking alternative stocks:', error);
    }
  };

  const handleQuantityChange = (itemId: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setApprovedQuantities((prev) => ({
      ...prev,
      [itemId]: numValue,
    }));
  };

  const handleApprove = async () => {
    if (!transfer) return;

    setSubmitting(true);
    try {
      // Prepare approval data
      const approvalData = {
        items: transfer.items.map((item) => ({
          id: item.id,
          qtyApproved: approvedQuantities[item.id],
        })),
        approvedBy: user?.id,
      };

      await api.post(`/transfers/${transferId}/approve`, approvalData);

      alert('Transfer request approved successfully!');
      router.push('/dashboard/issuance');
    } catch (error: any) {
      console.error('Error approving transfer:', error);
      alert(error.response?.data?.message || 'Failed to approve transfer request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!transfer) return;
    
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/transfers/${transferId}/reject`, {
        rejectionReason,
        rejectedBy: user?.id,
      });

      alert('Transfer request rejected');
      router.push('/dashboard/issuance');
    } catch (error: any) {
      console.error('Error rejecting transfer:', error);
      alert(error.response?.data?.message || 'Failed to reject transfer request');
    } finally {
      setSubmitting(false);
    }
  };

  const getStockStatus = (medicineId: string, qtyRequested: number) => {
    const available = stockLevels[medicineId] || 0;
    
    if (available >= qtyRequested) {
      return { color: 'text-green-600', icon: CheckCircle, text: 'Available' };
    } else if (available > 0) {
      return { color: 'text-yellow-600', icon: AlertTriangle, text: 'Partial' };
    } else {
      return { color: 'text-red-600', icon: XCircle, text: 'Out of Stock' };
    }
  };

  const handleRequestFromAlternative = async (
    medicineId: string,
    medicineName: string,
    altPharmacyId: string,
    altPharmacyName: string,
    qtyNeeded: number
  ) => {
    if (!transfer) return;

    const confirmMsg = `Request ${qtyNeeded} units of "${medicineName}" from ${altPharmacyName}?`;
    if (!confirm(confirmMsg)) return;

    setRequestingFromAlt((prev) => ({ ...prev, [`${medicineId}-${altPharmacyId}`]: true }));

    try {
      // Create a transfer request from the alternative pharmacy to main pharmacy
      const requestData = {
        fromPharmacyId: altPharmacyId,
        toPharmacyId: transfer.toPharmacy.id, // Main pharmacy
        items: [
          {
            medicineId: medicineId,
            qtyRequested: qtyNeeded,
          },
        ],
        requestedBy: user?.id,
        notes: `Auto-request to fulfill transfer request ${transfer.requestNumber}`,
      };

      await api.post('/transfers', requestData);

      alert(`Transfer request created successfully!\nRequesting ${qtyNeeded} units from ${altPharmacyName}`);
      
      // Optionally refresh the page to update stock levels
      await fetchTransferDetails();
    } catch (error: any) {
      console.error('Error creating transfer request:', error);
      alert(error.response?.data?.message || 'Failed to create transfer request');
    } finally {
      setRequestingFromAlt((prev) => ({ ...prev, [`${medicineId}-${altPharmacyId}`]: false }));
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading transfer request...</p>
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
            <h1 className="text-3xl font-bold text-foreground">Review Transfer Request</h1>
            <p className="text-muted-foreground mt-1">
              Request #{transfer.requestNumber}
            </p>
          </div>
          
          <Badge variant="secondary" className="text-lg px-4 py-2">
            {transfer.status}
          </Badge>
        </div>
      </div>

      {/* Request Details */}
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

      {/* Items Table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Requested Items</CardTitle>
          <CardDescription>
            Review stock availability and adjust approved quantities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medicine</TableHead>
                <TableHead>Form & Strength</TableHead>
                <TableHead className="text-right">Requested</TableHead>
                <TableHead className="text-right">Available Stock</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Approved Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfer.items.map((item) => {
                const status = getStockStatus(item.medicine.id, item.qtyRequested);
                const StatusIcon = status.icon;
                const availableStock = stockLevels[item.medicine.id] || 0;
                const alternatives = alternativeStocks[item.medicine.id] || [];

                return (
                  <React.Fragment key={item.id}>
                    <TableRow>
                      <TableCell className="font-medium">{item.medicine.name}</TableCell>
                      <TableCell>
                        {item.medicine.form}
                        {item.medicine.strength && ` - ${item.medicine.strength}`}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {item.qtyRequested}
                      </TableCell>
                      <TableCell className="text-right">
                        {availableStock}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className={`flex items-center justify-center gap-1 ${status.color}`}>
                          <StatusIcon className="h-4 w-4" />
                          <span className="text-sm font-medium">{status.text}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          max={Math.min(item.qtyRequested, availableStock)}
                          value={approvedQuantities[item.id] || 0}
                          onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                          className="w-24 ml-auto"
                        />
                      </TableCell>
                    </TableRow>
                    
                    {/* Show alternative stock sources if out of stock or low */}
                    {alternatives.length > 0 && (
                      <TableRow className="bg-blue-50 dark:bg-blue-950/20">
                        <TableCell colSpan={6} className="py-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                                Alternative Stock Available in Other Sub-Pharmacies:
                              </p>
                              <div className="grid grid-cols-1 gap-2">
                                {alternatives.map((alt) => {
                                  const deficit = item.qtyRequested - availableStock;
                                  const qtyToRequest = Math.min(alt.quantity, deficit);
                                  const isRequesting = requestingFromAlt[`${item.medicine.id}-${alt.pharmacyId}`];

                                  return (
                                    <div
                                      key={alt.pharmacyId}
                                      className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg px-4 py-3 border border-blue-200 dark:border-blue-800"
                                    >
                                      <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                          <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                              {alt.pharmacyName}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                              {alt.pharmacyCode}
                                            </p>
                                          </div>
                                          <Badge variant="default" className="bg-green-600">
                                            {alt.quantity} units available
                                          </Badge>
                                        </div>
                                      </div>
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          handleRequestFromAlternative(
                                            item.medicine.id,
                                            item.medicine.name,
                                            alt.pharmacyId,
                                            alt.pharmacyName,
                                            qtyToRequest
                                          )
                                        }
                                        disabled={isRequesting}
                                        className="ml-4"
                                      >
                                        {isRequesting ? (
                                          <>
                                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                            Requesting...
                                          </>
                                        ) : (
                                          <>
                                            <ArrowRight className="h-3 w-3 mr-1" />
                                            Request {qtyToRequest} units
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                              <p className="text-xs text-blue-700 dark:text-blue-300 mt-3 flex items-center gap-1">
                                <Package className="h-3 w-3" />
                                Click "Request" to create a transfer request from that pharmacy to your main pharmacy.
                              </p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Rejection Reason */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Rejection Reason (Optional)</CardTitle>
          <CardDescription>
            Provide a reason if you need to reject this request
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Enter rejection reason..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={3}
          />
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
          variant="destructive"
          onClick={handleReject}
          disabled={submitting || !rejectionReason.trim()}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Rejecting...
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 mr-2" />
              Reject Request
            </>
          )}
        </Button>
        
        <Button
          onClick={handleApprove}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Approving...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve Request
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
