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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface VisitSummary {
  visit: {
    id: string;
    visitNumber?: string;
    visitType: string;
    visitDate: string;
    consultationFee?: string | number;
    patient: {
      id: string;
      nrNumber: string;
      fullName: string;
    };
  };
  breakdown: {
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

export default function VisitPaymentsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [summary, setSummary] = useState<VisitSummary | null>(null);
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

  useEffect(() => {
    if (searchParams?.get('tab') === 'pay' && summary?.receipts?.length) {
      const firstOutstanding = summary.receipts.find(
        (receipt) => receipt.paymentStatus !== 'PAID' && receipt.paymentStatus !== 'REFUNDED'
      );
      if (firstOutstanding) {
        openPaymentDialog(firstOutstanding);
      }
    }
  }, [searchParams, summary]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/payments/visit/${id}`);
      setSummary(response.data);
    } catch (error: any) {
      console.error('Error fetching visit summary:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to load visit summary',
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

  const getOutstandingReceipt = () =>
    summary?.receipts.find(
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
            <CardTitle>Visit summary not found</CardTitle>
            <CardDescription>The visit payment summary could not be loaded.</CardDescription>
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
          <h1 className="text-3xl font-bold text-foreground">Visit Payment Summary</h1>
          <p className="text-muted-foreground mt-1">
            Visit {summary.visit.visitNumber || summary.visit.id.slice(0, 8)} for {summary.visit.patient.fullName}
          </p>
        </div>
        <Button variant="outline" onClick={handlePayOutstanding}>
          Record Payment
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Visit Details</CardTitle>
          <CardDescription>MRN: {summary.visit.patient.nrNumber}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Visit Type</p>
            <p className="font-medium">{summary.visit.visitType}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Visit Date</p>
            <p className="font-medium">{format(new Date(summary.visit.visitDate), 'MMM dd, yyyy')}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Consultation Fee</p>
            <p className="font-medium">{formatCurrency(summary.visit.consultationFee || 0)}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Charges Breakdown</CardTitle>
          <CardDescription>Consolidated charges for this visit</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Consultation</p>
            <p className="font-semibold">{formatCurrency(summary.breakdown.consultationCharges)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Operations</p>
            <p className="font-semibold">{formatCurrency(summary.breakdown.operationCharges)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Laboratory</p>
            <p className="font-semibold">{formatCurrency(summary.breakdown.labCharges)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Pharmacy</p>
            <p className="font-semibold">{formatCurrency(summary.breakdown.pharmacyCharges)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-lg font-bold">{formatCurrency(summary.breakdown.total)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5" />
            Receipts
          </CardTitle>
          <CardDescription>Payments recorded for this visit</CardDescription>
        </CardHeader>
        <CardContent>
          {summary.receipts.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">No receipts found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.receipts.map((receipt) => (
                  <TableRow key={receipt.id}>
                    <TableCell className="font-mono">{receipt.receiptNumber}</TableCell>
                    <TableCell>{receipt.receiptType}</TableCell>
                    <TableCell>{receipt.description || '-'} </TableCell>
                    <TableCell>{formatCurrency(receipt.totalAmount)}</TableCell>
                    <TableCell>{formatCurrency(receipt.paidAmount)}</TableCell>
                    <TableCell>
                      <Badge variant={receipt.paymentStatus === 'PAID' ? 'default' : 'secondary'}>
                        {receipt.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(receipt.createdAt), 'MMM dd, yyyy')}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={receipt.paymentStatus === 'PAID' || receipt.paymentStatus === 'REFUNDED'}
                        onClick={() => openPaymentDialog(receipt)}
                      >
                        Pay
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Apply a partial or full payment to this receipt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Receipt</p>
              <p className="font-medium">{selectedReceipt?.receiptNumber}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Remaining Balance</p>
              <p className="font-semibold">{formatCurrency(receiptRemaining)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Amount to Pay</p>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
              />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Payment Method</p>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
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
              {submitting ? 'Recording...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
