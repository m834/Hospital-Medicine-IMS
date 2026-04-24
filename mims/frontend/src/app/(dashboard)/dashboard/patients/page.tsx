'use client';

import { useState, useEffect } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Users,
  UserPlus,
  Search,
  Loader2,
  Eye,
  DollarSign,
  Phone,
  Calendar,
  MapPin,
  Printer,
  Info,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import api from '@/lib/api';
import { format } from 'date-fns';

interface Patient {
  id: string;
  nrNumber: string;
  fullName: string;
  mobile?: string;
  cnic?: string;
  gender: string;
  dob?: string;
  visitType: string;
  department?: string;
  departmentInfo?: {
    id: string;
    name: string;
    code: string;
  };
  attendingDoctor?: {
    fullName: string;
  };
  registeredAt: string;
  status: string;
  _count?: {
    visits: number;
  };
}

interface Visit {
  id: string;
  visitNumber: string;
  visitType: string;
  visitDate: string;
  status: string;
  paymentStatus: string;
  tokenNumber?: number;
  chiefComplaint?: string;
  consultationFee: number;
  patient: {
    id: string;
    fullName: string;
    nrNumber: string;
    mobile?: string;
    gender?: string;
    cnic?: string;
  };
  department?: { id: string; name: string };
  clinic?: {
    name: string;
    department?: { id: string; name: string };
    doctor?: { id: string; fullName: string };
  };
  attendingDoctor?: { id: string; fullName: string };
  registrar?: { id: string; fullName: string };
}

