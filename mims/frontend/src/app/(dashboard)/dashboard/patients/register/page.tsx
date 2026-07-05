'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Loader2, UserPlus, CheckCircle, Printer } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import api from '@/lib/api';

const patientSchema = z.object({
  // Only Full Name and CNIC are mandatory. CNIC is the identity key:
  // a matching CNIC records a new visit against the existing MRN.
  fullName: z.string().min(2, 'Full name is required'),
  cnic: z
    .string()
    .min(1, 'CNIC is required')
    .regex(/^\d{5}-\d{7}-\d$/, 'Enter a valid CNIC (XXXXX-XXXXXXX-X)'),
  age: z
    .string()
    .optional()
    .refine((v) => !v || (/^\d{1,3}$/.test(v) && Number(v) <= 150), {
      message: 'Enter a valid age',
    }),
  mobile: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  isGuardian: z.boolean().optional(),
  guardianType: z.enum(['WIFE', 'CHILD']).optional(),
  visitType: z.enum(['OPD', 'EMERGENCY', 'WARD_INDOOR']).optional(),
  department: z.string().optional(),
  clinicId: z.string().optional(),
  roomType: z.string().optional(),
  roomId: z.string().optional(),
  bedId: z.string().optional(),
  ward: z.string().optional(),
  bed: z.string().optional(),
  attendingDoctorId: z.string().optional(),
});

type PatientFormData = z.infer<typeof patientSchema>;

const formatCnic = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 13);
  const part1 = digits.slice(0, 5);
  const part2 = digits.slice(5, 12);
  const part3 = digits.slice(12, 13);
  if (digits.length <= 5) return part1;
  if (digits.length <= 12) return `${part1}-${part2}`;
  return `${part1}-${part2}-${part3}`;
};

// Keep age to at most 3 digits
const formatAge = (value: string) => value.replace(/\D/g, '').slice(0, 3);

interface Doctor {
  id: string;
  fullName: string;
  email: string;
  departmentId?: string;
}

interface Department {
  id: string;
  name: string;
  code: string;
  consultationFee?: number;
}

interface Clinic {
  id: string;
  name?: string;
  opdFee: number;
  availableDays?: string | string[];
  availableTime?: string;
  doctor: {
    id: string;
    fullName: string;
  };
  department?: {
    id: string;
    name: string;
  };
}

interface Room {
  id: string;
  roomNumber: string;
  roomType: string;
  capacity: number;
  availableBeds?: number;
}

interface Bed {
  id: string;
  bedNumber: string;
  status: string;
  dailyRate?: number;
  room?: {
    roomNumber: string;
    dailyRate?: number;
  };
}

const ROOM_TYPES = [
  { value: 'PRIVATE', label: 'Private' },
  { value: 'SEMI_PRIVATE', label: 'Semi-Private' },
  { value: 'GENERAL', label: 'General' },
  { value: 'ICU', label: 'ICU' },
  { value: 'NICU', label: 'NICU' },
  { value: 'PICU', label: 'PICU' },
  { value: 'CCU', label: 'CCU' },
  { value: 'HDU', label: 'HDU' },
  { value: 'ISOLATION', label: 'Isolation' },
  { value: 'EMERGENCY', label: 'Emergency' },
];

