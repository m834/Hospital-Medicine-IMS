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
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Loader2, UserPlus, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import api from '@/lib/api';

const patientSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  mobile: z.string().optional(),
  cnic: z.string().optional(),
  dob: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  address: z.string().optional(),
  visitType: z.enum(['OPD', 'EMERGENCY', 'WARD_INDOOR']),
  department: z.string().optional(),
  ward: z.string().optional(),
  bed: z.string().optional(),
  attendingDoctorId: z.string().optional(),
});

type PatientFormData = z.infer<typeof patientSchema>;

interface Doctor {
  id: string;
  fullName: string;
  email: string;
}

export default function RegisterPatientPage() {
  const [submitting, setSubmitting] = useState(false);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);

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
      mobile: '',
      cnic: '',
      dob: '',
      gender: 'MALE',
      address: '',
      visitType: 'OPD',
      department: '',
      ward: '',
      bed: '',
      attendingDoctorId: '',
    },
  });

  const visitType = form.watch('visitType');

  useEffect(() => {
    // Redirect if no access
    if (user && !hasAccess) {
      router.push('/unauthorized');
      return;
    }

    if (currentHospitalId) {
      fetchDoctors();
    }
  }, [currentHospitalId, user, hasAccess]);

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

  const onSubmit = async (data: PatientFormData) => {
    setSubmitting(true);
    try {
      if (!currentHospitalId) {
        alert('Please select a hospital first');
        setSubmitting(false);
        return;
      }

      const payload = {
        ...data,
        dob: data.dob || undefined,
        mobile: data.mobile || undefined,
        cnic: data.cnic || undefined,
        address: data.address || undefined,
        department: data.department || undefined,
        ward: data.ward || undefined,
        bed: data.bed || undefined,
        attendingDoctorId: data.attendingDoctorId || undefined,
      };

      // For SUPER_ADMIN, pass hospitalId as query param
      const params = user?.role === 'SUPER_ADMIN' && selectedHospital?.id 
        ? { hospitalId: currentHospitalId }
        : {};

      const response = await api.post('/patients', payload, { params });
      const patient = response.data;

      alert(`Patient registered successfully!\nNR Number: ${patient.nrNumber}`);
      router.push('/dashboard/patients');
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
          Fill in patient details to generate NR Number
        </p>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Patient Information</CardTitle>
          <CardDescription>
            All fields marked with * are required. NR Number will be auto-generated.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Personal Information</h3>

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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender *</FormLabel>
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
                    name="dob"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <FormLabel>CNIC</FormLabel>
                        <FormControl>
                          <Input placeholder="XXXXX-XXXXXXX-X" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Enter complete address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Visit Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Visit Information</h3>

                <FormField
                  control={form.control}
                  name="visitType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Visit Type *</FormLabel>
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
                      <FormDescription>
                        OPD for outpatient visits, Emergency for urgent cases, Ward/Indoor for admitted patients
                      </FormDescription>
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
                      <FormControl>
                        <Input placeholder="e.g., Cardiology, General Medicine" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {visitType === 'WARD_INDOOR' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="ward"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ward</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Ward A" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bed"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bed Number</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., B-12" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="attendingDoctorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Attending Doctor</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select doctor (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {loadingDoctors ? (
                            <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                              Loading doctors...
                            </div>
                          ) : doctors.length === 0 ? (
                            <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                              No doctors available
                            </div>
                          ) : (
                            doctors.map((doctor) => (
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
                      Registering...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Register Patient
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
