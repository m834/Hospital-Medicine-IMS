'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import api from '@/lib/api';
import { UserRole } from '@/lib/constants';
import { useGeneratePayrollBatch, usePayrollGeneratedStatus, usePayrollSettings, useRunPayrollBatch, useUpsertPayrollSetting, LatePenaltyType, LeavePayType, PayrollBatchItem } from '@/hooks/use-payroll';

interface UserOption {
  id: string;
  fullName: string;
  email?: string;
}

export default function PayrollPage() {
  const { toast } = useToast();
  const { user, logout } = useAuthStore();
  const { selectedHospital, clearSelection } = useHospitalStore();
  const hospitalId = selectedHospital?.id || user?.hospitalId;

  const canManagePayroll =
    user?.role === UserRole.MASTER_ADMIN ||
    user?.role === UserRole.SUPER_ADMIN ||
    user?.role === UserRole.HOSPITAL_ADMIN;

  const [users, setUsers] = useState<UserOption[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);

  const { data: payrollSettings = [], isLoading: isSettingsLoading } = usePayrollSettings(hospitalId);
  const upsertSettingMutation = useUpsertPayrollSetting(hospitalId);
  const runPayrollBatchMutation = useRunPayrollBatch(hospitalId);
  const generatePayrollBatchMutation = useGeneratePayrollBatch(hospitalId);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [settingsForm, setSettingsForm] = useState({
    monthlySalary: '0',
    allowanceAmount: '0',
    otherDeductionAmount: '0',
    latePenaltyType: 'NONE' as LatePenaltyType,
    leavePayType: 'PAID' as LeavePayType,
  });

  const [runForm, setRunForm] = useState({
    year: new Date().getFullYear().toString(),
    month: (new Date().getMonth() + 1).toString(),
  });

  const { data: generatedStatus } = usePayrollGeneratedStatus(hospitalId, {
    year: Number(runForm.year),
    month: Number(runForm.month),
  });

  const [runResults, setRunResults] = useState<PayrollBatchItem[]>([]);
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const lastBatchKeyRef = useRef('');

  useEffect(() => {
    const fetchUsers = async () => {
      if (!hospitalId) return;
      setIsUsersLoading(true);
      try {
        const response = await api.get(`/hospitals/${hospitalId}/users`);
        const data = response.data || [];
        setUsers(
          data.map((u: any) => ({
            id: u.id,
            fullName: u.fullName || u.name || u.email,
            email: u.email,
          }))
        );
      } catch (error) {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          clearSelection();
          logout();
          toast({
            title: 'Hospital not found',
            description: 'Your session is out of date. Please log in again.',
            variant: 'destructive',
          });
          return;
        }
        console.error('Failed to fetch users:', error);
        setUsers([]);
      } finally {
        setIsUsersLoading(false);
      }
    };

    fetchUsers();
  }, [hospitalId, clearSelection, logout, toast]);

  useEffect(() => {
    const fetchBatch = async () => {
      if (!hospitalId || !runForm.year || !runForm.month) return;
      if (!canManagePayroll) return;

      const batchKey = `${hospitalId}-${runForm.year}-${runForm.month}`;
      if (batchKey === lastBatchKeyRef.current) return;
      lastBatchKeyRef.current = batchKey;

      setIsAutoLoading(true);
      try {
        const result = await runPayrollBatchMutation.mutateAsync({
          year: Number(runForm.year),
          month: Number(runForm.month),
        });
        setRunResults(result);
      } catch (error) {
        console.error('Failed to load payroll preview:', error);
      } finally {
        setIsAutoLoading(false);
      }
    };

    fetchBatch();
  }, [hospitalId, runForm.year, runForm.month, canManagePayroll]);

  const selectedSetting = useMemo(() => payrollSettings.find((s) => s.userId === selectedEmployeeId), [payrollSettings, selectedEmployeeId]);

  useEffect(() => {
    if (selectedSetting) {
      setSettingsForm({
        monthlySalary: selectedSetting.monthlySalary.toString(),
        allowanceAmount: (selectedSetting.allowanceAmount ?? 0).toString(),
        otherDeductionAmount: (selectedSetting.otherDeductionAmount ?? 0).toString(),
        latePenaltyType: selectedSetting.latePenaltyType,
        leavePayType: selectedSetting.leavePayType,
      });
    } else if (selectedEmployeeId) {
      setSettingsForm({
        monthlySalary: '0',
        allowanceAmount: '0',
        otherDeductionAmount: '0',
        latePenaltyType: 'NONE',
        leavePayType: 'PAID',
      });
    }
  }, [selectedSetting, selectedEmployeeId]);

  const handleSaveSettings = async () => {
    if (!selectedEmployeeId) {
      toast({
        title: 'Select an employee',
        description: 'Choose an employee to configure payroll settings.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await upsertSettingMutation.mutateAsync({
        employeeId: selectedEmployeeId,
        payload: {
          monthlySalary: Number(settingsForm.monthlySalary || 0),
          allowanceAmount: Number(settingsForm.allowanceAmount || 0),
          otherDeductionAmount: Number(settingsForm.otherDeductionAmount || 0),
          latePenaltyType: settingsForm.latePenaltyType,
          leavePayType: settingsForm.leavePayType,
        },
      });

      toast({
        title: 'Payroll settings saved',
        description: 'Settings updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Failed to save settings',
        description: error instanceof Error ? error.message : 'Unable to save payroll settings.',
        variant: 'destructive',
      });
    }
  };

  const handleRunPayroll = async () => {
    try {
      const result = await generatePayrollBatchMutation.mutateAsync({
        year: Number(runForm.year),
        month: Number(runForm.month),
      });
      setRunResults(result);
      toast({
        title: 'Payroll generated',
        description: 'Payroll has been generated for all employees.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to calculate payroll.';
      toast({
        title: 'Payroll run failed',
        description: message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Payroll Module</h1>
        <p className="text-muted-foreground">Configure payroll settings per employee and calculate monthly payroll.</p>
      </div>

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="run">Run Payroll</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6">
          <Card className="p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Employee Payroll Settings</h2>
              <p className="text-sm text-muted-foreground">Monthly fixed salary, late penalty, and leave pay policy.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder={isUsersLoading ? 'Loading employees...' : 'Select employee'} />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monthly Salary</Label>
                <Input
                  type="number"
                  min={0}
                  value={settingsForm.monthlySalary}
                  onChange={(event) => setSettingsForm((prev) => ({ ...prev, monthlySalary: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Allowance Amount</Label>
                <Input
                  type="number"
                  min={0}
                  value={settingsForm.allowanceAmount}
                  onChange={(event) => setSettingsForm((prev) => ({ ...prev, allowanceAmount: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Other Deductions</Label>
                <Input
                  type="number"
                  min={0}
                  value={settingsForm.otherDeductionAmount}
                  onChange={(event) => setSettingsForm((prev) => ({ ...prev, otherDeductionAmount: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Late Penalty</Label>
                <Select
                  value={settingsForm.latePenaltyType}
                  onValueChange={(value) => setSettingsForm((prev) => ({ ...prev, latePenaltyType: value as LatePenaltyType }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Penalty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    <SelectItem value="HALF_DAY">Half Day Deduction</SelectItem>
                    <SelectItem value="ABSENT">Absent Deduction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Leave Pay</Label>
                <Select
                  value={settingsForm.leavePayType}
                  onValueChange={(value) => setSettingsForm((prev) => ({ ...prev, leavePayType: value as LeavePayType }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Leave Pay" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PAID">Paid</SelectItem>
                    <SelectItem value="UNPAID">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleSaveSettings} disabled={!canManagePayroll || upsertSettingMutation.isPending}>
              {upsertSettingMutation.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-lg font-semibold">Configured Employees</h3>
            {isSettingsLoading && <p>Loading payroll settings...</p>}
            {!isSettingsLoading && payrollSettings.length === 0 && <p>No payroll settings configured.</p>}
            {!isSettingsLoading && payrollSettings.length > 0 && (
              <div className="space-y-2">
                {payrollSettings.map((setting) => (
                  <div key={setting.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <div className="font-medium">{setting.user?.fullName || setting.user?.name || setting.user?.email}</div>
                      <div className="text-xs text-muted-foreground">{setting.user?.email || setting.userId}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">Salary: {setting.monthlySalary}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="run" className="space-y-6">
          <Card className="p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Run Payroll</h2>
              <p className="text-sm text-muted-foreground">Calculate monthly payroll for all employees based on attendance, leaves, and late rules.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Year</Label>
                <Input type="number" value={runForm.year} onChange={(event) => setRunForm((prev) => ({ ...prev, year: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Month</Label>
                <Select value={runForm.month} onValueChange={(value) => setRunForm((prev) => ({ ...prev, month: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">January</SelectItem>
                    <SelectItem value="2">February</SelectItem>
                    <SelectItem value="3">March</SelectItem>
                    <SelectItem value="4">April</SelectItem>
                    <SelectItem value="5">May</SelectItem>
                    <SelectItem value="6">June</SelectItem>
                    <SelectItem value="7">July</SelectItem>
                    <SelectItem value="8">August</SelectItem>
                    <SelectItem value="9">September</SelectItem>
                    <SelectItem value="10">October</SelectItem>
                    <SelectItem value="11">November</SelectItem>
                    <SelectItem value="12">December</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Payroll Preview</h3>
            </div>

            {(runPayrollBatchMutation.isPending || isAutoLoading) && <p>Loading payroll...</p>}
            {!runPayrollBatchMutation.isPending && !isAutoLoading && runResults.length === 0 && (
              <p className="text-sm text-muted-foreground">No payroll generated yet. Select month and click Generate Payroll.</p>
            )}

            {runResults.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="py-2 pr-4">Employee</th>
                      <th className="py-2 pr-4">Department</th>
                      <th className="py-2 pr-4">Role</th>
                      <th className="py-2 pr-4">Present</th>
                      <th className="py-2 pr-4">Absent</th>
                      <th className="py-2 pr-4">Approved Leaves</th>
                      <th className="py-2 pr-4">Net Salary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runResults.map((row) => (
                      <tr key={row.employeeId} className="border-b">
                        <td className="py-2 pr-4">
                          <div className="font-medium">{row.employeeName}</div>
                          {!row.configured && (
                            <div className="text-xs text-destructive">Payroll not configured</div>
                          )}
                        </td>
                        <td className="py-2 pr-4">{row.departmentName}</td>
                        <td className="py-2 pr-4">{row.role}</td>
                        <td className="py-2 pr-4">{row.counts.present}</td>
                        <td className="py-2 pr-4">{row.counts.absent}</td>
                        <td className="py-2 pr-4">{row.counts.onLeave}</td>
                        <td className="py-2 pr-4">{row.netPay}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-col items-end gap-2">
              {generatedStatus?.generated && (
                <p className="text-sm text-destructive">Payroll for this month has already been generated.</p>
              )}
              <Button
                onClick={handleRunPayroll}
                disabled={!canManagePayroll || generatePayrollBatchMutation.isPending || !!generatedStatus?.generated}
              >
                {generatePayrollBatchMutation.isPending ? 'Generating...' : 'Generate Payroll'}
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
