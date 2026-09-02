'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DateInput } from '@/components/ui/date-input';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import { useDepartments, Department } from '@/hooks/use-departments';
import { useRegistrationReport } from '@/hooks/use-registration-report';
import { UserRole, ROLE_LABELS } from '@/lib/constants';
import { FlaskConical, UserPlus, Users, Wallet } from 'lucide-react';

/** Mirrors the @Roles list on GET /reports/registration. */
const ALLOWED_ROLES: UserRole[] = [
  UserRole.MASTER_ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.HOSPITAL_ADMIN,
  UserRole.REGISTRATION_STAFF_MANAGER,
];

const ALL_DEPARTMENTS = 'ALL';

type ReportMode = 'DAILY' | 'RANGE';

const today = () => new Date().toISOString().split('T')[0];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(value || 0);

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

export default function RegistrationReportPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();
  // The token is the source of truth; selectedHospital only ever fills in for a
  // platform admin, who carries no hospitalId of their own.
  const hospitalId = user?.hospitalId || selectedHospital?.id;

  const hasAccess = !!user && ALLOWED_ROLES.includes(user.role as UserRole);

  const [mode, setMode] = useState<ReportMode>('DAILY');
  const [day, setDay] = useState(today);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [departmentId, setDepartmentId] = useState<string>(ALL_DEPARTMENTS);

  useEffect(() => {
    if (user && !hasAccess) {
      router.push('/unauthorized');
    }
  }, [user, hasAccess, router]);

  // A daily report is the same range collapsed onto one day.
  const from = mode === 'DAILY' ? day : startDate;
  const to = mode === 'DAILY' ? day : endDate;

  const invalidRange = !!from && !!to && from > to;

  const { data: departmentsData } = useDepartments({ hospitalId });
  const departments: Department[] = Array.isArray(departmentsData) ? departmentsData : [];

  const { data, isLoading, isError, error } = useRegistrationReport({
    hospitalId: hasAccess && !invalidRange ? hospitalId : undefined,
    startDate: from,
    endDate: to,
    departmentId: departmentId === ALL_DEPARTMENTS ? undefined : departmentId,
  });

  const rangeLabel = useMemo(() => {
    if (!data) return null;
    return data.range.isSingleDay
      ? formatDate(data.range.start)
      : `${formatDate(data.range.start)} – ${formatDate(data.range.end)}`;
  }, [data]);

  if (!user || !hasAccess) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Registration Report</h1>
        <p className="text-sm text-muted-foreground">
          Patient registrations and lab test revenue per registration staff member, grouped by
          department.
        </p>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
        <div className="space-y-2">
          <label className="text-sm font-medium">Report Type</label>
          <Select value={mode} onValueChange={(value) => setMode(value as ReportMode)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DAILY">Daily</SelectItem>
              <SelectItem value="RANGE">Date Range</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {mode === 'DAILY' ? (
          <div className="space-y-2">
            <label className="text-sm font-medium">Date</label>
            <DateInput value={day} onChange={setDay} className="w-44" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">From</label>
              <DateInput value={startDate} onChange={setStartDate} className="w-44" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">To</label>
              <DateInput value={endDate} onChange={setEndDate} className="w-44" />
            </div>
          </>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Department</label>
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="w-60">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_DEPARTMENTS}>All departments</SelectItem>
              {departments.map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" onClick={() => window.print()} className="md:ml-auto">
          Print
        </Button>
      </div>

      {invalidRange && (
        <p className="text-sm text-rose-600">The From date must be on or before the To date.</p>
      )}

      {rangeLabel && <div className="text-sm text-muted-foreground">Period: {rangeLabel}</div>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-sky-500 bg-sky-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Patient Registrations</CardTitle>
            <UserPlus className="h-4 w-4 text-sky-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : (data?.totals.registrations ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lab Test Revenue</CardTitle>
            <FlaskConical className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : formatCurrency(data?.totals.labTestRevenue ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {isLoading ? '' : `${data?.totals.labTestOrders ?? 0} lab tests charged`}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500 bg-amber-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collected</CardTitle>
            <Wallet className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : formatCurrency(data?.totals.labTestCollected ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {isLoading
                ? ''
                : `${formatCurrency(data?.totals.labTestOutstanding ?? 0)} outstanding`}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-indigo-500 bg-indigo-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Staff Members</CardTitle>
            <Users className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : (data?.totals.staffCount ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {isError && (
        <p className="text-sm text-rose-600">
          {(error as Error)?.message || 'Failed to load the registration report.'}
        </p>
      )}

      {!isLoading && data && data.departments.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No registrations or lab tests were recorded for this period.
          </CardContent>
        </Card>
      )}

      {data?.departments.map((department) => (
        <Card key={department.departmentId ?? department.departmentName}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>{department.departmentName}</CardTitle>
            <div className="text-sm text-muted-foreground">
              {department.registrations.toLocaleString()} registrations ·{' '}
              {formatCurrency(department.labTestRevenue)} lab revenue
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Registrations</TableHead>
                    <TableHead className="text-right">Lab Tests</TableHead>
                    <TableHead className="text-right">Lab Revenue</TableHead>
                    <TableHead className="text-right">Collected</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {department.staff.map((row) => (
                    <TableRow key={row.staffId}>
                      <TableCell className="font-medium">{row.staffName}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.role ? ROLE_LABELS[row.role as UserRole] ?? row.role : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.registrations.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.labTestOrders.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.labTestRevenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.labTestCollected)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.labTestOutstanding)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold">
                    <TableCell colSpan={2}>Department total</TableCell>
                    <TableCell className="text-right">
                      {department.registrations.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {department.labTestOrders.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(department.labTestRevenue)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(department.labTestCollected)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(department.labTestOutstanding)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
