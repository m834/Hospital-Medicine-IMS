'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { format } from 'date-fns';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Calendar, DollarSign, History, Loader2, Phone, Printer } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import api from '@/lib/api';
import { printPatientReceipt } from '@/lib/print-receipt';
import { DateInput } from '@/components/ui/date-input';
import { formatMRN } from '@/lib/mrn';

interface Patient {
  id: string;
  nrNumber: string;
  fullName: string;
  mobile?: string;
  cnic?: string;
  gender: string;
  dob?: string;
  visitType: string;
  departmentInfo?: {
    id: string;
    name: string;
    code: string;
  };
  attendingDoctor?: {
    id?: string;
    fullName: string;
  };
  registeredAt: string;
  address?: string;
}

interface Department {
  id: string;
  name: string;
}

interface Visit {
  id: string;
  visitNumber?: string;
  visitType: string;
  departmentId?: string;
  attendingDoctorId?: string;
  status: string;
  visitDate: string;
  consultationFee?: string | number;
  clinic?: {
    name?: string;
    opdFee?: string | number;
    department?: {
      id: string;
      name: string;
    };
    doctor?: {
      id: string;
      fullName: string;
    };
  };
  bed?: {
    id: string;
    bedNumber: string;
    bedType?: string;
    dailyRate?: string | number;
    room?: {
      id: string;
      roomNumber: string;
      roomType?: string;
      dailyRate?: string | number;
    };
  };
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingVisits, setLoadingVisits] = useState(true);

  const [visitTypeFilter, setVisitTypeFilter] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const allowedRoles = [
    'SUPER_ADMIN',
    'HOSPITAL_ADMIN',
    'REGISTRATION_STAFF',
    'RECEPTIONIST',
    'DOCTOR',
    'DOCTOR_ASSISTANT',
    'MAIN_PHARMACY_MANAGER',
    'SUB_PHARMACY_MANAGER',
    'PHARMACY_STAFF',
  ];

  const hasAccess = user && allowedRoles.includes(user.role);
  const currentHospitalId = user?.hospitalId || selectedHospital?.id;

  const departmentLookup = useMemo(() => {
    const map = new Map<string, string>();
    departments.forEach((dept) => map.set(dept.id, dept.name));
    return map;
  }, [departments]);

  useEffect(() => {
    if (user && !hasAccess) {
      router.push('/dashboard');
      return;
    }

    if (id && (currentHospitalId || user?.role === 'SUPER_ADMIN')) {
      fetchPatient();
      fetchDepartments();
    }
  }, [id, currentHospitalId, user, hasAccess]);

  useEffect(() => {
    if (id) {
      fetchVisits();
    }
  }, [id, visitTypeFilter, departmentFilter, startDate, endDate]);

  const fetchPatient = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (user?.role === 'SUPER_ADMIN' && currentHospitalId) {
        params.hospitalId = currentHospitalId;
      }
      const response = await api.get(`/patients/${id}`, { params });
      setPatient(response.data);
    } catch (error) {
      console.error('Error fetching patient:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    if (!currentHospitalId) return;
    try {
      const response = await api.get(`/departments/hospital/${currentHospitalId}`);
      const list = response.data || [];
      setDepartments(list);
    } catch (error) {
      console.error('Error fetching departments:', error);
      setDepartments([]);
    }
  };

  const fetchVisits = async () => {
    setLoadingVisits(true);
    try {
      const params: Record<string, string> = {
        patientId: id,
      };

      if (visitTypeFilter) params.visitType = visitTypeFilter;
      if (departmentFilter) params.departmentId = departmentFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await api.get('/patient-visits', { params });
      const data = response.data?.data || response.data || [];
      setVisits(data);
    } catch (error) {
      console.error('Error fetching visits:', error);
      setVisits([]);
    } finally {
      setLoadingVisits(false);
    }
  };

  const getDepartmentName = (visit: Visit) => {
    if (visit.clinic?.department?.name) return visit.clinic.department.name;
    if (visit.departmentId) return departmentLookup.get(visit.departmentId) || '-';
    return '-';
  };

  const formatFee = (value?: string | number) => {
    if (value === undefined || value === null) return '-';
    const numeric = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(numeric)) return '-';
    return numeric.toFixed(2);
  };

  const getVisitFee = (visit: Visit) => {
    if (visit.visitType === 'OPD') return formatFee(visit.consultationFee ?? visit.clinic?.opdFee);
    if (visit.visitType === 'WARD_INDOOR') {
      return formatFee(visit.bed?.dailyRate ?? visit.bed?.room?.dailyRate);
    }
    return formatFee(visit.consultationFee);
  };

  const getRoomLabel = (visit: Visit) => {
    return visit.bed?.room?.roomNumber || '-';
  };

  const getBedLabel = (visit: Visit) => {
    return visit.bed?.bedNumber || '-';
  };

  const printPatientDetails = () => {
    if (!patient) return;
    const hospitalName = selectedHospital?.name || 'Hospital Medical Center';
    printPatientReceipt(patient, hospitalName, user?.fullName);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Patient not found</CardTitle>
            <CardDescription>The requested patient could not be found.</CardDescription>
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
          <h1 className="text-3xl font-bold text-foreground">Patient Details</h1>
          <p className="text-muted-foreground mt-1">
            View patient information and visit history
          </p>
        </div>
        <Button variant="outline" onClick={printPatientDetails}>
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{patient.fullName}</CardTitle>
          <CardDescription>MRN: {formatMRN(patient.nrNumber)}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Gender</p>
            <p className="font-medium">{patient.gender}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Mobile</p>
            <p className="font-medium flex items-center gap-2">
              <Phone className="h-4 w-4" />
              {patient.mobile || '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">CNIC</p>
            <p className="font-medium">{patient.cnic || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Registered</p>
            <p className="font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {format(new Date(patient.registeredAt), 'MMM dd, yyyy')}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Default Visit Type</p>
            <Badge variant="outline">{patient.visitType}</Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Department</p>
            <p className="font-medium">{patient.departmentInfo?.name || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Attending Doctor</p>
            <p className="font-medium">{patient.attendingDoctor?.fullName || '-'}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Visit History</CardTitle>
          <CardDescription>Filter by visit type, department, or date range</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Visit Type</p>
              <Select
                value={visitTypeFilter || 'ALL'}
                onValueChange={(value) =>
                  setVisitTypeFilter(value === 'ALL' ? '' : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="OPD">OPD</SelectItem>
                  <SelectItem value="EMERGENCY">Emergency</SelectItem>
                  <SelectItem value="WARD_INDOOR">Ward/Indoor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">Department</p>
              <Select
                value={departmentFilter || 'ALL'}
                onValueChange={(value) =>
                  setDepartmentFilter(value === 'ALL' ? '' : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">Start Date</p>
              <DateInput value={startDate} onChange={setStartDate} />
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">End Date</p>
              <DateInput value={endDate} onChange={setEndDate} />
            </div>
          </div>

          {loadingVisits ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : visits.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No visits found for the selected filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Visit #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Bed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visits.map((visit) => (
                  <TableRow key={visit.id}>
                    <TableCell className="font-mono">
                      {visit.visitNumber || visit.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{visit.visitType}</Badge>
                    </TableCell>
                    <TableCell>{getDepartmentName(visit)}</TableCell>
                    <TableCell>
                      {visit.clinic?.doctor?.fullName || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{visit.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(visit.visitDate), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>{getVisitFee(visit)}</TableCell>
                    <TableCell>{getRoomLabel(visit)}</TableCell>
                    <TableCell>{getBedLabel(visit)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            router.push(`/dashboard/payments/patient/${patient.id}?scope=all`)
                          }
                        >
                          <DollarSign className="h-4 w-4 mr-1" />
                          Visit Pay
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/dashboard/payments/visit/${visit.id}?tab=history`)}
                        >
                          <History className="h-4 w-4 mr-1" />
                          History
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={printPatientDetails}
                        >
                          <Printer className="h-4 w-4 mr-1" />
                          Print
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
