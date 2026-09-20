'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DateInput } from '@/components/ui/date-input';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import { useDepartments, Department } from '@/hooks/use-departments';
import {
  useRegistrationReport,
  RegistrationReportStaffRow,
} from '@/hooks/use-registration-report';
import { UserRole, ROLE_LABELS } from '@/lib/constants';
import { ChevronDown, ChevronRight, FlaskConical, UserPlus, Users, Wallet } from 'lucide-react';
import {
  CategoryRevenueChart,
  LabRevenueTrendChart,
  RegistrationTrendChart,
} from './charts';

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

/**
 * A bar behind the number, scaled against the biggest row. It carries the same
 * value the cell already prints, so it is decoration that happens to be useful
 * at a glance rather than the only way to read the table.
 */
function ShareBar({ value, max, tone }: { value: number; max: number; tone: string }) {
  // A zero row shows an empty track: a minimum-width stub would read as work
  // that did not happen.
  const width = value > 0 && max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;

  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
    </div>
  );
}

/** Desk roles get their own colour so a roster is scannable by role. */
const ROLE_TONES: Record<string, string> = {
  REGISTRATION_STAFF: 'bg-sky-100 text-sky-700',
  REGISTRATION_STAFF_MANAGER: 'bg-indigo-100 text-indigo-700',
  RECEPTIONIST: 'bg-violet-100 text-violet-700',
  HOSPITAL_ADMIN: 'bg-amber-100 text-amber-700',
  SUPER_ADMIN: 'bg-amber-100 text-amber-700',
  MASTER_ADMIN: 'bg-amber-100 text-amber-700',
};

