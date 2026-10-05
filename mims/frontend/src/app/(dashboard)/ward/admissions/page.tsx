'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAdmissions } from '@/hooks/use-admissions';
import { useHospitalStore } from '@/stores/hospital.store';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@/lib/constants';
import { ArrowLeft } from 'lucide-react';

export default function AdmissionFormPage() {
  const router = useRouter();
  const { selectedHospital } = useHospitalStore();
  const { user } = useAuthStore();
  const { toast } = useToast();

  // Master Admin & Super Admin must select hospital, others use their hospitalId
  const hospitalId = selectedHospital?.id || user?.hospitalId;

  // Admitting happens on Patient Registration (visit type Ward/Indoor), which
  // saves the patient, visit, admission and bed together. This page lists who
  // is admitted; the admission form that used to sit here was never shown and
  // sent fields the server rejects, so it was removed rather than left as a
  // second, broken way in.
  const { data: admissionsData, isLoading: isLoadingAdmissions } = useAdmissions({
    hospitalId,
    limit: 100,
  });

  const admissionsList = admissionsData?.data || [];

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
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Patient Admission</h1>
            <p className="text-muted-foreground">
              Patients admitted to a bed. To admit a patient, register them with visit
              type Ward/Indoor (IPD).
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Indoor/In-house Patient List</CardTitle>
          <CardDescription>Currently admitted patients</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAdmissions ? (
            <div className="text-sm text-muted-foreground">Loading admissions...</div>
          ) : admissionsList.length === 0 ? (
            <div className="text-sm text-muted-foreground">No active admissions found.</div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2">Admission #</th>
                    <th className="text-left p-2">Patient</th>
                    <th className="text-left p-2">Department</th>
                    <th className="text-left p-2">Room</th>
                    <th className="text-left p-2">Bed</th>
                    <th className="text-left p-2">Doctor</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Admitted</th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admissionsList.map((admission: any) => (
                    <tr key={admission.id} className="border-t">
                      <td className="p-2 font-mono">
                        {admission.admissionNumber || admission.id.slice(0, 8)}
                      </td>
                      <td className="p-2">{admission.patient?.fullName || '-'}</td>
                      <td className="p-2">
                        {admission.department?.name || '-'}
                      </td>
                      <td className="p-2">{admission.room?.roomNumber || '-'}</td>
                      <td className="p-2">{admission.bed?.bedNumber || '-'}</td>
                      <td className="p-2">{admission.attendingDoctor?.fullName || '-'}</td>
                      <td className="p-2">
                        <Badge variant="secondary">{admission.status}</Badge>
                      </td>
                      <td className="p-2">
                        {admission.admittedAt
                          ? new Date(admission.admittedAt).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          {admission.status === 'ADMITTED' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => router.push('/ward/discharge')}
                            >
                              Discharge
                            </Button>
                          ) : admission.status === 'DISCHARGED' ? (
                            <Button
                              size="sm"
                              onClick={() =>
                                toast({
                                  title: 'Payment',
                                  description: 'Payment workflow is not implemented yet.',
                                })
                              }
                            >
                              Pay
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
