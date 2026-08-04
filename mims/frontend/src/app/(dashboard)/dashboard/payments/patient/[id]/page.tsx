'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, Loader2, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { formatMRN } from '@/lib/mrn';

interface PatientSummary {
  patient: {
    id: string;
    nrNumber: string;
    fullName: string;
    hospitalId: string;
  };
  breakdown: {
    roomCharges: number;
    consultationCharges: number;
    operationCharges: number;
    labCharges: number;
    pharmacyCharges: number;
    total: number;
  };
  receipts: Receipt[];
}

interface Receipt {
  id: string;
  receiptNumber: string;
  receiptType: string;
  description?: string;
  totalAmount: string;
  paidAmount: string;
  paymentStatus: string;
  paymentMethod: string;
  createdAt: string;
}

const paymentMethods = ['CASH', 'BANK_TRANSFER'];

export default function PatientPaymentsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [summary, setSummary] = useState<PatientSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [submitting, setSubmitting] = useState(false);

  const allowedRoles = [
    'MASTER_ADMIN',
    'SUPER_ADMIN',
    'HOSPITAL_ADMIN',
    'RECEPTIONIST',
    'BILLING_STAFF',
    'DOCTOR',
    'NURSE',
  ];

  const hasAccess = user && allowedRoles.includes(user.role);

  useEffect(() => {
    if (user && !hasAccess) {
      router.push('/dashboard');
      return;
    }

    if (id) {
      fetchSummary();
    }
  }, [id, user, hasAccess]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/payments/patient/${id}`);
      setSummary(response.data);
    } catch (error: any) {
      console.error('Error fetching patient summary:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to load patient summary',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number | string) => {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(numeric)) return '0.00';
    return numeric.toFixed(2);
  };

  const scope = searchParams?.get('scope');

  const scopedReceipts = useMemo(() => {
    if (!summary?.receipts) return [];
    if (scope === 'pharmacy') {
      return summary.receipts.filter((receipt) => receipt.receiptType === 'PHARMACY');
    }
    return summary.receipts;
  }, [summary, scope]);

  const scopedBreakdown = useMemo(() => {
    if (!summary) {
      return {
        roomCharges: 0,
        consultationCharges: 0,
        operationCharges: 0,
        labCharges: 0,
        pharmacyCharges: 0,
        total: 0,
      };
    }

    if (scope === 'pharmacy') {
      return {
        roomCharges: 0,
        consultationCharges: 0,
        operationCharges: 0,
        labCharges: 0,
        pharmacyCharges: summary.breakdown.pharmacyCharges,
        total: summary.breakdown.pharmacyCharges,
      };
    }

    return summary.breakdown;
  }, [summary, scope]);

  const getOutstandingReceipt = () =>
    scopedReceipts.find(
      (receipt) => receipt.paymentStatus !== 'PAID' && receipt.paymentStatus !== 'REFUNDED'
    ) || null;

  const receiptRemaining = useMemo(() => {
    if (!selectedReceipt) return 0;
    const total = Number(selectedReceipt.totalAmount || 0);
    const paid = Number(selectedReceipt.paidAmount || 0);
    return Math.max(total - paid, 0);
  }, [selectedReceipt]);

  const openPaymentDialog = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setPaymentAmount('');
    setPaymentMethod(receipt.paymentMethod || 'CASH');
    setPaymentDialogOpen(true);
  };

  const handlePayOutstanding = () => {
    const outstanding = getOutstandingReceipt();
    if (!outstanding) {
      toast({
        title: 'No outstanding balance',
        description: 'All receipts are fully paid.',
      });
      return;
    }
    openPaymentDialog(outstanding);
  };

  const handleSubmitPayment = async () => {
    if (!selectedReceipt) return;
    const amountToPay = Number(paymentAmount);
    if (!amountToPay || amountToPay <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Enter a valid payment amount',
        variant: 'destructive',
      });
      return;
    }

    const totalPaid = Number(selectedReceipt.paidAmount || 0) + amountToPay;

    setSubmitting(true);
    try {
      await api.post(`/receipts/${selectedReceipt.id}/payment`, {
        paidAmount: totalPaid,
        paymentMethod,
      });
      toast({
        title: 'Payment recorded',
        description: 'Receipt payment has been updated',
      });
      setPaymentDialogOpen(false);
      setSelectedReceipt(null);
      await fetchSummary();
    } catch (error: any) {
      console.error('Failed to update payment:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update payment',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Patient summary not found</CardTitle>
            <CardDescription>The patient payment summary could not be loaded.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={() => router.back()} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Patient Payment Summary</h1>
          <p className="text-muted-foreground mt-1">
            {summary.patient.fullName} ({formatMRN(summary.patient.nrNumber)})
          </p>
        </div>
        <Button onClick={handlePayOutstanding}>
          <ReceiptText className="h-4 w-4 mr-2" />
          Record Payment
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Room Charges</CardTitle>
          </CardHeader>
          <CardContent>{formatCurrency(scopedBreakdown.roomCharges)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Consultation Charges</CardTitle>
          </CardHeader>
          <CardContent>{formatCurrency(scopedBreakdown.consultationCharges)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Operation Charges</CardTitle>
          </CardHeader>
          <CardContent>{formatCurrency(scopedBreakdown.operationCharges)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Lab Charges</CardTitle>
          </CardHeader>
          <CardContent>{formatCurrency(scopedBreakdown.labCharges)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pharmacy Charges</CardTitle>
          </CardHeader>
          <CardContent>{formatCurrency(scopedBreakdown.pharmacyCharges)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Charges</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">
            {formatCurrency(scopedBreakdown.total)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Receipts</CardTitle>
          <CardDescription>All receipts for this patient</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scopedReceipts.map((receipt) => (
                <TableRow key={receipt.id}>
                  <TableCell className="font-medium">{receipt.receiptNumber}</TableCell>
                  <TableCell>{receipt.receiptType.replace('_', ' ')}</TableCell>
                  <TableCell>{formatCurrency(receipt.totalAmount)}</TableCell>
                  <TableCell>{formatCurrency(receipt.paidAmount)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        receipt.paymentStatus === 'PAID'
                          ? 'default'
                          : receipt.paymentStatus === 'PARTIALLY_PAID'
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {receipt.paymentStatus.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(receipt.createdAt), 'MMM dd, yyyy')}</TableCell>
                  <TableCell className="text-right">
                    {receipt.paymentStatus === 'PAID' || receipt.paymentStatus === 'REFUNDED' ? (
                      <span className="text-sm text-muted-foreground">No action</span>
                    ) : (
                      <Button size="sm" onClick={() => openPaymentDialog(receipt)}>
                        Pay
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              {selectedReceipt
                ? `Receipt ${selectedReceipt.receiptNumber} - Remaining ${formatCurrency(receiptRemaining)}`
                : 'Select a receipt to record payment'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Amount</label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Payment Method</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitPayment} disabled={submitting}>
              {submitting ? 'Saving...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
