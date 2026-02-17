'use client';

import { useState, useEffect } from 'react';
import { Search, UserPlus, Stethoscope, Receipt, Printer, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import api from '@/lib/api';
import { useGetAvailableClinics, Clinic } from '@/hooks/use-clinics';
import { useCreateVisit, VitalSigns } from '@/hooks/use-visits';

interface Patient {
  id: string;
  nrNumber: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  phone: string;
  cnic?: string;
  address?: string;
}

interface Department {
  id: string;
  name: string;
  code: string;
}

export function OPDRegistration() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showTokenSlip, setShowTokenSlip] = useState(false);
  const [tokenData, setTokenData] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [opdVisits, setOpdVisits] = useState<any[]>([]);
  const [loadingOpdVisits, setLoadingOpdVisits] = useState(false);
  const [updatingVisitId, setUpdatingVisitId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();

  // Master Admin & Super Admin must select hospital, others use their hospitalId
  const currentHospitalId = selectedHospital?.id || user?.hospitalId;

  const [vitalSigns, setVitalSigns] = useState<VitalSigns>({
    bloodPressureSystolic: '',
    bloodPressureDiastolic: '',
    pulse: '',
    temperature: '',
    spo2: '',
    weight: '',
    height: '',
  });

  const [chiefComplaint, setChiefComplaint] = useState('');

  const { data: clinics = [] } = useGetAvailableClinics(currentHospitalId);
  const createVisit = useCreateVisit();

  // Filter clinics by selected department
  const filteredClinics = selectedDepartment
    ? clinics.filter((c) => c.departmentId === selectedDepartment)
    : clinics;

  useEffect(() => {
    if (currentHospitalId) {
      fetchDepartments();
      fetchOpdVisits();
    }
  }, [currentHospitalId]);

  const fetchDepartments = async () => {
    if (!currentHospitalId) return;
    try {
      const response = await api.get('/departments', {
        params: { hospitalId: currentHospitalId },
      });
      setDepartments(response.data || []);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  const fetchOpdVisits = async () => {
    if (!currentHospitalId) return;
    setLoadingOpdVisits(true);
    try {
      const response = await api.get('/patient-visits', {
        params: {
          hospitalId: currentHospitalId,
          visitType: 'OPD',
          limit: 20,
          page: 1,
        },
      });
      const data = response.data?.data || response.data || [];
      setOpdVisits(data);
    } catch (error) {
      console.error('Failed to fetch OPD visits:', error);
      setOpdVisits([]);
    } finally {
      setLoadingOpdVisits(false);
    }
  };

  const updateVisitStatus = async (visitId: string, status: string) => {
    if (!visitId) return;
    setUpdatingVisitId(visitId);
    try {
      await api.put(`/patient-visits/${visitId}`, { status });
      setOpdVisits((prev) =>
        prev.map((visit) => (visit.id === visitId ? { ...visit, status } : visit))
      );
      toast({
        title: 'Status Updated',
        description: `Visit status changed to ${status}`,
      });
    } catch (error: any) {
      toast({
        title: 'Update Failed',
        description: error.response?.data?.message || 'Failed to update visit status',
        variant: 'destructive',
      });
    } finally {
      setUpdatingVisitId(null);
    }
  };

  const searchPatients = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await api.get('/patients/search', {
        params: {
          query: searchQuery,
          hospitalId: currentHospitalId,
        },
      });
      setSearchResults(response.data || []);
      if (response.data?.length === 0) {
        toast({
          title: 'No Results',
          description: 'No patients found. You may register a new patient.',
        });
      }
    } catch (error) {
      console.error('Failed to search patients:', error);
      toast({
        title: 'Search Failed',
        description: 'Failed to search patients. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleRegisterVisit = async () => {
    if (!selectedPatient || !selectedClinic || !currentHospitalId || !user?.id) {
      toast({
        title: 'Error',
        description: 'Please select a patient and clinic',
        variant: 'destructive',
      });
      return;
    }

    try {
      const visitData = await createVisit.mutateAsync({
        hospitalId: currentHospitalId,
        clinicId: selectedClinic.id,
        patientId: selectedPatient.id,
        registrarId: user.id,
        visitType: 'NEW',
        chiefComplaint: chiefComplaint || undefined,
        vitalSigns: Object.values(vitalSigns).some(v => v) ? vitalSigns : undefined,
      });

      setTokenData({
        tokenNumber: visitData.tokenNumber,
        patient: selectedPatient,
        clinic: selectedClinic,
        visitId: visitData.id,
        fee: selectedClinic.opdFee,
        registeredAt: new Date().toLocaleString(),
      });
      setShowTokenSlip(true);

      // Reset form
      setSelectedPatient(null);
      setSelectedClinic(null);
      setSelectedDepartment('');
      setChiefComplaint('');
      setVitalSigns({
        bloodPressureSystolic: '',
        bloodPressureDiastolic: '',
        pulse: '',
        temperature: '',
        spo2: '',
        weight: '',
        height: '',
      });
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      // Error handled in hook
    }
  };

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const printTokenSlip = () => {
    window.print();
  };

  if (!currentHospitalId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please select a hospital first</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>OPD List</CardTitle>
          <CardDescription>Latest OPD registrations from patient visits</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingOpdVisits ? (
            <div className="text-sm text-muted-foreground">Loading OPD list...</div>
          ) : opdVisits.length === 0 ? (
            <div className="text-sm text-muted-foreground">No OPD visits found.</div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2">Visit #</th>
                    <th className="text-left p-2">Patient</th>
                    <th className="text-left p-2">Clinic</th>
                    <th className="text-left p-2">Doctor</th>
                    <th className="text-left p-2">Fee</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {opdVisits.map((visit) => (
                    <tr key={visit.id} className="border-t">
                      <td className="p-2 font-mono">
                        {visit.visitNumber || visit.id.slice(0, 8)}
                      </td>
                      <td className="p-2">
                        {visit.patient?.fullName || '-'}
                      </td>
                      <td className="p-2">
                        {visit.clinic?.name || '-'}
                      </td>
                      <td className="p-2">
                        {visit.clinic?.doctor?.fullName || '-'}
                      </td>
                      <td className="p-2">
                        Rs. {parseFloat(visit.clinic?.opdFee || visit.consultationFee || '0').toLocaleString()}
                      </td>
                      <td className="p-2">
                        <Badge variant="secondary">{visit.status}</Badge>
                      </td>
                      <td className="p-2">
                        {visit.visitDate ? new Date(visit.visitDate).toLocaleDateString() : '-'}
                      </td>
                      <td className="p-2">
                        {visit.status === 'COMPLETED' || visit.status === 'CANCELLED' ? (
                          <span className="text-sm text-muted-foreground">No actions</span>
                        ) : (
                          <Select
                            value={visit.status || 'WAITING'}
                            onValueChange={(value) => updateVisitStatus(visit.id, value)}
                            disabled={updatingVisitId === visit.id}
                          >
                            <SelectTrigger className="h-8 w-[160px]">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="WAITING">WAITING</SelectItem>
                              <SelectItem value="CALLED">CALLED</SelectItem>
                              <SelectItem value="IN_PROGRESS">IN_PROGRESS</SelectItem>
                              <SelectItem value="COMPLETED">COMPLETED</SelectItem>
                              <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
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
