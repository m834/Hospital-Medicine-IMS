"use client";

import { useEffect, useMemo, useState } from "react";
import { useLabTests, useLabTestCategories, useCreateLabTest, useUpdateLabTest, useDeleteLabTest, useUpdateLabTestStatus } from "@/hooks/use-lab-tests";
import { useDepartments, type Department } from "@/hooks/use-departments";
import { useHospitalStore } from "@/stores/hospital.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Edit, Trash2, TestTube, DollarSign, Clock, FileText } from "lucide-react";
import type { LabTest, CreateLabTestInput } from "@/hooks/use-lab-tests";
import { generateNextCode } from "@/lib/code";

const PREDEFINED_CATEGORIES = [
  "X-RAY",
  "MICROBIOLOGY",
  "CHEMICAL PATH",
  "CARDIAC",
  "HAEMATOLOGY",
  "HIST PATHOLOGY",
  "GENERAL LAB",
  "OTHER",
];

export default function LabTestsPage() {
  const { selectedHospital } = useHospitalStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("ACTIVE");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<LabTest | null>(null);
  const [categorySelection, setCategorySelection] = useState("");
  const [customCategory, setCustomCategory] = useState("");

  const { data: labTests, isLoading } = useLabTests(selectedHospital?.id || "", {
    status: selectedStatus === "all" ? undefined : selectedStatus,
    testCategory: selectedCategory === "all" ? undefined : selectedCategory,
  });

  const { data: categories } = useLabTestCategories(selectedHospital?.id || "");
  const { data: departments } = useDepartments({ hospitalId: selectedHospital?.id || "", isActive: true });
  const createMutation = useCreateLabTest();
  const updateMutation = useUpdateLabTest();
  const deleteMutation = useDeleteLabTest();
  const updateStatusMutation = useUpdateLabTestStatus();

  const nextTestCode = useMemo(
    () => generateNextCode(labTests?.map((test) => test.testCode) || [], "LAB"),
    [labTests]
  );

  const [formData, setFormData] = useState<CreateLabTestInput>({
    hospitalId: selectedHospital?.id || "",
    testCode: "",
    testName: "",
    testCategory: "",
    description: "",
    price: 0,
    turnaroundTime: "",
    requirements: "",
    departmentId: undefined,
    subDepartmentId: undefined,
  });

  const filteredTests = labTests?.filter((test) =>
    test.testName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    test.testCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    test.testCategory.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = async () => {
    if (!selectedHospital || !formData.testCode || !formData.testName || !formData.testCategory) {
      return;
    }

    await createMutation.mutateAsync({
      ...formData,
      hospitalId: selectedHospital.id,
    });

    setIsCreateDialogOpen(false);
    resetForm();
  };

  const handleEdit = async () => {
    if (!selectedTest) return;

    await updateMutation.mutateAsync({
      id: selectedTest.id,
      data: formData,
    });

    setIsEditDialogOpen(false);
    setSelectedTest(null);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this test?")) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleStatusChange = async (id: string, status: "ACTIVE" | "INACTIVE" | "DISCONTINUED") => {
    await updateStatusMutation.mutateAsync({ id, status });
  };

  const handleCategoryChange = (value: string) => {
    setCategorySelection(value);
    if (value !== "OTHER") {
      setCustomCategory("");
      setFormData((prev) => ({ ...prev, testCategory: value }));
    } else {
      setFormData((prev) => ({ ...prev, testCategory: "" }));
    }
  };

  const handleCustomCategoryChange = (value: string) => {
    setCustomCategory(value);
    setFormData((prev) => ({ ...prev, testCategory: value }));
  };

  const resetForm = () => {
    setCategorySelection("");
    setCustomCategory("");
    setFormData({
      hospitalId: selectedHospital?.id || "",
      testCode: nextTestCode,
      testName: "",
      testCategory: "",
      description: "",
      price: 0,
      turnaroundTime: "",
      requirements: "",
      departmentId: undefined,
      subDepartmentId: undefined,
    });
  };

  useEffect(() => {
    if (isCreateDialogOpen) {
      setFormData((prev) => ({
        ...prev,
        hospitalId: selectedHospital?.id || "",
        testCode: nextTestCode,
      }));
    }
  }, [isCreateDialogOpen, nextTestCode, selectedHospital?.id]);

  const openEditDialog = (test: LabTest) => {
    setSelectedTest(test);
    const isPredefined = PREDEFINED_CATEGORIES.filter((c) => c !== "OTHER").includes(test.testCategory);
    setCategorySelection(isPredefined ? test.testCategory : "OTHER");
    setCustomCategory(isPredefined ? "" : test.testCategory);
    setFormData({
      hospitalId: test.hospitalId,
      testCode: test.testCode,
      testName: test.testName,
      testCategory: test.testCategory,
      description: test.description || "",
      price: test.price,
      turnaroundTime: test.turnaroundTime || "",
      requirements: test.requirements || "",
      departmentId: test.departmentId,
      subDepartmentId: test.subDepartmentId,
    });
    setIsEditDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      ACTIVE: "default",
      INACTIVE: "secondary",
      DISCONTINUED: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  if (!selectedHospital) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Please select a hospital</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lab Tests Catalog</h1>
          <p className="text-muted-foreground">Manage laboratory test catalog and pricing</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add New Test
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{labTests?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Tests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {labTests?.filter((t) => t.status === "ACTIVE").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Departments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(labTests?.map((t) => t.departmentId).filter(Boolean)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tests by name, code, or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat.category} value={cat.category}>
                    {cat.category} ({cat.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="DISCONTINUED">Discontinued</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tests List */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading tests...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTests?.map((test) => (
            <Card key={test.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{test.testName}</CardTitle>
                    <CardDescription className="mt-1">
                      <span className="font-mono text-xs">{test.testCode}</span>
                    </CardDescription>
                  </div>
                  {getStatusBadge(test.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <TestTube className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Category:</span>
                  <Badge variant="outline">{test.testCategory}</Badge>
                </div>
                
                {test.department && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Dept:</span>
                    <span>{test.department.name}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Price:</span>
                  <span className="font-semibold">{test.price.toFixed(2)}</span>
                </div>

                {test.turnaroundTime && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">TAT:</span>
                    <span>{test.turnaroundTime}</span>
                  </div>
                )}

                {test._count && (
                  <div className="text-sm text-muted-foreground">
                    {test._count.labOrders} order(s)
                  </div>
                )}

                {test.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                    {test.description}
                  </p>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEditDialog(test)}
                  >
                    <Edit className="mr-2 h-3 w-3" />
                    Edit
                  </Button>
                  {test.status === "ACTIVE" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusChange(test.id, "INACTIVE")}
                    >
                      Deactivate
                    </Button>
                  )}
                  {test.status === "INACTIVE" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusChange(test.id, "ACTIVE")}
                    >
                      Activate
                    </Button>
                  )}
                  {test._count?.labOrders === 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(test.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Lab Test</DialogTitle>
            <DialogDescription>Create a new laboratory test in the catalog</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="testCode">Test Code (Auto-generated)</Label>
                <Input
                  id="testCode"
                  value={formData.testCode}
                  readOnly
                  placeholder="LAB-001"
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="testCategory">Category *</Label>
                <Select value={categorySelection} onValueChange={handleCategoryChange}>
                  <SelectTrigger id="testCategory">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {PREDEFINED_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {categorySelection === "OTHER" && (
                  <Input
                    value={customCategory}
                    onChange={(e) => handleCustomCategoryChange(e.target.value)}
                    placeholder="Enter category name"
                    className="mt-2"
                  />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="testName">Test Name *</Label>
              <Input
                id="testName"
                value={formData.testName}
                onChange={(e) => setFormData({ ...formData, testName: e.target.value })}
                placeholder="e.g., Complete Blood Count"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="turnaroundTime">Turnaround Time</Label>
                <Input
                  id="turnaroundTime"
                  value={formData.turnaroundTime}
                  onChange={(e) => setFormData({ ...formData, turnaroundTime: e.target.value })}
                  placeholder="e.g., 2-4 hours, 24 hours"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department (Optional)</Label>
              <Select
                value={formData.departmentId || "none"}
                onValueChange={(value) => setFormData({ ...formData, departmentId: value === "none" ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Department</SelectItem>
                  {departments?.map((dept: Department) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requirements">Sample Requirements</Label>
              <Textarea
                id="requirements"
                value={formData.requirements}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                placeholder="e.g., Fasting required, 2ml blood sample"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Test description and clinical significance"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog - Same structure as Create */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Lab Test</DialogTitle>
            <DialogDescription>Update laboratory test details</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-testCode">Test Code (Auto-generated)</Label>
                <Input
                  id="edit-testCode"
                  value={formData.testCode}
                  readOnly
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-testCategory">Category *</Label>
                <Select value={categorySelection} onValueChange={handleCategoryChange}>
                  <SelectTrigger id="edit-testCategory">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {PREDEFINED_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {categorySelection === "OTHER" && (
                  <Input
                    value={customCategory}
                    onChange={(e) => handleCustomCategoryChange(e.target.value)}
                    placeholder="Enter category name"
                    className="mt-2"
                  />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-testName">Test Name *</Label>
              <Input
                id="edit-testName"
                value={formData.testName}
                onChange={(e) => setFormData({ ...formData, testName: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-price">Price *</Label>
                <Input
                  id="edit-price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-turnaroundTime">Turnaround Time</Label>
                <Input
                  id="edit-turnaroundTime"
                  value={formData.turnaroundTime}
                  onChange={(e) => setFormData({ ...formData, turnaroundTime: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-department">Department</Label>
              <Select
                value={formData.departmentId || "none"}
                onValueChange={(value) => setFormData({ ...formData, departmentId: value === "none" ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Department</SelectItem>
                  {departments?.map((dept: Department) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-requirements">Sample Requirements</Label>
              <Textarea
                id="edit-requirements"
                value={formData.requirements}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Updating..." : "Update Test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