export default function RegisterPatientPage() {
  const [submitting, setSubmitting] = useState(false);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loadingClinics, setLoadingClinics] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [loadingBeds, setLoadingBeds] = useState(false);
  const [selectedFee, setSelectedFee] = useState<string>('');
  const [selectedBedRate, setSelectedBedRate] = useState<string>('');

  const router = useRouter();
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();

  // Check if user has access to register patients
  const allowedRoles = ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'REGISTRATION_STAFF', 'DOCTOR', 'MAIN_PHARMACY_MANAGER', 'SUB_PHARMACY_MANAGER'];
  const hasAccess = user && allowedRoles.includes(user.role);

  const currentHospitalId = user?.hospitalId || selectedHospital?.id;

  const form = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      fullName: '',
      age: '',
      mobile: '',
      cnic: '',
      gender: 'MALE' as const,
      isGuardian: false,
      guardianType: 'WIFE' as const,
      visitType: 'OPD' as const,
      department: '',
      clinicId: '',
      roomType: '',
      roomId: '',
      bedId: '',
      ward: '',
      bed: '',
      attendingDoctorId: '',
    },
  });

  const visitType = form.watch('visitType');
  const guardianType = form.watch('guardianType');
  const selectedDepartmentId = form.watch('department');
  const selectedRoomType = form.watch('roomType');
  const selectedRoomId = form.watch('roomId');

  // Fetch clinics when department changes and visit type is OPD
  useEffect(() => {
    if (visitType === 'OPD' && selectedDepartmentId && currentHospitalId) {
      fetchClinics(selectedDepartmentId);
    } else {
      setClinics([]);
      form.setValue('clinicId', '');
    }
  }, [selectedDepartmentId, visitType, currentHospitalId]);

  // Fetch rooms when room type changes and visit type is WARD_INDOOR
  useEffect(() => {
    if (visitType === 'WARD_INDOOR' && selectedRoomType && currentHospitalId) {
      fetchRooms(selectedRoomType);
    } else {
      setRooms([]);
      form.setValue('roomId', '');
    }
  }, [selectedRoomType, visitType, currentHospitalId]);

  // Fetch beds when room changes and visit type is WARD_INDOOR
  useEffect(() => {
    if (visitType === 'WARD_INDOOR' && selectedRoomId && currentHospitalId) {
      fetchBeds(selectedRoomId);
    } else {
      setBeds([]);
      form.setValue('bedId', '');
    }
  }, [selectedRoomId, visitType, currentHospitalId]);

  const fetchClinics = async (departmentId: string) => {
    setLoadingClinics(true);
    try {
      const response = await api.get('/clinics', {
        params: { 
          hospitalId: currentHospitalId, 
          departmentId,
          status: 'ACTIVE'
        },
      });
      const clinicsList = response.data?.data || response.data || [];
      setClinics(clinicsList);
    } catch (error) {
      console.error('Error fetching clinics:', error);
      setClinics([]);
    } finally {
      setLoadingClinics(false);
    }
  };

  const fetchRooms = async (roomType: string) => {
    setLoadingRooms(true);
    try {
      const response = await api.get('/rooms', {
        params: { 
          hospitalId: currentHospitalId, 
          roomType
        },
      });
      const roomsList = response.data?.data || response.data || [];
      setRooms(roomsList);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      setRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  };

  const fetchBeds = async (roomId: string) => {
    setLoadingBeds(true);
    try {
      const response = await api.get('/beds', {
        params: { 
          roomId,
          status: 'AVAILABLE'
        },
      });
      const bedsList = response.data?.data || response.data || [];
      setBeds(bedsList);
    } catch (error) {
      console.error('Error fetching beds:', error);
      setBeds([]);
    } finally {
      setLoadingBeds(false);
    }
  };

  useEffect(() => {
    // Redirect if no access
    if (user && !hasAccess) {
      router.push('/unauthorized');
      return;
    }

    if (currentHospitalId) {
      fetchDepartments();
      fetchDoctors();
    }
  }, [currentHospitalId, user, hasAccess]);

  const fetchDepartments = async () => {
    setLoadingDepartments(true);
    try {
      const response = await api.get(`/departments/hospital/${currentHospitalId}`);
      console.log('Departments API Response:', response.data); // Debug log
      const departmentsList = response.data || [];
      console.log('Departments List:', departmentsList); // Debug log
      setDepartments(departmentsList);
    } catch (error) {
      console.error('Error fetching departments:', error);
    } finally {
      setLoadingDepartments(false);
    }
  };

  const fetchDoctors = async () => {
    setLoadingDoctors(true);
    try {
      const response = await api.get(`/hospitals/${currentHospitalId}/users`, {
        params: { role: 'DOCTOR' },
      });
      const doctorsList = response.data || [];
      setDoctors(doctorsList);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    } finally {
      setLoadingDoctors(false);
    }
  };

  // Filter doctors by selected department
  const filteredDoctors = selectedDepartmentId
    ? doctors.filter(doc => doc.departmentId === selectedDepartmentId)
    : doctors;

  const onSubmit = async (data: PatientFormData) => {
    setSubmitting(true);
    try {
      if (!currentHospitalId) {
        alert('Please select a hospital first');
        setSubmitting(false);
        return;
      }

      // Patient creation payload (includes visit details for visit record creation)
      const patientPayload = {
        fullName: data.fullName,
        gender: data.gender,
        age: data.age ? Number(data.age) : undefined,
        mobile: data.mobile || undefined,
        cnic: data.cnic || undefined,
        guardianType: data.isGuardian ? data.guardianType : undefined,
        visitType: data.visitType,
        clinicId: data.clinicId || undefined,
        department: data.department || undefined,
        ward: data.roomId || data.ward || undefined,
        bed: data.bedId || data.bed || undefined,
        attendingDoctorId: data.attendingDoctorId || undefined,
      };

      // For SUPER_ADMIN, pass hospitalId as query param
      const params = user?.role === 'SUPER_ADMIN' && selectedHospital?.id 
        ? { hospitalId: currentHospitalId }
        : {};

      const response = await api.post('/patients', patientPayload, { params });
      const patient = response.data;

      // On successful save, go straight to the patient page and auto-print
      router.push(`/dashboard/patients/${patient.id}?autoprint=1`);
    } catch (error: any) {
      console.error('Error registering patient:', error);
      alert(error.response?.data?.message || 'Failed to register patient');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <h1 className="text-3xl font-bold text-foreground">Register New Patient</h1>
        <p className="text-muted-foreground mt-1">
          Fill in patient details to generate MRN
        </p>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Patient Information</CardTitle>
          <CardDescription>
            Only Full Name and CNIC are required — all other fields are optional. A matching CNIC
            records a new visit against the existing MRN. To register a wife or child under the
            same CNIC holder, turn on <span className="font-medium">Guardian</span> and pick
            Wife or Children — they each get their own MRN.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Personal Information</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter full name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="MALE">Male</SelectItem>
                            <SelectItem value="FEMALE">Female</SelectItem>
                            <SelectItem value="OTHER">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="age"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Age</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. 24"
                            inputMode="numeric"
                            value={field.value || ''}
                            onChange={(event) => {
                              field.onChange(formatAge(event.target.value));
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="mobile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mobile Number</FormLabel>
                        <FormControl>
                          <Input placeholder="03XX-XXXXXXX" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cnic"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNIC *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="XXXXX-XXXXXXX-X"
                            value={field.value || ''}
                            onChange={(event) => {
                              field.onChange(formatCnic(event.target.value));
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isGuardian"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Guardian</FormLabel>
                        <div className="flex h-10 flex-col justify-center gap-2">
                          <div className="flex items-center gap-2">
                            <Switch
                              id="isGuardian"
                              checked={!!field.value}
                              onCheckedChange={(checked) => {
                                field.onChange(checked);
                                if (checked && !form.getValues('guardianType')) {
                                  form.setValue('guardianType', 'WIFE');
                                }
                              }}
                            />
                            <label htmlFor="isGuardian" className="text-sm text-muted-foreground">
                              Register under this CNIC holder
                            </label>
                          </div>
                          {field.value && (
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-sm ${guardianType !== 'CHILD' ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
                              >
                                Wife
                              </span>
                              <Switch
                                checked={guardianType === 'CHILD'}
                                onCheckedChange={(checked) =>
                                  form.setValue('guardianType', checked ? 'CHILD' : 'WIFE')
                                }
                              />
                              <span
                                className={`text-sm ${guardianType === 'CHILD' ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
                              >
                                Children
                              </span>
                            </div>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Visit Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Visit Information</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="visitType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Visit Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select visit type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="OPD">Out-Patient (OPD)</SelectItem>
                            <SelectItem value="EMERGENCY">Emergency</SelectItem>
                            <SelectItem value="WARD_INDOOR">Ward/Indoor (IPD)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue('attendingDoctorId', '');
                            const dept = departments.find(d => d.id === value);
                            if (dept?.consultationFee) {
                              setSelectedFee(`PKR ${dept.consultationFee}`);
                            } else {
                              setSelectedFee('');
                            }
                          }} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {loadingDepartments ? (
                              <div className="px-2 py-4 text-sm text-center">
                                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                              </div>
                            ) : departments.length === 0 ? (
                              <div className="px-2 py-2 text-sm text-muted-foreground">
                                No departments
                              </div>
                            ) : (
                              departments.map((dept) => (
                                <SelectItem key={dept.id} value={dept.id}>
                                  {dept.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Clinic selector for OPD */}
                  {visitType === 'OPD' && selectedDepartmentId ? (
                    <FormField
                      control={form.control}
                      name="clinicId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Clinic</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              field.onChange(value);
                              const clinic = clinics.find(c => c.id === value);
                              if (clinic) {
                                setSelectedFee(`PKR ${clinic.opdFee}`);
                                form.setValue('attendingDoctorId', clinic.doctor.id);
                              }
                            }} 
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select clinic" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {loadingClinics ? (
                                <div className="px-2 py-4 text-sm text-center">
                                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                </div>
                              ) : clinics.length === 0 ? (
                                <div className="px-2 py-2 text-sm text-muted-foreground">
                                  No clinics available
                                </div>
                              ) : (
                                clinics.map((clinic) => (
                                  <SelectItem key={clinic.id} value={clinic.id}>
                                    Dr. {clinic.doctor.fullName} - PKR {clinic.opdFee}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <FormField
                      control={form.control}
                      name="attendingDoctorId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Doctor</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select doctor" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {loadingDoctors ? (
                                <div className="px-2 py-4 text-sm text-center">
                                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                </div>
                              ) : filteredDoctors.length === 0 ? (
                                <div className="px-2 py-2 text-sm text-muted-foreground">
                                  No doctors available
                                </div>
                              ) : (
                                filteredDoctors.map((doctor) => (
                                  <SelectItem key={doctor.id} value={doctor.id}>
                                    Dr. {doctor.fullName}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {/* Show fee if selected */}
                {selectedFee && visitType !== 'EMERGENCY' && (
                  <p className="text-sm font-medium text-green-600">
                    💰 Consultation Fee: {selectedFee}
                  </p>
                )}

                {/* Flat emergency registration fee */}
                {visitType === 'EMERGENCY' && (
                  <p className="text-sm font-medium text-red-600">
                    🚨 Emergency Registration Fee: PKR 20 (collected at the counter; a slip is generated)
                  </p>
                )}

                {/* Ward/Bed for Indoor patients */}
                {visitType === 'WARD_INDOOR' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Room Type */}
                      <FormField
                        control={form.control}
                        name="roomType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Room Type</FormLabel>
                            <Select 
                              onValueChange={(value) => {
                                field.onChange(value);
                                form.setValue('roomId', '');
                                form.setValue('bedId', '');
                              }} 
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select room type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {ROOM_TYPES.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Room */}
                      {selectedRoomType && (
                        <FormField
                          control={form.control}
                          name="roomId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Room</FormLabel>
                              <Select 
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  form.setValue('bedId', '');
                                }} 
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select room" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {loadingRooms ? (
                                    <div className="px-2 py-4 text-sm text-center">
                                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                    </div>
                                  ) : rooms.length === 0 ? (
                                    <div className="px-2 py-2 text-sm text-muted-foreground">
                                      No rooms available
                                    </div>
                                  ) : (
                                    rooms.map((room) => (
                                      <SelectItem key={room.id} value={room.id}>
                                        Room {room.roomNumber}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {/* Bed */}
                      {selectedRoomId && (
                        <FormField
                          control={form.control}
                          name="bedId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Bed</FormLabel>
                              <Select 
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  const bed = beds.find(b => b.id === value);
                                  if (bed) {
                                    const rate = bed.dailyRate || bed.room?.dailyRate || 0;
                                    setSelectedBedRate(`PKR ${rate}/day`);
                                  }
                                }} 
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select bed" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {loadingBeds ? (
                                    <div className="px-2 py-4 text-sm text-center">
                                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                    </div>
                                  ) : beds.length === 0 ? (
                                    <div className="px-2 py-2 text-sm text-muted-foreground">
                                      No beds available
                                    </div>
                                  ) : (
                                    beds.map((bed) => {
                                      const rate = bed.dailyRate || bed.room?.dailyRate || 0;
                                      return (
                                        <SelectItem key={bed.id} value={bed.id}>
                                          Bed {bed.bedNumber} - PKR {rate}/day
                                        </SelectItem>
                                      );
                                    })
                                  )}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    {/* Show bed rate if selected */}
                    {selectedBedRate && (
                      <p className="text-sm font-medium text-blue-600">
                        💵 Daily Rate: {selectedBedRate}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Printer className="h-4 w-4 mr-2" />
                      Save and Print
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
