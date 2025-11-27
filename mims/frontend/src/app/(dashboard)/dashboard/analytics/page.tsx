'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Users,
  AlertTriangle,
  Clock,
  Activity,
} from 'lucide-react';

enum TimePeriod {
  TODAY = 'today',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
}

interface Pharmacy {
  id: string;
  name: string;
  type: string;
}

interface KPIs {
  stockValue: { totalValue: number; totalQuantity: number; batchCount: number };
  totalPatients: { count: number };
  totalIssues: { count: number; totalValue: number };
  totalTransfers: { sent: number; received: number };
  activeAlerts: { count: number };
  expiringBatches: { count: number; totalQuantity: number };
}

interface DashboardOverview {
  period: {
    label: string;
    startDate: string;
    endDate: string;
  };
  kpis: KPIs;
}

interface StockTrend {
  date: string;
  received: number;
  available: number;
}

interface ConsumptionTrend {
  date: string;
  totalQuantity: number;
  totalValue: number;
  transactionCount: number;
}

interface TopMedicine {
  medicineId: string;
  name: string;
  genericName?: string;
  form: string;
  totalQuantity: number;
  totalValue: number;
  transactionCount: number;
}

interface PharmacyPerformance {
  pharmacyId: string;
  pharmacyName: string;
  type: string;
  stockValue: number;
  stockQuantity: number;
  issueCount: number;
  issueValue: number;
  transferCount: number;
  activeAlerts: number;
}

interface ExpiryCategory {
  category: string;
  batchCount: number;
  totalQuantity: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function AnalyticsPage() {
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();

  const [period, setPeriod] = useState<TimePeriod>(TimePeriod.MONTH);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState<string>('');
  
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [stockTrends, setStockTrends] = useState<StockTrend[]>([]);
  const [consumptionTrends, setConsumptionTrends] = useState<ConsumptionTrend[]>([]);
  const [topMedicines, setTopMedicines] = useState<TopMedicine[]>([]);
  const [pharmacyPerformance, setPharmacyPerformance] = useState<PharmacyPerformance[]>([]);
  const [expiryAnalysis, setExpiryAnalysis] = useState<ExpiryCategory[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isHospitalAdmin = user?.role === 'HOSPITAL_ADMIN';

  // Fetch pharmacies
  useEffect(() => {
    const fetchPharmacies = async () => {
      try {
        const hospitalId = isSuperAdmin ? selectedHospital?.id : user?.hospitalId;
        if (!hospitalId) {
          console.log('No hospital ID available yet');
          return;
        }

        const response = await api.get('/pharmacies', {
          params: { hospitalId },
        });

        setPharmacies(response.data || []);
      } catch (err: any) {
        console.error('Error fetching pharmacies:', err);
        // Don't show error to user for pharmacy fetch - it's optional
      }
    };

    if (user) {
      fetchPharmacies();
    }
  }, [user, selectedHospital, isSuperAdmin]);

  // Fetch all analytics data
  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const hospitalId = isSuperAdmin ? selectedHospital?.id : user?.hospitalId;
      if (!hospitalId) {
        setError('Hospital not selected');
        return;
      }

      const params: any = {
        hospitalId,
        period,
      };

      if (selectedPharmacy) {
        params.pharmacyId = selectedPharmacy;
      }

      // Fetch all endpoints in parallel using api instance
      const [
        overviewRes,
        stockTrendsRes,
        consumptionTrendsRes,
        topMedicinesRes,
        pharmacyPerformanceRes,
        expiryAnalysisRes,
      ] = await Promise.all([
        api.get('/analytics/overview', { params }),
        api.get('/analytics/stock-trends', { params }),
        api.get('/analytics/consumption-trends', { params }),
        api.get('/analytics/top-medicines', { params }),
        api.get('/analytics/pharmacy-performance', { params }),
        api.get('/analytics/expiry-analysis', { params }),
      ]);

      setOverview(overviewRes.data);
      setStockTrends(stockTrendsRes.data);
      setConsumptionTrends(consumptionTrendsRes.data);
      setTopMedicines(topMedicinesRes.data);
      setPharmacyPerformance(pharmacyPerformanceRes.data);
      setExpiryAnalysis(expiryAnalysisRes.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && (selectedHospital || user.hospitalId)) {
      fetchAnalytics();
    }
  }, [period, selectedPharmacy, user, selectedHospital]);

