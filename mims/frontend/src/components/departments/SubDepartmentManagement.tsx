'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Building2, Users, Search, RefreshCw } from 'lucide-react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';

interface Department {
  id: string;
  name: string;
  code: string;
  hospitalId: string;
  hospital: {
    name: string;
    code: string;
  };
}

interface SubDepartment {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  departmentId: string;
  department: {
    name: string;
    code: string;
    hospital: {
      name: string;
      code: string;
    };
  };
  _count?: {
    users: number;
  };
}

export function SubDepartmentManagement() {
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingSubDept, setEditingSubDept] = useState<SubDepartment | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<SubDepartment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  
  const { toast } = useToast();
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();

  const currentHospitalId = user?.hospitalId || selectedHospital?.id;
  
  // Permission check - allow MASTER_ADMIN, SUPER_ADMIN, and HOSPITAL_ADMIN to manage
  const canModify = 
    user?.role === 'MASTER_ADMIN' || 
    user?.role === 'SUPER_ADMIN' || 
    user?.role === 'HOSPITAL_ADMIN';

  const [subDeptForm, setSubDeptForm] = useState({
    name: '',
    code: '',
    description: '',
    departmentId: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  useEffect(() => {
    if (currentHospitalId) {
      fetchDepartments();
      fetchSubDepartments();
    }
  }, [currentHospitalId]);

  const fetchDepartments = async () => {
    try {
      const params: any = {};
      if (currentHospitalId) {
        params.hospitalId = currentHospitalId;
      }
      const response = await api.get('/departments', { params });
      setDepartments((response.data || []).filter((d: any) => d.status === 'ACTIVE'));
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  const fetchSubDepartments = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (currentHospitalId) {
        params.hospitalId = currentHospitalId;
      }
      const response = await api.get('/sub-departments', { params });
      setSubDepartments(response.data || []);
    } catch (error) {
      console.error('Failed to fetch sub-departments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load sub-departments',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubDepartment = async () => {
    if (!subDeptForm.name || !subDeptForm.code || !subDeptForm.departmentId) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await api.post(`/sub-departments/department/${subDeptForm.departmentId}`, {
        name: subDeptForm.name,
        code: subDeptForm.code,
        description: subDeptForm.description || undefined,
        status: subDeptForm.status,
      });

      if (response.status === 201) {
        toast({ title: 'Success', description: 'Sub-department created successfully' });
        setShowDialog(false);
        resetForm();
        fetchSubDepartments();
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
    if (!editingSubDept || !subDeptForm.name || !subDeptForm.code) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      await api.patch(`/sub-departments/${editingSubDept.id}`, {
        name: subDeptForm.name,
        code: subDeptForm.code,
        description: subDeptForm.description || undefined,
        status: subDeptForm.status,
      });

      toast({ title: 'Success', description: 'Sub-department updated successfully' });
      setShowDialog(false);
      setEditingSubDept(null);
      resetForm();
      fetchSubDepartments();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update sub-department',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteSubDepartment = async () => {
    if (!deleteConfirm) return;

    try {
      await api.delete(`/sub-departments/${deleteConfirm.id}`);
      toast({ title: 'Success', description: 'Sub-department deleted successfully' });
      setDeleteConfirm(null);
      fetchSubDepartments();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete sub-department',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setSubDeptForm({
      name: '',
      code: '',
      description: '',
      departmentId: '',
      status: 'ACTIVE',
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setEditingSubDept(null);
    setShowDialog(true);
  };

  const openEditDialog = (subDept: SubDepartment) => {
    setSubDeptForm({
      name: subDept.name,
      code: subDept.code,
      description: subDept.description || '',
      departmentId: subDept.departmentId,
      status: subDept.status,
    });
    setEditingSubDept(subDept);
    setShowDialog(true);
  };

  // Filter sub-departments
  const filteredSubDepartments = subDepartments.filter((subDept) => {
    const matchesSearch =
      subDept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subDept.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subDept.department.name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDepartment = selectedDepartment === 'all' || subDept.departmentId === selectedDepartment;
    const matchesStatus = selectedStatus === 'all' || subDept.status === selectedStatus;

    return matchesSearch && matchesDepartment && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sub-Departments</h1>
          <p className="text-muted-foreground">
            Manage hospital sub-departments and their assignments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchSubDepartments} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          {canModify && (
            <Button onClick={openCreateDialog} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Sub-Department
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sub-Departments</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subDepartments.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Building2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {subDepartments.filter((d) => d.status === 'ACTIVE').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {subDepartments.reduce((sum, d) => sum + (d._count?.users || 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by name, code, or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                {dept.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sub-Departments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sub-Departments List</CardTitle>
          <CardDescription>
            {filteredSubDepartments.length} sub-department{filteredSubDepartments.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sub-Department</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Hospital</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubDepartments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No sub-departments found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSubDepartments.map((subDept) => (
                    <TableRow key={subDept.id}>
                      <TableCell className="font-medium">{subDept.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{subDept.code}</Badge>
                      </TableCell>
                      <TableCell>{subDept.department.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {subDept.department.hospital.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {subDept.description || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{subDept._count?.users || 0}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={subDept.status === 'ACTIVE' ? 'default' : 'secondary'}
                          className={
                            subDept.status === 'ACTIVE'
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-400 text-white'
                          }
                        >
                          {subDept.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canModify ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(subDept)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteConfirm(subDept)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">View only</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingSubDept ? 'Edit Sub-Department' : 'Create Sub-Department'}
            </DialogTitle>
            <DialogDescription>
              {editingSubDept
                ? 'Update sub-department information'
                : 'Add a new sub-department to a department'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="department">
                Department <span className="text-destructive">*</span>
              </Label>
              <Select
                value={subDeptForm.departmentId}
                onValueChange={(value) =>
                  setSubDeptForm({ ...subDeptForm, departmentId: value })
                }
                disabled={!!editingSubDept}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Enter sub-department name"
                value={subDeptForm.name}
                onChange={(e) => setSubDeptForm({ ...subDeptForm, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">
                Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="code"
                placeholder="Enter sub-department code (e.g., CARD-OPD)"
                value={subDeptForm.code}
                onChange={(e) => setSubDeptForm({ ...subDeptForm, code: e.target.value.toUpperCase() })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Enter description"
                value={subDeptForm.description}
                onChange={(e) => setSubDeptForm({ ...subDeptForm, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
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
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={editingSubDept ? handleUpdateSubDepartment : handleCreateSubDepartment}
            >
              {editingSubDept ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Sub-Department</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this sub-department? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteConfirm && (
            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="font-semibold">{deleteConfirm.name}</p>
              <p className="text-sm text-muted-foreground">
                {deleteConfirm.code} • {deleteConfirm.department.name}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteSubDepartment}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
