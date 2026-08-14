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
      const res = await api.post('/backups');
      const made: BackupManifest = res.data;
      setNotice(`Backup created: ${made.filename} (${formatSize(made.sizeBytes)})`);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Backup failed');
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

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">
            Backups {backups.length > 0 && `(${backups.length})`}
          </CardTitle>
          <CardDescription>Newest first</CardDescription>
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
