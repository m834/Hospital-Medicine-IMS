'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Clock, 
  CheckCircle, 
  PlayCircle, 
  Phone,
  User,
  Stethoscope,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth.store';
import { useGetDoctorClinics, Clinic } from '@/hooks/use-clinics';
import { useGetClinicQueue, useCallNextPatient, Visit } from '@/hooks/use-visits';

const STATUS_COLORS = {
  WAITING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  CALLED: 'bg-orange-100 text-orange-800 border-orange-300',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 border-blue-300',
  COMPLETED: 'bg-green-100 text-green-800 border-green-300',
  CANCELLED: 'bg-red-100 text-red-800 border-red-300',
  NO_SHOW: 'bg-gray-100 text-gray-800 border-gray-300',
};

export function QueueDashboard() {
  const router = useRouter();
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const { toast } = useToast();
  const { user } = useAuthStore();

  const doctorId = user?.id;

  const { data: clinics = [], isLoading: loadingClinics } = useGetDoctorClinics(doctorId || '');
  const { 
    data: queueData, 
    isLoading: loadingQueue,
    refetch: refetchQueue 
  } = useGetClinicQueue(selectedClinic?.id || '');
  const callNextPatient = useCallNextPatient();

  const queue = queueData || [];
  const waitingPatients = queue.filter((v) => v.status === 'WAITING');
  const calledPatients = queue.filter((v) => v.status === 'CALLED');
  const inProgressPatients = queue.filter((v) => v.status === 'IN_PROGRESS');
  const completedPatients = queue.filter((v) => v.status === 'COMPLETED');

  // Current patient being consulted
  const currentPatient = inProgressPatients[0] || calledPatients[0];
  
  // Next patient in queue
  const nextPatient = waitingPatients[0];

  useEffect(() => {
    if (clinics.length > 0 && !selectedClinic) {
      setSelectedClinic(clinics[0]);
    }
  }, [clinics, selectedClinic]);

  const handleCallNext = async () => {
    if (!selectedClinic) return;

    try {
      const visit = await callNextPatient.mutateAsync(selectedClinic.id);
      // Navigate to consultation page
      router.push(`/doctor/consult/${visit.id}`);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleStartConsultation = (visitId: string) => {
    router.push(`/doctor/consult/${visitId}`);
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

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loadingClinics) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (clinics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Stethoscope className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No clinics assigned to you</p>
        <p className="text-sm text-muted-foreground">Please contact admin to set up your clinic</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Doctor Queue</h1>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select
            value={selectedClinic?.id || ''}
            onValueChange={(value) => {
              const clinic = clinics.find((c) => c.id === value);
              setSelectedClinic(clinic || null);
            }}
          >
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select Clinic" />
            </SelectTrigger>
            <SelectContent>
              {clinics.map((clinic) => (
                <SelectItem key={clinic.id} value={clinic.id}>
                  {clinic.name || `${clinic.department?.name} Clinic`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => refetchQueue()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{queue.length}</p>
                <p className="text-sm text-muted-foreground">Total Patients</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{waitingPatients.length}</p>
                <p className="text-sm text-muted-foreground">Waiting</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <PlayCircle className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inProgressPatients.length + calledPatients.length}</p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedPatients.length}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Token Display */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Current Token</CardTitle>
            <CardDescription>Now consulting</CardDescription>
          </CardHeader>
          <CardContent>
            {currentPatient ? (
              <div className="text-center space-y-4">
                <div className="text-7xl font-bold text-primary">
                  {currentPatient.tokenNumber}
                </div>
                <div className="space-y-2">
                  <p className="font-semibold text-lg">
                    {currentPatient.patient?.firstName} {currentPatient.patient?.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    MRN: {currentPatient.patient?.nrNumber}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {currentPatient.patient?.gender} •{' '}
                    {calculateAge(currentPatient.patient?.dateOfBirth || '')} years
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => handleStartConsultation(currentPatient.id)}
                >
                  Continue Consultation
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No patient in consultation</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Call Next & Queue */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Patient Queue</CardTitle>
              <CardDescription>Waiting patients</CardDescription>
            </div>
            <Button
              size="lg"
              disabled={waitingPatients.length === 0 || callNextPatient.isPending}
              onClick={handleCallNext}
            >
              <Phone className="h-5 w-5 mr-2" />
              {callNextPatient.isPending ? 'Calling...' : 'Call Next Patient'}
            </Button>
          </CardHeader>
          <CardContent>
            {loadingQueue ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : waitingPatients.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <p className="text-muted-foreground">No patients waiting</p>
                <p className="text-sm text-muted-foreground">Queue is empty</p>
              </div>
            ) : (
              <div className="space-y-2">
                {waitingPatients.map((visit, index) => (
                  <div
                    key={visit.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      index === 0 ? 'bg-primary/5 border-primary' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`h-10 w-10 rounded-full flex items-center justify-center font-bold ${
                          index === 0
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {visit.tokenNumber}
                      </div>
                      <div>
                        <p className="font-medium">
                          {visit.patient?.firstName} {visit.patient?.lastName}
                          {index === 0 && (
                            <Badge className="ml-2" variant="default">
                              Next
                            </Badge>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          MRN: {visit.patient?.nrNumber} •{' '}
                          {visit.patient?.gender} •{' '}
                          {calculateAge(visit.patient?.dateOfBirth || '')}y
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={STATUS_COLORS[visit.status]}>
                        {visit.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTime(visit.registeredAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Completed Today */}
      {completedPatients.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Completed Today</CardTitle>
            <CardDescription>
              {completedPatients.length} consultations completed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {completedPatients.slice(0, 9).map((visit) => (
                <div
                  key={visit.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                >
                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-medium text-sm">
                    {visit.tokenNumber}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {visit.patient?.firstName} {visit.patient?.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Completed {formatTime(visit.completedAt || visit.updatedAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStartConsultation(visit.id)}
                  >
                    View
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
