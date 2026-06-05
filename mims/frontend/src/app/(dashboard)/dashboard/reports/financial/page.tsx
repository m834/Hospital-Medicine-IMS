'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateInput } from '@/components/ui/date-input';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import { useFinancialDetailed, FinancialReportPeriod } from '@/hooks/use-financial-reports';
import { DollarSign, TrendingDown, TrendingUp, Wallet } from 'lucide-react';

const periodOptions: { value: FinancialReportPeriod; label: string }[] = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Yearly' },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(value || 0);

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

export default function FinancialReportPage() {
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();
  const hospitalId = selectedHospital?.id || user?.hospitalId;

  const [period, setPeriod] = useState<FinancialReportPeriod>('MONTHLY');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const { data, isLoading } = useFinancialDetailed({
    hospitalId,
    period,
    date,
  });

  const profitColor = useMemo(() => {
    if (!data) return 'text-muted-foreground';
    return data.profitLoss >= 0 ? 'text-emerald-600' : 'text-rose-600';
  }, [data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Financial Reports</h1>
        <p className="text-sm text-muted-foreground">
          Income, expenses, payroll, and profit/loss for daily, weekly, monthly, and yearly periods.
        </p>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="space-y-2">
          <label className="text-sm font-medium">Report Period</label>
          <Select value={period} onValueChange={(value) => setPeriod(value as FinancialReportPeriod)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Reference Date</label>
          <DateInput value={date} onChange={setDate} className="w-48" />
        </div>
      </div>

      {data && (
        <div className="text-sm text-muted-foreground">
          Range: {formatDate(data.range.start)} - {formatDate(data.range.end)}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Income</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : formatCurrency(data?.totalIncome || 0)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500 bg-amber-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expenses</CardTitle>
            <Wallet className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : formatCurrency(data?.expenses || 0)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-rose-500 bg-rose-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payroll</CardTitle>
            <TrendingDown className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : formatCurrency(data?.payroll || 0)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-indigo-500 bg-indigo-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit / Loss</CardTitle>
            <TrendingUp className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${profitColor}`}>
              {isLoading ? '...' : formatCurrency(data?.profitLoss || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {data && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/20">
            <CardHeader>
              <CardTitle className="text-emerald-700">Income Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-700">Daily Clinic / OPD</span>
                  <span className="font-medium text-emerald-700">{formatCurrency(data.income.opd)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-blue-700">Lab Income</span>
                  <span className="font-medium text-blue-700">{formatCurrency(data.income.lab)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-rose-700">Operation / Surgery</span>
                  <span className="font-medium text-rose-700">{formatCurrency(data.income.operation)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-indigo-700">Room / Bed Charges</span>
                  <span className="font-medium text-indigo-700">{formatCurrency(data.income.room)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-amber-700">Pharmacy Income</span>
                  <span className="font-medium text-amber-700">{formatCurrency(data.income.pharmacy)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-700">Other Income</span>
                  <span className="font-medium text-slate-700">{formatCurrency(data.income.other)}</span>
                </div>
                <div className="border-t pt-2 flex items-center justify-between font-semibold">
                  <span>Total Income</span>
                  <span>{formatCurrency(data.totalIncome)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-rose-500 bg-rose-50/20">
            <CardHeader>
              <CardTitle className="text-rose-700">Payroll by Department</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(data.payrollByDepartment || {}).length === 0 ? (
                <p className="text-sm text-rose-600/70">No payroll records in this period.</p>
              ) : (
                <div className="space-y-2 text-sm">
                  {Object.entries(data.payrollByDepartment).map(([dept, total]) => (
                    <div key={dept} className="flex items-center justify-between">
                      <span className="text-rose-700">{dept}</span>
                      <span className="font-medium text-rose-700">{formatCurrency(total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
