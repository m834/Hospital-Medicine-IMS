'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
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
import { UserRole } from '@/lib/constants';
import { getErrorMessage } from '@/lib/api';
import { generateNextCode } from '@/lib/code';
import {
  LeaveStatus,
  useApplyLeave,
  useCancelLeave,
  useCreateHoliday,
  useCreateLeaveType,
  useHolidays,
  useLeaveRequests,
  useLeaveTypes,
  useProcessLeave,
} from '@/hooks/use-leaves';

const STATUS_OPTIONS: { value: LeaveStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function LeavesPage() {
    const formatDate = (value?: string | null) => {
      if (!value) return '-';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      return format(date, 'yyyy-MM-dd');
    };
  const { toast } = useToast();
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();
  const hospitalId = selectedHospital?.id || user?.hospitalId;

  const canProcessRequests =
    user?.role === UserRole.MASTER_ADMIN ||
    user?.role === UserRole.SUPER_ADMIN ||
    user?.role === UserRole.HOSPITAL_ADMIN ||
    user?.role === UserRole.DEPARTMENT_ADMIN;

  const [filters, setFilters] = useState({
    status: 'ALL' as LeaveStatus | 'ALL',
    leaveTypeId: '',
    fromDate: '',
    toDate: '',
  });

  const requestFilters = useMemo(() => {
    return {
      status: filters.status === 'ALL' ? undefined : filters.status,
      leaveTypeId: filters.leaveTypeId || undefined,
      fromDate: filters.fromDate || undefined,
      toDate: filters.toDate || undefined,
      take: 50,
    };
  }, [filters]);

  const { data: leaveTypes = [] } = useLeaveTypes(hospitalId);
  const {
    data: leaveRequests = [],
    isLoading,
    isError: isLeaveRequestsError,
    error: leaveRequestsError,
  } = useLeaveRequests(hospitalId, requestFilters);
  const applyLeaveMutation = useApplyLeave(hospitalId);
  const processLeaveMutation = useProcessLeave(hospitalId);
  const cancelLeaveMutation = useCancelLeave(hospitalId);
  const createLeaveTypeMutation = useCreateLeaveType(hospitalId);
  const createHolidayMutation = useCreateHoliday(hospitalId);

  const [applyForm, setApplyForm] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: '',
  });

  const [leaveTypeForm, setLeaveTypeForm] = useState({
    name: '',
    code: '',
    annualAllowance: '0',
    description: '',
    requiresApproval: true,
    isActive: true,
  });

  const nextLeaveTypeCode = useMemo(
    () => generateNextCode(leaveTypes.map((type) => type.code), 'LEV'),
    [leaveTypes]
  );

  useEffect(() => {
    setLeaveTypeForm((prev) => ({
      ...prev,
      code: nextLeaveTypeCode,
    }));
  }, [nextLeaveTypeCode]);

  const [holidayYear, setHolidayYear] = useState(`${new Date().getFullYear()}`);
  const { data: holidays = [] } = useHolidays(hospitalId, Number(holidayYear));
  const [holidayForm, setHolidayForm] = useState({
    name: '',
    date: '',
    description: '',
  });

  const handleApplyLeave = async () => {
    if (!applyForm.leaveTypeId || !applyForm.startDate || !applyForm.endDate) {
      toast({
        title: 'Missing leave details',
        description: 'Select a leave type and date range.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await applyLeaveMutation.mutateAsync({
        leaveTypeId: applyForm.leaveTypeId,
        startDate: applyForm.startDate,
        endDate: applyForm.endDate,
        reason: applyForm.reason || undefined,
      });

      setApplyForm({
        leaveTypeId: '',
        startDate: '',
        endDate: '',
        reason: '',
      });

      toast({
        title: 'Leave submitted',
        description: 'Your leave request has been submitted for review.',
      });
    } catch (error) {
      toast({
        title: 'Failed to apply for leave',
        description: error instanceof Error ? error.message : 'Unable to submit leave request.',
        variant: 'destructive',
      });
    }
  };

  const handleProcessLeave = async (leaveRequestId: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      await processLeaveMutation.mutateAsync({
        leaveRequestId,
        payload: { decision },
      });
      toast({
        title: 'Leave updated',
        description: `Leave request ${decision.toLowerCase()}.`,
      });
    } catch (error) {
      toast({
        title: 'Failed to update leave',
        description: error instanceof Error ? error.message : 'Unable to process leave request.',
        variant: 'destructive',
      });
    }
  };

  const handleCancelLeave = async (leaveRequestId: string) => {
    try {
      await cancelLeaveMutation.mutateAsync({ leaveRequestId, payload: {} });
      toast({
        title: 'Leave cancelled',
        description: 'The leave request has been cancelled.',
      });
    } catch (error) {
      toast({
        title: 'Failed to cancel leave',
        description: error instanceof Error ? error.message : 'Unable to cancel leave request.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateLeaveType = async () => {
    if (!leaveTypeForm.name.trim()) {
      toast({
        title: 'Leave type name required',
        description: 'Provide a name for the leave type.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const createdCode = leaveTypeForm.code;

      await createLeaveTypeMutation.mutateAsync({
        name: leaveTypeForm.name.trim(),
        code: createdCode,
        annualAllowance: Number(leaveTypeForm.annualAllowance || 0),
        description: leaveTypeForm.description || undefined,
        requiresApproval: leaveTypeForm.requiresApproval,
        isActive: leaveTypeForm.isActive,
      });

      setLeaveTypeForm({
        name: '',
        code: generateNextCode([...leaveTypes.map((type) => type.code), createdCode], 'LEV'),
        annualAllowance: '0',
        description: '',
        requiresApproval: true,
        isActive: true,
      });

      toast({
        title: 'Leave type created',
        description: 'Leave type is now available.',
      });
    } catch (error) {
      toast({
        title: 'Failed to create leave type',
        description: error instanceof Error ? error.message : 'Unable to create leave type.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateHoliday = async () => {
    if (!holidayForm.name.trim() || !holidayForm.date) {
      toast({
        title: 'Holiday details required',
        description: 'Provide a name and date for the holiday.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createHolidayMutation.mutateAsync({
        name: holidayForm.name.trim(),
        date: holidayForm.date,
        description: holidayForm.description || undefined,
      });

      setHolidayForm({
        name: '',
        date: '',
        description: '',
      });

      toast({
        title: 'Holiday created',
        description: 'Holiday has been added to the calendar.',
      });
    } catch (error) {
      toast({
        title: 'Failed to create holiday',
        description: error instanceof Error ? error.message : 'Unable to create holiday.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-foreground">Leave Management</h1>
        <p className="text-muted-foreground">
          Track requests, manage leave types, and maintain holiday calendars.
        </p>
      </div>

      <Tabs defaultValue="requests" className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="types">Leave Types</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-6">
          <Card className="p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Apply for Leave</h2>
              <p className="text-sm text-muted-foreground">Submit a leave request for review.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2 md:col-span-1">
                <Label>Leave type</Label>
                <Select
                  value={applyForm.leaveTypeId}
                  onValueChange={(value) =>
                    setApplyForm((prev) => ({ ...prev, leaveTypeId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={applyForm.startDate}
                  onChange={(event) =>
                    setApplyForm((prev) => ({ ...prev, startDate: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>End date</Label>
                <Input
                  type="date"
                  value={applyForm.endDate}
                  onChange={(event) =>
                    setApplyForm((prev) => ({ ...prev, endDate: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label>Reason</Label>
                <Input
                  value={applyForm.reason}
                  onChange={(event) =>
                    setApplyForm((prev) => ({ ...prev, reason: event.target.value }))
                  }
                  placeholder="Optional"
                />
              </div>
            </div>
            <Button
              onClick={handleApplyLeave}
              disabled={applyLeaveMutation.isPending}
            >
              {applyLeaveMutation.isPending ? 'Submitting...' : 'Submit Leave Request'}
            </Button>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">Leave Requests</h2>
              <p className="text-sm text-muted-foreground">Review and process leave requests.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={filters.status}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, status: value as LeaveStatus | 'ALL' }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Leave type</Label>
                <Select
                  value={filters.leaveTypeId || 'ALL'}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, leaveTypeId: value === 'ALL' ? '' : value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    {leaveTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>From</Label>
                <Input
                  type="date"
                  value={filters.fromDate}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, fromDate: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>To</Label>
                <Input
                  type="date"
                  value={filters.toDate}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, toDate: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!hospitalId && (
                    <TableRow>
                      <TableCell colSpan={5}>Select a hospital to view requests.</TableCell>
                    </TableRow>
                  )}
                  {hospitalId && isLoading && (
                    <TableRow>
                      <TableCell colSpan={5}>Loading leave requests...</TableCell>
                    </TableRow>
                  )}
                  {hospitalId && isLeaveRequestsError && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        Failed to load leave requests: {getErrorMessage(leaveRequestsError)}
                      </TableCell>
                    </TableRow>
                  )}
                  {hospitalId && !isLoading && !isLeaveRequestsError && leaveRequests.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5}>No leave requests found.</TableCell>
                    </TableRow>
                  )}
                  {leaveRequests.map((request) => {
                    const requesterName =
                      request.user?.fullName || request.user?.name || request.user?.email || 'Employee';
                    const canCancel =
                      request.userId === user?.id &&
                      (request.status === 'PENDING' || request.status === 'APPROVED');

                    return (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div className="font-medium">{requesterName}</div>
                          <div className="text-xs text-muted-foreground">{request.user?.email}</div>
                        </TableCell>
                        <TableCell>{request.leaveType?.name || 'Leave'}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {formatDate(request.startDate)} → {formatDate(request.endDate)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {request.totalDays} day(s)
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              request.status === 'APPROVED'
                                ? 'default'
                                : request.status === 'PENDING'
                                  ? 'secondary'
                                  : 'outline'
                            }
                          >
                            {request.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canProcessRequests && request.status === 'PENDING' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleProcessLeave(request.id, 'APPROVED')}
                                  disabled={processLeaveMutation.isPending}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleProcessLeave(request.id, 'REJECTED')}
                                  disabled={processLeaveMutation.isPending}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                            {canCancel && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCancelLeave(request.id)}
                                disabled={cancelLeaveMutation.isPending}
                              >
                                Cancel
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="types" className="space-y-6">
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Leave Types</h2>
                <p className="text-sm text-muted-foreground">Configure leave entitlements.</p>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="leave-type-active">Active</Label>
                <Switch
                  id="leave-type-active"
                  checked={leaveTypeForm.isActive}
                  onCheckedChange={(checked) =>
                    setLeaveTypeForm((prev) => ({ ...prev, isActive: checked }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={leaveTypeForm.name}
                  onChange={(event) =>
                    setLeaveTypeForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Annual Leave"
                />
              </div>
              <div className="space-y-2">
                <Label>Code (Auto-generated)</Label>
                <Input
                  value={leaveTypeForm.code}
                  readOnly
                  placeholder="LEV-001"
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-2">
                <Label>Annual allowance (days)</Label>
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={leaveTypeForm.annualAllowance}
                  onChange={(event) =>
                    setLeaveTypeForm((prev) => ({ ...prev, annualAllowance: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={leaveTypeForm.description}
                onChange={(event) =>
                  setLeaveTypeForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Optional"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={leaveTypeForm.requiresApproval}
                onCheckedChange={(checked) =>
                  setLeaveTypeForm((prev) => ({ ...prev, requiresApproval: checked }))
                }
              />
              <Label>Requires approval</Label>
            </div>
            <Button
              onClick={handleCreateLeaveType}
              disabled={createLeaveTypeMutation.isPending}
            >
              {createLeaveTypeMutation.isPending ? 'Creating...' : 'Create Leave Type'}
            </Button>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-lg font-semibold">Existing Leave Types</h3>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Allowance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveTypes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4}>No leave types configured.</TableCell>
                    </TableRow>
                  )}
                  {leaveTypes.map((type) => (
                    <TableRow key={type.id}>
                      <TableCell>{type.name}</TableCell>
                      <TableCell>{type.code}</TableCell>
                      <TableCell>{type.maxDaysPerYear} days</TableCell>
                      <TableCell>
                        <Badge variant={type.isActive ? 'default' : 'secondary'}>
                          {type.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="holidays" className="space-y-6">
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Holiday Calendar</h2>
                <p className="text-sm text-muted-foreground">Add official holidays and schedules.</p>
              </div>
              <div className="space-y-1">
                <Label>Year</Label>
                <Input
                  type="number"
                  min={2000}
                  max={2100}
                  value={holidayYear}
                  onChange={(event) => setHolidayYear(event.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={holidayForm.name}
                  onChange={(event) =>
                    setHolidayForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Public Holiday"
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={holidayForm.date}
                  onChange={(event) =>
                    setHolidayForm((prev) => ({ ...prev, date: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={holidayForm.description}
                  onChange={(event) =>
                    setHolidayForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  placeholder="Optional"
                />
              </div>
            </div>
            <Button
              onClick={handleCreateHoliday}
              disabled={createHolidayMutation.isPending}
            >
              {createHolidayMutation.isPending ? 'Adding...' : 'Add Holiday'}
            </Button>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-lg font-semibold">Holiday List</h3>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3}>No holidays configured.</TableCell>
                    </TableRow>
                  )}
                  {holidays.map((holiday) => (
                    <TableRow key={holiday.id}>
                      <TableCell>{holiday.name}</TableCell>
                      <TableCell>{holiday.holidayDate?.slice(0, 10)}</TableCell>
                      <TableCell>{holiday.description || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
