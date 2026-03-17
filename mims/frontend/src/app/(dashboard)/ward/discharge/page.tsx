'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  useAdmissions,
  useAdmission,
  useDischargeAdmission,
} from '@/hooks/use-admissions';
import { useHospitalStore } from '@/stores/hospital.store';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@/lib/constants';
import {
  Search,
  User,
  BedDouble,
  Calendar,
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Clock,
  DollarSign,
  FileText,
} from 'lucide-react';
import { formatDistanceStrict, differenceInDays } from 'date-fns';

export default function DischargeFormPage() {
  const router = useRouter();
  const params = useParams();
  const { selectedHospital } = useHospitalStore();
  const { user } = useAuthStore();
  const { toast } = useToast();

  // Master Admin & Super Admin must select hospital, others use their hospitalId
  const hospitalId = selectedHospital?.id || user?.hospitalId;

  // Selected admission
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<string | null>(
    params?.id as string || null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Discharge form data
  const [formData, setFormData] = useState<{
    dischargeDate: string;
    dischargeSummary: string;
    diagnosisOnDischarge: string;
  }>({
    dischargeDate: new Date().toISOString().slice(0, 16),
    dischargeSummary: '',
    diagnosisOnDischarge: '',
  });

  // Queries
  const { data: admissionsData, isLoading } = useAdmissions({
    hospitalId: hospitalId,
    status: 'ADMITTED',
    limit: 100,
  });

  const { data: selectedAdmission, refetch: refetchAdmission } = useAdmission(
    selectedAdmissionId || ''
  );

  const admissions = admissionsData?.data || [];

  // Mutation
  const dischargeMutation = useDischargeAdmission();

  // Calculate charges and duration
  const calculateDetails = () => {
    if (!selectedAdmission) return null;

    const admissionDateValue = selectedAdmission.admittedAt || selectedAdmission.createdAt;
    const admissionDate = admissionDateValue ? new Date(admissionDateValue) : null;
    const dischargeDate = formData.dischargeDate ? new Date(formData.dischargeDate) : new Date();
    const validAdmissionDate = admissionDate && !Number.isNaN(admissionDate.getTime()) ? admissionDate : new Date();
    const duration = Math.max(1, differenceInDays(dischargeDate, validAdmissionDate) + 1);

    // Calculate estimated charges (this is simplified - actual calculation happens on backend)
    const roomDailyRate = Number(selectedAdmission.room?.dailyRate ?? 0) || 0;
    const bedDailyRate = Number(selectedAdmission.bed?.dailyRate ?? 0) || 0;
    const estimatedRoomCharges = roomDailyRate * duration;
    const estimatedBedCharges = bedDailyRate * duration;
    const estimatedTotal = estimatedBedCharges;

    return {
      duration,
      durationText: `${duration} day${duration > 1 ? 's' : ''}`,
      admissionDate: validAdmissionDate.toLocaleString(),
      dischargeDate: dischargeDate.toLocaleString(),
      roomDailyRate,
      bedDailyRate,
      estimatedRoomCharges,
      estimatedBedCharges,
      estimatedTotal,
    };
  };

  const details = calculateDetails();

  const handleSelectAdmission = (admissionId: string) => {
    setSelectedAdmissionId(admissionId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAdmissionId) {
      toast({
        title: 'Error',
        description: 'Please select an admission to discharge',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.dischargeSummary) {
      toast({
        title: 'Error',
        description: 'Discharge summary is required',
        variant: 'destructive',
      });
      return;
    }

    setShowConfirmDialog(true);
  };

  const confirmDischarge = async () => {
    if (!selectedAdmissionId) return;
    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'Unable to determine current user for discharge',
        variant: 'destructive',
      });
      return;
    }

    try {
      const detailsSnapshot = details;
      await dischargeMutation.mutateAsync({
        id: selectedAdmissionId,
        data: {
          dischargingUserId: user.id,
          dischargedAt: new Date(formData.dischargeDate).toISOString(),
          diagnosisOnDischarge: formData.diagnosisOnDischarge || '',
          dischargeSummary: formData.dischargeSummary,
          estimatedTotal: detailsSnapshot?.estimatedTotal,
        },
      });

      toast({
        title: 'Success',
        description: 'Patient discharged successfully',
      });

      setShowConfirmDialog(false);
      setSelectedAdmissionId(null);
      setFormData({
        dischargeDate: new Date().toISOString().slice(0, 16),
        dischargeSummary: '',
        diagnosisOnDischarge: '',
      });

      // Redirect to admissions list
      router.push('/ward/admissions');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to discharge patient',
        variant: 'destructive',
      });
    }
  };

  const handlePrintDischarge = () => {
    if (!selectedAdmission || !details) return;

    const reportHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Discharge Summary - ${selectedAdmission.admissionNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            h1 { margin: 0 0 8px; font-size: 20px; }
            h2 { margin: 20px 0 8px; font-size: 16px; }
            .meta { color: #555; font-size: 12px; margin-bottom: 12px; }
            .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; font-size: 13px; }
            .label { color: #666; font-size: 12px; }
            .value { font-weight: 600; }
            .totals { margin-top: 12px; font-size: 13px; }
            .totals div { display: flex; justify-content: space-between; margin: 4px 0; }
            .totals .total { font-weight: 700; font-size: 14px; border-top: 1px solid #ddd; padding-top: 6px; }
          </style>
        </head>
        <body>
          <h1>Discharge Summary</h1>
          <div class="meta">Admission: ${selectedAdmission.admissionNumber} · Printed: ${new Date().toLocaleString()}</div>

          <h2>Patient Information</h2>
          <div class="grid">
            <div><div class="label">Name</div><div class="value">${selectedAdmission.patient?.fullName || '-'}</div></div>
            <div><div class="label">NR Number</div><div class="value">${selectedAdmission.patient?.nrNumber || '-'}</div></div>
            <div><div class="label">Gender</div><div class="value">${selectedAdmission.patient?.gender || '-'}</div></div>
            <div><div class="label">Mobile</div><div class="value">${selectedAdmission.patient?.mobile || '-'}</div></div>
          </div>

          <h2>Admission Details</h2>
          <div class="grid">
            <div><div class="label">Admission Type</div><div class="value">${selectedAdmission.admissionType || '-'}</div></div>
            <div><div class="label">Department</div><div class="value">${selectedAdmission.department?.name || '-'}</div></div>
            <div><div class="label">Room</div><div class="value">${selectedAdmission.room?.roomNumber || '-'} (${selectedAdmission.room?.roomType || '-'})</div></div>
            <div><div class="label">Bed</div><div class="value">${selectedAdmission.bed?.bedNumber || '-'} (${selectedAdmission.bed?.bedType || '-'})</div></div>
            <div><div class="label">Doctor</div><div class="value">${selectedAdmission.attendingDoctor?.fullName || '-'}</div></div>
            <div><div class="label">Admission Date</div><div class="value">${details.admissionDate}</div></div>
          </div>

          <h2>Discharge</h2>
          <div class="grid">
            <div><div class="label">Discharge Date</div><div class="value">${details.dischargeDate}</div></div>
            <div><div class="label">Duration</div><div class="value">${details.durationText}</div></div>
          </div>
          <div style="margin-top: 8px; font-size: 13px;"><div class="label">Diagnosis on Discharge</div><div class="value">${formData.diagnosisOnDischarge || '-'}</div></div>
          <div style="margin-top: 8px; font-size: 13px;"><div class="label">Discharge Summary</div><div class="value">${formData.dischargeSummary || '-'}</div></div>

          <h2>Estimated Charges</h2>
          <div class="totals">
            <div><span>Bed Charges (${details.duration} days @ PKR${details.bedDailyRate}/day)</span><span>PKR${details.estimatedBedCharges.toFixed(2)}</span></div>
            <div class="total"><span>Estimated Total</span><span>PKR${details.estimatedTotal.toFixed(2)}</span></div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(reportHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const filteredAdmissions = admissions.filter((admission: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      admission.admissionNumber.toLowerCase().includes(query) ||
      admission.patient?.fullName.toLowerCase().includes(query) ||
      admission.patient?.nrNumber.toLowerCase().includes(query)
    );
  });

  // Only show hospital selection warning for Master/Super Admin
  const isMasterOrSuper = user?.role === UserRole.MASTER_ADMIN || user?.role === UserRole.SUPER_ADMIN;
  
  if (isMasterOrSuper && !selectedHospital) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>No Hospital Selected</CardTitle>
            <CardDescription>
              Please select a hospital from the dropdown to proceed
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  
  if (!hospitalId) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Loading</CardTitle>
            <CardDescription>
              Loading hospital information...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Discharge Patient</h1>
            <p className="text-muted-foreground">
              Process patient discharge and calculate charges
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Admissions List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Active Admissions</CardTitle>
              <CardDescription>
                Select a patient to discharge
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or admission number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>

                {/* Admissions List */}
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredAdmissions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <BedDouble className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No active admissions found</p>
                    </div>
                  ) : (
                    filteredAdmissions.map((admission: any) => (
                      <button
                        key={admission.id}
                        onClick={() => handleSelectAdmission(admission.id)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                          selectedAdmissionId === admission.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-semibold">
                              {admission.patient?.fullName}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {admission.admissionNumber}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {admission.patient?.nrNumber}
                            </div>
                            <div className="flex items-center gap-2 mt-2 text-xs">
                              <Badge variant="outline">
                                {admission.room?.roomNumber}
                              </Badge>
                              <Badge variant="outline">
                                {admission.bed?.bedNumber}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-2">
                              Admitted{' '}
                              {formatDistanceStrict(
                                new Date(admission.admittedAt || admission.createdAt),
                                new Date(),
                                { addSuffix: true }
                              )}
                            </div>
                          </div>
                          {selectedAdmissionId === admission.id && (
                            <CheckCircle className="h-5 w-5 text-primary" />
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Discharge Form */}
        <div className="lg:col-span-3">
          {!selectedAdmission ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No Admission Selected</p>
                <p className="text-muted-foreground text-center mt-2">
                  Please select an admission from the list to proceed with discharge
                </p>
              </CardContent>
            </Card>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Patient Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Patient Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Patient Name</p>
                      <p className="font-semibold">
                        {selectedAdmission.patient?.fullName}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">NR Number</p>
                      <p className="font-semibold">
                        {selectedAdmission.patient?.nrNumber}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Gender</p>
                      <p className="font-semibold">
                        {selectedAdmission.patient?.gender}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Mobile</p>
                      <p className="font-semibold">
                        {selectedAdmission.patient?.mobile || 'N/A'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Admission Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BedDouble className="w-5 h-5" />
                    Admission Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Admission Number</p>
                      <p className="font-semibold">
                        {selectedAdmission.admissionNumber}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Admission Type</p>
                      <Badge>{selectedAdmission.admissionType}</Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Room</p>
                      <p className="font-semibold">
                        {selectedAdmission.room?.roomNumber} ({selectedAdmission.room?.roomType})
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Bed</p>
                      <p className="font-semibold">
                        {selectedAdmission.bed?.bedNumber} ({selectedAdmission.bed?.bedType})
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Primary Doctor</p>
                      <p className="font-semibold">
                        {selectedAdmission.attendingDoctor?.fullName || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Department</p>
                      <p className="font-semibold">
                        {selectedAdmission.department?.name || 'N/A'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Duration & Charges */}
              {details && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5" />
                      Duration & Estimated Charges
                    </CardTitle>
                    <CardDescription>
                      Actual charges will be calculated on discharge
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Admission Date</p>
                          <p className="font-semibold">{details.admissionDate}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Discharge Date</p>
                          <p className="font-semibold">{details.dischargeDate}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-muted-foreground">Duration</p>
                          <p className="font-semibold text-lg">{details.durationText}</p>
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <div className="space-y-2 text-sm">
                          
                          <div className="flex justify-between">
                            <span>Bed Charges ({details.duration} days @ PKR{details.bedDailyRate}/day)</span>
                            <span className="font-semibold">PKR{details.estimatedBedCharges.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between border-t pt-2 text-base">
                            <span className="font-semibold">Estimated Total</span>
                            <span className="font-bold text-lg">PKR{details.estimatedTotal.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Discharge Information */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Discharge Information
                    </CardTitle>
                    <Button type="button" variant="outline" onClick={handlePrintDischarge}>
                      Print Discharge Report
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="dischargeDate">Discharge Date & Time *</Label>
                    <Input
                      id="dischargeDate"
                      type="datetime-local"
                      value={formData.dischargeDate?.slice(0, 16)}
                      onChange={(e) =>
                        setFormData({ ...formData, dischargeDate: e.target.value })
                      }
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="diagnosisOnDischarge">Diagnosis on Discharge</Label>
                    <Input
                      id="diagnosisOnDischarge"
                      value={formData.diagnosisOnDischarge || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          diagnosisOnDischarge: e.target.value,
                        })
                      }
                      placeholder="Enter diagnosis"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="dischargeSummary">Discharge Summary *</Label>
                    <textarea
                      id="dischargeSummary"
                      value={formData.dischargeSummary}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          dischargeSummary: e.target.value,
                        })
                      }
                      placeholder="Enter detailed discharge summary including treatment given, condition on discharge, follow-up instructions, etc."
                      className="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      required
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Submit Button */}
              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedAdmissionId(null);
                    setFormData({
                      dischargeDate: new Date().toISOString().slice(0, 16),
                      dischargeSummary: '',
                      diagnosisOnDischarge: '',
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={dischargeMutation.isPending}>
                  {dischargeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Discharge Patient
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Patient Discharge</DialogTitle>
            <DialogDescription>
              Are you sure you want to discharge this patient? This action will:
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-muted-foreground">
            <li>Mark the admission as discharged</li>
            <li>Release the assigned bed</li>
            <li>Calculate and finalize all charges</li>
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmDischarge}
              disabled={dischargeMutation.isPending}
            >
              {dischargeMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Confirm Discharge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