interface Stats {
  totalPatients: number;
  todayRegistrations: number;
  inPatients: number;
  outPatients: number;
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [todayVisits, setTodayVisits] = useState<Visit[]>([]);
  const [visitHistoryPatient, setVisitHistoryPatient] = useState<Patient | null>(null);
  const [visitHistory, setVisitHistory] = useState<Visit[]>([]);
  const [visitHistoryLoading, setVisitHistoryLoading] = useState(false);
  const [stats, setStats] = useState<Stats>({
    totalPatients: 0,
    todayRegistrations: 0,
    inPatients: 0,
    outPatients: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();
  const router = useRouter();

  const currentHospitalId = user?.hospitalId || selectedHospital?.id;
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (!user) return;
    if (currentHospitalId || isSuperAdmin) {
      fetchPatients();
    }
    if (currentHospitalId) {
      fetchTodayVisits();
    }
  }, [currentHospitalId, user]);

  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      setFilteredPatients(
        patients.filter(
          (p) =>
            p.nrNumber.toLowerCase().includes(query) ||
            p.fullName.toLowerCase().includes(query) ||
            p.mobile?.toLowerCase().includes(query),
        ),
      );
    } else {
      setFilteredPatients(patients);
    }
  }, [searchQuery, patients]);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 100, page: 1 };
      if (currentHospitalId) params.hospitalId = currentHospitalId;
      if (!params.hospitalId) { setLoading(false); return; }

      const response = await api.get('/patients', { params });
      const patientList = response.data?.data || response.data || [];
      setPatients(patientList);
      setFilteredPatients(patientList);

      const total = patientList.length;
      const today = new Date().toDateString();
      setStats({
        totalPatients: total,
        todayRegistrations: patientList.filter((p: Patient) => new Date(p.registeredAt).toDateString() === today).length,
        inPatients: patientList.filter((p: Patient) => p.visitType === 'WARD_INDOOR').length,
        outPatients: patientList.filter((p: Patient) => p.visitType === 'OPD' || p.visitType === 'EMERGENCY').length,
      });
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayVisits = async () => {
    try {
      if (!currentHospitalId) return;
      const today = new Date();
      const startDate = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const endDate = new Date(today.setHours(23, 59, 59, 999)).toISOString();

      const response = await api.get('/visits', {
        params: { hospitalId: currentHospitalId, startDate, endDate, limit: 500, page: 1 },
      });
      setTodayVisits(response.data?.data || []);
    } catch (error) {
      console.error('Error fetching today visits:', error);
    }
  };

  const openVisitHistory = async (patient: Patient) => {
    setVisitHistoryPatient(patient);
    setVisitHistory([]);
    setVisitHistoryLoading(true);
    try {
      const response = await api.get('/visits', {
        params: { patientId: patient.id, limit: 100, page: 1 },
      });
      setVisitHistory(response.data?.data || []);
    } catch (error) {
      console.error('Error fetching visit history:', error);
    } finally {
      setVisitHistoryLoading(false);
    }
  };

  const printReceipt = (patient: Patient) => {
    const hospitalName = selectedHospital?.name || 'Hospital Medical Center';
    const receiptHTML = `
      <!DOCTYPE html><html><head>
        <title>Patient Registration Receipt - ${patient.nrNumber}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; width: 80mm; padding: 10mm; font-size: 12px; line-height: 1.4; }
          .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
          .hospital-name { font-size: 16px; font-weight: bold; margin-bottom: 3px; text-transform: uppercase; }
          .receipt-title { font-size: 12px; font-weight: bold; margin-top: 5px; }
          .row { display: flex; justify-content: space-between; margin: 5px 0; font-size: 11px; }
          .label { font-weight: bold; flex-shrink: 0; }
          .value { text-align: right; margin-left: 10px; word-break: break-word; }
          .nr-number { font-size: 16px; font-weight: bold; text-align: center; margin: 10px 0; padding: 8px; border: 2px solid #000; background: #f0f0f0; letter-spacing: 2px; }
          .section { margin: 10px 0; padding-top: 10px; border-top: 1px dashed #000; }
          .footer { margin-top: 15px; padding-top: 10px; border-top: 2px dashed #000; text-align: center; font-size: 10px; }
        </style>
      </head><body>
        <div class="receipt">
          <div class="header">
            <div class="hospital-name">${hospitalName}</div>
            <div class="receipt-title">PATIENT REGISTRATION</div>
          </div>
          <div class="nr-number">${patient.nrNumber}</div>
          <div class="section">
            <div class="row"><span class="label">Name:</span><span class="value">${patient.fullName}</span></div>
            <div class="row"><span class="label">Gender:</span><span class="value">${patient.gender}</span></div>
            ${patient.dob ? `<div class="row"><span class="label">DOB:</span><span class="value">${format(new Date(patient.dob), 'dd/MM/yyyy')}</span></div>` : ''}
            ${patient.mobile ? `<div class="row"><span class="label">Mobile:</span><span class="value">${patient.mobile}</span></div>` : ''}
          </div>
          <div class="section">
            <div class="row"><span class="label">Visit Type:</span><span class="value">${getVisitTypeLabel(patient.visitType)}</span></div>
            ${patient.departmentInfo?.name ? `<div class="row"><span class="label">Department:</span><span class="value">${patient.departmentInfo.name}</span></div>` : ''}
            ${patient.attendingDoctor?.fullName ? `<div class="row"><span class="label">Doctor:</span><span class="value">Dr. ${patient.attendingDoctor.fullName}</span></div>` : ''}
          </div>
          <div class="section">
            <div class="row"><span class="label">Date:</span><span class="value">${format(new Date(patient.registeredAt), 'dd/MM/yyyy')}</span></div>
            <div class="row"><span class="label">Time:</span><span class="value">${format(new Date(patient.registeredAt), 'hh:mm a')}</span></div>
          </div>
          <div class="footer">
            <p>Keep this receipt for your records</p>
            <p style="margin-top:5px;">Printed: ${format(new Date(), 'dd/MM/yyyy hh:mm a')}</p>
          </div>
        </div>
      </body></html>`;

    const printFrame = document.createElement('iframe');
    printFrame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
    document.body.appendChild(printFrame);
    const frameDoc = printFrame.contentWindow?.document;
    if (frameDoc) {
      frameDoc.open(); frameDoc.write(receiptHTML); frameDoc.close();
      printFrame.onload = () => setTimeout(() => {
        printFrame.contentWindow?.print();
        setTimeout(() => document.body.removeChild(printFrame), 100);
      }, 250);
    }
  };

  const getGenderBadge = (gender: string) => {
    const colors: Record<string, string> = { MALE: 'bg-blue-100 text-blue-800', FEMALE: 'bg-pink-100 text-pink-800', OTHER: 'bg-gray-100 text-gray-800' };
    return colors[gender] || colors.OTHER;
  };

  const getVisitTypeBadge = (visitType: string) => {
    const colors: Record<string, string> = { OPD: 'bg-green-100 text-green-800', EMERGENCY: 'bg-red-100 text-red-800', WARD_INDOOR: 'bg-purple-100 text-purple-800' };
    return colors[visitType] || 'bg-gray-100 text-gray-800';
  };

  const getVisitTypeLabel = (visitType: string) => {
    const labels: Record<string, string> = { OPD: 'OPD', EMERGENCY: 'Emergency', WARD_INDOOR: 'Ward/Indoor' };
    return labels[visitType] || visitType;
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = { WAITING: 'bg-yellow-100 text-yellow-800', IN_PROGRESS: 'bg-blue-100 text-blue-800', COMPLETED: 'bg-green-100 text-green-800', CANCELLED: 'bg-red-100 text-red-800' };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPaymentBadge = (status: string) => {
    const colors: Record<string, string> = { PAID: 'bg-green-100 text-green-800', UNPAID: 'bg-red-100 text-red-800', PARTIAL: 'bg-orange-100 text-orange-800' };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Filter today visits by type and search
  const filterTodayVisits = (type: string) => {
    let list = todayVisits.filter((v) => v.visitType === type);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (v) =>
          v.visitNumber.toLowerCase().includes(q) ||
          v.patient.fullName.toLowerCase().includes(q) ||
          v.patient.nrNumber.toLowerCase().includes(q) ||
          v.patient.mobile?.toLowerCase().includes(q),
      );
    }
    return list;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isSuperAdmin && !selectedHospital?.id) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Select a Hospital</CardTitle>
              <CardDescription>Please select a hospital from the header to view and manage patients.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  const todayOPD = filterTodayVisits('OPD');
  const todayIndoor = filterTodayVisits('WARD_INDOOR');
  const todayEmergency = filterTodayVisits('EMERGENCY');

  const canRegisterPatient = [
    'MASTER_ADMIN',
    'SUPER_ADMIN',
    'HOSPITAL_ADMIN',
    'REGISTRATION_STAFF',
    'REGISTRATION_STAFF_MANAGER',
    'RECEPTIONIST',
  ].includes(user?.role || '');

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Patient Management</h1>
          <p className="text-muted-foreground mt-1">Register and manage patient records</p>
        </div>
        {canRegisterPatient && (
          <Button onClick={() => router.push('/dashboard/patients/register')}>
            <UserPlus className="h-4 w-4 mr-2" />
            Register Patient
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.totalPatients}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today's Visits</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{todayVisits.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today's Indoor</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-purple-600">{todayIndoor.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today's Emergency</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{todayEmergency.length}</div></CardContent>
        </Card>
      </div>

      {/* Search and Table */}
      <Card>
        <CardHeader>
          <CardTitle>Patient Records</CardTitle>
          <CardDescription>View and search all registered patients and today's visits</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by MRN, Visit ID, Name, or Mobile..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="all">
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="all">
                All Patients
                <Badge variant="secondary" className="ml-2">{filteredPatients.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="opd">
                OPD
                <Badge variant="secondary" className="ml-2">
                  {filteredPatients.filter((p) => p.visitType === 'OPD').length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="today_opd">
                Today's OPD
                <Badge variant="secondary" className="ml-2">{todayOPD.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="today_indoor">
                Today's Indoor
                <Badge variant="secondary" className="ml-2">{todayIndoor.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="today_emergency">
                Today's Emergency
                <Badge variant="secondary" className="ml-2">{todayEmergency.length}</Badge>
              </TabsTrigger>
            </TabsList>

            {/* ── All Patients tab ── */}
            {(['all', 'opd'] as const).map((tab) => {
              const list = tab === 'opd'
                ? filteredPatients.filter((p) => p.visitType === 'OPD')
                : filteredPatients;
              return (
                <TabsContent key={tab} value={tab}>
                  {list.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        {searchQuery ? 'No patients found matching your search' : 'No patients registered yet'}
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>MRN</TableHead>
                          <TableHead>Patient Name</TableHead>
                          <TableHead>Gender</TableHead>
                          <TableHead>Mobile</TableHead>
                          <TableHead>CNIC</TableHead>
                          <TableHead>Visit Type</TableHead>
                          <TableHead>Total Visits</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Registered</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {list.map((patient) => (
                          <TableRow key={patient.id}>
                            <TableCell className="font-mono font-semibold">{patient.nrNumber}</TableCell>
                            <TableCell className="font-medium">{patient.fullName}</TableCell>
                            <TableCell>
                              <Badge className={getGenderBadge(patient.gender)}>{patient.gender}</Badge>
                            </TableCell>
                            <TableCell>
                              {patient.mobile ? (
                                <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{patient.mobile}</div>
                              ) : '-'}
                            </TableCell>
                            <TableCell>{patient.cnic || '-'}</TableCell>
                            <TableCell>
                              <Badge className={getVisitTypeBadge(patient.visitType)}>
                                {getVisitTypeLabel(patient.visitType)}
                              </Badge>
                            </TableCell>
                            <TableCell>{patient._count?.visits ?? 0}</TableCell>
                            <TableCell>{patient.departmentInfo?.name || '-'}</TableCell>
                            <TableCell>{format(new Date(patient.registeredAt), 'MMM dd, yyyy')}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openVisitHistory(patient)} title="Visit History">
                                  <Info className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/patients/${patient.id}`)}>
                                  <Eye className="h-4 w-4 mr-1" />View
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/payments/patient/${patient.id}`)}>
                                  <DollarSign className="h-4 w-4 mr-1" />Pay
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => printReceipt(patient)}>
                                  <Printer className="h-4 w-4 mr-1" />Print
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              );
            })}

            {/* ── Visit-based tabs (Today's OPD / Indoor / Emergency) ── */}
            {([
              { key: 'today_opd', list: todayOPD, label: "today's OPD" },
              { key: 'today_indoor', list: todayIndoor, label: "today's indoor" },
              { key: 'today_emergency', list: todayEmergency, label: "today's emergency" },
            ] as const).map(({ key, list, label }) => (
              <TabsContent key={key} value={key}>
                {list.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      {searchQuery ? 'No visits found matching your search' : `No ${label} visits recorded`}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Visit ID</TableHead>
                        <TableHead>MRN</TableHead>
                        <TableHead>Patient Name</TableHead>
                        <TableHead>Mobile</TableHead>
                        <TableHead>Visit Type</TableHead>
                        <TableHead>Token #</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Doctor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Visit Time</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.map((visit) => (
                        <TableRow key={visit.id}>
                          <TableCell className="font-mono font-semibold text-xs">{visit.visitNumber}</TableCell>
                          <TableCell className="font-mono">{visit.patient.nrNumber}</TableCell>
                          <TableCell className="font-medium">{visit.patient.fullName}</TableCell>
                          <TableCell>
                            {visit.patient.mobile ? (
                              <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{visit.patient.mobile}</div>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge className={getVisitTypeBadge(visit.visitType)}>
                              {getVisitTypeLabel(visit.visitType)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {visit.tokenNumber ? (
                              <Badge variant="outline">#{visit.tokenNumber}</Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell>{visit.clinic?.department?.name || visit.department?.name || '-'}</TableCell>
                          <TableCell>{visit.clinic?.doctor?.fullName || visit.attendingDoctor?.fullName || '-'}</TableCell>
                          <TableCell>
                            <Badge className={getStatusBadge(visit.status)}>{visit.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getPaymentBadge(visit.paymentStatus)}>{visit.paymentStatus}</Badge>
                          </TableCell>
                          <TableCell>{format(new Date(visit.visitDate), 'hh:mm a')}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/patients/${visit.patient.id}`)}>
                                <Eye className="h-4 w-4 mr-1" />View
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/payments/patient/${visit.patient.id}`)}>
                                <DollarSign className="h-4 w-4 mr-1" />Pay
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Visit History Dialog */}
      <Dialog open={!!visitHistoryPatient} onOpenChange={(open) => !open && setVisitHistoryPatient(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Visit History — {visitHistoryPatient?.fullName}{' '}
              <span className="text-muted-foreground font-normal text-sm ml-2">
                ({visitHistoryPatient?.nrNumber})
              </span>
            </DialogTitle>
          </DialogHeader>

          {visitHistoryLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : visitHistory.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No visits recorded for this patient.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Visit ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Chief Complaint</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visitHistory.map((visit, idx) => (
                  <TableRow key={visit.id}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{visit.visitNumber}</TableCell>
                    <TableCell>
                      <Badge className={getVisitTypeBadge(visit.visitType)}>
                        {getVisitTypeLabel(visit.visitType)}
                      </Badge>
                    </TableCell>
                    <TableCell>{visit.tokenNumber ? `#${visit.tokenNumber}` : '-'}</TableCell>
                    <TableCell>{visit.clinic?.department?.name || visit.department?.name || '-'}</TableCell>
                    <TableCell>{visit.clinic?.doctor?.fullName || visit.attendingDoctor?.fullName || '-'}</TableCell>
                    <TableCell className="max-w-[150px] truncate" title={visit.chiefComplaint}>{visit.chiefComplaint || '-'}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadge(visit.status)}>{visit.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPaymentBadge(visit.paymentStatus)}>{visit.paymentStatus}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(visit.visitDate), 'MMM dd, yyyy hh:mm a')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
