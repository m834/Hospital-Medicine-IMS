"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLabTests } from "@/hooks/use-lab-tests";
import { useLabOrders, useCreateLabOrder } from "@/hooks/use-lab-orders";
import { useHospitalStore } from "@/stores/hospital.store";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Plus, Trash2, FileText, Printer, CheckCircle2, UserCheck, Loader2, X } from "lucide-react";
import api from "@/lib/api";
import { printLabReceipt } from "@/lib/print-receipt";
import type { LabTest } from "@/hooks/use-lab-tests";
import type { LabOrder } from "@/hooks/use-lab-orders";
import { formatMRN } from '@/lib/mrn';

interface Patient {
  id: string;
  nrNumber: string;
  fullName: string;
  gender?: string;
  dob?: string;
  mobile?: string;
  cnic?: string;
  bloodGroup?: string;
}

interface SelectedTest {
  test: LabTest;
  priority: "ROUTINE" | "URGENT" | "STAT";
}

function LabSlip({
  orders,
  patientId,
  hospitalName,
  orderedByName,
  clinicalNotes,
}: {
  orders: LabOrder[];
  patientId: string;
  hospitalName: string;
  orderedByName: string;
  clinicalNotes: string;
}) {
  const now = new Date();
  const totalAmount = orders.reduce((sum, o) => sum + Number(o.labTest?.price || 0), 0);
  const patient = orders[0]?.patient;

  return (
    <div className="font-sans text-sm text-black p-6 max-w-[600px] mx-auto">
      {/* Header */}
      <div className="text-center border-b-2 border-black pb-3 mb-4">
        <h1 className="text-xl font-bold uppercase">{hospitalName}</h1>
        <h2 className="text-base font-semibold mt-1">Laboratory Investigation Request</h2>
        <p className="text-xs mt-1">Date: {now.toLocaleDateString()} &nbsp;|&nbsp; Time: {now.toLocaleTimeString()}</p>
      </div>

      {/* Patient Info */}
      <div className="grid grid-cols-2 gap-2 border border-gray-400 rounded p-3 mb-4 text-xs">
        <div><span className="font-semibold">Patient MRN:</span> {formatMRN(patient?.nrNumber) || patientId}</div>
        <div><span className="font-semibold">Patient Name:</span> {patient?.fullName || "—"}</div>
        <div><span className="font-semibold">Gender:</span> {patient?.gender || "—"}</div>
        <div><span className="font-semibold">Mobile:</span> {patient?.mobile || "—"}</div>
        <div><span className="font-semibold">Referred By:</span> {orderedByName}</div>
        <div><span className="font-semibold">Order Numbers:</span> {orders.map(o => o.orderNumber).join(", ")}</div>
      </div>

      {/* Tests */}
      <table className="w-full border-collapse mb-4 text-xs">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-400 px-2 py-1 text-left">#</th>
            <th className="border border-gray-400 px-2 py-1 text-left">Test Code</th>
            <th className="border border-gray-400 px-2 py-1 text-left">Test Name</th>
            <th className="border border-gray-400 px-2 py-1 text-left">Category</th>
            <th className="border border-gray-400 px-2 py-1 text-left">Priority</th>
            <th className="border border-gray-400 px-2 py-1 text-right">Amount (Rs.)</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order, i) => (
            <tr key={order.id}>
              <td className="border border-gray-400 px-2 py-1">{i + 1}</td>
              <td className="border border-gray-400 px-2 py-1">{order.labTest?.testCode}</td>
              <td className="border border-gray-400 px-2 py-1 font-medium">{order.labTest?.testName}</td>
              <td className="border border-gray-400 px-2 py-1">{order.labTest?.testCategory}</td>
              <td className="border border-gray-400 px-2 py-1">
                <span className={`font-semibold ${order.priority === "STAT" ? "text-red-600" : order.priority === "URGENT" ? "text-orange-600" : "text-green-700"}`}>
                  {order.priority}
                </span>
              </td>
              <td className="border border-gray-400 px-2 py-1 text-right">{Number(order.labTest?.price || 0).toFixed(2)}</td>
            </tr>
          ))}
          <tr className="font-bold bg-gray-50">
            <td colSpan={5} className="border border-gray-400 px-2 py-1 text-right">Total:</td>
            <td className="border border-gray-400 px-2 py-1 text-right">Rs. {totalAmount.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      {clinicalNotes && (
        <div className="border border-gray-400 rounded p-2 mb-4 text-xs">
          <span className="font-semibold">Clinical Notes: </span>{clinicalNotes}
        </div>
      )}

      {/* Requirements */}
      {orders.some(o => o.labTest?.requirements) && (
        <div className="border border-gray-300 rounded p-2 mb-4 text-xs bg-yellow-50">
          <p className="font-semibold mb-1">Special Requirements:</p>
          {orders.filter(o => o.labTest?.requirements).map(o => (
            <p key={o.id}>• {o.labTest?.testName}: {o.labTest?.requirements}</p>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between mt-6 pt-4 border-t border-gray-400 text-xs">
        <div className="text-center">
          <div className="border-t border-black w-32 mt-8 mx-auto" />
          <p>Patient / Guardian Signature</p>
        </div>
        <div className="text-center">
          <div className="border-t border-black w-32 mt-8 mx-auto" />
          <p>Lab Technician</p>
        </div>
        <div className="text-center">
          <div className="border-t border-black w-32 mt-8 mx-auto" />
          <p>Authorized By</p>
        </div>
      </div>
      <p className="text-center text-xs text-gray-500 mt-3">— Please bring this slip when collecting your results —</p>
    </div>
  );
}

export default function NewLabOrderPageComponent() {
  const router = useRouter();
  const { selectedHospital } = useHospitalStore();
  const { user } = useAuthStore();
  const [patientNrNumber, setPatientNrNumber] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedTests, setSelectedTests] = useState<SelectedTest[]>([]);
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [isTestSelectorOpen, setIsTestSelectorOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [createdOrders, setCreatedOrders] = useState<LabOrder[]>([]);
  const [showSlip, setShowSlip] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Patient search
  const [patientSearchQuery, setPatientSearchQuery] = useState("");
  const [patientSearching, setPatientSearching] = useState(false);
  const [patientSearchError, setPatientSearchError] = useState("");
  const [foundPatient, setFoundPatient] = useState<Patient | null>(null);
  const [searchType, setSearchType] = useState<"mrn" | "cnic">("mrn");

  // CNIC formatter: turns raw digits into 12345-1234567-1 format
  const formatCnic = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 13);
    if (digits.length <= 5) return digits;
    if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
  };

  const handleSearchQueryChange = (val: string) => {
    if (searchType === "cnic") {
      setPatientSearchQuery(formatCnic(val));
    } else {
      setPatientSearchQuery(val);
    }
  };

  const handleSearchTypeChange = (type: "mrn" | "cnic") => {
    setSearchType(type);
    setPatientSearchQuery("");
    setPatientSearchError("");
  };

  const handlePatientSearch = async () => {
    const q = patientSearchQuery.trim();
    if (!q) return;
    setPatientSearching(true);
    setPatientSearchError("");
    setFoundPatient(null);
    try {
      // Always use the logged-in user's hospitalId — never selectedHospital
      const hospitalId = user?.hospitalId || "";
      if (!hospitalId) {
        setPatientSearchError("No hospital assigned to your account.");
        return;
      }
      let patient: Patient | null = null;

      if (searchType === "mrn") {
        try {
          const res = await api.get(`/patients/nr/${encodeURIComponent(q)}`, { params: { hospitalId } });
          patient = res.data;
        } catch {
          const res = await api.get("/patients", { params: { hospitalId, search: q, limit: 5 } });
          const list: Patient[] = res.data?.data || [];
          patient = list[0] || null;
        }
      } else {
        const cnicRaw = q.replace(/\D/g, "");
        let list: Patient[] = [];

        // Attempt 1: cnic param with formatted value
        try {
          const res1 = await api.get("/patients", { params: { hospitalId, cnic: q, limit: 5 } });
          list = res1.data?.data || [];
        } catch { /* ignore */ }

        // Attempt 2: search param with formatted cnic
        if (!list.length) {
          try {
            const res2 = await api.get("/patients", { params: { hospitalId, search: q, limit: 5 } });
            list = res2.data?.data || [];
          } catch { /* ignore */ }
        }

        // Attempt 3: search with raw digits
        if (!list.length && cnicRaw.length >= 5) {
          try {
            const res3 = await api.get("/patients", { params: { hospitalId, search: cnicRaw, limit: 5 } });
            list = res3.data?.data || [];
          } catch { /* ignore */ }
        }

        patient = list[0] || null;
      }

      if (patient) {
        setFoundPatient(patient);
        setPatientNrNumber(patient.nrNumber);
      } else {
        setPatientSearchError(`No patient found with this ${searchType === "mrn" ? "MRN" : "CNIC"}.`);
      }
    } catch (err) {
      console.error("[Patient search error]", err);
      setPatientSearchError("Search failed. Please try again.");
    } finally {
      setPatientSearching(false);
    }
  };

  const handleClearPatient = () => {
    setFoundPatient(null);
    setPatientNrNumber("");
    setPatientSearchQuery("");
    setPatientSearchError("");
  };

  // Same rule as the patient lookup above: the logged-in user's hospital wins,
  // and only a SUPER_ADMIN falls back to the header selector.
  const { data: labTests } = useLabTests(user?.hospitalId || selectedHospital?.id || "", {
    status: "ACTIVE",
    testCategory: selectedCategory === "all" ? undefined : selectedCategory,
  });

  const createOrderMutation = useCreateLabOrder();

  const categories = Array.from(
    new Set(labTests?.map((test) => test.testCategory).filter(Boolean) || [])
  );

  const filteredTests = labTests?.filter((test) =>
    test.testName.toLowerCase().includes(patientSearch.toLowerCase()) ||
    test.testCode.toLowerCase().includes(patientSearch.toLowerCase())
  );

  const totalPrice = selectedTests.reduce((sum, st) => sum + Number(st.test.price), 0);

  const handleAddTest = (test: LabTest, priority: "ROUTINE" | "URGENT" | "STAT" = "ROUTINE") => {
    if (!selectedTests.find((st) => st.test.id === test.id)) {
      setSelectedTests([...selectedTests, { test, priority }]);
    }
    setPatientSearch("");
  };

  const handleRemoveTest = (testId: string) => {
    setSelectedTests(selectedTests.filter((st) => st.test.id !== testId));
  };

  const handleUpdatePriority = (testId: string, priority: "ROUTINE" | "URGENT" | "STAT") => {
    setSelectedTests(
      selectedTests.map((st) =>
        st.test.id === testId ? { ...st, priority } : st
      )
    );
  };

  const handleSubmit = async () => {
    if (!patientNrNumber || selectedTests.length === 0 || !user) {
      alert("Please enter patient NR number and select at least one test");
      return;
    }

    try {
      const results: LabOrder[] = [];
      // Prefer the resolved UUID; fall back to nrNumber (service will resolve it)
      const resolvedPatientId = foundPatient?.id || patientNrNumber;
      for (const selectedTest of selectedTests) {
        const order = await createOrderMutation.mutateAsync({
          hospitalId: user?.hospitalId || selectedHospital?.id || "",
          patientId: resolvedPatientId,
          labTestId: selectedTest.test.id,
          orderedById: user.id,
          priority: selectedTest.priority,
          clinicalNotes,
        });
        results.push(order as LabOrder);
      }
      setCreatedOrders(results);
      setShowSlip(true);
    } catch (error) {
      console.error("Failed to create orders:", error);
    }
  };

  const handlePrint = () => {
    if (createdOrders.length === 0) return;
    printLabReceipt(createdOrders, {
      patientId: patientNrNumber,
      hospitalName: selectedHospital?.name || user?.hospitalId || "Hospital",
      printedBy: user?.fullName || user?.email || "Staff",
      clinicalNotes,
    });
  };

  const handleNewOrder = () => {
    setCreatedOrders([]);
    setShowSlip(false);
    setPatientNrNumber("");
    setSelectedTests([]);
    setClinicalNotes("");
    setFoundPatient(null);
    setPatientSearchQuery("");
    setPatientSearchError("");
    setSearchType("mrn");
  };

  if (!selectedHospital && !user?.hospitalId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">No hospital available</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── SUCCESS: show printable slip ──────────────────────────────────────────
  if (showSlip && createdOrders.length > 0) {
    return (
      <div className="space-y-4 p-6 max-w-3xl mx-auto">
        {/* Success banner */}
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
          <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
          <div>
            <p className="font-semibold text-green-800">Lab order created successfully!</p>
            <p className="text-sm text-green-700">
              {createdOrders.length} test(s) ordered. Order numbers: {createdOrders.map(o => o.orderNumber).join(", ")}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button onClick={handlePrint} className="flex-1" size="lg">
            <Printer className="mr-2 h-5 w-5" />
            Print Lab Slip
          </Button>
          <Button variant="outline" onClick={handleNewOrder} size="lg">
            <Plus className="mr-2 h-4 w-4" />
            New Order
          </Button>
          <Button variant="ghost" onClick={() => router.push("/lab")} size="lg">
            Go to Lab Dashboard
          </Button>
        </div>

        {/* Printable slip preview */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Lab Test Slip Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div ref={printRef} className="border rounded-b-lg overflow-hidden">
              <LabSlip
                orders={createdOrders}
                patientId={patientNrNumber}
                hospitalName={selectedHospital?.name || user?.hospitalId || "Hospital"}
                orderedByName={user?.fullName || user?.email || "Staff"}
                clinicalNotes={clinicalNotes}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Lab Order</h1>
        <p className="text-muted-foreground">Create a new lab order for a patient</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Patient and Order Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Patient Information */}
          <Card>
            <CardHeader>
              <CardTitle>Patient Information</CardTitle>
              <CardDescription>Search by MRN or CNIC to load patient details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search Type Toggle */}
              {!foundPatient && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleSearchTypeChange("mrn")}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      searchType === "mrn"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-white text-muted-foreground border-gray-300 hover:border-primary"
                    }`}
                  >
                    Search by MRN
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSearchTypeChange("cnic")}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      searchType === "cnic"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-white text-muted-foreground border-gray-300 hover:border-primary"
                    }`}
                  >
                    Search by CNIC
                  </button>
                </div>
              )}

              {/* Search Row */}
              <div className="flex gap-2">
                <Input
                  placeholder={
                    searchType === "mrn"
                      ? "Enter MRN (e.g. 482913)"
                      : "Enter CNIC (e.g. 12345-1234567-1)"
                  }
                  value={patientSearchQuery}
                  onChange={(e) => handleSearchQueryChange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !foundPatient && handlePatientSearch()}
                  disabled={!!foundPatient}
                  maxLength={searchType === "cnic" ? 15 : undefined}
                />
                {foundPatient ? (
                  <Button variant="outline" size="icon" onClick={handleClearPatient} title="Clear patient">
                    <X className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={handlePatientSearch} disabled={patientSearching || !patientSearchQuery.trim()}>
                    {patientSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    <span className="ml-2">{patientSearching ? "Searching..." : "Search"}</span>
                  </Button>
                )}
              </div>

              {/* Error */}
              {patientSearchError && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <X className="h-3 w-3" /> {patientSearchError}
                </p>
              )}

              {/* Found Patient Card */}
              {foundPatient && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-5 w-5 text-green-600" />
                      <span className="font-semibold text-green-800">Patient Found</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleClearPatient} className="text-muted-foreground h-7">
                      <X className="h-3 w-3 mr-1" /> Change
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    <div><span className="text-muted-foreground">Full Name:</span> <span className="font-medium">{foundPatient.fullName}</span></div>
                    <div><span className="text-muted-foreground">MRN:</span> <span className="font-medium">{formatMRN(foundPatient.nrNumber)}</span></div>
                    {foundPatient.gender && <div><span className="text-muted-foreground">Gender:</span> {foundPatient.gender}</div>}
                    {foundPatient.dob && <div><span className="text-muted-foreground">DOB:</span> {new Date(foundPatient.dob).toLocaleDateString()}</div>}
                    {foundPatient.mobile && <div><span className="text-muted-foreground">Mobile:</span> {foundPatient.mobile}</div>}
                    {foundPatient.cnic && <div><span className="text-muted-foreground">CNIC:</span> {foundPatient.cnic}</div>}
                    {foundPatient.bloodGroup && <div><span className="text-muted-foreground">Blood Group:</span> <span className="font-semibold text-red-600">{foundPatient.bloodGroup}</span></div>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Test Selection */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Selected Tests</CardTitle>
                <CardDescription>
                  {selectedTests.length} test(s) selected
                </CardDescription>
              </div>
              <Button onClick={() => setIsTestSelectorOpen(true)} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Test
              </Button>
            </CardHeader>
            <CardContent>
              {selectedTests.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Test Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedTests.map((st) => (
                      <TableRow key={st.test.id}>
                        <TableCell className="font-medium">{st.test.testName}</TableCell>
                        <TableCell>{st.test.testCode}</TableCell>
                        <TableCell>Rs. {st.test.price}</TableCell>
                        <TableCell>
                          <Select
                            value={st.priority}
                            onValueChange={(value) =>
                              handleUpdatePriority(st.test.id, value as "ROUTINE" | "URGENT" | "STAT")
                            }
                          >
                            <SelectTrigger className="w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ROUTINE">Routine</SelectItem>
                              <SelectItem value="URGENT">Urgent</SelectItem>
                              <SelectItem value="STAT">STAT</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveTest(st.test.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-8 text-muted-foreground">No tests selected</p>
              )}
            </CardContent>
          </Card>

          {/* Clinical Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Clinical Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Enter any clinical notes or special instructions for the lab"
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                rows={4}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right: Summary and Actions */}
        <div className="space-y-6">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tests Selected:</span>
                  <span className="font-medium">{selectedTests.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Amount:</span>
                  <span className="font-medium">Rs. {totalPrice.toFixed(2)}</span>
                </div>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg space-y-2">
                <p className="text-sm font-medium">Priority Breakdown:</p>
                <div className="space-y-1 text-xs">
                  {selectedTests.length > 0 && (
                    <>
                      <p>
                        STAT:{" "}
                        <Badge variant="destructive">
                          {selectedTests.filter((st) => st.priority === "STAT").length}
                        </Badge>
                      </p>
                      <p>
                        URGENT:{" "}
                        <Badge variant="secondary">
                          {selectedTests.filter((st) => st.priority === "URGENT").length}
                        </Badge>
                      </p>
                      <p>
                        ROUTINE:{" "}
                        <Badge variant="outline">
                          {selectedTests.filter((st) => st.priority === "ROUTINE").length}
                        </Badge>
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  onClick={handleSubmit}
                  disabled={selectedTests.length === 0 || !patientNrNumber || createOrderMutation.isPending}
                  className="w-full"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {createOrderMutation.isPending ? "Creating..." : "Create Order & Print Slip"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.back()}
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Info</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2 text-muted-foreground">
              <p>✓ Order number auto-generated</p>
              <p>✓ Receipt created automatically</p>
              <p>✓ Lab queue will be updated</p>
              <p>✓ Patient notified</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Test Selector Dialog */}
      <Dialog open={isTestSelectorOpen} onOpenChange={setIsTestSelectorOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Lab Tests</DialogTitle>
            <DialogDescription>
              Choose tests to add to this order
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search and Filter */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tests..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div>
                <Label htmlFor="category" className="text-xs">
                  Category
                </Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat || "uncategorized"}>
                        {cat || "Uncategorized"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tests List */}
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {filteredTests && filteredTests.length > 0 ? (
                filteredTests.map((test) => (
                  <div
                    key={test.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{test.testName}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>{test.testCode}</span>
                        {test.testCategory && <span>•</span>}
                        {test.testCategory && <span>{test.testCategory}</span>}
                        <span>•</span>
                        <span>Rs. {test.price}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        handleAddTest(test);
                        setPatientSearch("");
                      }}
                      disabled={selectedTests.some((st) => st.test.id === test.id)}
                    >
                      {selectedTests.some((st) => st.test.id === test.id) ? "Added" : "Add"}
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-center py-8 text-muted-foreground">No tests found</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTestSelectorOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
