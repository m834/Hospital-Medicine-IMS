'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  Loader2,
  Database,
  Download,
  Trash2,
  ShieldAlert,
  CheckCircle,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';

interface TableMergeResult {
  table: string;
  inBackup: number;
  alreadyPresent: number;
  inserted: number;
  skipped: number;
  skipReasons: string[];
}

interface RestoreReport {
  dryRun: boolean;
  sourceFile: string;
  safetyBackup?: string;
  tables: TableMergeResult[];
  totalInserted: number;
  durationMs: number;
}

interface BackupManifest {
  filename: string;
  database: string;
  sizeBytes: number;
  createdAt: string;
  durationMs: number;
  triggeredBy: {
    id: string;
    fullName?: string;
    email?: string;
    role?: string;
  };
}

const BACKUP_ROLES = ['MASTER_ADMIN', 'SUPER_ADMIN'];

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function BackupsPage() {
  const { user } = useAuthStore();
  const canBackup = BACKUP_ROLES.includes(user?.role ?? '');

  const [backups, setBackups] = useState<BackupManifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // --- Restore ---
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<RestoreReport | null>(null);
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/backups');
      setBackups(res.data ?? []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load backups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canBackup) void load();
    else setLoading(false);
  }, [canBackup, load]);

  const takeBackup = async () => {
    setError('');
    setNotice('');
    setCreating(true);
    try {
      // The shared client times out at 30s, which is fine for ordinary calls
      // and far too short for dumping a real database. A large instance takes
      // minutes, so this one request gets its own budget.
      const res = await api.post('/backups', undefined, { timeout: 15 * 60 * 1000 });
      const made: BackupManifest = res.data;
      setNotice(`Backup created: ${made.filename} (${formatSize(made.sizeBytes)})`);
      await load();
    } catch (err: any) {
      // A timeout has no response body, so it needs saying separately —
      // otherwise it looks identical to the server refusing.
      if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message ?? '')) {
        setError(
          'The backup took longer than the request allowed. It may still be running on the server — ' +
            'wait a minute and press Refresh before trying again, so you do not start a second one.',
        );
      } else {
        setError(err.response?.data?.message || 'Backup failed');
      }
    } finally {
      setCreating(false);
    }
  };

  /**
   * Fetched through the api client rather than a plain link: the endpoint needs
   * the bearer token, which a bare href cannot carry.
   */
  const download = async (filename: string) => {
    setError('');
    setDownloading(filename);
    try {
      const res = await api.get(`/backups/${encodeURIComponent(filename)}/download`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError('Failed to download the backup');
    } finally {
      setDownloading(null);
    }
  };

  /**
   * Preview first, apply second — deliberately two presses. The preview writes
   * nothing and shows exactly what would be added, so nobody merges into a
   * live database without having seen the numbers.
   */
  const runRestore = async (apply: boolean) => {
    if (!file) return;
    if (apply && !window.confirm(
      `Add the missing records from ${file.name} to this database?\n\n` +
      'Existing records are never changed or removed. A safety backup is taken first.',
    )) return;

    setError('');
    setNotice('');
    setRestoring(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post(`/backups/restore${apply ? '?apply=true' : ''}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30 * 60 * 1000,
      });
      const result: RestoreReport = res.data;
      setReport(result);
      if (apply) {
        setNotice(
          `Added ${result.totalInserted} record(s).` +
            (result.safetyBackup ? ` Safety backup taken: ${result.safetyBackup}` : ''),
        );
        await load();
      }
    } catch (err: any) {
      if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message ?? '')) {
        setError('The restore took longer than the request allowed. Check the server log before retrying.');
      } else {
        setError(err.response?.data?.message || 'Restore failed');
      }
    } finally {
      setRestoring(false);
    }
  };

  const remove = async (filename: string) => {
    if (!window.confirm(`Delete ${filename}? This cannot be undone.`)) return;
    setError('');
    setNotice('');
    setDeleting(filename);
    try {
      await api.delete(`/backups/${encodeURIComponent(filename)}`);
      setNotice(`Deleted ${filename}`);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete the backup');
    } finally {
      setDeleting(null);
    }
  };

  if (!canBackup) {
    return (
      <div className="p-6">
        <Card className="border-red-200">
          <CardContent className="flex items-center gap-3 py-8">
            <ShieldAlert className="h-5 w-5 text-red-600" />
            <p className="text-sm text-muted-foreground">
              Only Super Admins and Master Admins can manage database backups.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Database className="h-6 w-6" /> Database Backup
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Take a full backup of this instance and download it to move data between the
          local server and cloud.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle className="h-4 w-4" /> {notice}
        </div>
      )}

      <Card className="mb-6">
        <CardHeader className="border-b bg-muted/40">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Take a Backup</CardTitle>
              <CardDescription>
                Dumps every table to a timestamped, compressed file on the server.
                Who ran it and when is recorded in the activity log.
              </CardDescription>
            </div>
            <Button onClick={takeBackup} disabled={creating} className="gap-2">
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Backing up…
                </>
              ) : (
                <>
                  <Database className="h-4 w-4" /> Backup Now
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">
            A backup contains every patient record in the system, unredacted. Treat the
            downloaded file as you would the database itself — downloads are logged.
          </p>
        </CardContent>
      </Card>

      {/* ── Restore ─────────────────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader className="border-b bg-muted/40">
          <CardTitle className="text-base">Restore Missing Records</CardTitle>
          <CardDescription>
            Upload a backup from another environment to bring across what this database is
            missing. Existing records are never changed or removed — only missing ones are added.
            Accepts a .sql or .sql.gz dump.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".sql,.gz,.sql.gz,.dump"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setReport(null);
                setError('');
              }}
              className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
            />
            <Button
              variant="outline"
              onClick={() => runRestore(false)}
              disabled={!file || restoring}
              className="gap-2"
            >
              {restoring && !report ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Preview
            </Button>
          </div>

          {report && (
            <div className="rounded-lg border">
              <div className="border-b bg-muted/40 px-4 py-2 text-sm font-medium">
                {report.dryRun ? 'Preview — nothing has been changed' : 'Applied'}
                <span className="ml-2 font-normal text-muted-foreground">
                  {report.sourceFile} · {(report.durationMs / 1000).toFixed(1)}s
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Table</TableHead>
                    <TableHead className="text-right">In file</TableHead>
                    <TableHead className="text-right">Already here</TableHead>
                    <TableHead className="text-right">
                      {report.dryRun ? 'Would add' : 'Added'}
                    </TableHead>
                    <TableHead className="text-right">Skipped</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.tables.map((t) => (
                    <TableRow key={t.table}>
                      <TableCell className="font-medium">
                        {t.table}
                        {t.skipReasons.length > 0 && (
                          <span className="block text-xs text-muted-foreground">
                            {t.skipReasons.join('; ')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{t.inBackup}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {t.alreadyPresent}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${t.inserted > 0 ? 'font-semibold text-green-700' : ''}`}
                      >
                        {t.inserted}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${t.skipped > 0 ? 'text-amber-700' : 'text-muted-foreground'}`}
                      >
                        {t.skipped}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {report.dryRun && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-amber-50 px-4 py-3">
                  <p className="text-sm text-amber-900">
                    {report.totalInserted > 0
                      ? `${report.totalInserted} record(s) would be added. A safety backup is taken before applying.`
                      : 'Nothing to add — this database already has everything in the file.'}
                  </p>
                  <Button
                    onClick={() => runRestore(true)}
                    disabled={restoring || report.totalInserted === 0}
                    className="gap-2"
                  >
                    {restoring && <Loader2 className="h-4 w-4 animate-spin" />}
                    Apply
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                Backups {backups.length > 0 && `(${backups.length})`}
              </CardTitle>
              <CardDescription>Newest first</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex min-h-[140px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : backups.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No backups yet. Use “Backup Now” to take the first one.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Taken</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead className="text-right">Size</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map((b) => (
                    <TableRow key={b.filename}>
                      <TableCell className="font-mono text-xs">{b.filename}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(b.createdAt), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {b.triggeredBy?.fullName || b.triggeredBy?.email || '—'}
                        {b.triggeredBy?.role && (
                          <span className="block text-xs text-muted-foreground">
                            {b.triggeredBy.role.replace(/_/g, ' ')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatSize(b.sizeBytes)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Download"
                            disabled={downloading === b.filename}
                            onClick={() => download(b.filename)}
                          >
                            {downloading === b.filename ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete"
                            disabled={deleting === b.filename}
                            onClick={() => remove(b.filename)}
                          >
                            {deleting === b.filename ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-red-600" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