function RoleBadge({ role }: { role: string | null }) {
  if (!role) return <span className="text-muted-foreground">—</span>;

  return (
    <Badge
      variant="secondary"
      className={`border-transparent font-medium ${ROLE_TONES[role] ?? 'bg-muted text-muted-foreground'}`}
    >
      {ROLE_LABELS[role as UserRole] ?? role}
    </Badge>
  );
}

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('en-PK', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
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
  // Which staff rows have their test breakdown open. Collapsed by default so
  // the table still reads as a summary on a busy day.
  const [openStaff, setOpenStaff] = useState<string[]>([]);

  const toggleStaff = (id: string) =>
    setOpenStaff((open) =>
      open.includes(id) ? open.filter((openId) => openId !== id) : [...open, id],
    );

  // Which category rows have their test list open in the Lab Tests tab.
  const [openCategories, setOpenCategories] = useState<string[]>([]);

  const toggleCategory = (category: string) =>
    setOpenCategories((open) =>
      open.includes(category)
        ? open.filter((openCategory) => openCategory !== category)
        : [...open, category],
    );

  const [tab, setTab] = useState<'PATIENTS' | 'LAB'>('PATIENTS');

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

  const { data, isLoading, isFetching, isError, error, dataUpdatedAt } = useRegistrationReport({
    hospitalId: hasAccess && !invalidRange ? hospitalId : undefined,
    startDate: from,
    endDate: to,
    departmentId: departmentId === ALL_DEPARTMENTS ? undefined : departmentId,
    staffId: staffId === ALL_STAFF ? undefined : staffId,
  });

  const staffOptions = data?.staffOptions ?? [];

  /**
   * With no staff member picked the manager reads the whole desk top-down, so
   * everyone on the roster gets a row — a quiet period shows zeros rather than
   * dropping the person off the list. Pick someone and the table becomes about
   * them alone: their own row, and nothing else to read past.
   */
  const staffRoster: RegistrationReportStaffRow[] = useMemo(() => {
    const worked = data?.staff ?? [];
    const idle = staffOptions
      .filter((option) => !worked.some((row) => row.staffId === option.id))
      .map((option) => ({
        staffId: option.id,
        staffName: option.fullName,
        role: option.role,
        departmentId: null,
        departmentName: '—',
        registrations: 0,
        labTestOrders: 0,
        labTestRevenue: 0,
        labTestCollected: 0,
        labTestOutstanding: 0,
        tests: [],
      }));

    const roster = [...worked, ...idle];

    // The backend already narrows the numbers to the picked staff member; this
    // drops the rest of the desk from the roster so the table matches them.
    return staffId === ALL_STAFF ? roster : roster.filter((row) => row.staffId === staffId);
  }, [data?.staff, staffOptions, staffId]);

  // Each tab ranks the desk by the number that tab is about.
  const patientRoster = useMemo(
    () =>
      [...staffRoster].sort(
        (a, b) => b.registrations - a.registrations || a.staffName.localeCompare(b.staffName),
      ),
    [staffRoster],
  );

  const labRoster = useMemo(
    () =>
      [...staffRoster].sort(
        (a, b) => b.labTestRevenue - a.labTestRevenue || a.staffName.localeCompare(b.staffName),
      ),
    [staffRoster],
  );

  // The busiest row sets the scale for every share bar in its table.
  const peakRegistrations = Math.max(1, ...staffRoster.map((row) => row.registrations));
  const peakLabRevenue = Math.max(1, ...staffRoster.map((row) => row.labTestRevenue));

  const selectedStaffName =
    staffId === ALL_STAFF
      ? null
      : staffOptions.find((option) => option.id === staffId)?.fullName ?? 'this staff member';

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
            : 'The registration desk top-down: who registered which patients, and the lab charges each of them raised.'}
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

      {rangeLabel && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>Period: {rangeLabel}</span>
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              {isFetching && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {isFetching
              ? 'Refreshing…'
              : `Live · updated ${new Date(dataUpdatedAt).toLocaleTimeString('en-PK', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}`}
          </span>
        </div>
      )}

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

      {data && (
        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
          <TabsList>
            <TabsTrigger value="PATIENTS" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Registered Patients
            </TabsTrigger>
            <TabsTrigger value="LAB" className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              Lab Tests
            </TabsTrigger>
          </TabsList>

          {/* Registrations only: no lab money in this tab, so the two halves of
              the desk's work are never read off the same table. */}
          <TabsContent value="PATIENTS" className="space-y-6">
            {data.daily.length > 1 && (
              <Card className="border-t-4 border-t-sky-500">
                <CardHeader>
                  <CardTitle className="text-base">Registrations per day</CardTitle>
                </CardHeader>
                <CardContent>
                  <RegistrationTrendChart data={data.daily} />
                </CardContent>
              </Card>
            )}

            {!isSelfScoped && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {selectedStaffName ? `Registration Staff — ${selectedStaffName}` : 'Registration Staff'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Staff Member</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead className="text-right">Registrations</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {patientRoster.map((row) => (
                          <TableRow
                            key={row.staffId}
                            className={row.staffId === staffId ? 'bg-muted/50' : undefined}
                          >
                            <TableCell className="font-medium">{row.staffName}</TableCell>
                            <TableCell>
                              <RoleBadge role={row.role} />
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {row.departmentName}
                            </TableCell>
                            <TableCell className="w-40 text-right">
                              <span
                                className={
                                  row.registrations > 0
                                    ? 'font-semibold text-sky-700'
                                    : 'text-muted-foreground'
                                }
                              >
                                {row.registrations.toLocaleString()}
                              </span>
                              <ShareBar
                                value={row.registrations}
                                max={peakRegistrations}
                                tone="bg-sky-500"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-semibold">
                          <TableCell colSpan={3}>Total</TableCell>
                          <TableCell className="text-right">
                            {data.totals.registrations.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>
                  {selectedStaffName
                    ? `Patients registered by ${selectedStaffName}`
                    : 'Patients registered'}
                </CardTitle>
                <div className="text-sm text-muted-foreground">
                  {data.patients.length.toLocaleString()} shown
                  {data.patientsTruncated && ' (newest 500)'}
                </div>
              </CardHeader>
              <CardContent>
                {data.patients.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No patients were registered in this period.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>MRN</TableHead>
                          <TableHead>Patient</TableHead>
                          <TableHead>Visit Type</TableHead>
                          <TableHead>Registered At</TableHead>
                          {!selectedStaffName && <TableHead>Registered By</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.patients.map((patient) => (
                          <TableRow key={patient.id}>
                            <TableCell className="font-mono text-xs">{patient.nrNumber}</TableCell>
                            <TableCell className="font-medium">{patient.fullName}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {patient.visitType ?? '—'}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDateTime(patient.registeredAt)}
                            </TableCell>
                            {!selectedStaffName && (
                              <TableCell className="text-muted-foreground">
                                {patient.staffName}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="LAB" className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-t-4 border-t-blue-500">
                <CardHeader>
                  <CardTitle className="text-base">Revenue by category</CardTitle>
                </CardHeader>
                <CardContent>
                  <CategoryRevenueChart data={data.categories} />
                </CardContent>
              </Card>

              {data.daily.length > 1 && (
                <Card className="border-t-4 border-t-emerald-500">
                  <CardHeader>
                    <CardTitle className="text-base">Lab revenue per day</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <LabRevenueTrendChart data={data.daily} />
                  </CardContent>
                </Card>
              )}
            </div>

            {!isSelfScoped && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {selectedStaffName
                      ? `Lab Charges — ${selectedStaffName}`
                      : 'Lab Charges by Staff Member'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Staff Member</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead className="text-right">Lab Tests</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-right">Collected</TableHead>
                          <TableHead className="text-right">Outstanding</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {labRoster.map((row) => {
                          const isOpen = openStaff.includes(row.staffId);
                          const hasTests = row.tests.length > 0;

                          return (
                            <Fragment key={row.staffId}>
                              <TableRow
                                className={row.staffId === staffId ? 'bg-muted/50' : undefined}
                              >
                                <TableCell className="font-medium">
                                  {hasTests ? (
                                    <button
                                      type="button"
                                      onClick={() => toggleStaff(row.staffId)}
                                      aria-expanded={isOpen}
                                      className="flex items-center gap-1 text-left hover:underline"
                                    >
                                      {isOpen ? (
                                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                      )}
                                      {row.staffName}
                                    </button>
                                  ) : (
                                    <span className="pl-5">{row.staffName}</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <RoleBadge role={row.role} />
                                </TableCell>
                                <TableCell className="text-right">
                                  {row.labTestOrders.toLocaleString()}
                                </TableCell>
                                <TableCell className="w-44 text-right">
                                  <span
                                    className={
                                      row.labTestRevenue > 0
                                        ? 'font-semibold text-emerald-700'
                                        : 'text-muted-foreground'
                                    }
                                  >
                                    {formatCurrency(row.labTestRevenue)}
                                  </span>
                                  <ShareBar
                                    value={row.labTestRevenue}
                                    max={peakLabRevenue}
                                    tone="bg-emerald-500"
                                  />
                                </TableCell>
                                <TableCell className="text-right text-amber-700">
                                  {formatCurrency(row.labTestCollected)}
                                </TableCell>
                                <TableCell className="text-right text-rose-700">
                                  {formatCurrency(row.labTestOutstanding)}
                                </TableCell>
                              </TableRow>

                              {isOpen && (
                                <TableRow className="bg-muted/40 hover:bg-muted/40">
                                  <TableCell colSpan={6} className="py-2">
                                    <div className="pl-5">
                                      <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                                        Tests charged
                                      </p>
                                      <ul className="space-y-1 text-sm">
                                        {row.tests.map((test) => (
                                          <li
                                            key={test.testName}
                                            className="flex max-w-md justify-between gap-4"
                                          >
                                            <span>
                                              {test.testName}
                                              {test.orders > 1 && (
                                                <span className="text-muted-foreground">
                                                  {' '}
                                                  × {test.orders}
                                                </span>
                                              )}
                                            </span>
                                            <span className="tabular-nums">
                                              {formatCurrency(test.revenue)}
                                            </span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          );
                        })}
                        <TableRow className="font-semibold">
                          <TableCell colSpan={2}>Total</TableCell>
                          <TableCell className="text-right">
                            {data.totals.labTestOrders.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(data.totals.labTestRevenue)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(data.totals.labTestCollected)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(data.totals.labTestOutstanding)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Category first, tests underneath: the manager asked what each
                kind of test brings in, not what each individual test does. */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedStaffName ? `Categories — ${selectedStaffName}` : 'Revenue by Category'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.categories.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No lab tests were charged in this period.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Tests</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.categories.map((category) => {
                          const isOpen = openCategories.includes(category.category);

                          return (
                            <Fragment key={category.category}>
                              <TableRow>
                                <TableCell className="font-medium">
                                  <button
                                    type="button"
                                    onClick={() => toggleCategory(category.category)}
                                    aria-expanded={isOpen}
                                    className="flex items-center gap-1 text-left hover:underline"
                                  >
                                    {isOpen ? (
                                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    )}
                                    {category.category}
                                  </button>
                                </TableCell>
                                <TableCell className="text-right">
                                  {category.orders.toLocaleString()}
                                </TableCell>
                                <TableCell className="w-48 text-right">
                                  <span className="font-semibold text-blue-700">
                                    {formatCurrency(category.revenue)}
                                  </span>
                                  <ShareBar
                                    value={category.revenue}
                                    max={data.categories[0]?.revenue ?? 0}
                                    tone="bg-blue-500"
                                  />
                                </TableCell>
                              </TableRow>

                              {isOpen &&
                                category.tests.map((test) => (
                                  <TableRow
                                    key={`${category.category}-${test.testName}`}
                                    className="bg-muted/40 hover:bg-muted/40"
                                  >
                                    <TableCell className="pl-10 text-sm">{test.testName}</TableCell>
                                    <TableCell className="text-right text-sm">
                                      {test.orders.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right text-sm">
                                      {formatCurrency(test.revenue)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                            </Fragment>
                          );
                        })}
                        <TableRow className="font-semibold">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right">
                            {data.totals.labTestOrders.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(data.totals.labTestRevenue)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* A single day is its own trend, so the table only earns its place
                once the range covers more than one. */}
            {data.daily.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Day by Day</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Registrations</TableHead>
                          <TableHead className="text-right">Lab Tests</TableHead>
                          <TableHead className="text-right">Lab Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.daily.map((entry) => (
                          <TableRow key={entry.date}>
                            <TableCell>{formatDate(entry.date)}</TableCell>
                            <TableCell className="text-right">
                              {entry.registrations.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              {entry.labTestOrders.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(entry.labTestRevenue)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-semibold">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right">
                            {data.totals.registrations.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {data.totals.labTestOrders.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(data.totals.labTestRevenue)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
