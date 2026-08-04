'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import { UserRole } from '@/lib/constants';
import api from '@/lib/api';
import {
  Package, AlertTriangle, ArrowLeftRight, Syringe, Clock,
  TrendingUp, RefreshCw, Loader2, DollarSign, Archive,
  CheckCircle2, XCircle, ExternalLink, Eye,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts';
import Link from 'next/link';
import { formatMRN } from '@/lib/mrn';

const PIE_COLORS = ['#3b82f6', '#ef4444', '#6b7280'];
const BAR_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

interface InventoryStats {
  totalBatches: number;
  availableBatches: number;
  expiredBatches: number;
  depletedBatches: number;
  totalQuantity: number;
  totalValue: number;
  lowStock: number;
  expiringSoon: number;
}

interface IssuanceStats {
  totalIssues: number;
  todayIssues: number;
  totalAmount: number;
  todayAmount: number;
}

export default function MainPharmacyDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();

  const [invStats, setInvStats] = useState<InventoryStats | null>(null);
  const [issStats, setIssStats] = useState<IssuanceStats | null>(null);
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  const [stockAlerts, setStockAlerts] = useState<any[]>([]);
  const [expiringBatches, setExpiringBatches] = useState<any[]>([]);
  const [recentIssuances, setRecentIssuances] = useState<any[]>([]);
  const [frequentMedicines, setFrequentMedicines] = useState<any[]>([]);
  const [issuanceTrend, setIssuanceTrend] = useState<any[]>([]);
  const [subPharmacies, setSubPharmacies] = useState<any[]>([]);
  const [subPharmacyStats, setSubPharmacyStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [txTab, setTxTab] = useState<'transactions' | 'frequent'>('transactions');

  const pharmacyId = user?.pharmacyId;
  const hospitalId = user?.hospitalId || selectedHospital?.id;

  useEffect(() => {
    if (!user) return;
    if (user.role !== UserRole.MAIN_PHARMACY_MANAGER) {
      router.push('/dashboard');
      return;
    }
    fetchAll();
  }, [user]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.allSettled([
        fetchInvStats(),
        fetchIssStats(),
        fetchPendingTransfers(),
        fetchStockAlerts(),
        fetchExpiringBatches(),
        fetchRecentIssuances(),
        fetchFrequentMedicines(),
        fetchTrend(),
        fetchSubPharmacies(),
      ]);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, [pharmacyId, hospitalId]);

  // Build query params
  // p()  → hospital-wide (no pharmacyId) — main pharmacy sees ALL pharmacy data
  // pH() → scoped to this pharmacy (for transfer management)
  const p = (extra: Record<string, any> = {}) => {
    const base: Record<string, any> = {};
    if (hospitalId) base.hospitalId = hospitalId;
    return { ...base, ...extra };
  };

  const pH = (extra: Record<string, any> = {}) => {
    const base: Record<string, any> = {};
    if (pharmacyId) base.pharmacyId = pharmacyId;
    if (hospitalId) base.hospitalId = hospitalId;
    return { ...base, ...extra };
  };

  const fetchInvStats = async () => {
    try {
      const r = await api.get('/inventory/stats', { params: p() });
      setInvStats(r.data);
    } catch (e) { console.error('inv stats', e); }
  };

  const fetchIssStats = async () => {
    try {
      const r = await api.get('/issuance/stats', { params: p() });
      setIssStats(r.data);
    } catch (e) { console.error('iss stats', e); }
  };

  const fetchPendingTransfers = async () => {
    try {
      const r = await api.get('/transfers', { params: pH({ status: 'PENDING', limit: 5 }) });
      setPendingTransfers(r.data?.data || r.data || []);
    } catch (e) { console.error('transfers', e); }
  };

  const fetchStockAlerts = async () => {
    try {
      // Correct endpoint: /inventory/alerts/low-stock
      const r = await api.get('/inventory/alerts/low-stock', { params: p() });
      setStockAlerts((Array.isArray(r.data) ? r.data : r.data?.data || []).slice(0, 6));
    } catch (e) { console.error('alerts', e); }
  };

  const fetchExpiringBatches = async () => {
    try {
      // Correct endpoint: /inventory/alerts/expiring
      const r = await api.get('/inventory/alerts/expiring', { params: p({ days: 30 }) });
      setExpiringBatches((Array.isArray(r.data) ? r.data : r.data?.data || []).slice(0, 5));
    } catch (e) { console.error('expiring', e); }
  };

  const fetchRecentIssuances = async () => {
    try {
      const r = await api.get('/issuance', { params: p({ limit: 7, page: 1 }) });
      setRecentIssuances(r.data?.data || []);
    } catch (e) { console.error('issuances', e); }
  };

  const fetchFrequentMedicines = async () => {
    try {
      // /analytics/top-medicines?pharmacyId=&period=this_month
      const r = await api.get('/analytics/top-medicines', { params: p({ period: 'month' }) });
      setFrequentMedicines((Array.isArray(r.data) ? r.data : []).slice(0, 10));
    } catch (e) { console.error('top medicines', e); }
  };

  const fetchTrend = async () => {
    try {
      const r = await api.get('/issuance', { params: p({ limit: 200, page: 1 }) });
      const txns: any[] = r.data?.data || [];
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const label = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
        const dayStr = d.toDateString();
        const dayTxns = txns.filter(t => new Date(t.issuedAt).toDateString() === dayStr);
        days.push({
          day: label,
          issued: dayTxns.length,
          amount: Math.round(dayTxns.reduce((s, t) => s + Number(t.totalAmount || 0), 0)),
        });
      }
      setIssuanceTrend(days);
    } catch (e) { console.error('trend', e); }
  };

  const fetchSubPharmacies = async () => {
    try {
      if (!hospitalId) return;
      const r = await api.get('/pharmacies', { params: { hospitalId, type: 'SUB' } });
      // Also filter on client side in case backend doesn't support type param yet
      const subs: any[] = (r.data || []).filter((p: any) => p.type === 'SUB');
      setSubPharmacies(subs);
      // Fetch stats per sub-pharmacy
      const statsEntries = await Promise.allSettled(
        subs.map((sp) =>
          Promise.all([
            api.get('/inventory/stats', { params: { pharmacyId: sp.id, hospitalId } }),
            api.get('/issuance/stats', { params: { pharmacyId: sp.id, hospitalId } }),
          ]).then(([inv, iss]) => [sp.id, { inv: inv.data, iss: iss.data }] as [string, any])
        )
      );
      const statsMap: Record<string, any> = {};
      statsEntries.forEach((r) => {
        if (r.status === 'fulfilled') {
          const [id, data] = r.value;
          statsMap[id] = data;
        }
      });
      setSubPharmacyStats(statsMap);
    } catch (e) { console.error('sub pharmacies', e); }
  };

  const batchPieData = invStats
    ? [
        { name: 'Available', value: invStats.availableBatches },
        { name: 'Expired', value: invStats.expiredBatches },
        { name: 'Depleted', value: invStats.depletedBatches },
      ].filter(d => d.value > 0)
    : [];

  // ─── Stat Card ───────────────────────────────────────────────────────────
  const StatCard = ({ title, value, sub, icon: Icon, color, href, loading: l }: any) => (
    <Link href={href || '#'} className="block rounded-xl border bg-white p-5 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 font-medium truncate">{title}</p>
          {l
            ? <div className="mt-2 h-8 w-24 animate-pulse rounded bg-gray-200" />
            : <p className="mt-1 text-2xl font-bold text-gray-900">{value ?? '—'}</p>
          }
          {sub && !l && <p className="mt-1 text-xs text-gray-500 truncate">{sub}</p>}
        </div>
        <div className={`rounded-lg p-2.5 ml-3 flex-shrink-0 ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </Link>
  );

  // ─── Tab Button ──────────────────────────────────────────────────────────
  const Tab = ({ id, label, active, onClick }: any) => (
    <button
      onClick={() => onClick(id)}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );

  const fmtPKR = (v: number) => `PKR ${v.toLocaleString()}`;

  return (
    <div className="space-y-6 p-1">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Main Pharmacy Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : 'Loading data...'}
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {/* ── Stats Row 1 — Inventory ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Total Stock Value"
          value={fmtPKR(invStats?.totalValue || 0)}
          sub={`${(invStats?.totalBatches || 0).toLocaleString()} batches total`}
          icon={DollarSign} color="bg-blue-500" href="/dashboard/inventory" loading={loading}
        />
        <StatCard
          title="Available Batches"
          value={(invStats?.availableBatches ?? 0).toLocaleString()}
          sub={`${(invStats?.totalQuantity || 0).toLocaleString()} units in stock`}
          icon={Package} color="bg-green-500" href="/dashboard/inventory" loading={loading}
        />
        <StatCard
          title="Low Stock Items"
          value={(invStats?.lowStock ?? 0).toLocaleString()}
          sub="Need replenishment"
          icon={AlertTriangle} color="bg-red-500" href="/dashboard/inventory" loading={loading}
        />
        <StatCard
          title="Expiring in 30 Days"
          value={(invStats?.expiringSoon ?? 0).toLocaleString()}
          sub="Batches expiring soon"
          icon={Clock} color="bg-amber-500" href="/dashboard/inventory" loading={loading}
        />
      </div>

      {/* ── Stats Row 2 — Issuance ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Today's Issues"
          value={(issStats?.todayIssues ?? 0).toLocaleString()}
          sub={fmtPKR(issStats?.todayAmount || 0)}
          icon={Syringe} color="bg-purple-500" href="/dashboard/issuance" loading={loading}
        />
        <StatCard
          title="Total Issues (All Time)"
          value={(issStats?.totalIssues ?? 0).toLocaleString()}
          sub={fmtPKR(issStats?.totalAmount || 0)}
          icon={TrendingUp} color="bg-indigo-500" href="/dashboard/issuance" loading={loading}
        />
        <StatCard
          title="Pending Transfers"
          value={pendingTransfers.length.toLocaleString()}
          sub="Awaiting approval"
          icon={ArrowLeftRight} color="bg-orange-500" href="/dashboard/transfers" loading={loading}
        />
        <StatCard
          title="Expired Batches"
          value={(invStats?.expiredBatches ?? 0).toLocaleString()}
          sub="Needs disposal"
          icon={Archive} color="bg-gray-500" href="/dashboard/inventory" loading={loading}
        />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Issuance Trend — col-span-2 */}
        <div className="lg:col-span-2 rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">7-Day Issuance Trend</h2>
            <Link
              href="/dashboard/issuance"
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              <Eye className="h-3.5 w-3.5" /> View all
            </Link>
          </div>
          {loading ? (
            <div className="h-52 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={issuanceTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="mGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  formatter={(value: any, name: string) =>
                    name === 'amount' ? [`PKR ${Number(value).toLocaleString()}`, 'Amount'] : [value, 'Transactions']
                  }
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="issued"
                  name="Transactions"
                  stroke="#3b82f6"
                  fill="url(#mGrad)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Batch Status Pie */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">Batch Status</h2>
            <Link href="/dashboard/inventory" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
              <Eye className="h-3.5 w-3.5" /> View
            </Link>
          </div>
          {loading ? (
            <div className="h-52 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
            </div>
          ) : batchPieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={batchPieData}
                    cx="50%" cy="50%"
                    innerRadius={45} outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {batchPieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => [v.toLocaleString(), 'Batches']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1.5 mt-2">
                {batchPieData.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-gray-600">{item.name}</span>
                    </div>
                    <span className="font-semibold text-gray-900">{item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-52 flex flex-col items-center justify-center text-gray-400">
              <Package className="h-8 w-8 mb-2" />
              <p className="text-sm">No batch data available</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Frequent Medicines Bar Chart ── */}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800">Top 10 Most Dispensed Medicines (This Month)</h2>
          <Link href="/dashboard/issuance" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
            <Eye className="h-3.5 w-3.5" /> Full Report
          </Link>
        </div>
        {loading ? (
          <div className="h-56 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
          </div>
        ) : frequentMedicines.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center text-gray-400">
            <Syringe className="h-8 w-8 mb-2" />
            <p className="text-sm">No dispensing data for this month</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={frequentMedicines.map(m => ({
                name: m.name?.length > 14 ? m.name.slice(0, 14) + '…' : m.name,
                fullName: m.name,
                qty: m.totalQuantity,
                txns: m.transactionCount,
              }))}
              margin={{ top: 5, right: 10, left: 0, bottom: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs">
                      <p className="font-semibold text-gray-800 mb-1">{d.fullName}</p>
                      <p className="text-blue-600">Qty Issued: <b>{d.qty?.toLocaleString()}</b></p>
                      <p className="text-purple-600">Transactions: <b>{d.txns?.toLocaleString()}</b></p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="qty" name="Qty Issued" radius={[4, 4, 0, 0]}>
                {frequentMedicines.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Transactions / Frequent Tab Section ── */}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
            <Tab id="transactions" label="Recent Transactions" active={txTab === 'transactions'} onClick={setTxTab} />
            <Tab id="frequent" label="Frequent Transactions" active={txTab === 'frequent'} onClick={setTxTab} />
          </div>
          <Link
            href="/dashboard/issuance"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View All Transactions
          </Link>
        </div>

        {/* Transactions Tab */}
        {txTab === 'transactions' && (
          <>
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
                ))}
              </div>
            ) : recentIssuances.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <XCircle className="h-9 w-9 mb-2" />
                <p className="text-sm font-medium">No transactions found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-gray-500">
                      <th className="pb-2.5 font-medium">Receipt / NR</th>
                      <th className="pb-2.5 font-medium">Patient</th>
                      <th className="pb-2.5 font-medium">Pharmacy</th>
                      <th className="pb-2.5 font-medium">Items</th>
                      <th className="pb-2.5 font-medium">Amount</th>
                      <th className="pb-2.5 font-medium">Date & Time</th>
                      <th className="pb-2.5 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentIssuances.map((tx: any) => (
                      <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-2.5">
                          <span className="font-mono text-xs text-blue-600">{formatMRN(tx.nrNumber) || tx.id?.slice(0, 8)}</span>
                        </td>
                        <td className="py-2.5 font-medium text-gray-800">
                          {tx.patient?.fullName || '—'}
                        </td>
                        <td className="py-2.5 text-gray-500 text-xs">
                          {tx.pharmacy?.name || '—'}
                        </td>
                        <td className="py-2.5 text-gray-600">
                          {tx.items?.length ?? 0} item{tx.items?.length !== 1 ? 's' : ''}
                        </td>
                        <td className="py-2.5 font-semibold text-green-700">
                          PKR {Number(tx.totalAmount || 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 text-gray-500 text-xs">
                          <div>{new Date(tx.issuedAt).toLocaleDateString()}</div>
                          <div>{new Date(tx.issuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td className="py-2.5">
                          <Link
                            href={`/dashboard/issuance/${tx.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50 transition-colors"
                          >
                            <Eye className="h-3 w-3" /> View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Frequent Transactions Tab */}
        {txTab === 'frequent' && (
          <>
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
                ))}
              </div>
            ) : frequentMedicines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <Syringe className="h-9 w-9 mb-2" />
                <p className="text-sm font-medium">No dispensing data this month</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-gray-500">
                      <th className="pb-2.5 font-medium">#</th>
                      <th className="pb-2.5 font-medium">Medicine</th>
                      <th className="pb-2.5 font-medium">Generic Name</th>
                      <th className="pb-2.5 font-medium">Form</th>
                      <th className="pb-2.5 font-medium">Total Qty Issued</th>
                      <th className="pb-2.5 font-medium">Transactions</th>
                      <th className="pb-2.5 font-medium">Total Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {frequentMedicines.map((m: any, idx: number) => (
                      <tr key={m.medicineId || idx} className="hover:bg-gray-50 transition-colors">
                        <td className="py-2.5">
                          <span className="w-6 h-6 rounded-full text-xs font-bold text-white flex items-center justify-center" style={{ background: BAR_COLORS[idx % BAR_COLORS.length] }}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-2.5 font-medium text-gray-800">{m.name}</td>
                        <td className="py-2.5 text-gray-500 text-xs">{m.genericName || '—'}</td>
                        <td className="py-2.5">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">{m.form || '—'}</span>
                        </td>
                        <td className="py-2.5 font-semibold text-gray-900">{(m.totalQuantity || 0).toLocaleString()}</td>
                        <td className="py-2.5 text-gray-600">{(m.transactionCount || 0).toLocaleString()}</td>
                        <td className="py-2.5 font-semibold text-green-700">PKR {Number(m.totalValue || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-3 flex justify-end">
              <Link
                href="/dashboard/issuance"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View Full Consumption Report
              </Link>
            </div>
          </>
        )}
      </div>

      {/* ── Sub-Pharmacy Overview ── */}
      {subPharmacies.length > 0 && (
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">Sub-Pharmacy Overview</h2>
            <Link href="/dashboard/transfers" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
              <Eye className="h-3.5 w-3.5" /> Manage Transfers
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subPharmacies.map((sp) => {
              const stats = subPharmacyStats[sp.id];
              const inv = stats?.inv;
              const iss = stats?.iss;
              return (
                <div key={sp.id} className="rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{sp.name}</p>
                      <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">{sp.code || 'SUB'}</span>
                    </div>
                    <Link href="/dashboard/inventory" className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100">
                      <Eye className="h-3.5 w-3.5 text-blue-600" />
                    </Link>
                  </div>
                  {loading || !stats ? (
                    <div className="space-y-1.5">
                      {[...Array(3)].map((_, i) => <div key={i} className="h-5 animate-pulse rounded bg-gray-100" />)}
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Available Batches</span>
                        <span className="font-semibold text-gray-800">{(inv?.availableBatches ?? 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Total Units</span>
                        <span className="font-semibold text-gray-800">{(inv?.totalQuantity ?? 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Today Issues</span>
                        <span className="font-semibold text-green-700">{(iss?.todayIssues ?? 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Today Amount</span>
                        <span className="font-semibold text-green-700">PKR {(iss?.todayAmount ?? 0).toLocaleString()}</span>
                      </div>
                      {(inv?.lowStock ?? 0) > 0 && (
                        <div className="flex justify-between pt-1 border-t border-red-100">
                          <span className="text-red-500 text-xs font-medium">⚠ Low Stock</span>
                          <span className="font-bold text-red-600 text-xs">{inv.lowStock} items</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Bottom 3-Col Section ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Low Stock Alerts */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-800">Low Stock Alerts</h2>
            <Link href="/dashboard/inventory" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
              <Eye className="h-3.5 w-3.5" /> View all
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />)}
            </div>
          ) : stockAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <CheckCircle2 className="h-8 w-8 mb-2 text-green-400" />
              <p className="text-sm">All stock levels OK</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stockAlerts.map((a: any, i: number) => (
                <div key={a.medicineId || i} className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2">
                  <div>
                    {/* Low stock alerts return medicineName (not medicine.name) */}
                    <p className="text-sm font-medium text-gray-800">{a.medicineName || a.medicine?.name}</p>
                    <p className="text-xs text-gray-500">{a.form || ''} {a.strength || ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-600">{(a.totalDispensingStock ?? a.totalStock ?? a.qtyAvailable ?? 0)} left</p>
                    <p className="text-xs text-gray-400">min: {a.reorderLevel ?? 10}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expiring Soon */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-800">Expiring Soon</h2>
            <Link href="/dashboard/inventory" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
              <Eye className="h-3.5 w-3.5" /> View all
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />)}
            </div>
          ) : expiringBatches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <CheckCircle2 className="h-8 w-8 mb-2 text-green-400" />
              <p className="text-sm">No batches expiring soon</p>
            </div>
          ) : (
            <div className="space-y-2">
              {expiringBatches.map((b: any) => {
                const daysLeft = Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / 86400000);
                return (
                  <div key={b.id} className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2">
                    <div>
                      {/* Expiring batches return medicine.name (nested object) */}
                      <p className="text-sm font-medium text-gray-800">{b.medicine?.name}</p>
                      <p className="text-xs text-gray-500">Batch: {b.batchNo} · {b.qtyAvailable} units</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${daysLeft <= 7 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {daysLeft}d
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pending Transfers */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-800">Pending Transfers</h2>
            <Link href="/dashboard/transfers?status=PENDING" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
              <Eye className="h-3.5 w-3.5" /> View all
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />)}
            </div>
          ) : pendingTransfers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <CheckCircle2 className="h-8 w-8 mb-2 text-green-400" />
              <p className="text-sm">No pending transfers</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingTransfers.map((t: any) => (
                <div key={t.id} className="rounded-lg bg-orange-50 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-800">{t.requestNumber}</p>
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{t.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t.fromPharmacy?.name || '—'} → {t.toPharmacy?.name || '—'}
                  </p>
                  <p className="text-xs text-gray-400">{new Date(t.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
