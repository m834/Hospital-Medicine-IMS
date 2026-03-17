'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Stethoscope,
  Activity,
  FileText,
  Pill,
  ArrowLeft,
  Save,
  CheckCircle,
  Send,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth.store';
import { useGetVisit, useUpdateVisit, useCompleteVisit, VitalSigns } from '@/hooks/use-visits';
import { useCreateReferral } from '@/hooks/use-referrals';
import api from '@/lib/api';

interface Department {
  id: string;
  name: string;
  code: string;
}

interface DepartmentDoctor {
  id: string;
  fullName: string;
  email?: string;
}

interface ConsultationFormProps {
  visitId: string;
}

const REFERRAL_TYPES = [
  { value: 'LAB_TEST', label: 'Lab Test' },
  { value: 'RADIOLOGY', label: 'Radiology' },
  { value: 'PHARMACY', label: 'Pharmacy' },
  { value: 'ADMISSION', label: 'Admission' },
  { value: 'SPECIALIST_CONSULTATION', label: 'Specialist Consultation' },
];

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export function ConsultationForm({ visitId }: ConsultationFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showReferralDialog, setShowReferralDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [departmentDoctors, setDepartmentDoctors] = useState<DepartmentDoctor[]>([]);

  const { data: visit, isLoading, refetch } = useGetVisit(visitId);
  const updateVisit = useUpdateVisit();
  const completeVisit = useCompleteVisit();
  const createReferral = useCreateReferral();

  const [vitalSigns, setVitalSigns] = useState<VitalSigns>({
    bloodPressureSystolic: '',
    bloodPressureDiastolic: '',
    pulse: '',
    temperature: '',
    spo2: '',
    weight: '',
    height: '',
    respiratoryRate: '',
  });

  const [consultation, setConsultation] = useState({
    chiefComplaint: '',
    historyOfPresentIllness: '',
    examinationFindings: '',
    diagnosis: '',
    treatment: '',
    notes: '',
  });

  const [referralForm, setReferralForm] = useState({
    toDepartmentId: '',
    toDoctorId: '',
    referralType: 'SPECIALIST_CONSULTATION' as string,
    priority: 'NORMAL' as string,
    reason: '',
    notes: '',
  });

  useEffect(() => {
    if (visit) {
      // Populate form with existing data
      if (visit.vitalSigns) {
        setVitalSigns({
          bloodPressureSystolic: visit.vitalSigns.bloodPressureSystolic || '',
          bloodPressureDiastolic: visit.vitalSigns.bloodPressureDiastolic || '',
          pulse: visit.vitalSigns.pulse || '',
          temperature: visit.vitalSigns.temperature || '',
          spo2: visit.vitalSigns.spo2 || '',
          weight: visit.vitalSigns.weight || '',
          height: visit.vitalSigns.height || '',
          respiratoryRate: visit.vitalSigns.respiratoryRate || '',
        });
      }
      setConsultation({
        chiefComplaint: visit.chiefComplaint || '',
        historyOfPresentIllness: '',
        examinationFindings: '',
        diagnosis: visit.diagnosis || '',
        treatment: visit.treatment || '',
        notes: visit.notes || '',
      });
      // Fetch departments
      fetchDepartments();
    }
  }, [visit]);

  const fetchDepartments = async () => {
    if (!visit?.hospitalId) return;
    try {
      const response = await api.get('/departments', {
        params: { hospitalId: visit.hospitalId },
      });
      setDepartments(response.data || []);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  const handleSave = async () => {
    try {
      await updateVisit.mutateAsync({
        id: visitId,
        dto: {
          chiefComplaint: consultation.chiefComplaint || undefined,
          historyOfIllness: consultation.historyOfPresentIllness || undefined,
          examination: consultation.examinationFindings || undefined,
          vitalSigns: Object.values(vitalSigns).some((v) => v) ? vitalSigns : undefined,
          diagnosis: consultation.diagnosis || undefined,
          treatmentPlan: consultation.treatment || undefined,
          notes: consultation.notes || undefined,
          status: 'IN_PROGRESS',
        },
      });
      setHasUnsavedChanges(false);
      refetch();
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleComplete = async () => {
    try {
      await completeVisit.mutateAsync(visitId);
      setShowCompleteDialog(false);
      toast({
        title: 'Consultation Completed',
        description: 'Patient has been marked as completed',
      });
      router.push('/doctor/queue');
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleCreateReferral = async () => {
    if (!visit?.hospitalId || !visit?.clinic?.department?.id || !user?.id) return;

    try {
      await createReferral.mutateAsync({
        hospitalId: visit.hospitalId,
        visitId: visitId,
        fromDepartmentId: visit.clinic.department.id,
        toDepartmentId: referralForm.toDepartmentId,
        referrerId: user.id,
        referralType: referralForm.referralType as any,
        priority: referralForm.priority as any,
        reason: referralForm.reason,
        notes: referralForm.notes || undefined,
      });
      setShowReferralDialog(false);
      setReferralForm({
        toDepartmentId: '',
        toDoctorId: '',
        referralType: 'SPECIALIST_CONSULTATION',
        priority: 'NORMAL',
        reason: '',
        notes: '',
      });
      setDepartmentDoctors([]);
      refetch();
    } catch (error) {
      // Error handled in hook
    }
  };

  const fetchDepartmentDoctors = async (departmentId: string) => {
    if (!departmentId) {
      setDepartmentDoctors([]);
      return;
    }

    try {
      const response = await api.get(`/clinics/department/${departmentId}`);
      const clinics = response.data || [];
      const doctorsMap = new Map<string, DepartmentDoctor>();
      clinics.forEach((clinic: any) => {
        if (clinic?.doctor?.id) {
          doctorsMap.set(clinic.doctor.id, {
            id: clinic.doctor.id,
            fullName: clinic.doctor.fullName,
            email: clinic.doctor.email,
          });
        }
      });
      setDepartmentDoctors(Array.from(doctorsMap.values()));
    } catch (error) {
      console.error('Failed to fetch department doctors:', error);
      setDepartmentDoctors([]);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-muted-foreground">Visit not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Queue
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Consultation</h1>
            <p className="text-muted-foreground">
              Token #{visit.tokenNumber} • {visit.clinic?.name || visit.clinic?.department?.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              visit.status === 'COMPLETED'
                ? 'default'
                : visit.status === 'IN_PROGRESS'
                ? 'secondary'
                : 'outline'
            }
          >
            {visit.status}
          </Badge>
          {hasUnsavedChanges && (
            <Badge variant="destructive">Unsaved Changes</Badge>
          )}
        </div>
      </div>

      {/* Patient Info Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl font-bold">
              {visit.patient?.firstName?.[0]}
              {visit.patient?.lastName?.[0]}
            </div>
            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Patient Name</p>
                <p className="font-semibold">
                  {visit.patient?.firstName} {visit.patient?.lastName}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">NR Number</p>
                <p className="font-semibold">{visit.patient?.nrNumber}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Age / Gender</p>
                <p className="font-semibold">
                  {calculateAge(visit.patient?.dateOfBirth || '')} years / {visit.patient?.gender}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-semibold">{visit.patient?.phone}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Consultation Tabs */}
      <Tabs defaultValue="vitals" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="vitals" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Vitals
          </TabsTrigger>
          <TabsTrigger value="complaint" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Complaint
          </TabsTrigger>
          <TabsTrigger value="diagnosis" className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            Diagnosis
          </TabsTrigger>
          <TabsTrigger value="treatment" className="flex items-center gap-2">
            <Pill className="h-4 w-4" />
            Treatment
          </TabsTrigger>
          <TabsTrigger value="referrals" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Referrals
          </TabsTrigger>
        </TabsList>

        {/* Vital Signs Tab */}
        <TabsContent value="vitals">
          <Card>
            <CardHeader>
              <CardTitle>Vital Signs</CardTitle>
              <CardDescription>Record or update patient vital signs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label>Blood Pressure (Systolic)</Label>
                  <Input
                    placeholder="120"
                    value={vitalSigns.bloodPressureSystolic}
                    onChange={(e) => {
                      setVitalSigns({ ...vitalSigns, bloodPressureSystolic: e.target.value });
                      setHasUnsavedChanges(true);
                    }}
                  />
                </div>
                <div>
                  <Label>Blood Pressure (Diastolic)</Label>
                  <Input
                    placeholder="80"
                    value={vitalSigns.bloodPressureDiastolic}
                    onChange={(e) => {
                      setVitalSigns({ ...vitalSigns, bloodPressureDiastolic: e.target.value });
                      setHasUnsavedChanges(true);
                    }}
                  />
                </div>
                <div>
                  <Label>Pulse (bpm)</Label>
                  <Input
                    placeholder="72"
                    value={vitalSigns.pulse}
                    onChange={(e) => {
                      setVitalSigns({ ...vitalSigns, pulse: e.target.value });
                      setHasUnsavedChanges(true);
                    }}
                  />
                </div>
                <div>
                  <Label>Temperature (°F)</Label>
                  <Input
                    placeholder="98.6"
                    value={vitalSigns.temperature}
                    onChange={(e) => {
                      setVitalSigns({ ...vitalSigns, temperature: e.target.value });
                      setHasUnsavedChanges(true);
                    }}
                  />
                </div>
                <div>
                  <Label>SpO2 (%)</Label>
                  <Input
                    placeholder="98"
                    value={vitalSigns.spo2}
                    onChange={(e) => {
                      setVitalSigns({ ...vitalSigns, spo2: e.target.value });
                      setHasUnsavedChanges(true);
                    }}
                  />
                </div>
                <div>
                  <Label>Respiratory Rate</Label>
                  <Input
                    placeholder="16"
                    value={vitalSigns.respiratoryRate}
                    onChange={(e) => {
                      setVitalSigns({ ...vitalSigns, respiratoryRate: e.target.value });
                      setHasUnsavedChanges(true);
                    }}
                  />
                </div>
                <div>
                  <Label>Weight (kg)</Label>
                  <Input
                    placeholder="70"
                    value={vitalSigns.weight}
                    onChange={(e) => {
                      setVitalSigns({ ...vitalSigns, weight: e.target.value });
                      setHasUnsavedChanges(true);
                    }}
                  />
                </div>
                <div>
                  <Label>Height (cm)</Label>
                  <Input
                    placeholder="170"
                    value={vitalSigns.height}
                    onChange={(e) => {
                      setVitalSigns({ ...vitalSigns, height: e.target.value });
                      setHasUnsavedChanges(true);
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chief Complaint Tab */}
        <TabsContent value="complaint">
          <Card>
            <CardHeader>
              <CardTitle>Chief Complaint & History</CardTitle>
              <CardDescription>Document patient complaints and medical history</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Chief Complaint</Label>
                <Textarea
                  placeholder="Describe the patient's main complaint..."
                  rows={4}
                  value={consultation.chiefComplaint}
                  onChange={(e) => {
                    setConsultation({ ...consultation, chiefComplaint: e.target.value });
                    setHasUnsavedChanges(true);
                  }}
                />
              </div>
              <div>
                <Label>History of Present Illness</Label>
                <Textarea
                  placeholder="Document the history of present illness..."
                  rows={4}
                  value={consultation.historyOfPresentIllness}
                  onChange={(e) => {
                    setConsultation({ ...consultation, historyOfPresentIllness: e.target.value });
                    setHasUnsavedChanges(true);
                  }}
                />
              </div>
              <div>
                <Label>Examination Findings</Label>
                <Textarea
                  placeholder="Document physical examination findings..."
                  rows={4}
                  value={consultation.examinationFindings}
                  onChange={(e) => {
                    setConsultation({ ...consultation, examinationFindings: e.target.value });
                    setHasUnsavedChanges(true);
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Diagnosis Tab */}
        <TabsContent value="diagnosis">
          <Card>
            <CardHeader>
              <CardTitle>Diagnosis</CardTitle>
              <CardDescription>Record diagnosis and clinical findings</CardDescription>
            </CardHeader>
            <CardContent>
              <div>
                <Label>Diagnosis</Label>
                <Textarea
                  placeholder="Enter diagnosis..."
                  rows={6}
                  value={consultation.diagnosis}
                  onChange={(e) => {
                    setConsultation({ ...consultation, diagnosis: e.target.value });
                    setHasUnsavedChanges(true);
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Treatment Tab */}
        <TabsContent value="treatment">
          <Card>
            <CardHeader>
              <CardTitle>Treatment Plan</CardTitle>
              <CardDescription>Document treatment and prescription</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Treatment Plan</Label>
                <Textarea
                  placeholder="Enter treatment plan and prescription..."
                  rows={6}
                  value={consultation.treatment}
                  onChange={(e) => {
                    setConsultation({ ...consultation, treatment: e.target.value });
                    setHasUnsavedChanges(true);
                  }}
                />
              </div>
              <div>
                <Label>Additional Notes</Label>
                <Textarea
                  placeholder="Any additional notes or instructions..."
                  rows={4}
                  value={consultation.notes}
                  onChange={(e) => {
                    setConsultation({ ...consultation, notes: e.target.value });
                    setHasUnsavedChanges(true);
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Referrals Tab */}
        <TabsContent value="referrals">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Referrals</CardTitle>
                <CardDescription>Manage patient referrals to other departments</CardDescription>
              </div>
              <Button onClick={() => setShowReferralDialog(true)}>
                <Send className="h-4 w-4 mr-2" />
                Add Referral
              </Button>
            </CardHeader>
            <CardContent>
              {visit.referrals && visit.referrals.length > 0 ? (
                <div className="space-y-3">
                  {visit.referrals.map((referral) => (
                    <div
                      key={referral.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">
                          {referral.referralType.replace('_', ' ')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          To: {referral.toDepartment?.name} • {referral.reason}
                        </p>
                      </div>
                      <Badge
                        variant={
                          referral.status === 'COMPLETED'
                            ? 'default'
                            : referral.status === 'ACCEPTED'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {referral.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Send className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No referrals created</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setShowReferralDialog(true)}
                  >
                    Create First Referral
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Queue
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={updateVisit.isPending || visit.status === 'COMPLETED'}
          >
            <Save className="h-4 w-4 mr-2" />
            {updateVisit.isPending ? 'Saving...' : 'Save'}
          </Button>
          <Button
            onClick={() => setShowCompleteDialog(true)}
            disabled={completeVisit.isPending || visit.status === 'COMPLETED'}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Complete Consultation
          </Button>
        </div>
      </div>

      {/* Referral Dialog */}
      <Dialog open={showReferralDialog} onOpenChange={setShowReferralDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Referral</DialogTitle>
            <DialogDescription>Refer patient to another department</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Referral Type</Label>
              <Select
                value={referralForm.referralType}
                onValueChange={(value) =>
                  setReferralForm({ ...referralForm, referralType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REFERRAL_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>To Department</Label>
              <Select
                value={referralForm.toDepartmentId}
                onValueChange={(value) => {
                  setReferralForm({ ...referralForm, toDepartmentId: value, toDoctorId: '' });
                  fetchDepartmentDoctors(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Department Doctor</Label>
              <Select
                value={referralForm.toDoctorId}
                onValueChange={(value) =>
                  setReferralForm({ ...referralForm, toDoctorId: value })
                }
                disabled={!referralForm.toDepartmentId || departmentDoctors.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      referralForm.toDepartmentId
                        ? departmentDoctors.length > 0
                          ? 'Select Doctor'
                          : 'No doctors available'
                        : 'Select department first'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {departmentDoctors.map((doctor) => (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      {doctor.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select
                value={referralForm.priority}
                onValueChange={(value) =>
                  setReferralForm({ ...referralForm, priority: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason for Referral</Label>
              <Textarea
                placeholder="Describe reason for referral..."
                value={referralForm.reason}
                onChange={(e) =>
                  setReferralForm({ ...referralForm, reason: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Additional Notes</Label>
              <Textarea
                placeholder="Any additional notes..."
                value={referralForm.notes}
                onChange={(e) =>
                  setReferralForm({ ...referralForm, notes: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReferralDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateReferral}
              disabled={
                createReferral.isPending ||
                !referralForm.toDepartmentId ||
                !referralForm.reason
              }
            >
              {createReferral.isPending ? 'Creating...' : 'Create Referral'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Consultation</DialogTitle>
            <DialogDescription>
              Are you sure you want to complete this consultation? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleComplete} disabled={completeVisit.isPending}>
              {completeVisit.isPending ? 'Completing...' : 'Complete Consultation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
