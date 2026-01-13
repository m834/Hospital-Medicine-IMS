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
  Users,
  UserPlus,
  Search,
  Loader2,
  Eye,
  Phone,
  Calendar,
  MapPin,
  Printer,
} from 'lucide-react';
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
  gender: string;
  dob?: string;
  visitType: string;
  department?: string;
  attendingDoctor?: {
    fullName: string;
  };
  registeredAt: string;
  status: string;
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

  // Check if user has access to patients page
  const allowedRoles = ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'REGISTRATION_STAFF', 'DOCTOR', 'DOCTOR_ASSISTANT', 'MAIN_PHARMACY_MANAGER', 'SUB_PHARMACY_MANAGER'];
  const hasAccess = user && allowedRoles.includes(user.role);

  const currentHospitalId = user?.hospitalId || selectedHospital?.id;
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    // Redirect if no access
    if (user && !hasAccess) {
      router.push('/dashboard');
      return;
    }

    if (currentHospitalId || isSuperAdmin) {
      fetchPatients();
    }
  }, [currentHospitalId, user, hasAccess]);

  useEffect(() => {
    // Filter patients based on search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const filtered = patients.filter(
        (patient) =>
          patient.nrNumber.toLowerCase().includes(query) ||
          patient.fullName.toLowerCase().includes(query) ||
          patient.mobile?.toLowerCase().includes(query)
      );
      setFilteredPatients(filtered);
    } else {
      setFilteredPatients(patients);
    }
  }, [searchQuery, patients]);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 100, page: 1 };
      
      // Include hospitalId - either from user's hospital or selected hospital
      if (currentHospitalId) {
        params.hospitalId = currentHospitalId;
      }
      
      // If no hospitalId available, don't make the request
      if (!params.hospitalId) {
        console.warn('No hospital selected. Please select a hospital from the dropdown.');
        setLoading(false);
        return;
      }
      
      const response = await api.get('/patients', { params });
      const patientList = response.data?.data || response.data || [];
      setPatients(patientList);
      setFilteredPatients(patientList);

      // Calculate stats
      const total = patientList.length;
      const today = new Date().toDateString();
      const todayCount = patientList.filter(
        (p: Patient) => new Date(p.registeredAt).toDateString() === today
      ).length;
      const inPatientCount = patientList.filter((p: Patient) => p.visitType === 'WARD_INDOOR').length;
      const outPatientCount = patientList.filter((p: Patient) => p.visitType === 'OPD' || p.visitType === 'EMERGENCY').length;

      setStats({
        totalPatients: total,
        todayRegistrations: todayCount,
        inPatients: inPatientCount,
        outPatients: outPatientCount,
      });
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      setLoading(false);
    }
  };

  const printReceipt = (patient: Patient) => {
    const hospitalName = selectedHospital?.name || 'Hospital Medical Center';
    
    const receiptHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Patient Registration Receipt - ${patient.nrNumber}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            * { 
              margin: 0; 
              padding: 0; 
              box-sizing: border-box; 
            }
            body { 
              font-family: 'Courier New', monospace; 
              width: 80mm;
              padding: 10mm;
              font-size: 12px;
              line-height: 1.4;
            }
            .receipt { 
              width: 100%;
            }
            .header { 
              text-align: center; 
              border-bottom: 2px dashed #000;
              padding-bottom: 10px;
              margin-bottom: 10px;
            }
            .hospital-name { 
              font-size: 16px; 
              font-weight: bold;
              margin-bottom: 3px;
              text-transform: uppercase;
            }
            .receipt-title {
              font-size: 12px;
              font-weight: bold;
              margin-top: 5px;
            }
            .row { 
              display: flex;
              justify-content: space-between;
              margin: 5px 0;
              font-size: 11px;
            }
            .label { 
              font-weight: bold;
              flex-shrink: 0;
            }
            .value { 
              text-align: right;
              margin-left: 10px;
              word-break: break-word;
            }
            .nr-number {
              font-size: 16px;
              font-weight: bold;
              text-align: center;
              margin: 10px 0;
              padding: 8px;
              border: 2px solid #000;
              background: #f0f0f0;
              letter-spacing: 2px;
            }
            .section { 
              margin: 10px 0;
              padding-top: 10px;
              border-top: 1px dashed #000;
            }
            .footer {
              margin-top: 15px;
              padding-top: 10px;
              border-top: 2px dashed #000;
              text-align: center;
              font-size: 10px;
            }
            @media print {
              body { 
                padding: 5mm;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <div class="hospital-name">${hospitalName}</div>
              <div class="receipt-title">PATIENT REGISTRATION</div>
            </div>

            <div class="nr-number">
              ${patient.nrNumber}
            </div>

            <div class="section">
              <div class="row">
                <span class="label">Name:</span>
                <span class="value">${patient.fullName}</span>
              </div>
              <div class="row">
                <span class="label">Gender:</span>
                <span class="value">${patient.gender}</span>
              </div>
              ${patient.dob ? `
              <div class="row">
                <span class="label">DOB:</span>
                <span class="value">${format(new Date(patient.dob), 'dd/MM/yyyy')}</span>
              </div>
              ` : ''}
              ${patient.mobile ? `
              <div class="row">
                <span class="label">Mobile:</span>
                <span class="value">${patient.mobile}</span>
              </div>
              ` : ''}
            </div>

            <div class="section">
              <div class="row">
                <span class="label">Visit Type:</span>
                <span class="value">${getVisitTypeLabel(patient.visitType)}</span>
              </div>
              ${patient.department ? `
              <div class="row">
                <span class="label">Department:</span>
                <span class="value">${patient.department}</span>
              </div>
              ` : ''}
              ${patient.attendingDoctor?.fullName ? `
              <div class="row">
                <span class="label">Doctor:</span>
                <span class="value">Dr. ${patient.attendingDoctor.fullName}</span>
              </div>
              ` : ''}
            </div>

            <div class="section">
              <div class="row">
                <span class="label">Date:</span>
                <span class="value">${format(new Date(patient.registeredAt), 'dd/MM/yyyy')}</span>
              </div>
              <div class="row">
                <span class="label">Time:</span>
                <span class="value">${format(new Date(patient.registeredAt), 'hh:mm a')}</span>
              </div>
            </div>

            <div class="footer">
              <p>Keep this receipt for your records</p>
              <p style="margin-top: 5px;">Printed: ${format(new Date(), 'dd/MM/yyyy hh:mm a')}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Create hidden iframe for printing
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = 'none';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(receiptHTML);
      frameDoc.close();

      // Wait for content to load, then print
      printFrame.onload = () => {
        setTimeout(() => {
          printFrame.contentWindow?.print();
          // Remove iframe after printing
          setTimeout(() => {
            document.body.removeChild(printFrame);
          }, 100);
        }, 250);
      };
    }
  };

  const getGenderBadge = (gender: string) => {
    const colors = {
      MALE: 'bg-blue-100 text-blue-800',
      FEMALE: 'bg-pink-100 text-pink-800',
      OTHER: 'bg-gray-100 text-gray-800',
    };
    return colors[gender as keyof typeof colors] || colors.OTHER;
  };

  const getVisitTypeBadge = (visitType: string) => {
    const colors = {
      'OPD': 'bg-green-100 text-green-800',
      'EMERGENCY': 'bg-red-100 text-red-800',
      'WARD_INDOOR': 'bg-purple-100 text-purple-800',
    };
    return colors[visitType as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getVisitTypeLabel = (visitType: string) => {
    const labels = {
      'OPD': 'OPD',
      'EMERGENCY': 'Emergency',
      'WARD_INDOOR': 'Ward/Indoor',
    };
    return labels[visitType as keyof typeof labels] || visitType;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show message for SUPER_ADMIN if no hospital selected
  if (isSuperAdmin && !selectedHospital?.id) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Select a Hospital</CardTitle>
              <CardDescription>
                Please select a hospital from the header to view and manage patients.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Patient Management</h1>
          <p className="text-muted-foreground mt-1">Register and manage patient records</p>
        </div>
        <Button onClick={() => router.push('/dashboard/patients/register')}>
          <UserPlus className="h-4 w-4 mr-2" />
          Register Patient
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPatients}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today's Registrations</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.todayRegistrations}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In-Patients</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.inPatients}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Out-Patients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.outPatients}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Table */}
      <Card>
        <CardHeader>
          <CardTitle>Patient Records</CardTitle>
          <CardDescription>
            View and search all registered patients
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by NR Number, Name, or Mobile..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Table */}
          {filteredPatients.length === 0 ? (
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
                  <TableHead>NR Number</TableHead>
                  <TableHead>Patient Name</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Visit Type</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Attending Doctor</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPatients.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell className="font-mono font-semibold">
                      {patient.nrNumber}
                    </TableCell>
                    <TableCell className="font-medium">{patient.fullName}</TableCell>
                    <TableCell>
                      <Badge className={getGenderBadge(patient.gender)}>
                        {patient.gender}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {patient.mobile ? (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {patient.mobile}
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={getVisitTypeBadge(patient.visitType)}>
                        {getVisitTypeLabel(patient.visitType)}
                      </Badge>
                    </TableCell>
                    <TableCell>{patient.department || '-'}</TableCell>
                    <TableCell>{patient.attendingDoctor?.fullName || '-'}</TableCell>
                    <TableCell>
                      {format(new Date(patient.registeredAt), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/dashboard/patients/${patient.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => printReceipt(patient)}
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
