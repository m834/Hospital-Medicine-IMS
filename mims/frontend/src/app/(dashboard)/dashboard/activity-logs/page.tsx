'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Download, Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  LOGIN: 'bg-purple-100 text-purple-800',
  LOGOUT: 'bg-gray-100 text-gray-700',
  FAILED_LOGIN: 'bg-orange-100 text-orange-800',
  CREATE_FAILED: 'bg-red-50 text-red-600',
  UPDATE_FAILED: 'bg-orange-50 text-orange-600',
  DELETE_FAILED: 'bg-red-50 text-red-600',
};

const MODULES = [
  'All', 'Auth', 'Medicines', 'Inventory', 'Prescriptions', 'Issuance',
  'Transfers', 'Patients', 'Visits', 'Users', 'Pharmacies', 'Hospitals',
  'Departments', 'Payments',
];

const ACTIONS = [
  'All', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'FAILED_LOGIN',
];

const PAGE_SIZE = 50;

interface AuditLog {
  id: string;
  userId: string;
  hospitalId: string;
  action: string;
  module?: string;
  entityType: string;
  entityId: string;
  description?: string;
  ipAddress?: string;
  timestamp: string;
  user?: {
    id: string;
    email: string;
    fullName?: string;
    role: string;
  };
}

interface LogsResponse {
  logs: AuditLog[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

export default function ActivityLogsPage() {
  const { user } = useAuthStore();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [module, setModule] = useState('All');
  const [action, setAction] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination (cursor-based but we simulate pages via offset)
  const [page, setPage] = useState(1);
  const [cursors, setCursors] = useState<(string | null)[]>([null]); // index 0 = page 1 cursor

  const fetchLogs = useCallback(async (cursorForPage: string | null = null) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      if (cursorForPage) params.set('cursor', cursorForPage);
      if (user.hospitalId && user.role !== 'MASTER_ADMIN' && user.role !== 'SUPER_ADMIN') {
        params.set('hospitalId', user.hospitalId);
      }
      if (search.trim()) params.set('searchText', search.trim());
      if (module !== 'All') params.set('module', module);
      if (action !== 'All') params.set('action', action);
      if (startDate) params.set('startDate', new Date(startDate).toISOString());
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        params.set('endDate', end.toISOString());
      }

      const resp = await api.get(`/audit-logs?${params.toString()}`);
      const data: LogsResponse = resp.data;
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      // Store next cursor for the NEXT page
      setCursors((prev) => {
        const updated = [...prev];
        updated[page] = data.nextCursor; // cursor for page+1
        return updated;
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  }, [user, search, module, action, startDate, endDate, page]);

  useEffect(() => {
    // Reset to page 1 when filters change
    setPage(1);
    setCursors([null]);
  }, [search, module, action, startDate, endDate]);

  useEffect(() => {
    fetchLogs(cursors[page - 1] ?? null);
  }, [page, cursors[0]]); // re-run when page or initial cursor changes

  // Separate effect for filter changes
  useEffect(() => {
    fetchLogs(null);
  }, [search, module, action, startDate, endDate]);

  const handlePrev = () => {
    if (page > 1) setPage((p) => p - 1);
  };

  const handleNext = () => {
    const nextCursor = cursors[page];
    if (nextCursor) {
      setPage((p) => p + 1);
      fetchLogs(nextCursor);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Timestamp', 'User', 'Role', 'Module', 'Action', 'Description', 'Entity', 'IP'];
    const rows = logs.map((l) => [
      new Date(l.timestamp).toLocaleString(),
      l.user?.fullName || l.user?.email || l.userId,
      l.user?.role || '',
      l.module || l.entityType,
      l.action,
      l.description || '',
      `${l.entityType}:${l.entityId}`,
      l.ipAddress || '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasNext = !!(cursors[page]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Activity Logs</h1>
            <p className="text-sm text-muted-foreground">
              System-wide audit trail of all operations
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchLogs(cursors[page - 1] ?? null)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={logs.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search description, user, entity..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={module} onValueChange={setModule}>
              <SelectTrigger>
                <SelectValue placeholder="Module" />
              </SelectTrigger>
              <SelectContent>
                {MODULES.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger>
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                {ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-sm"
                title="From date"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-sm"
                title="To date"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats bar */}
      <div className="text-sm text-muted-foreground">
        {loading ? 'Loading...' : `${total.toLocaleString()} total records`}
        {total > 0 && !loading && (
          <span className="ml-2">
            — Page {page} of {Math.max(totalPages, 1)}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-red-700 text-sm">{error}</div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-32">IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j}>
                          <div className="h-4 bg-gray-100 rounded animate-pulse" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                      No activity logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {log.user?.fullName || log.user?.email || log.userId}
                        </div>
                        {log.user?.fullName && (
                          <div className="text-xs text-muted-foreground">{log.user.email}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {log.user?.role?.replace(/_/g, ' ') || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{log.module || log.entityType}</span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {log.action}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <span className="text-sm line-clamp-2">
                          {log.description || `${log.action} on ${log.entityType} (${log.entityId})`}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.ipAddress || '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Showing {logs.length} of {total.toLocaleString()} entries
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrev} disabled={page === 1 || loading}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={handleNext} disabled={!hasNext || loading}>
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
