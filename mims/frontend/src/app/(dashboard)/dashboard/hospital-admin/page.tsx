'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@/lib/constants';
import api from '@/lib/api';
import {
  Users, Store, Activity, UserPlus, Building2, TrendingUp, ClipboardList,
  AlertCircle, ArrowLeftRight, Syringe, BedDouble, DoorOpen, FlaskConical,
  Stethoscope, PackageOpen, PackageX, HeartPulse, FileText, CalendarDays,
  Timer, Wallet, ReceiptText, RefreshCw, Clock, ChevronRight, AlertTriangle,
  CheckCircle2, XCircle, LogOut,
} from 'lucide-react';


// ─── Types ────────────────────────────────────────────────────────────────────

interface SectionCardProps {
  title: string;
  href: string;
  icon: React.ElementType;
  color: string;
  items: { label: string; value: string | number; sub?: string; badge?: { text: string; color: string } }[];
  loading: boolean;
}

function SectionCard({ title, href, icon: Icon, color, items, loading }: SectionCardProps) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    teal: 'bg-teal-50 text-teal-600 border-teal-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    pink: 'bg-pink-50 text-pink-600 border-pink-100',
    cyan: 'bg-cyan-50 text-cyan-600 border-cyan-100',
  };
  const cls = colors[color] || colors.blue;

  return (
    <div className="flex flex-col rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className={`flex items-center justify-between rounded-t-xl border-b px-4 py-3 ${cls}`}>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <a href={href} className="flex items-center gap-1 text-xs font-medium opacity-70 hover:opacity-100">
          View <ChevronRight className="h-3 w-3" />
        </a>
      </div>
      <div className="divide-y divide-gray-50 px-4 py-2">
        {loading
          ? [1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between py-2">
                <div className="h-3 w-28 animate-pulse rounded bg-gray-100" />
                <div className="h-3 w-12 animate-pulse rounded bg-gray-100" />
              </div>
            ))
          : items.map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2">
                <span className="text-xs text-gray-500">{item.label}</span>
                <div className="flex items-center gap-2">
                  {item.badge && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.badge.color}`}>
                      {item.badge.text}
                    </span>
                  )}
                  <span className="text-sm font-bold text-gray-800">{item.value}</span>
                  {item.sub && <span className="text-[10px] text-gray-400">{item.sub}</span>}
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}

function KpiCard({
  title, value, sub, icon: Icon, color, href, loading,
}: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; href?: string; loading: boolean;
}) {
  const bg: Record<string, string> = {
    blue: 'bg-blue-600', green: 'bg-emerald-600', purple: 'bg-purple-600',
    yellow: 'bg-amber-500', red: 'bg-red-600', indigo: 'bg-indigo-600',
    teal: 'bg-teal-600', orange: 'bg-orange-500',
  };
  const inner = (
    <div className={`flex items-center gap-4 rounded-xl p-4 text-white shadow-sm ${bg[color] || bg.blue}`}>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/20">
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium opacity-80">{title}</p>
        {loading ? (
          <div className="mt-1 h-7 w-20 animate-pulse rounded bg-white/30" />
        ) : (
          <p className="mt-0.5 text-2xl font-bold leading-none truncate">{value}</p>
        )}
        {sub && <p className="mt-1 text-[11px] opacity-70">{sub}</p>}
      </div>
    </div>
  );
  return href ? <a href={href}>{inner}</a> : inner;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HospitalAdminDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // ─── Data state ──────────────────────────────────────────────────────────────
  const [analytics, setAnalytics] = useState<any>(null);
  const [patientStats, setPatientStats] = useState<any>(null);
  const [inventoryStats, setInventoryStats] = useState<any>(null);
  const [lowStockAlerts, setLowStockAlerts] = useState<any[]>([]);
  const [expiringAlerts, setExpiringAlerts] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [roomOccupancy, setRoomOccupancy] = useState<any>(null);
  const [bedsAvailable, setBedsAvailable] = useState<any[]>([]);
  const [activeAdmissions, setActiveAdmissions] = useState<any[]>([]);
  const [operations, setOperations] = useState<any>(null);
  const [clinics, setClinics] = useState<any[]>([]);
  const [pharmacyStats, setPharmacyStats] = useState<any>(null);
  const [prescriptions, setPrescriptions] = useState<any>(null);
  const [labOrders, setLabOrders] = useState<any>(null);
  const [financialReport, setFinancialReport] = useState<any>(null);
  const [shiftStats, setShiftStats] = useState<any>(null);
  const [leaveStats, setLeaveStats] = useState<any>(null);
  const [payroll, setPayroll] = useState<any[]>([]);
  const [expenditure, setExpenditure] = useState<any>(null);
  const [systemUsers, setSystemUsers] = useState<any[]>([]);

  const hospitalId = user?.hospitalId;

  const fetchAll = useCallback(async () => {
    if (!hospitalId) return;
    setLoading(true);
    try {
      const safe = (p: Promise<any>) => p.catch(() => null);

      const [
        analyticsRes,
        patientRes,
        invStatsRes,
        lowStockRes,
        expiringRes,
        deptRes,
        roomRes,
        bedsRes,
        admissionsRes,
        operationsRes,
        clinicsRes,
        pharmacyRes,
        prescRes,
        labRes,
        financeRes,
        shiftsRes,
        leavesRes,
        payrollRes,
        expenditureRes,
        usersRes,
      ] = await Promise.all([
        safe(api.get(`/analytics/overview?hospitalId=${hospitalId}`)),
        safe(api.get(`/patients/stats?hospitalId=${hospitalId}`)),
        safe(api.get(`/inventory/stats?hospitalId=${hospitalId}`)),
        safe(api.get(`/inventory/alerts/low-stock?hospitalId=${hospitalId}&limit=5`)),
        safe(api.get(`/inventory/alerts/expiring?hospitalId=${hospitalId}&limit=5`)),
        safe(api.get(`/departments/hospital/${hospitalId}`)),
        safe(api.get(`/rooms/occupancy/${hospitalId}`)),
        safe(api.get(`/beds/available/${hospitalId}`)),
        safe(api.get(`/admissions/active/${hospitalId}`)),
        safe(api.get(`/operations?hospitalId=${hospitalId}&limit=5`)),
        safe(api.get(`/clinics?hospitalId=${hospitalId}`)),
        safe(api.get(`/pharmacies/stats/${hospitalId}`)),
        safe(api.get(`/prescriptions?hospitalId=${hospitalId}&limit=1`)),
        safe(api.get(`/lab-orders/statistics?hospitalId=${hospitalId}`)),
        safe(api.get(`/reports/financial-summary?hospitalId=${hospitalId}`)),
        safe(api.get(`/shifts/statistics/summary?hospitalId=${hospitalId}`)),
        safe(api.get(`/leaves/statistics/summary?hospitalId=${hospitalId}`)),
        safe(api.get(`/payroll/generated?hospitalId=${hospitalId}&limit=1`)),
        safe(api.get(`/expenditure/totals?hospitalId=${hospitalId}`)),
        safe(api.get(`/users?hospitalId=${hospitalId}&limit=100`)),
      ]);

      setAnalytics(analyticsRes?.data || null);
      setPatientStats(patientRes?.data || null);
      setInventoryStats(invStatsRes?.data || null);
      setLowStockAlerts(lowStockRes?.data?.data || lowStockRes?.data || []);
      setExpiringAlerts(expiringRes?.data?.data || expiringRes?.data || []);
      setDepartments(deptRes?.data?.data || deptRes?.data || []);
      setRoomOccupancy(roomRes?.data || null);
      setBedsAvailable(bedsRes?.data?.data || bedsRes?.data || []);
      setActiveAdmissions(admissionsRes?.data?.data || admissionsRes?.data || []);
      setOperations(operationsRes?.data || null);
      setClinics(clinicsRes?.data?.data || clinicsRes?.data || []);
      setPharmacyStats(pharmacyRes?.data || null);
      setPrescriptions(prescRes?.data || null);
      setLabOrders(labRes?.data || null);
      setFinancialReport(financeRes?.data || null);
      setShiftStats(shiftsRes?.data || null);
      setLeaveStats(leavesRes?.data || null);
      setPayroll(payrollRes?.data?.data || payrollRes?.data || []);
      setExpenditure(expenditureRes?.data || null);
      setSystemUsers(usersRes?.data?.data || usersRes?.data || []);
      setLastUpdated(new Date());
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [hospitalId]);

  useEffect(() => {
    if (!user) return;
    if (user.role !== UserRole.HOSPITAL_ADMIN) { router.push('/dashboard'); return; }
    fetchAll();
    const interval = setInterval(fetchAll, 60_000);
    return () => clearInterval(interval);
  }, [user, router, fetchAll]);

  // ─── Derived counts ───────────────────────────────────────────────────────────
  const kpis = analytics?.kpis;
  const totalBeds = bedsAvailable.length > 0 ? bedsAvailable.reduce((s: number, b: any) => s + (b.totalBeds ?? 1), 0) : null;
  const availBeds = bedsAvailable.length > 0 ? bedsAvailable.reduce((s: number, b: any) => s + (b.availableBeds ?? (b.status === 'AVAILABLE' ? 1 : 0)), 0) : null;

  // Role breakdown from users list
  const roleCount = systemUsers.reduce((acc: Record<string, number>, u: any) => {
    acc[u.role] = (acc[u.role] || 0) + 1; return acc;
  }, {});

  const operList: any[] = Array.isArray(operations?.data) ? operations.data
    : Array.isArray(operations) ? operations : [];
  const pendingOps = operList.filter((o: any) => o.status === 'SCHEDULED').length;
  const completedOps = operList.filter((o: any) => o.status === 'COMPLETED').length;

  const prescTotal = prescriptions?.total ?? prescriptions?.meta?.total ?? 0;

  return (
    <div className="space-y-6 pb-10">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hospital Admin Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Real-time overview · {user?.fullName}
            {lastUpdated && (
              <span className="ml-2 inline-flex items-center gap-1 text-gray-400">
                <Clock className="h-3 w-3" />
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Top KPIs ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard title="Total Patients" value={kpis?.totalPatients?.count ?? patientStats?.total ?? '—'} sub={`+${patientStats?.todayRegistrations ?? 0} today`} icon={Users} color="blue" href="/dashboard/patients" loading={loading} />
        <KpiCard title="Active Admissions" value={activeAdmissions.length} sub="currently admitted" icon={HeartPulse} color="red" href="/dashboard/receptionist" loading={loading} />
        <KpiCard title="Stock Value" value={kpis?.stockValue?.totalValue ? `$${Number(kpis.stockValue.totalValue).toLocaleString()}` : inventoryStats?.totalValue ? `$${Number(inventoryStats.totalValue).toLocaleString()}` : '—'} sub={`${inventoryStats?.availableBatches ?? 0} batches`} icon={PackageOpen} color="green" href="/dashboard/inventory" loading={loading} />
        <KpiCard title="Stock Alerts" value={(lowStockAlerts.length) + (expiringAlerts.length)} sub={`${lowStockAlerts.length} low · ${expiringAlerts.length} expiring`} icon={AlertTriangle} color="yellow" href="/dashboard/inventory" loading={loading} />
        <KpiCard title="Today Issuances" value={kpis?.totalIssues?.count ?? '—'} sub="medicines dispensed" icon={Syringe} color="purple" href="/dashboard/issuance" loading={loading} />
        <KpiCard title="Departments" value={departments.length} sub={`${clinics.length} clinics`} icon={Building2} color="indigo" href="/admin/departments" loading={loading} />
      </div>

      {/* ── Alert Banner ── */}
      {!loading && (lowStockAlerts.length > 0 || expiringAlerts.length > 0) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
          <span className="text-sm font-medium text-amber-800">
            {lowStockAlerts.length > 0 && <><strong>{lowStockAlerts.length}</strong> low-stock items · </>}
            {expiringAlerts.length > 0 && <><strong>{expiringAlerts.length}</strong> batches expiring soon</>}
          </span>
          <a href="/dashboard/inventory" className="ml-auto text-xs font-semibold text-amber-700 underline">View Inventory →</a>
        </div>
      )}

      {/* ── Section Grid ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

        {/* 1. System Users */}
        <SectionCard title="System Users" href="/dashboard/users" icon={Users} color="blue" loading={loading}
          items={[
            { label: 'Total Users', value: systemUsers.length },
            { label: 'Doctors', value: roleCount['DOCTOR'] ?? 0 },
            { label: 'Pharmacy Staff', value: (roleCount['PHARMACY_STAFF'] ?? 0) + (roleCount['MAIN_PHARMACY_MANAGER'] ?? 0) + (roleCount['SUB_PHARMACY_MANAGER'] ?? 0) },
            { label: 'Active', value: systemUsers.filter((u: any) => u.status === 'ACTIVE').length, badge: { text: 'ACTIVE', color: 'bg-green-100 text-green-700' } },
          ]}
        />

        {/* 2. Departments */}
        <SectionCard title="Departments" href="/admin/departments" icon={Building2} color="indigo" loading={loading}
          items={[
            { label: 'Total Departments', value: departments.length },
            { label: 'Sub-Departments', value: departments.reduce((s: number, d: any) => s + (d._count?.subDepartments ?? 0), 0) },
            { label: 'Clinics', value: clinics.length },
            { label: 'Available Clinics', value: clinics.filter((c: any) => c.isAvailable).length, badge: { text: 'OPEN', color: 'bg-green-100 text-green-700' } },
          ]}
        />

        {/* 3. Room Management */}
        <SectionCard title="Room Management" href="/admin/rooms" icon={DoorOpen} color="teal" loading={loading}
          items={[
            { label: 'Total Rooms', value: roomOccupancy?.totalRooms ?? '—' },
            { label: 'Occupied', value: roomOccupancy?.occupiedRooms ?? '—', badge: roomOccupancy?.occupiedRooms > 0 ? { text: 'OCCUPIED', color: 'bg-red-100 text-red-700' } : undefined },
            { label: 'Available', value: roomOccupancy?.availableRooms ?? '—', badge: { text: 'FREE', color: 'bg-green-100 text-green-700' } },
            { label: 'Occupancy Rate', value: roomOccupancy?.occupancyRate ? `${roomOccupancy.occupancyRate.toFixed(1)}%` : '—' },
          ]}
        />

        {/* 4. Bed Management */}
        <SectionCard title="Bed Management" href="/admin/beds" icon={BedDouble} color="cyan" loading={loading}
          items={[
            { label: 'Total Beds', value: totalBeds ?? bedsAvailable.length },
            { label: 'Available', value: availBeds ?? bedsAvailable.filter((b: any) => b.status === 'AVAILABLE').length, badge: { text: 'FREE', color: 'bg-green-100 text-green-700' } },
            { label: 'Occupied', value: bedsAvailable.filter((b: any) => b.status === 'OCCUPIED').length, badge: bedsAvailable.filter((b: any) => b.status === 'OCCUPIED').length > 0 ? { text: 'IN USE', color: 'bg-red-100 text-red-700' } : undefined },
            { label: 'Maintenance', value: bedsAvailable.filter((b: any) => b.status === 'MAINTENANCE').length },
          ]}
        />

        {/* 5. Operations */}
        <SectionCard title="Operations" href="/admin/operations" icon={Activity} color="purple" loading={loading}
          items={[
            { label: 'Total', value: operList.length },
            { label: 'Scheduled', value: pendingOps, badge: pendingOps > 0 ? { text: 'PENDING', color: 'bg-yellow-100 text-yellow-700' } : undefined },
            { label: 'Completed', value: completedOps, badge: completedOps > 0 ? { text: 'DONE', color: 'bg-green-100 text-green-700' } : undefined },
            { label: 'Cancelled', value: operList.filter((o: any) => o.status === 'CANCELLED').length },
          ]}
        />

        {/* 6. Clinics */}
        <SectionCard title="Clinics" href="/admin/clinics" icon={Stethoscope} color="blue" loading={loading}
          items={[
            { label: 'Total Clinics', value: clinics.length },
            { label: 'Available', value: clinics.filter((c: any) => c.isAvailable).length, badge: { text: 'OPEN', color: 'bg-green-100 text-green-700' } },
            { label: 'Unavailable', value: clinics.filter((c: any) => !c.isAvailable).length },
            { label: 'Departments', value: departments.length },
          ]}
        />

        {/* 7. Patient Admission */}
        <SectionCard title="Patient Admission" href="/dashboard/receptionist" icon={UserPlus} color="green" loading={loading}
          items={[
            { label: 'Active Admissions', value: activeAdmissions.length, badge: activeAdmissions.length > 0 ? { text: 'LIVE', color: 'bg-blue-100 text-blue-700' } : undefined },
            { label: 'Available Beds', value: availBeds ?? '—' },
            { label: "Today's Registrations", value: patientStats?.todayRegistrations ?? '—' },
            { label: 'Total Patients', value: patientStats?.total ?? '—' },
          ]}
        />

        {/* 8. Patient Discharge */}
        <SectionCard title="Patient Discharge" href="/ward/discharge" icon={LogOut} color="orange" loading={loading}
          items={[
            { label: 'Currently Admitted', value: activeAdmissions.length },
            { label: 'OPD Patients', value: patientStats?.byVisitType?.['OPD'] ?? '—' },
            { label: 'IPD Patients', value: patientStats?.byVisitType?.['IPD'] ?? '—' },
            { label: 'Emergency', value: patientStats?.byVisitType?.['EMERGENCY'] ?? '—' },
          ]}
        />

        {/* 9. Lab Services */}
        <SectionCard title="Lab Services" href="/lab/reports" icon={FlaskConical} color="pink" loading={loading}
          items={[
            { label: 'Total Orders', value: labOrders?.total ?? labOrders?.totalOrders ?? '—' },
            { label: 'Pending', value: labOrders?.pending ?? labOrders?.pendingOrders ?? '—', badge: (labOrders?.pending || labOrders?.pendingOrders) ? { text: 'PENDING', color: 'bg-yellow-100 text-yellow-700' } : undefined },
            { label: 'Completed', value: labOrders?.completed ?? labOrders?.completedOrders ?? '—' },
            { label: 'Today', value: labOrders?.today ?? labOrders?.todayOrders ?? '—' },
          ]}
        />

        {/* 10. Pharmacies */}
        <SectionCard title="Pharmacies" href="/dashboard/pharmacies" icon={Store} color="green" loading={loading}
          items={[
            { label: 'Total Pharmacies', value: pharmacyStats?.total ?? pharmacyStats?.totalPharmacies ?? '—' },
            { label: 'Active', value: pharmacyStats?.active ?? pharmacyStats?.activePharmacies ?? '—', badge: { text: 'ACTIVE', color: 'bg-green-100 text-green-700' } },
            { label: "Today's Issuances", value: pharmacyStats?.todayIssuances ?? kpis?.totalIssues?.count ?? '—' },
            { label: 'Pending Transfers', value: pharmacyStats?.pendingTransfers ?? (kpis?.totalTransfers ? kpis.totalTransfers.sent + kpis.totalTransfers.received : undefined) ?? '—' },
          ]}
        />

        {/* 11. Inventory */}
        <SectionCard title="Inventory" href="/dashboard/inventory" icon={PackageOpen} color="indigo" loading={loading}
          items={[
            { label: 'Total Batches', value: inventoryStats?.totalBatches ?? '—' },
            { label: 'Available Batches', value: inventoryStats?.availableBatches ?? '—', badge: { text: 'IN STOCK', color: 'bg-green-100 text-green-700' } },
            { label: 'Expired Batches', value: inventoryStats?.expiredBatches ?? '—', badge: (inventoryStats?.expiredBatches > 0) ? { text: 'EXPIRED', color: 'bg-red-100 text-red-700' } : undefined },
            { label: 'Total Qty', value: inventoryStats?.totalQuantity?.toLocaleString() ?? '—' },
          ]}
        />

        {/* 12. Stock Alerts */}
        <SectionCard title="Stock Alerts" href="/dashboard/inventory" icon={PackageX} color="red" loading={loading}
          items={[
            { label: 'Low Stock Items', value: lowStockAlerts.length, badge: lowStockAlerts.length > 0 ? { text: 'ALERT', color: 'bg-red-100 text-red-700' } : { text: 'OK', color: 'bg-green-100 text-green-700' } },
            { label: 'Expiring Soon', value: expiringAlerts.length, badge: expiringAlerts.length > 0 ? { text: 'WARN', color: 'bg-amber-100 text-amber-700' } : { text: 'OK', color: 'bg-green-100 text-green-700' } },
            { label: 'Depleted Batches', value: inventoryStats?.depletedBatches ?? '—' },
            { label: 'Total Alerts', value: (lowStockAlerts.length) + (expiringAlerts.length) + (inventoryStats?.expiredBatches ?? 0) },
          ]}
        />

        {/* 13. Patients */}
        <SectionCard title="Patients" href="/dashboard/patients" icon={Users} color="teal" loading={loading}
          items={[
            { label: 'Total Registered', value: patientStats?.total ?? kpis?.totalPatients?.count ?? '—' },
            { label: "Today's Registrations", value: patientStats?.todayRegistrations ?? '—', badge: patientStats?.todayRegistrations > 0 ? { text: 'TODAY', color: 'bg-blue-100 text-blue-700' } : undefined },
            { label: 'Male', value: patientStats?.byGender?.['MALE'] ?? '—' },
            { label: 'Female', value: patientStats?.byGender?.['FEMALE'] ?? '—' },
          ]}
        />

        {/* 14. Prescriptions */}
        <SectionCard title="Prescriptions" href="/dashboard/prescriptions" icon={FileText} color="purple" loading={loading}
          items={[
            { label: 'Total', value: prescTotal || prescriptions?.meta?.total || '—' },
            { label: 'Active', value: prescriptions?.activeCount ?? prescriptions?.active ?? '—', badge: { text: 'ACTIVE', color: 'bg-green-100 text-green-700' } },
            { label: 'Dispensed', value: prescriptions?.dispensedCount ?? prescriptions?.dispensed ?? '—' },
            { label: 'Today', value: prescriptions?.todayCount ?? prescriptions?.today ?? '—' },
          ]}
        />

        {/* 15. Financial Reports */}
        <SectionCard title="Financial Reports" href="/dashboard/reports" icon={ReceiptText} color="green" loading={loading}
          items={[
            { label: 'Total Revenue', value: financialReport?.totalRevenue ? `$${Number(financialReport.totalRevenue).toLocaleString()}` : '—' },
            { label: 'Total Receipts', value: financialReport?.totalReceipts ?? financialReport?.receipts ?? '—' },
            { label: 'Total Payments', value: financialReport?.totalPayments ? `$${Number(financialReport.totalPayments).toLocaleString()}` : '—' },
            { label: 'Pending', value: financialReport?.pendingPayments ?? '—', badge: financialReport?.pendingPayments > 0 ? { text: 'DUE', color: 'bg-yellow-100 text-yellow-700' } : undefined },
          ]}
        />

        {/* 16. Attendance Dashboard */}
        <SectionCard title="Attendance Dashboard" href="/dashboard/attendance" icon={CalendarDays} color="indigo" loading={loading}
          items={[
            { label: 'Total Shifts', value: shiftStats?.totalShifts ?? '—' },
            { label: 'Active Shifts', value: shiftStats?.activeShifts ?? '—', badge: { text: 'LIVE', color: 'bg-green-100 text-green-700' } },
            { label: 'Total Assignments', value: shiftStats?.totalAssignments ?? '—' },
            { label: 'Pending Leaves', value: leaveStats?.pending ?? '—', badge: leaveStats?.pending > 0 ? { text: 'PENDING', color: 'bg-yellow-100 text-yellow-700' } : undefined },
          ]}
        />

        {/* 17. Shifts */}
        <SectionCard title="Shifts" href="/dashboard/attendance/shifts" icon={Timer} color="blue" loading={loading}
          items={[
            { label: 'Total Shifts', value: shiftStats?.totalShifts ?? '—' },
            { label: 'Active', value: shiftStats?.activeShifts ?? '—', badge: { text: 'ACTIVE', color: 'bg-green-100 text-green-700' } },
            { label: 'Inactive', value: shiftStats?.inactiveShifts ?? '—' },
            { label: 'Assignments', value: shiftStats?.totalAssignments ?? '—' },
          ]}
        />

        {/* 18. Leaves */}
        <SectionCard title="Leaves" href="/dashboard/attendance/leaves" icon={CalendarDays} color="orange" loading={loading}
          items={[
            { label: 'Total Requests', value: leaveStats?.total ?? '—' },
            { label: 'Pending', value: leaveStats?.pending ?? '—', badge: leaveStats?.pending > 0 ? { text: 'PENDING', color: 'bg-yellow-100 text-yellow-700' } : undefined },
            { label: 'Approved', value: leaveStats?.approved ?? '—', badge: { text: 'APPROVED', color: 'bg-green-100 text-green-700' } },
            { label: 'Approved Days', value: leaveStats?.totalApprovedDays ?? '—' },
          ]}
        />

        {/* 19. Payroll */}
        <SectionCard title="Payroll" href="/dashboard/payroll" icon={Wallet} color="purple" loading={loading}
          items={[
            { label: 'Last Generated', value: payroll[0]?.period ?? payroll[0]?.month ?? '—' },
            { label: 'Total Net Pay', value: payroll[0]?.totalNetPay ? `$${Number(payroll[0].totalNetPay).toLocaleString()}` : '—' },
            { label: 'Employees', value: payroll[0]?.employeeCount ?? payroll.length },
            { label: 'Status', value: payroll[0]?.status ?? '—', badge: payroll[0]?.status === 'PROCESSED' ? { text: 'DONE', color: 'bg-green-100 text-green-700' } : { text: 'PENDING', color: 'bg-yellow-100 text-yellow-700' } },
          ]}
        />

        {/* 20. Expenditure */}
        <SectionCard title="Expenditure" href="/dashboard/expenditure" icon={TrendingUp} color="red" loading={loading}
          items={[
            { label: 'Total Expenditure', value: expenditure?.total ? `$${Number(expenditure.total).toLocaleString()}` : expenditure?.totalAmount ? `$${Number(expenditure.totalAmount).toLocaleString()}` : '—' },
            { label: 'This Month', value: expenditure?.thisMonth ? `$${Number(expenditure.thisMonth).toLocaleString()}` : '—' },
            { label: 'Categories', value: expenditure?.categories ?? expenditure?.totalCategories ?? '—' },
            { label: 'Pending', value: expenditure?.pending ?? '—', badge: expenditure?.pending > 0 ? { text: 'PENDING', color: 'bg-yellow-100 text-yellow-700' } : undefined },
          ]}
        />

      </div>

      {/* ── Active Admissions Table ── */}
      {!loading && activeAdmissions.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <HeartPulse className="h-4 w-4 text-red-500" />
              Active Admissions ({activeAdmissions.length})
            </h3>
            <a href="/dashboard/receptionist" className="text-xs text-blue-600 hover:underline">View All →</a>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                <th className="px-4 py-2">Patient</th>
                <th className="px-4 py-2">MRN</th>
                <th className="px-4 py-2">Room/Bed</th>
                <th className="px-4 py-2">Admitted</th>
                <th className="px-4 py-2">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {activeAdmissions.slice(0, 5).map((a: any) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-800">{a.patient?.fullName ?? a.patientName ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-500">{a.patient?.nrNumber ?? a.nrNumber ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-500">{a.room?.name ?? a.bed?.room?.name ?? '—'} / {a.bed?.bedNumber ?? a.bedNumber ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-500">{a.admissionDate ? new Date(a.admissionDate).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">{a.status ?? 'ACTIVE'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Stock Alerts Detail ── */}
      {!loading && lowStockAlerts.length > 0 && (
        <div className="rounded-xl border border-red-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-red-100 px-5 py-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Low Stock Items ({lowStockAlerts.length})
            </h3>
            <a href="/dashboard/inventory" className="text-xs text-blue-600 hover:underline">View All →</a>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="bg-red-50 text-left text-xs font-semibold uppercase text-gray-500">
                <th className="px-4 py-2">Medicine</th>
                <th className="px-4 py-2">Pharmacy</th>
                <th className="px-4 py-2">Available Qty</th>
                <th className="px-4 py-2">Alert Level</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {lowStockAlerts.slice(0, 5).map((a: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-800">{a.medicineName ?? a.medicine?.name ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-500">{a.pharmacyName ?? a.pharmacy?.name ?? '—'}</td>
                    <td className="px-4 py-2 font-bold text-red-600">{a.availableQty ?? a.qtyAvailable ?? '—'}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">LOW</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <p className="text-center text-xs text-gray-400">
        Auto-refreshes every 60 seconds · M-IMS Hospital Admin Dashboard
      </p>
    </div>
  );
}

