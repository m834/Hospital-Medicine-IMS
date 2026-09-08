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
  UserRole.REGISTRATION_STAFF,
];

/**
 * Roles that see only their own row. The backend pins them to their own id off
 * the token, so this only decides which filters are worth showing.
 */
const SELF_SCOPED_ROLES: UserRole[] = [UserRole.REGISTRATION_STAFF];

const ALL_DEPARTMENTS = 'ALL';
const ALL_STAFF = 'ALL';

type ReportMode = 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'DAY' | 'RANGE';

const MODE_LABELS: Record<ReportMode, string> = {
  TODAY: 'Today',
  YESTERDAY: 'Yesterday',
  THIS_WEEK: 'This week',
  THIS_MONTH: 'This month',
  DAY: 'A specific day',
  RANGE: 'Date range',
};

/**
 * Local calendar date, not UTC: at the desk in Karachi an ISO/UTC "today" still
 * reads as yesterday until 5am, which would quietly report the wrong day.
 */
const toISODate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;

const today = () => toISODate(new Date());

const daysAgo = (count: number) => {
  const date = new Date();
  date.setDate(date.getDate() - count);
  return date;
};

/** Monday, the first working day of the week at the desk. */
const startOfWeek = () => {
  const date = new Date();
  const weekday = (date.getDay() + 6) % 7; // Sunday is 0; make Monday 0
  date.setDate(date.getDate() - weekday);
  return date;
};

const startOfMonth = () => {
  const date = new Date();
  date.setDate(1);
  return date;
};

/** The date range a preset stands for. DAY and RANGE come from the pickers. */
const rangeForMode = (mode: ReportMode): { from: string; to: string } | null => {
  switch (mode) {
    case 'TODAY':
      return { from: today(), to: today() };
    case 'YESTERDAY':
      return { from: toISODate(daysAgo(1)), to: toISODate(daysAgo(1)) };
    case 'THIS_WEEK':
      return { from: toISODate(startOfWeek()), to: today() };
    case 'THIS_MONTH':
      return { from: toISODate(startOfMonth()), to: today() };
    default:
      return null;
  }
};

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
  // A registration staff member gets their own row and nothing else, so the
  // filters that pick other people are not worth showing them.
  const isSelfScoped = !!user && SELF_SCOPED_ROLES.includes(user.role as UserRole);

  const [mode, setMode] = useState<ReportMode>('TODAY');
  const [day, setDay] = useState(today);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [departmentId, setDepartmentId] = useState<string>(ALL_DEPARTMENTS);
  const [staffId, setStaffId] = useState<string>(ALL_STAFF);

  useEffect(() => {
    if (user && !hasAccess) {
      router.push('/unauthorized');
    }
  }, [user, hasAccess, router]);

  // A preset resolves to a range; a single day is that range collapsed onto one.
  const preset = rangeForMode(mode);
  const from = preset ? preset.from : mode === 'DAY' ? day : startDate;
  const to = preset ? preset.to : mode === 'DAY' ? day : endDate;

  const invalidRange = !!from && !!to && from > to;

  const { data: departmentsData } = useDepartments({ hospitalId: isSelfScoped ? undefined : hospitalId });
  const departments: Department[] = Array.isArray(departmentsData) ? departmentsData : [];

  const { data, isLoading, isError, error } = useRegistrationReport({
    hospitalId: hasAccess && !invalidRange ? hospitalId : undefined,
    startDate: from,
    endDate: to,
    departmentId: departmentId === ALL_DEPARTMENTS ? undefined : departmentId,
    staffId: staffId === ALL_STAFF ? undefined : staffId,
  });

  const staffOptions = data?.staffOptions ?? [];

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
        <h1 className="text-2xl font-bold">
          {isSelfScoped ? 'My Registration Report' : 'Registration Report'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isSelfScoped
            ? 'The patients you registered and the lab tests charged against them.'
            : 'Patient registrations and lab test revenue per registration staff member, grouped by department.'}
        </p>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
        <div className="space-y-2">
          <label className="text-sm font-medium">Period</label>
          <Select value={mode} onValueChange={(value) => setMode(value as ReportMode)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(MODE_LABELS) as ReportMode[]).map((value) => (
                <SelectItem key={value} value={value}>
                  {MODE_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {mode === 'DAY' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Date</label>
            <DateInput value={day} onChange={setDay} className="w-44" />
          </div>
        )}

        {mode === 'RANGE' && (
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

        {!isSelfScoped && (
          <>
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

            <div className="space-y-2">
              <label className="text-sm font-medium">Staff Member</label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger className="w-60">
                  <SelectValue placeholder="All staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_STAFF}>All staff</SelectItem>
                  {staffOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

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
        {!isSelfScoped && (
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
        )}
      </div>

      {isError && (
        <p className="text-sm text-rose-600">
          {(error as Error)?.message || 'Failed to load the registration report.'}
        </p>
      )}

      {!isLoading && data && data.departments.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {isSelfScoped
              ? 'You registered no patients in this period.'
              : 'No registrations or lab tests were recorded for this period.'}
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