  const formatCurrency = (value: number) => {
    return `Nu. ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatNumber = (value: number) => {
    return value.toLocaleString('en-IN');
  };

  if (loading && !overview) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Activity className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">Comprehensive insights and performance metrics</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Time Period</Label>
              <Select value={period} onValueChange={(value: TimePeriod) => setPeriod(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TimePeriod.TODAY}>Today</SelectItem>
                  <SelectItem value={TimePeriod.WEEK}>Last 7 Days</SelectItem>
                  <SelectItem value={TimePeriod.MONTH}>Last 30 Days</SelectItem>
                  <SelectItem value={TimePeriod.QUARTER}>Last 90 Days</SelectItem>
                  <SelectItem value={TimePeriod.YEAR}>Last Year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Pharmacy (Optional)</Label>
              <Select value={selectedPharmacy || 'all'} onValueChange={(value) => setSelectedPharmacy(value === 'all' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Pharmacies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pharmacies</SelectItem>
                  {pharmacies.map((pharmacy) => (
                    <SelectItem key={pharmacy.id} value={pharmacy.id}>
                      {pharmacy.name} ({pharmacy.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={fetchAnalytics} disabled={loading} className="w-full">
                {loading ? 'Refreshing...' : 'Refresh Data'}
              </Button>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {overview && (
            <div className="mt-4 text-sm text-gray-600">
              Showing data for: <span className="font-medium">{overview.period.label}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {overview && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Stock Value</p>
                    <p className="text-2xl font-bold mt-2">{formatCurrency(overview.kpis.stockValue.totalValue)}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatNumber(overview.kpis.stockValue.totalQuantity)} items
                    </p>
                  </div>
                  <Package className="h-12 w-12 text-blue-600 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Patients</p>
                    <p className="text-2xl font-bold mt-2">{formatNumber(overview.kpis.totalPatients.count)}</p>
                    <p className="text-xs text-gray-500 mt-1">Registered</p>
                  </div>
                  <Users className="h-12 w-12 text-green-600 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Medicine Issues</p>
                    <p className="text-2xl font-bold mt-2">{formatNumber(overview.kpis.totalIssues.count)}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatCurrency(overview.kpis.totalIssues.totalValue)} total
                    </p>
                  </div>
                  <TrendingUp className="h-12 w-12 text-purple-600 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Alerts</p>
                    <p className="text-2xl font-bold mt-2">{formatNumber(overview.kpis.activeAlerts.count)}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatNumber(overview.kpis.expiringBatches.count)} expiring soon
                    </p>
                  </div>
                  <AlertTriangle className="h-12 w-12 text-orange-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Stock Trends Chart */}
          {stockTrends.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Stock Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={stockTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(date) => new Date(date).toLocaleDateString()}
                      formatter={(value: number) => formatNumber(value)}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="received" stroke="#8884d8" name="Received" />
                    <Line type="monotone" dataKey="available" stroke="#82ca9d" name="Available" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Consumption Trends Chart */}
          {consumptionTrends.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Medicine Consumption Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={consumptionTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip
                      labelFormatter={(date) => new Date(date).toLocaleDateString()}
                      formatter={(value: number, name: string) => [
                        name === 'totalValue' ? formatCurrency(value) : formatNumber(value),
                        name,
                      ]}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="totalQuantity" fill="#8884d8" name="Quantity" />
                    <Bar yAxisId="right" dataKey="totalValue" fill="#82ca9d" name="Value (Nu.)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Top Medicines */}
          {topMedicines.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Medicines by Consumption</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={topMedicines} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={150} />
                    <Tooltip formatter={(value: number) => formatNumber(value)} />
                    <Legend />
                    <Bar dataKey="totalQuantity" fill="#8884d8" name="Quantity Issued" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Pharmacy Performance Comparison */}
          {pharmacyPerformance.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Pharmacy Performance Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={pharmacyPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="pharmacyName" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatNumber(value)} />
                    <Legend />
                    <Bar dataKey="issueCount" fill="#8884d8" name="Issues" />
                    <Bar dataKey="transferCount" fill="#82ca9d" name="Transfers" />
                    <Bar dataKey="activeAlerts" fill="#ffc658" name="Active Alerts" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Expiry Analysis */}
          {expiryAnalysis.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Stock Expiry Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={expiryAnalysis}
                        dataKey="batchCount"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                      >
                        {expiryAnalysis.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="space-y-4">
                    <h3 className="font-semibold">Expiry Details</h3>
                    {expiryAnalysis.map((category, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <div>
                            <p className="font-medium">{category.category}</p>
                            <p className="text-sm text-gray-600">{formatNumber(category.totalQuantity)} units</p>
                          </div>
                        </div>
                        <p className="text-lg font-semibold">{category.batchCount} batches</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
