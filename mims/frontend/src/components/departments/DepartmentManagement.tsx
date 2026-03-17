'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Building2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { UserRole } from '@/lib/constants';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import api from '@/lib/api';
import { generateNextCode } from '@/lib/code';

interface Hospital {
  id: string;
  name: string;
  code: string;
}

interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  hospitalId: string;
  hospital: {
    name: string;
    code: string;
  };
  _count?: {
    subDepartments: number;
    users: number;
  };
}

interface SubDepartment {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  departmentId: string;
  _count?: {
    users: number;
  };
}

export function DepartmentManagement() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDeptDialog, setShowDeptDialog] = useState(false);
  const [showSubDeptDialog, setShowSubDeptDialog] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editingSubDept, setEditingSubDept] = useState<SubDepartment | null>(null);
  const { toast } = useToast();
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();

  // Determine current hospital based on user role
  // Master Admin & Super Admin must select hospital, others use their hospitalId
  const currentHospitalId = selectedHospital?.id || user?.hospitalId;
  const currentHospitalName = user?.hospitalId 
    ? 'Your Hospital' 
    : selectedHospital?.name || 'No Hospital Selected';
  const userRole = user?.role as UserRole | null;

  const [deptForm, setDeptForm] = useState({
    name: '',
    code: '',
    description: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const [subDeptForm, setSubDeptForm] = useState({
    name: '',
    code: '',
    description: '',
    departmentId: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const getNextDeptCode = () => generateNextCode(departments.map((dept) => dept.code), 'DEP');
  const getNextSubDeptCode = () => generateNextCode(subDepartments.map((subDept) => subDept.code), 'SUB');

  useEffect(() => {
    if (currentHospitalId) {
      fetchDepartments();
    }
  }, [currentHospitalId]);

  const fetchDepartments = async () => {
    if (!currentHospitalId) {
      toast({
        title: 'Error',
        description: 'Please select a hospital first',
        variant: 'destructive',
      });
      return;
    }
    setLoading(true);
    try {
      const params: any = {};
      if (currentHospitalId) {
        params.hospitalId = currentHospitalId;
      }
      const response = await api.get('/departments', { params });
      setDepartments(response.data || []);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load departments',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSubDepartments = async (departmentId: string) => {
    try {
      const response = await api.get(`/sub-departments/department/${departmentId}`);
      setSubDepartments(response.data || []);
    } catch (error) {
      console.error('Failed to fetch sub-departments:', error);
    }
  };

  const handleCreateDepartment = async () => {
    if (!currentHospitalId) {
      toast({
        title: 'Error',
        description: 'Hospital context is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      await api.post(`/departments/hospital/${currentHospitalId}`, {
        name: deptForm.name,
        code: deptForm.code,
        description: deptForm.description || undefined,
        status: deptForm.status,
      });
      toast({ title: 'Success', description: 'Department created successfully' });
      setShowDeptDialog(false);
      resetDeptForm();
      fetchDepartments();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create department',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateDepartment = async () => {
    if (!editingDept) return;

    try {
      await api.patch(`/departments/${editingDept.id}`, {
        name: deptForm.name,
        code: deptForm.code,
        description: deptForm.description || undefined,
        status: deptForm.status,
      });
      toast({ title: 'Success', description: 'Department updated successfully' });
      setShowDeptDialog(false);
      setEditingDept(null);
      resetDeptForm();
      fetchDepartments();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update department',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this department?')) return;

    try {
      await api.delete(`/departments/${id}`);
      toast({ title: 'Success', description: 'Department deleted successfully' });
      fetchDepartments();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete department',
        variant: 'destructive',
      });
    }
  };

  const handleCreateSubDepartment = async () => {
    try {
      await api.post(`/sub-departments/department/${subDeptForm.departmentId}`, {
        name: subDeptForm.name,
        code: subDeptForm.code,
        description: subDeptForm.description || undefined,
        status: subDeptForm.status,
      });
      toast({ title: 'Success', description: 'Sub-department created successfully' });
      setShowSubDeptDialog(false);
      resetSubDeptForm();
      if (selectedDepartment) {
        fetchSubDepartments(selectedDepartment.id);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create sub-department',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateSubDepartment = async () => {
    if (!editingSubDept) return;

    try {
      await api.patch(`/sub-departments/${editingSubDept.id}`, {
        name: subDeptForm.name,
        code: subDeptForm.code,
        description: subDeptForm.description || undefined,
        status: subDeptForm.status,
      });
      toast({ title: 'Success', description: 'Sub-department updated successfully' });
      setShowSubDeptDialog(false);
      setEditingSubDept(null);
      resetSubDeptForm();
      if (selectedDepartment) {
        fetchSubDepartments(selectedDepartment.id);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update sub-department',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteSubDepartment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this sub-department?')) return;

    try {
      await api.delete(`/sub-departments/${id}`);
      toast({ title: 'Success', description: 'Sub-department deleted successfully' });
      if (selectedDepartment) {
        fetchSubDepartments(selectedDepartment.id);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete sub-department',
        variant: 'destructive',
      });
    }
  };

  const openDeptDialog = (dept?: Department) => {
    if (dept) {
      setEditingDept(dept);
      setDeptForm({
        name: dept.name,
        code: dept.code,
        description: dept.description || '',
        status: dept.status,
      });
    } else {
      setEditingDept(null);
      resetDeptForm();
    }
    setShowDeptDialog(true);
  };

  const openSubDeptDialog = (subDept?: SubDepartment) => {
    if (subDept) {
      setEditingSubDept(subDept);
      setSubDeptForm({
        name: subDept.name,
        code: subDept.code,
        description: subDept.description || '',
        departmentId: subDept.departmentId,
        status: subDept.status,
      });
    } else {
      setEditingSubDept(null);
      setSubDeptForm({
        name: '',
        description: '',
        code: getNextSubDeptCode(),
        departmentId: selectedDepartment?.id || '',
        status: 'ACTIVE',
      });
    }
    setShowSubDeptDialog(true);
  };

  const resetDeptForm = () => {
    setDeptForm({
      name: '',
      code: getNextDeptCode(),
      description: '',
      status: 'ACTIVE',
    });
  };

  const resetSubDeptForm = () => {
    setSubDeptForm({
      name: '',
      code: getNextSubDeptCode(),
      description: '',
      departmentId: selectedDepartment?.id || '',
      status: 'ACTIVE',
    });
  };

  const canModify = 
    userRole === UserRole.MASTER_ADMIN || 
    userRole === UserRole.SUPER_ADMIN || 
    userRole === UserRole.HOSPITAL_ADMIN;

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Hospital Context Banner */}
      {!currentHospitalId && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950/30">
          <p className="text-sm text-yellow-900 dark:text-yellow-400">
            ⚠️ Please select a hospital from the navbar dropdown to manage departments
          </p>
        </div>
      )}
      
      {currentHospitalId && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
          <p className="text-sm text-blue-900 dark:text-blue-400">
            📍 Managing departments for: <strong>{currentHospitalName}</strong>
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Department Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage hospital departments and sub-departments
          </p>
        </div>
        {canModify && currentHospitalId && (
          <Button onClick={() => openDeptDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Department
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Departments List */}
        <Card>
          <CardHeader>
            <CardTitle>Departments</CardTitle>
            <CardDescription>{departments.length} total departments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {departments.map((dept) => (
                <div
                  key={dept.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedDepartment?.id === dept.id
                      ? 'bg-primary/5 border-primary'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => {
                    setSelectedDepartment(dept);
                    fetchSubDepartments(dept.id);
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-semibold">{dept.name}</h3>
                        <Badge
                          variant={dept.status === 'ACTIVE' ? 'default' : 'secondary'}
                        >
                          {dept.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Code: {dept.code} | Hospital: {dept.hospital.name}
                      </p>
                      {dept.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {dept.description}
                        </p>
                      )}
                      <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                        <span>{dept._count?.subDepartments || 0} sub-departments</span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {dept._count?.users || 0} users
                        </span>
                      </div>
                    </div>
                    {canModify && (
                      <div className="flex gap-1 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeptDialog(dept);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDepartment(dept.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sub-Departments List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Sub-Departments</CardTitle>
                <CardDescription>
                  {selectedDepartment
                    ? `${subDepartments.length} sub-departments in ${selectedDepartment.name}`
                    : 'Select a department to view sub-departments'}
                </CardDescription>
              </div>
              {canModify && selectedDepartment && (
                <Button size="sm" onClick={() => openSubDeptDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedDepartment ? (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a department to view its sub-departments</p>
              </div>
            ) : (
              <div className="space-y-3">
                {subDepartments.map((subDept) => (
                  <div
                    key={subDept.id}
                    className="p-4 border rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{subDept.name}</h4>
                          <Badge
                            variant={subDept.status === 'ACTIVE' ? 'default' : 'secondary'}
                          >
                            {subDept.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Code: {subDept.code}
                        </p>
                        {subDept.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {subDept.description}
                          </p>
                        )}
                        <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {subDept._count?.users || 0} users
                        </div>
                      </div>
                      {canModify && (
                        <div className="flex gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openSubDeptDialog(subDept)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSubDepartment(subDept.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Department Dialog */}
      <Dialog open={showDeptDialog} onOpenChange={setShowDeptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDept ? 'Edit Department' : 'Create Department'}
            </DialogTitle>
            <DialogDescription>
              {editingDept
                ? 'Update department information'
                : 'Add a new department to a hospital'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Hospital Context Display */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
              <p className="text-xs text-blue-900 dark:text-blue-400">
                <strong>Hospital:</strong> {currentHospitalName}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Department will be created for this hospital
              </p>
            </div>
            
            <div>
              <Label htmlFor="name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={deptForm.name}
                onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                placeholder="e.g., Cardiology"
              />
            </div>
            <div>
              <Label htmlFor="code">Code (Auto-generated)</Label>
              <Input
                id="code"
                value={deptForm.code}
                readOnly
                placeholder="DEP-001"
                className="bg-muted/50"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={deptForm.description}
                onChange={(e) =>
                  setDeptForm({ ...deptForm, description: e.target.value })
                }
                placeholder="Optional description"
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={deptForm.status}
                onValueChange={(value: 'ACTIVE' | 'INACTIVE') =>
                  setDeptForm({ ...deptForm, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeptDialog(false);
                setEditingDept(null);
                resetDeptForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editingDept ? handleUpdateDepartment : handleCreateDepartment}
              disabled={!deptForm.name || !deptForm.code}
            >
              {editingDept ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sub-Department Dialog */}
      <Dialog open={showSubDeptDialog} onOpenChange={setShowSubDeptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSubDept ? 'Edit Sub-Department' : 'Create Sub-Department'}
            </DialogTitle>
            <DialogDescription>
              {editingSubDept
                ? 'Update sub-department information'
                : `Add a new sub-department to ${selectedDepartment?.name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="subName">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="subName"
                value={subDeptForm.name}
                onChange={(e) => setSubDeptForm({ ...subDeptForm, name: e.target.value })}
                placeholder="e.g., Interventional Cardiology"
              />
            </div>
            <div>
              <Label htmlFor="subCode">Code (Auto-generated)</Label>
              <Input
                id="subCode"
                value={subDeptForm.code}
                readOnly
                placeholder="SUB-001"
                className="bg-muted/50"
              />
            </div>
            <div>
              <Label htmlFor="subDescription">Description</Label>
              <Input
                id="subDescription"
                value={subDeptForm.description}
                onChange={(e) =>
                  setSubDeptForm({ ...subDeptForm, description: e.target.value })
                }
                placeholder="Optional description"
              />
            </div>
            <div>
              <Label htmlFor="subStatus">Status</Label>
              <Select
                value={subDeptForm.status}
                onValueChange={(value: 'ACTIVE' | 'INACTIVE') =>
                  setSubDeptForm({ ...subDeptForm, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSubDeptDialog(false);
                setEditingSubDept(null);
                resetSubDeptForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={
                editingSubDept ? handleUpdateSubDepartment : handleCreateSubDepartment
              }
              disabled={!subDeptForm.name || !subDeptForm.code}
            >
              {editingSubDept ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
