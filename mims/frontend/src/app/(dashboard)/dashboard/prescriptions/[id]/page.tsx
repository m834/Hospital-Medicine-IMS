'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface PrescriptionItem {
  id: string;
  qtyPrescribed: number;
  dosage?: string;
  frequency?: string;
  duration?: string;
  status: string;
  medicine: {
    id: string;
    name: string;
    genericName?: string;
    strength?: string;
    form: string;
  };
}

interface PrescriptionDetail {
  id: string;
  nrNumber: string;
  prescriptionType: string;
  status: string;
  notes?: string;
  createdAt: string;
  patient: {
    id: string;
    nrNumber: string;
    fullName: string;
    gender: string;
    mobile: string;
  };
  doctor?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  items: PrescriptionItem[];
}

export default function PrescriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [prescription, setPrescription] = useState<PrescriptionDetail | null>(null);

  useEffect(() => {
    if (id) {
      fetchPrescription();
    }
  }, [id]);

  const fetchPrescription = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/prescriptions/${id}`);
      setPrescription(response.data);
    } catch (error: any) {
      console.error('Failed to load prescription:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to load prescription',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    const color =
      status === 'PENDING'
        ? 'bg-yellow-100 text-yellow-800'
        : status === 'ISSUED'
        ? 'bg-green-100 text-green-800'
        : status === 'PARTIALLY_ISSUED'
        ? 'bg-blue-100 text-blue-800'
        : 'bg-red-100 text-red-800';

    return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${color}`}>{status.replace('_', ' ')}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!prescription) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Prescription not found</CardTitle>
            <CardDescription>The prescription could not be loaded.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <div>
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Prescription Details</h1>
        <p className="text-muted-foreground mt-1">NR: {prescription.nrNumber}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>Prescription overview</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-sm text-muted-foreground">Patient</div>
            <div className="font-medium">{prescription.patient.fullName}</div>
            <div className="text-sm text-muted-foreground">{prescription.patient.mobile}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Doctor</div>
            <div className="font-medium">{prescription.doctor?.fullName || '-'}</div>
            <div className="text-sm text-muted-foreground">{prescription.doctor?.email || ''}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Type</div>
            <div className="font-medium">{prescription.prescriptionType.replace('_', ' ')}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Status</div>
            <div>{statusBadge(prescription.status)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Created</div>
            <div className="font-medium">{format(new Date(prescription.createdAt), 'MMM dd, yyyy')}</div>
          </div>
          {prescription.notes && (
            <div className="md:col-span-2">
              <div className="text-sm text-muted-foreground">Notes</div>
              <div className="font-medium">{prescription.notes}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
          <CardDescription>Prescribed medicines</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medicine</TableHead>
                <TableHead>Form</TableHead>
                <TableHead>Strength</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Dosage</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prescription.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.medicine.name}</TableCell>
                  <TableCell>{item.medicine.form}</TableCell>
                  <TableCell>{item.medicine.strength || '-'}</TableCell>
                  <TableCell>{item.qtyPrescribed}</TableCell>
                  <TableCell>{item.dosage || '-'}</TableCell>
                  <TableCell>{item.frequency || '-'}</TableCell>
                  <TableCell>{item.duration || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={item.status === 'ISSUED' ? 'default' : 'outline'}>
                      {item.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
