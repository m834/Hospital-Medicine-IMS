'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  useCreateAdmission,
  useAdmissions,
  type CreateAdmissionData,
} from '@/hooks/use-admissions';
import { useAvailableRooms } from '@/hooks/use-rooms';
import { useAvailableBeds } from '@/hooks/use-beds';
import { useDepartments } from '@/hooks/use-departments';
import { useHospitalStore } from '@/stores/hospital.store';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@/lib/constants';
import api from '@/lib/api';
import {
  Search,
  User,
  BedDouble,
  DoorOpen,
  Stethoscope,
  Calendar,
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';

const ADMISSION_TYPES = [
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'ELECTIVE', label: 'Elective' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'OBSERVATION', label: 'Observation' },
];

interface Patient {
  id: string;
  nrNumber: string;
  fullName: string;
  gender: string;
  mobile?: string;
  dateOfBirth?: string;
  visitType?: string;
}

interface Doctor {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

export default function AdmissionFormPage() {
  const router = useRouter();
  const { selectedHospital } = useHospitalStore();
  const { user } = useAuthStore();
  const { toast } = useToast();

  // Master Admin & Super Admin must select hospital, others use their hospitalId
  const hospitalId = selectedHospital?.id || user?.hospitalId;

  // Patient search
  const [searchNR, setSearchNR] = useState('');
  const [searchingPatient, setSearchingPatient] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Doctors
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  // Form data
  const [formData, setFormData] = useState<Partial<CreateAdmissionData>>({
    admissionType: 'ELECTIVE',
    admissionDate: new Date().toISOString().slice(0, 16),
  });

  // Queries
  const { data: departmentsData } = useDepartments({
    hospitalId: hospitalId,
    isActive: true,
  });

  const { data: availableRoomsData } = useAvailableRooms(
    hospitalId || '',
    formData.roomId ? undefined : undefined
  );

  const { data: availableBedsData } = useAvailableBeds(
    hospitalId || '',
    formData.roomId,
    undefined
  );

  const departments = departmentsData?.data || [];
  const availableRooms = availableRoomsData || [];
  const availableBeds = availableBedsData || [];

  // Mutation
  const createMutation = useCreateAdmission();
  useEffect(() => {
    if (hospitalId) {
      fetchDoctors();
    }
  }, [hospitalId]);

  const { data: admissionsData, isLoading: isLoadingAdmissions } = useAdmissions({
    hospitalId,
    limit: 100,
  });

  const admissionsList = admissionsData?.data || [];

  const fetchDoctors = async () => {
    if (!hospitalId) return;

    setLoadingDoctors(true);
    try {
      const response = await api.get(`/hospitals/${hospitalId}/users`, {
        params: { role: 'DOCTOR' },
      });
      setDoctors(response.data || []);
    } catch (error) {
      console.error('Failed to fetch doctors:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch doctors',
        variant: 'destructive',
      });
    } finally {
      setLoadingDoctors(false);
    }
  };

  const searchPatient = async () => {
    if (!searchNR.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter MRN',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSearchingPatient(true);
      const response = await api.get('/patients', {
        params: {
          nrNumber: searchNR.trim(),
          hospitalId: hospitalId,
        },
      });

      const patients = response.data.data || [];
      if (patients.length === 0) {
        toast({
          title: 'Not Found',
          description: 'Patient not found',
          variant: 'destructive',
        });
        setSelectedPatient(null);
        return;
      }

      const patient = patients[0];
      setSelectedPatient(patient);
      setFormData((prev) => ({ ...prev, patientId: patient.id }));

      toast({
        title: 'Success',
        description: 'Patient found successfully',
      });
    } catch (error: any) {
      console.error('Failed to search patient:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to search patient',
        variant: 'destructive',
      });
      setSelectedPatient(null);
    } finally {
      setSearchingPatient(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hospitalId) {
      toast({
        title: 'Error',
        description: 'No hospital selected',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedPatient) {
      toast({
        title: 'Error',
        description: 'Please search and select a patient',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.roomId || !formData.bedId || !formData.primaryDoctorId || !formData.admissionType) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createMutation.mutateAsync({
        hospitalId: selectedHospital!.id,
        patientId: selectedPatient.id,
        roomId: formData.roomId!,
        bedId: formData.bedId!,
        admissionType: formData.admissionType,
        admissionDate: formData.admissionDate || new Date().toISOString(),
        expectedDuration: formData.expectedDuration,
        admittedById: user?.id || '',
        primaryDoctorId: formData.primaryDoctorId!,
        referringDoctorId: formData.referringDoctorId && formData.referringDoctorId !== 'none' ? formData.referringDoctorId : undefined,
        departmentId: formData.departmentId && formData.departmentId !== 'none' ? formData.departmentId : undefined,
        provisionalDiagnosis: formData.provisionalDiagnosis,
        notes: formData.notes,
      });

      toast({
        title: 'Success',
        description: 'Patient admitted successfully',
      });

      // Reset form
      setSelectedPatient(null);
      setSearchNR('');
      setFormData({
        admissionType: 'ELECTIVE',
        admissionDate: new Date().toISOString().slice(0, 16),
      });

      // Redirect to admissions list or stay on form
      // router.push('/admin/admissions');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to admit patient',
        variant: 'destructive',
      });
    }
  };

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
              Admit a patient to a hospital bed
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
