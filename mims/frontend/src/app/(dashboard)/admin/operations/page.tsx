"use client";

import { useEffect, useMemo, useState } from "react";
import { useHospitalStore } from "@/stores/hospital.store";
import { useAuthStore } from "@/stores/auth.store";
import { useDepartments, type Department } from "@/hooks/use-departments";
import api from "@/lib/api";
import {
  useOperations,
  useCreateOperation,
  useUpdateOperationStatus,
  useRescheduleOperation,
  useTheatreAvailability,
  useOperationTheatres,
  useCreateOperationTheatre,
  type OperationStatus,
  type CreateOperationInput,
  type CreateOperationTheatreInput,
} from "@/hooks/use-operations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Plus, CalendarClock, ClipboardList } from "lucide-react";
import { formatMRN } from '@/lib/mrn';

const STATUS_OPTIONS: OperationStatus[] = [
  "SCHEDULED",
  "PRE_OP",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "POSTPONED",
];

const formatCnic = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 13);
  const part1 = digits.slice(0, 5);
  const part2 = digits.slice(5, 12);
  const part3 = digits.slice(12, 13);
  if (digits.length <= 5) return part1;
  if (digits.length <= 12) return `${part1}-${part2}`;
  return `${part1}-${part2}-${part3}`;
};

export default function OperationsPage() {
  const { selectedHospital } = useHospitalStore();
  const { user } = useAuthStore();
  const hospitalId = selectedHospital?.id || user?.hospitalId || "";
  const { token } = useAuthStore();

  const [statusFilter, setStatusFilter] = useState<OperationStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isTheatreOpen, setIsTheatreOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<any | null>(null);
  const [patientCnic, setPatientCnic] = useState("");
  const [patientResult, setPatientResult] = useState<{
    id: string;
    fullName: string;
    nrNumber: string;
    mobile?: string;
    gender?: string;
    visitType?: string;
    departmentInfo?: { id: string; name: string; code: string } | null;
    roomInfo?: { id: string; roomNumber: string; roomType: string } | null;
    bedInfo?: { id: string; bedNumber: string; bedType: string } | null;
    admissionInfo?: { id: string; admissionNumber: string; admittedAt: string } | null;
  } | null>(null);
  const [patientSearchError, setPatientSearchError] = useState<string | null>(null);
  const [isSearchingPatient, setIsSearchingPatient] = useState(false);
  const [patientDepartment, setPatientDepartment] = useState<{ id: string; name: string; code: string } | null>(null);
  const [roomInfo, setRoomInfo] = useState<{ id: string; roomNumber: string; roomType: string } | null>(null);
  const [bedInfo, setBedInfo] = useState<{ id: string; bedNumber: string; bedType: string } | null>(null);
  const [availabilityDate, setAvailabilityDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [availabilityTheatreId, setAvailabilityTheatreId] = useState<string>("");
  const [statusForm, setStatusForm] = useState<{ status: OperationStatus; postOpNotes: string; recoveryNotes: string; followUpAt: string }>(
    { status: "SCHEDULED", postOpNotes: "", recoveryNotes: "", followUpAt: "" },
  );
  const [rescheduleForm, setRescheduleForm] = useState<{ scheduledAt: string; theatreId: string; estimatedDurationMinutes: number }>(
    { scheduledAt: "", theatreId: "", estimatedDurationMinutes: 60 },
  );
  const [doctors, setDoctors] = useState<Array<{ id: string; fullName: string; departmentId?: string | null }>>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  const { data: departments } = useDepartments({ hospitalId, isActive: true });
  const { data: operationsResponse, isLoading } = useOperations(hospitalId, {
    status: statusFilter === "all" ? undefined : statusFilter,
  });
  const { data: theatresResponse } = useOperationTheatres(hospitalId, { status: "ACTIVE" });

  const createOperation = useCreateOperation();
  const updateStatus = useUpdateOperationStatus();
  const rescheduleOperation = useRescheduleOperation();
  const createTheatre = useCreateOperationTheatre();

  const operations = operationsResponse?.data || [];
  const theatres = theatresResponse?.data || [];
  const departmentOptions = Array.isArray(departments)
    ? departments
    : (departments?.data || departments?.departments || []);
  const availabilityTheatre = theatres.find((theatre) => theatre.id === availabilityTheatreId);
  const { data: availabilityResponse } = useTheatreAvailability(
    availabilityTheatreId || "",
    availabilityDate,
  );
  const availabilityOperations = availabilityResponse?.operations || [];

  const formatPrice = (value?: number | string | null) => {
    if (value === null || value === undefined || value === "") return "-";
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return "-";
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      maximumFractionDigits: 0,
    }).format(numeric);
  };

  const [operationForm, setOperationForm] = useState<CreateOperationInput>({
    hospitalId,
    patientId: "",
    patientType: "OPD",
    visitId: "",
    admissionId: "",
    departmentId: "",
    operationType: "",
    surgeonId: "",
    theatreId: "",
    scheduledAt: "",
    estimatedDurationMinutes: 60,
    emergencyFlag: false,
    operationPrice: undefined,
    notes: "",
    preOpNotes: "",
  });

  const filteredDoctors = operationForm.departmentId
    ? doctors.filter((doctor) => doctor.departmentId === operationForm.departmentId)
    : doctors;

  const [theatreForm, setTheatreForm] = useState<CreateOperationTheatreInput>({
    hospitalId,
    name: "",
    code: "",
    departmentId: "",
    location: "",
    status: "ACTIVE",
    notes: "",
  });

  const generateTheatreCode = () => {
    const now = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
      now.getDate(),
    ).padStart(2, "0")}`;
    const random = Math.floor(1000 + Math.random() * 9000);
    return `OT-${date}-${random}`;
  };

  useEffect(() => {
    if (isTheatreOpen && !theatreForm.code) {
      setTheatreForm((prev) => ({
        ...prev,
        hospitalId,
        code: generateTheatreCode(),
      }));
    }
  }, [isTheatreOpen, theatreForm.code, hospitalId]);

  useEffect(() => {
    const fetchDoctors = async () => {
      if (!hospitalId) {
        setDoctors([]);
        return;
      }
      setLoadingDoctors(true);
      try {
        const response = await api.get(`/hospitals/${hospitalId}/users`, {
          params: { role: "DOCTOR" },
        });
        setDoctors(response.data || []);
      } catch (error) {
        setDoctors([]);
      } finally {
        setLoadingDoctors(false);
      }
    };

    fetchDoctors();
  }, [hospitalId]);

  const filteredOperations = useMemo(() => {
    if (!searchQuery) return operations;
    const query = searchQuery.toLowerCase();
    return operations.filter((operation) => {
      return (
        operation.operationType.toLowerCase().includes(query) ||
        operation.patient?.fullName?.toLowerCase().includes(query) ||
        operation.theatre?.name?.toLowerCase().includes(query) ||
        operation.surgeon?.fullName?.toLowerCase().includes(query)
      );
    });
  }, [operations, searchQuery]);

  const selectedDepartmentTheatres = useMemo(() => {
    if (!operationForm.departmentId) return [];
    return theatres.filter((theatre) => theatre.departmentId === operationForm.departmentId);
  }, [theatres, operationForm.departmentId]);

  const handleCreateOperation = async () => {
    console.log("Creating operation with form data:", operationForm);
    // if (!hospitalId || !operationForm.patientId || !operationForm.departmentId || !operationForm.operationType || !operationForm.surgeonId || !operationForm.scheduledAt) {
    //   return;
    // }

    // if (selectedDepartmentTheatres.length > 0 && !operationForm.theatreId) {
    //   return;
    // }

    const payload: CreateOperationInput = {
      ...operationForm,
      hospitalId,
      scheduledAt: new Date(operationForm.scheduledAt).toISOString(),
      visitId: operationForm.patientType === "OPD" ? operationForm.visitId || undefined : undefined,
      admissionId: operationForm.patientType === "IN_HOUSE" ? operationForm.admissionId || undefined : undefined,
      operationPrice: operationForm.operationPrice ? Number(operationForm.operationPrice) : undefined,
    };

    await createOperation.mutateAsync(payload);
    setIsCreateOpen(false);
  };

  const handleFindPatientByCnic = async () => {
    if (!patientCnic || !hospitalId || !token) return;
    setIsSearchingPatient(true);
    setPatientSearchError(null);
    setRoomInfo(null);
    setBedInfo(null);
    setPatientDepartment(null);

    try {
      const { data: result } = await api.get(`/patients`, {
        params: { hospitalId, cnic: patientCnic, limit: "1" },
      });
      const patient = result?.data?.[0] || result?.patients?.[0] || result?.[0];

      if (!patient) {
        setPatientResult(null);
        setOperationForm((prev) => ({ ...prev, patientId: "" }));
        setPatientSearchError("No patient found with this CNIC.");
        return;
      }

      setPatientResult({
        id: patient.id,
        fullName: patient.fullName,
        nrNumber: patient.nrNumber,
        mobile: patient.mobile,
        gender: patient.gender,
        visitType: patient.visitType,
        departmentInfo: patient.departmentInfo || null,
        roomInfo: patient.roomInfo || null,
        bedInfo: patient.bedInfo || null,
        admissionInfo: patient.admissionInfo || null,
      });

      const derivedDepartment = patient.departmentInfo || null;
      setPatientDepartment(derivedDepartment);
      setRoomInfo(patient.roomInfo || null);
      setBedInfo(patient.bedInfo || null);

      setOperationForm((prev) => ({
        ...prev,
        patientId: patient.id,
        patientType: patient.visitType === "WARD_INDOOR" ? "IN_HOUSE" : "OPD",
        departmentId: derivedDepartment?.id || prev.departmentId,
        admissionId: patient.visitType === "WARD_INDOOR" ? patient.admissionInfo?.id || prev.admissionId : "",
      }));

      if (patient.visitType !== "WARD_INDOOR") {
        setRoomInfo(null);
        setBedInfo(null);
      }

      if (patient.visitType === "WARD_INDOOR" && (!patient.roomInfo || !patient.bedInfo || !patient.admissionInfo)) {
        try {
          const { data: admissionResult } = await api.get(`/admissions`, {
            params: { hospitalId, patientId: patient.id, status: "ADMITTED", limit: "1" },
          });
          const admission = admissionResult?.data?.[0];
          if (admission) {
            setRoomInfo(admission.room || null);
            setBedInfo(admission.bed || null);
            if (admission.department) {
              setPatientDepartment(admission.department);
              setOperationForm((prev) => ({
                ...prev,
                departmentId: admission.department.id || prev.departmentId,
                admissionId: admission.id,
              }));
            } else {
              setOperationForm((prev) => ({
                ...prev,
                admissionId: admission.id,
              }));
            }
          }
        } catch {
          /* admission lookup is best-effort */
        }
      }

      if (patient.visitType !== "WARD_INDOOR") {
        try {
          const { data: visitResult } = await api.get(`/visits/patient/${patient.id}`, {
            params: { limit: 1 },
          });
          const latestVisit = Array.isArray(visitResult) ? visitResult[0] : visitResult?.data?.[0];
          if (latestVisit?.id) {
            setOperationForm((prev) => ({
              ...prev,
              visitId: latestVisit.id,
              departmentId: prev.departmentId || latestVisit?.clinic?.department?.id || prev.departmentId,
            }));
          }
        } catch {
          /* visit lookup is best-effort */
        }
      }
    } catch (error) {
      setPatientSearchError("Failed to fetch patient.");
    } finally {
      setIsSearchingPatient(false);
    }
  };

  const handleCreateTheatre = async () => {
    if (!hospitalId || !theatreForm.name || !theatreForm.code) return;

    await createTheatre.mutateAsync({
      ...theatreForm,
      hospitalId,
      departmentId: theatreForm.departmentId || undefined,
    });

    setIsTheatreOpen(false);
  };

  const handleOpenStatus = (operation: any) => {
    setSelectedOperation(operation);
    setStatusForm({
      status: operation.status,
      postOpNotes: operation.postOpNotes || "",
      recoveryNotes: operation.recoveryNotes || "",
      followUpAt: operation.followUpAt ? operation.followUpAt.slice(0, 16) : "",
    });
    setIsStatusOpen(true);
  };

  const handleSubmitStatus = async () => {
    if (!selectedOperation) return;
    await updateStatus.mutateAsync({
      id: selectedOperation.id,
      data: {
        status: statusForm.status,
        postOpNotes: statusForm.postOpNotes || undefined,
        recoveryNotes: statusForm.recoveryNotes || undefined,
        followUpAt: statusForm.followUpAt ? new Date(statusForm.followUpAt).toISOString() : undefined,
      },
    });
    setIsStatusOpen(false);
  };

  const handleOpenReschedule = (operation: any) => {
    setSelectedOperation(operation);
    setRescheduleForm({
      scheduledAt: operation.scheduledAt ? operation.scheduledAt.slice(0, 16) : "",
      theatreId: operation.theatreId || "",
      estimatedDurationMinutes: operation.estimatedDurationMinutes || 60,
    });
    setIsRescheduleOpen(true);
  };

  const handleSubmitReschedule = async () => {
    if (!selectedOperation || !rescheduleForm.scheduledAt) return;
    await rescheduleOperation.mutateAsync({
      id: selectedOperation.id,
      data: {
        scheduledAt: new Date(rescheduleForm.scheduledAt).toISOString(),
        theatreId: rescheduleForm.theatreId || undefined,
        estimatedDurationMinutes: rescheduleForm.estimatedDurationMinutes || undefined,
      },
    });
    setIsRescheduleOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Surgery & Operation Management</h1>
          <p className="text-sm text-gray-500">Schedule operations, manage theatres, and track surgery status.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsTheatreOpen(true)}>
            <ClipboardList className="mr-2 h-4 w-4" />
            Add Theatre
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Schedule Operation
          </Button>
        </div>
      </div>

      <Tabs defaultValue="operations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="theatres">Theatres</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
        </TabsList>

        <TabsContent value="operations">
          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle>Scheduled Operations</CardTitle>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <Input
                  placeholder="Search operations"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="md:w-64"
                />
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as OperationStatus | "all")}> 
                  <SelectTrigger className="md:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>{status.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operation</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Theatre</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">Loading...</TableCell>
                    </TableRow>
                  ) : filteredOperations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-500">No operations found.</TableCell>
                    </TableRow>
                  ) : (
                    filteredOperations.map((operation) => (
                      <TableRow key={operation.id}>
                        <TableCell className="font-medium">{operation.operationType}</TableCell>
                        <TableCell>{operation.patient?.fullName || operation.patientId}</TableCell>
                        <TableCell>{operation.theatre?.name || operation.theatreId}</TableCell>
                        <TableCell>{new Date(operation.scheduledAt).toLocaleString()}</TableCell>
                        <TableCell>
                          {formatPrice(
                            operation.totalCharges ?? operation.estimatedCost ?? operation.price,
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{operation.status.replace("_", " ")}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {operation.status !== "COMPLETED" && operation.status !== "CANCELLED" && (
                              <Button size="sm" variant="outline" onClick={() => handleOpenStatus(operation)}>
                                Update
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => handleOpenReschedule(operation)}>
                              Reschedule
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="theatres">
          <Card>
            <CardHeader>
              <CardTitle>Operation Theatres</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {theatres.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-500">No theatres added yet.</TableCell>
                    </TableRow>
                  ) : (
                    theatres.map((theatre) => (
                      <TableRow key={theatre.id}>
                        <TableCell className="font-medium">{theatre.name}</TableCell>
                        <TableCell>{theatre.code}</TableCell>
                        <TableCell>{theatre.department?.name || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{theatre.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="availability">
          <Card>
            <CardHeader>
              <CardTitle>Theatre Availability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Theatre</Label>
                  <Select value={availabilityTheatreId} onValueChange={setAvailabilityTheatreId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select theatre" />
                    </SelectTrigger>
                    <SelectContent>
                      {theatres.map((theatre) => (
                        <SelectItem key={theatre.id} value={theatre.id}>
                          {theatre.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <DateInput value={availabilityDate} onChange={setAvailabilityDate} />
                </div>
              </div>

              {!availabilityTheatreId ? (
                <div className="text-sm text-muted-foreground">Select a theatre to view availability.</div>
              ) : availabilityOperations.length === 0 ? (
                <div className="text-sm text-muted-foreground">No scheduled operations for {availabilityTheatre?.name}.</div>
              ) : (
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2">Operation</th>
                        <th className="text-left p-2">Patient</th>
                        <th className="text-left p-2">Scheduled</th>
                        <th className="text-left p-2">Duration</th>
                        <th className="text-left p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availabilityOperations.map((operation) => (
                        <tr key={operation.id} className="border-t">
                          <td className="p-2 font-medium">{operation.operationType}</td>
                          <td className="p-2">{operation.patient?.fullName || operation.patientId}</td>
                          <td className="p-2">{new Date(operation.scheduledAt).toLocaleString()}</td>
                          <td className="p-2">{operation.estimatedDurationMinutes || 60} mins</td>
                          <td className="p-2">
                            <Badge variant="outline">{operation.status.replace("_", " ")}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Schedule Operation</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Patient CNIC</Label>
              <div className="flex gap-2">
                <Input
                  value={patientCnic}
                  onChange={(event) => setPatientCnic(formatCnic(event.target.value))}
                  placeholder="Enter CNIC"
                  inputMode="numeric"
                />
                <Button type="button" variant="outline" onClick={handleFindPatientByCnic} disabled={isSearchingPatient}>
                  {isSearchingPatient ? "Searching..." : "Find"}
                </Button>
              </div>
              {patientSearchError && <p className="text-xs text-red-500">{patientSearchError}</p>}
              {patientResult && (
                <div className="rounded-md border border-border bg-muted/30 p-2 text-xs text-gray-600">
                  <div className="font-medium text-gray-800">{patientResult.fullName}</div>
                  <div>NR#: {formatMRN(patientResult.nrNumber)} · {patientResult.gender || "-"}</div>
                  <div>Mobile: {patientResult.mobile || "-"}</div>
                </div>
              )}
            </div>
            {patientResult && (
              <div className="space-y-2">
                <Label>Patient Visit Type</Label>
                <Input value={patientResult.visitType || "-"} readOnly />
              </div>
            )}
            {patientDepartment && (
              <div className="space-y-2">
                <Label>Patient Department</Label>
                <Input value={`${patientDepartment.name} (${patientDepartment.code})`} readOnly />
              </div>
            )}
            {operationForm.patientType === "IN_HOUSE" && (
              <div className="space-y-2">
                <Label>Room</Label>
                <Input value={roomInfo ? `${roomInfo.roomNumber} (${roomInfo.roomType})` : "Not assigned"} readOnly />
              </div>
            )}
            {operationForm.patientType === "IN_HOUSE" && (
              <div className="space-y-2">
                <Label>Bed</Label>
                <Input value={bedInfo ? `${bedInfo.bedNumber} (${bedInfo.bedType})` : "Not assigned"} readOnly />
              </div>
            )}
            {operationForm.patientType === "OPD" && (
              <div className="space-y-2">
                <Label>Visit ID</Label>
                <Input value={operationForm.visitId || ""} onChange={(event) => setOperationForm({ ...operationForm, visitId: event.target.value })} />
              </div>
            )}
            {operationForm.patientType === "IN_HOUSE" && (
              <div className="space-y-2">
                <Label>Admission ID</Label>
                <Input value={operationForm.admissionId || ""} onChange={(event) => setOperationForm({ ...operationForm, admissionId: event.target.value })} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={operationForm.departmentId}
                onValueChange={(value) => setOperationForm({ ...operationForm, departmentId: value, theatreId: "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departmentOptions.map((dept: Department) => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Operation Type</Label>
              <Input value={operationForm.operationType} onChange={(event) => setOperationForm({ ...operationForm, operationType: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Surgeon</Label>
              <Select
                value={operationForm.surgeonId}
                onValueChange={(value) => setOperationForm({ ...operationForm, surgeonId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingDoctors ? "Loading doctors..." : "Select surgeon"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredDoctors.length === 0 ? (
                    <div className="px-2 py-2 text-sm text-muted-foreground">No doctors available</div>
                  ) : (
                    filteredDoctors.map((doctor) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.fullName}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {selectedDepartmentTheatres.length > 0 ? (
              <div className="space-y-2">
                <Label>Theatre</Label>
                <Select
                  value={operationForm.theatreId}
                  onValueChange={(value) => setOperationForm({ ...operationForm, theatreId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select theatre" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedDepartmentTheatres.map((theatre) => (
                      <SelectItem key={theatre.id} value={theatre.id}>{theatre.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Theatre</Label>
                <div className="rounded-md border border-dashed border-border p-3 text-xs text-gray-500">
                  No theatre configured for this department.
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Scheduled Date/Time</Label>
              <div className="relative">
                <CalendarClock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  type="datetime-local"
                  className="pl-10"
                  value={operationForm.scheduledAt}
                  onChange={(event) => setOperationForm({ ...operationForm, scheduledAt: event.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Estimated Duration (minutes)</Label>
              <Input
                type="number"
                value={operationForm.estimatedDurationMinutes || 60}
                onChange={(event) => setOperationForm({ ...operationForm, estimatedDurationMinutes: Number(event.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Operation Price (PKR)</Label>
              <Input
                type="number"
                min={0}
                value={operationForm.operationPrice ?? ""}
                onChange={(event) =>
                  setOperationForm({
                    ...operationForm,
                    operationPrice: event.target.value === "" ? undefined : Number(event.target.value),
                  })
                }
                placeholder="Enter price"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={operationForm.emergencyFlag || false}
                onCheckedChange={(checked) => setOperationForm({ ...operationForm, emergencyFlag: checked })}
              />
              <Label>Emergency</Label>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={operationForm.notes || ""}
                onChange={(event) => setOperationForm({ ...operationForm, notes: event.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Pre-Op Notes</Label>
              <Textarea
                value={operationForm.preOpNotes || ""}
                onChange={(event) => setOperationForm({ ...operationForm, preOpNotes: event.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateOperation} disabled={createOperation.isPending}>
              {createOperation.isPending ? "Scheduling..." : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTheatreOpen} onOpenChange={setIsTheatreOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add Operation Theatre</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={theatreForm.name} onChange={(event) => setTheatreForm({ ...theatreForm, name: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Code (Auto-generated)</Label>
              <Input value={theatreForm.code} readOnly className="bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={theatreForm.departmentId || "none"}
                onValueChange={(value) => setTheatreForm({ ...theatreForm, departmentId: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Department</SelectItem>
                  {departmentOptions.map((dept: Department) => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={theatreForm.status || "ACTIVE"}
                onValueChange={(value) => setTheatreForm({ ...theatreForm, status: value as CreateOperationTheatreInput["status"] })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="MAINTENANCE">MAINTENANCE</SelectItem>
                  <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTheatreOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTheatre} disabled={createTheatre.isPending}>
              {createTheatre.isPending ? "Saving..." : "Add Theatre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isStatusOpen} onOpenChange={setIsStatusOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Update Operation Status</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusForm.status} onValueChange={(value) => setStatusForm({ ...statusForm, status: value as OperationStatus })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>{status.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Post-Op Notes</Label>
              <Textarea value={statusForm.postOpNotes} onChange={(event) => setStatusForm({ ...statusForm, postOpNotes: event.target.value })} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Recovery Notes</Label>
              <Textarea value={statusForm.recoveryNotes} onChange={(event) => setStatusForm({ ...statusForm, recoveryNotes: event.target.value })} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Follow-up Date</Label>
              <Input type="datetime-local" value={statusForm.followUpAt} onChange={(event) => setStatusForm({ ...statusForm, followUpAt: event.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStatusOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitStatus} disabled={updateStatus.isPending}>
              {updateStatus.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRescheduleOpen} onOpenChange={setIsRescheduleOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reschedule Operation</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Scheduled Date/Time</Label>
              <Input
                type="datetime-local"
                value={rescheduleForm.scheduledAt}
                onChange={(event) => setRescheduleForm({ ...rescheduleForm, scheduledAt: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Theatre</Label>
              <Select
                value={rescheduleForm.theatreId}
                onValueChange={(value) => setRescheduleForm({ ...rescheduleForm, theatreId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select theatre" />
                </SelectTrigger>
                <SelectContent>
                  {theatres.map((theatre) => (
                    <SelectItem key={theatre.id} value={theatre.id}>{theatre.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estimated Duration (minutes)</Label>
              <Input
                type="number"
                value={rescheduleForm.estimatedDurationMinutes}
                onChange={(event) => setRescheduleForm({ ...rescheduleForm, estimatedDurationMinutes: Number(event.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRescheduleOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitReschedule} disabled={rescheduleOperation.isPending}>
              {rescheduleOperation.isPending ? "Rescheduling..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
