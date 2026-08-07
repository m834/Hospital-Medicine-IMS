'use client';

/**
 * Item Dispensing Report
 * Every time one medicine was given to a patient, with a date-range filter,
 * total dispensed, and print / export.
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Printer, FileDown, Search, PackageX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DateInput } from '@/components/ui/date-input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import api from '@/lib/api';
import { formatMRN } from '@/lib/mrn';
import { format } from 'date-fns';

interface ReportRow {
  dispensedAt: string;
  patientName: string | null;
  nrNumber: string;
  quantity: number;
  dispensedBy: string | null;
  batchNo: string | null;
  category: 'NORMAL' | 'LP' | null;
  reference: string;
  source: 'PRESCRIPTION' | 'ISSUANCE';
}

interface Report {
  medicine: {
    id: string;
    name: string;
    genericName?: string | null;
    strength?: string | null;
    form: string;
  };
  rows: ReportRow[];
  totalQuantity: number;
  totalRecords: number;
}

// dd/mm/yyyy from the shared DateInput -> yyyy-mm-dd for the API
const toIsoDate = (value: string): string | undefined => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined;
};

export default function DispensingReportPage() {
  const router = useRouter();
  const params = useParams();
  const medicineId = String(params?.medicineId ?? '');

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Default is all-time: both blank
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [appliedRange, setAppliedRange] = useState<{ from?: string; to?: string }>({});

  const load = useCallback(
    async (range: { from?: string; to?: string }) => {
      if (!medicineId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/inventory/dispensing-report/${medicineId}`, {
          params: { from: range.from, to: range.to },
        });
        setReport(res.data ?? null);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load the dispensing report');
        setReport(null);
      } finally {
        setLoading(false);
      }
    },
    [medicineId],
  );

  useEffect(() => {
    void load({});
  }, [load]);

  const applyFilter = () => {
    const range = { from: toIsoDate(fromDate), to: toIsoDate(toDate) };
    setAppliedRange(range);
    void load(range);
  };

  const clearFilter = () => {
    setFromDate('');
    setToDate('');
    setAppliedRange({});
    void load({});
  };

  const medicineLabel = report
    ? [report.medicine.name, report.medicine.strength, report.medicine.form]
        .filter(Boolean)
        .join(' · ')
    : '';

  const rangeLabel =
    appliedRange.from || appliedRange.to
      ? `${appliedRange.from ?? 'start'} to ${appliedRange.to ?? 'today'}`
      : 'All time';

  const formatWhen = (value: string) => format(new Date(value), 'dd/MM/yyyy HH:mm');

  const handleExport = () => {
    if (!report || report.rows.length === 0) return;

    const header = [
      'Date/Time',
      'Patient Name',
      'MRN',
      'Quantity',
      'Dispensed By',
      'Batch No',
      'Category',
      'Reference',
      'Source',
    ];

    // Quote every field so names containing commas survive the round trip
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = report.rows.map((r) =>
      [
        formatWhen(r.dispensedAt),
        r.patientName ?? '',
        formatMRN(r.nrNumber),
        r.quantity,
        r.dispensedBy ?? '',
        r.batchNo ?? '',
        r.category ?? '',
        r.reference,
        r.source === 'PRESCRIPTION' ? 'Prescription' : 'Pharmacy issue',
      ]
        .map(escape)
        .join(','),
    );

    const csv = [
      `"Dispensing Report - ${medicineLabel}"`,
      `"Period","${rangeLabel}"`,
      `"Total dispensed","${report.totalQuantity}"`,
      '',
      header.map(escape).join(','),
      ...lines,
    ].join('\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dispensing-${report.medicine.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!report) return;

    const rowsHtml = report.rows
      .map(
        (r) => `
          <tr>
            <td>${formatWhen(r.dispensedAt)}</td>
            <td>${r.patientName ?? '—'}</td>
            <td>${formatMRN(r.nrNumber)}</td>
            <td class="num">${r.quantity}</td>
            <td>${r.dispensedBy ?? '—'}</td>
            <td>${r.batchNo ?? '—'}</td>
            <td>${r.source === 'PRESCRIPTION' ? 'Prescription' : 'Pharmacy issue'}</td>
          </tr>`,
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Dispensing Report - ${report.medicine.name}</title>
          <style>
            @page { size: A4; margin: 12mm; }
            body { font-family: Arial, sans-serif; color: #111827; }
            h1 { font-size: 18px; margin: 0 0 4px; }
            .meta { font-size: 12px; color: #374151; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #d1d5db; padding: 5px 7px; text-align: left; }
            th { background: #f3f4f6; }
            .num { text-align: right; }
            tfoot td { font-weight: 700; background: #f9fafb; }
          </style>
        </head>
        <body>
          <h1>Dispensing Report — ${medicineLabel}</h1>
          <div class="meta">
            Period: ${rangeLabel} · Records: ${report.totalRecords} · Printed: ${format(new Date(), 'dd/MM/yyyy HH:mm')}
          </div>
          <table>
            <thead>
              <tr>
                <th>Date/Time</th><th>Patient</th><th>MRN</th><th class="num">Qty</th>
                <th>Dispensed By</th><th>Batch</th><th>Source</th>
              </tr>
            </thead>
            <tbody>${rowsHtml || '<tr><td colspan="7">No dispensing records</td></tr>'}</tbody>
            <tfoot>
              <tr>
                <td colspan="3">Total dispensed</td>
                <td class="num">${report.totalQuantity}</td>
                <td colspan="3"></td>
              </tr>
            </tfoot>
          </table>
        </body>
      </html>`;

    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
    document.body.appendChild(frame);
    const doc = frame.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      frame.onload = () => {
        setTimeout(() => {
          frame.contentWindow?.print();
          setTimeout(() => document.body.removeChild(frame), 100);
        }, 250);
      };
    }
  };

  return (
    <div className="container mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Dispensing Report</h1>
          <p className="text-sm text-muted-foreground">
            {loading && !report ? 'Loading…' : medicineLabel || 'Item'}
          </p>
        </div>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
          <CardDescription>Leave both dates blank for the complete history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">From</label>
              <DateInput value={fromDate} onChange={setFromDate} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">To</label>
              <DateInput value={toDate} onChange={setToDate} />
            </div>
            <Button onClick={applyFilter} disabled={loading}>
              <Search className="mr-2 h-4 w-4" />
              Apply
            </Button>
            {(appliedRange.from || appliedRange.to) && (
              <Button variant="outline" onClick={clearFilter} disabled={loading}>
                Clear
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                onClick={handlePrint}
                disabled={loading || !report || report.rows.length === 0}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={loading || !report || report.rows.length === 0}
              >
                <FileDown className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Showing: {rangeLabel}</p>
        </CardContent>
      </Card>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Dispensing History
            {report && (
              <Badge variant="secondary" className="ml-2">
                {report.totalRecords}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Every time this item was given to a patient, newest first</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !report || report.rows.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-center">
              <PackageX className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium">No dispensing records</p>
              <p className="text-sm text-muted-foreground">
                {appliedRange.from || appliedRange.to
                  ? 'This item was not dispensed in the selected date range.'
                  : 'This item has never been dispensed to a patient.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>MRN</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Dispensed By</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((row, i) => (
                    <TableRow key={`${row.reference}-${i}`}>
                      <TableCell className="whitespace-nowrap">{formatWhen(row.dispensedAt)}</TableCell>
                      <TableCell className="font-medium">{row.patientName ?? '—'}</TableCell>
                      <TableCell className="font-mono text-sm">{formatMRN(row.nrNumber)}</TableCell>
                      <TableCell className="text-right font-semibold">{row.quantity}</TableCell>
                      <TableCell>{row.dispensedBy ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{row.batchNo ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={row.source === 'PRESCRIPTION' ? 'secondary' : 'outline'}>
                          {row.source === 'PRESCRIPTION' ? 'Prescription' : 'Pharmacy issue'}
                        </Badge>
                        {row.category && (
                          <span className="ml-2 text-xs text-muted-foreground">{row.category}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 flex items-center justify-between rounded-lg bg-muted p-4">
                <span className="text-sm text-muted-foreground">
                  Total dispensed ({report.totalRecords} record{report.totalRecords === 1 ? '' : 's'})
                </span>
                <span className="text-lg font-bold">{report.totalQuantity.toLocaleString()}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
