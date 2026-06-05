'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import {
  useAssignShift,
  useCreateShift,
  useDeactivateShift,
  useShifts,
  useAllShiftAssignments,
} from '@/hooks/use-shifts';
import api, { getErrorMessage } from '@/lib/api';
import { UserRole } from '@/lib/constants';

interface UserOption {
  id: string;
  fullName: string;
  email?: string;
}

export default function ShiftsPage() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();
  const hospitalId = selectedHospital?.id || user?.hospitalId;

  const canManageShifts =
    user?.role === UserRole.MASTER_ADMIN ||
    user?.role === UserRole.SUPER_ADMIN ||
    user?.role === UserRole.HOSPITAL_ADMIN ||
    user?.role === UserRole.DEPARTMENT_ADMIN;

  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const { data: shifts = [], isLoading } = useShifts(hospitalId);

  const createShiftMutation = useCreateShift(hospitalId);
  const deactivateShiftMutation = useDeactivateShift(hospitalId);
  const assignShiftMutation = useAssignShift(hospitalId);

  const [users, setUsers] = useState<UserOption[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);

  const [shiftForm, setShiftForm] = useState({
    name: '',
    startTime: '8',
    startMinute: '0',
    endTime: '17',
    endMinute: '0',
    breakDurationMinutes: '0',
    gracePeriodMinutes: '15',
    isActive: true,
    description: '',
  });

  const [assignmentForm, setAssignmentForm] = useState({
    employeeId: '',
    shiftId: '',
    effectiveFrom: '',
    effectiveTo: '',
    notes: '',
  });

  const {
    data: assignmentHistory = [],
    isLoading: isAssignmentLoading,
    isError: isAssignmentError,
    error: assignmentError,
  } = useAllShiftAssignments(hospitalId);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!hospitalId) return;
      setIsUsersLoading(true);
      try {
        const response = await api.get(`/hospitals/${hospitalId}/users`);
        const data = response.data || [];
        const mapped = data.map((u: any) => ({
          id: u.id,
          fullName: u.fullName || u.name || u.email,
          email: u.email,
        }));
        setUsers(mapped);
      } catch (error) {
        console.error('Failed to fetch users:', error);
        setUsers([]);
      } finally {
        setIsUsersLoading(false);
      }
    };

    fetchUsers();
  }, [hospitalId]);

  const handleCreateShift = async () => {
    if (!shiftForm.name.trim()) {
      toast({
        title: 'Shift name required',
        description: 'Provide a name for the shift.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createShiftMutation.mutateAsync({
        name: shiftForm.name.trim(),
        startTime: Number(shiftForm.startTime),
        startMinute: Number(shiftForm.startMinute || 0),
        endTime: Number(shiftForm.endTime),
        endMinute: Number(shiftForm.endMinute || 0),
        breakDurationMinutes: Number(shiftForm.breakDurationMinutes || 0),
        gracePeriodMinutes: Number(shiftForm.gracePeriodMinutes || 0),
        isActive: shiftForm.isActive,
        description: shiftForm.description || undefined,
      });

      setShiftForm({
        name: '',
        startTime: '8',
        startMinute: '0',
        endTime: '17',
        endMinute: '0',
        breakDurationMinutes: '0',
        gracePeriodMinutes: '15',
        isActive: true,
        description: '',
      });

      toast({
        title: 'Shift created',
        description: 'The new shift is now available.',
      });
    } catch (error) {
      toast({
        title: 'Failed to create shift',
        description: error instanceof Error ? error.message : 'Unable to create shift.',
        variant: 'destructive',
      });
    }
  };

  const handleDeactivateShift = async (shiftId: string) => {
    try {
      await deactivateShiftMutation.mutateAsync(shiftId);
      toast({
        title: 'Shift deactivated',
        description: 'The shift is now inactive.',
      });
    } catch (error) {
      toast({
        title: 'Failed to deactivate shift',
        description: error instanceof Error ? error.message : 'Unable to deactivate shift.',
        variant: 'destructive',
      });
    }
  };

  const handleAssignShift = async () => {
    if (!assignmentForm.employeeId || !assignmentForm.shiftId || !assignmentForm.effectiveFrom) {
      toast({
        title: 'Missing assignment details',
        description: 'Select an employee, shift, and effective date.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await assignShiftMutation.mutateAsync({
        employeeId: assignmentForm.employeeId,
        shiftId: assignmentForm.shiftId,
        effectiveFrom: assignmentForm.effectiveFrom,
        effectiveTo: assignmentForm.effectiveTo || undefined,
        notes: assignmentForm.notes || undefined,
      });

      setAssignmentForm((prev) => ({
        ...prev,
        shiftId: '',
        effectiveFrom: '',
        effectiveTo: '',
        notes: '',
      }));

      toast({
        title: 'Shift assigned',
        description: 'Employee has been assigned to the shift.',
      });
    } catch (error) {
      toast({
        title: 'Failed to assign shift',
        description: error instanceof Error ? error.message : 'Unable to assign shift.',
        variant: 'destructive',
      });
    }
  };

  const visibleShifts = useMemo(
    () => (showActiveOnly ? shifts.filter((shift) => shift.isActive) : shifts),
    [showActiveOnly, shifts]
  );
  const shiftOptions = visibleShifts;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-foreground">Shift Management</h1>
        <p className="text-muted-foreground">
          Create shifts, review schedules, and assign staff to rotations.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Create Shift</h2>
              <p className="text-sm text-muted-foreground">Define working hours and rules.</p>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="shift-active">Active</Label>
              <Switch
                id="shift-active"
                checked={shiftForm.isActive}
                onCheckedChange={(checked) =>
                  setShiftForm((prev) => ({ ...prev, isActive: checked }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="shift-name">Shift name</Label>
            <Input
              id="shift-name"
              value={shiftForm.name}
              onChange={(event) =>
                setShiftForm((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="Morning Shift"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start (hour/min)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={shiftForm.startTime}
                  onChange={(event) =>
                    setShiftForm((prev) => ({ ...prev, startTime: event.target.value }))
                  }
                />
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={shiftForm.startMinute}
                  onChange={(event) =>
                    setShiftForm((prev) => ({ ...prev, startMinute: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>End (hour/min)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={shiftForm.endTime}
                  onChange={(event) =>
                    setShiftForm((prev) => ({ ...prev, endTime: event.target.value }))
                  }
                />
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={shiftForm.endMinute}
                  onChange={(event) =>
                    setShiftForm((prev) => ({ ...prev, endMinute: event.target.value }))
                  }
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Break (minutes)</Label>
              <Input
                type="number"
                min={0}
                max={60}
                value={shiftForm.breakDurationMinutes}
                onChange={(event) =>
                  setShiftForm((prev) => ({ ...prev, breakDurationMinutes: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Grace (minutes)</Label>
              <Input
                type="number"
                min={0}
                max={30}
                value={shiftForm.gracePeriodMinutes}
                onChange={(event) =>
                  setShiftForm((prev) => ({ ...prev, gracePeriodMinutes: event.target.value }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={shiftForm.description}
              onChange={(event) =>
                setShiftForm((prev) => ({ ...prev, description: event.target.value }))
              }
              placeholder="Optional notes for the shift"
            />
          </div>
          <Button
            className="w-full"
            onClick={handleCreateShift}
            disabled={!canManageShifts || createShiftMutation.isPending}
          >
            {createShiftMutation.isPending ? 'Creating...' : 'Create Shift'}
          </Button>
        </Card>

        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Assign Shift</h2>
            <p className="text-sm text-muted-foreground">Assign a shift to an employee.</p>
          </div>
          <div className="space-y-2">
            <Label>Employee</Label>
            <Select
              value={assignmentForm.employeeId}
              onValueChange={(value) =>
                setAssignmentForm((prev) => ({ ...prev, employeeId: value }))
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={isUsersLoading ? 'Loading employees...' : 'Select employee'}
                />
              </SelectTrigger>
              <SelectContent>
                {users.map((userOption) => (
                  <SelectItem key={userOption.id} value={userOption.id}>
                    {userOption.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Shift</Label>
            <Select
              value={assignmentForm.shiftId}
              onValueChange={(value) =>
                setAssignmentForm((prev) => ({ ...prev, shiftId: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select shift" />
              </SelectTrigger>
              <SelectContent>
                {shiftOptions.length === 0 && (
                  <SelectItem value="no-shifts" disabled>
                    No shifts available
                  </SelectItem>
                )}
                {shiftOptions.map((shift) => (
                  <SelectItem key={shift.id} value={shift.id}>
                    {shift.name}{shift.isActive ? '' : ' (Inactive)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Effective from</Label>
              <DateInput
                value={assignmentForm.effectiveFrom}
                onChange={(value) =>
                  setAssignmentForm((prev) => ({ ...prev, effectiveFrom: value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Effective to (optional)</Label>
              <DateInput
                value={assignmentForm.effectiveTo}
                onChange={(value) =>
                  setAssignmentForm((prev) => ({ ...prev, effectiveTo: value }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={assignmentForm.notes}
              onChange={(event) =>
                setAssignmentForm((prev) => ({ ...prev, notes: event.target.value }))
              }
              placeholder="Rotation or assignment notes"
            />
          </div>
          <Button
            className="w-full"
            onClick={handleAssignShift}
            disabled={!canManageShifts || assignShiftMutation.isPending}
          >
            {assignShiftMutation.isPending ? 'Assigning...' : 'Assign Shift'}
          </Button>
        </Card>

        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Assigned Shifts</h2>
            <p className="text-sm text-muted-foreground">
              All employee shift assignments.
            </p>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Effective</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!hospitalId && (
                  <TableRow>
                    <TableCell colSpan={4}>
                      Select a hospital to view assignments.
                    </TableCell>
                  </TableRow>
                )}
                {hospitalId && isAssignmentLoading && (
                  <TableRow>
                    <TableCell colSpan={4}>Loading assignments...</TableCell>
                  </TableRow>
                )}
                {hospitalId && isAssignmentError && (
                  <TableRow>
                    <TableCell colSpan={4}>
                      Failed to load assignments: {getErrorMessage(assignmentError)}
                    </TableCell>
                  </TableRow>
                )}
                {hospitalId && !isAssignmentLoading && !isAssignmentError && assignmentHistory.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4}>No assignments found.</TableCell>
                  </TableRow>
                )}
                {assignmentHistory.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <div className="font-medium">
                        {assignment.user?.fullName || assignment.user?.name || assignment.user?.email || 'Employee'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {assignment.user?.email || assignment.userId}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {assignment.shift?.name || 'Shift'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {assignment.shift?.startTime} - {assignment.shift?.endTime}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {new Date(assignment.effectiveFrom).toLocaleDateString()} 
                        {assignment.effectiveTo
                          ? ` → ${new Date(assignment.effectiveTo).toLocaleDateString()}`
                          : ' → Ongoing'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {assignment.isPermanent ? 'Permanent' : 'Temporary'}
                      </div>
                    </TableCell>
                    <TableCell>{assignment.assignmentReason || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Shift Directory</h2>
              <p className="text-sm text-muted-foreground">All configured shifts.</p>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="active-only">Active only</Label>
              <Switch
                id="active-only"
                checked={showActiveOnly}
                onCheckedChange={setShowActiveOnly}
              />
            </div>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shift</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Break</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={5}>Loading shifts...</TableCell>
                  </TableRow>
                )}
                {!isLoading && shifts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>No shifts configured yet.</TableCell>
                  </TableRow>
                )}
                {visibleShifts.map((shift) => (
                  <TableRow key={shift.id}>
                    <TableCell>
                      <div className="font-medium">{shift.name}</div>
                      <div className="text-xs text-muted-foreground">{shift.code}</div>
                    </TableCell>
                    <TableCell>
                      {shift.startTime} - {shift.endTime}
                      <div className="text-xs text-muted-foreground">
                        Grace {shift.gracePeriodMinutes} min
                      </div>
                    </TableCell>
                    <TableCell>{shift.breakDurationMinutes} min</TableCell>
                    <TableCell>
                      <Badge variant={shift.isActive ? 'default' : 'secondary'}>
                        {shift.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canManageShifts || !shift.isActive || deactivateShiftMutation.isPending}
                        onClick={() => handleDeactivateShift(shift.id)}
                      >
                        Deactivate
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
