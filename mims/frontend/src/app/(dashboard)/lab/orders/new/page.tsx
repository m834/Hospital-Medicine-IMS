"use client";

import { useState } from "react";
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
import { Search, Plus, Trash2, FileText } from "lucide-react";
import type { LabTest } from "@/hooks/use-lab-tests";

interface SelectedTest {
  test: LabTest;
  priority: "ROUTINE" | "URGENT" | "STAT";
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

  const { data: labTests } = useLabTests(selectedHospital?.id || "", {
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
      for (const selectedTest of selectedTests) {
        await createOrderMutation.mutateAsync({
          hospitalId: selectedHospital?.id || user?.hospitalId || "",
          patientId: patientNrNumber,
          labTestId: selectedTest.test.id,
          orderedById: user.id,
          priority: selectedTest.priority,
          clinicalNotes,
        });
      }
      router.push("/lab");
    } catch (error) {
      console.error("Failed to create orders:", error);
    }
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
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="patientNr">Patient NR Number</Label>
                <Input
                  id="patientNr"
                  placeholder="e.g., NR-2024-001"
                  value={patientNrNumber}
                  onChange={(e) => setPatientNrNumber(e.target.value)}
                />
              </div>
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
                  disabled={selectedTests.length === 0 || !patientNrNumber}
                  className="w-full"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Create Order & Generate Receipt
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
