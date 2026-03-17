'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import { UserRole } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { format, subDays, isSameDay, eachDayOfInterval } from 'date-fns';
import api from '@/lib/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface UserOption {
  id: string;
  fullName: string;
  email?: string;
}

interface AttendanceRecord {
  id: string;
  attendanceDate: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  isManualEntry: boolean;
  status: string;
}

export default function MarkAttendancePage() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();
  const hospitalId = selectedHospital?.id || user?.hospitalId;

  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isRecordsLoading, setIsRecordsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const canMarkAttendance =
    user?.role === UserRole.MASTER_ADMIN ||
    user?.role === UserRole.SUPER_ADMIN ||
    user?.role === UserRole.HOSPITAL_ADMIN;

  useEffect(() => {
    const fetchUsers = async () => {
      if (!hospitalId) return;
      setIsUsersLoading(true);
      try {
        const response = await api.get(`/hospitals/${hospitalId}/users`);
        const data = response.data || [];
        const mapped = data.map((u: any) => ({
          id: u.id,
          fullName: u.fullName || u.name || u.email,
          email: u.email,
        }));
        setUsers(mapped);
      } catch (error) {
        console.error('Failed to fetch users:', error);
        setUsers([]);
      } finally {
        setIsUsersLoading(false);
      }
    };

    fetchUsers();
  }, [hospitalId]);

  useEffect(() => {
    const fetchRecords = async () => {
      if (!selectedUserId) {
        setRecords([]);
        return;
      }

      setIsRecordsLoading(true);
      try {
        const startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');
        const endDate = format(new Date(), 'yyyy-MM-dd');
        const response = await api.get('/attendance-records', {
          params: {
            employeeId: selectedUserId,
            startDate,
            endDate,
          },
        });

        setRecords(response.data || []);
      } catch (error) {
        console.error('Failed to fetch attendance records:', error);
        setRecords([]);
      } finally {
        setIsRecordsLoading(false);
      }
    };

    fetchRecords();
  }, [selectedUserId]);

  const today = new Date();

  const todayRecord = useMemo(() => {
    return records.find((record) =>
      isSameDay(new Date(record.attendanceDate), today)
    );
  }, [records, today]);

  const displayRecords = useMemo(() => {
    const startDate = subDays(today, 29);
    const days = eachDayOfInterval({ start: startDate, end: today });

    const byDate = new Map(
      records.map((record) => [
        format(new Date(record.attendanceDate), 'yyyy-MM-dd'),
        record,
      ])
    );

    return days.map((date) => {
      const key = format(date, 'yyyy-MM-dd');
      const existing = byDate.get(key);
      if (existing) return existing;
      return {
        id: `placeholder-${key}`,
        attendanceDate: date.toISOString(),
        checkInTime: null,
        checkOutTime: null,
        isManualEntry: false,
        status: 'NOT_MARKED',
      } as AttendanceRecord;
    }).reverse();
  }, [records, today]);

  const handleMarkTimeIn = async () => {
    if (!selectedUserId || !canMarkAttendance) return;

    setIsActionLoading(true);
    try {
      await api.post(
        '/attendance-records',
        {
          employeeId: selectedUserId,
          attendanceDate: format(new Date(), 'yyyy-MM-dd'),
          checkInTime: new Date().toISOString(),
          isManualMark: true,
          notes: 'Manual time in',
        },
        {
          headers: hospitalId ? { 'x-hospital-id': hospitalId } : undefined,
        }
      );

      toast({
        title: 'Time in marked',
        description: 'Manual time in has been recorded.',
      });

      const response = await api.get('/attendance-records', {
        params: {
          employeeId: selectedUserId,
          startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
          endDate: format(new Date(), 'yyyy-MM-dd'),
        },
        headers: hospitalId ? { 'x-hospital-id': hospitalId } : undefined,
      });
      setRecords(response.data || []);
    } catch (error) {
      toast({
        title: 'Failed to mark time in',
        description: error instanceof Error ? error.message : 'Unable to mark time in.',
        variant: 'destructive',
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleMarkTimeOut = async (recordId: string) => {
    if (!recordId || !canMarkAttendance) return;

    setIsActionLoading(true);
    try {
      await api.put(
        `/attendance-records/${recordId}`,
        {
          status: 'PRESENT',
          correctedCheckOutTime: new Date().toISOString(),
          reason: 'Manual time out',
          approvedBy: user?.id,
        },
        {
          headers: hospitalId ? { 'x-hospital-id': hospitalId } : undefined,
        }
      );

      toast({
        title: 'Time out marked',
        description: 'Manual time out has been recorded.',
      });

      const response = await api.get('/attendance-records', {
        params: {
          employeeId: selectedUserId,
          startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
          endDate: format(new Date(), 'yyyy-MM-dd'),
        },
        headers: hospitalId ? { 'x-hospital-id': hospitalId } : undefined,
      });
      setRecords(response.data || []);
    } catch (error) {
      toast({
        title: 'Failed to mark time out',
        description: error instanceof Error ? error.message : 'Unable to mark time out.',
        variant: 'destructive',
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const renderAction = (record: AttendanceRecord) => {
    const isToday = isSameDay(new Date(record.attendanceDate), today);
    const isPlaceholder = record.id.startsWith('placeholder-');

    if (!isToday) {
      return (
        <Button size="sm" variant="secondary" disabled>
          Manual only today
        </Button>
      );
    }

    if (isPlaceholder && !todayRecord) {
      return (
        <Button
          size="sm"
          onClick={handleMarkTimeIn}
          disabled={!canMarkAttendance || isActionLoading}
        >
          Mark Time In
        </Button>
      );
    }

    if (record.checkInTime && !record.checkOutTime) {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleMarkTimeOut(record.id)}
          disabled={!canMarkAttendance || isActionLoading}
        >
          Mark Time Out
        </Button>
      );
    }

    return (
      <Button size="sm" variant="secondary" disabled>
        Marked
      </Button>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Mark Attendance</h1>
        <p className="text-muted-foreground mt-1">
          Select a user to view attendance history and manually mark time in/out.
        </p>
      </div>

      <Card className="p-6 space-y-6">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Showing last 30 days (latest first).</span>
          <span>Manual marking is allowed for today only.</span>
        </div>
        <div className="space-y-2">
          <Label htmlFor="userSelect">Select User</Label>
          <select
            id="userSelect"
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
            disabled={isUsersLoading || !hospitalId}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">
              {isUsersLoading
                ? 'Loading users...'
                : hospitalId
                  ? 'Select a user'
                  : 'Select hospital to load users'}
            </option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} {u.email ? `(${u.email})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Time In</TableHead>
                <TableHead>Time Out</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Manual Mark</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isRecordsLoading && (
                <TableRow>
                  <TableCell colSpan={5}>Loading attendance...</TableCell>
                </TableRow>
              )}
              {!isRecordsLoading && displayRecords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>Select a user to view attendance.</TableCell>
                </TableRow>
              )}
              {!isRecordsLoading && displayRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{format(new Date(record.attendanceDate), 'yyyy-MM-dd')}</TableCell>
                  <TableCell>
                    {record.checkInTime ? format(new Date(record.checkInTime), 'HH:mm') : '—'}
                  </TableCell>
                  <TableCell>
                    {record.checkOutTime ? format(new Date(record.checkOutTime), 'HH:mm') : '—'}
                  </TableCell>
                  <TableCell>
                    {record.id.startsWith('placeholder-')
                      ? 'Not marked'
                      : record.isManualEntry
                        ? 'Marked as Manual'
                        : 'Marked as Biometric'}
                  </TableCell>
                  <TableCell className="text-right">
                    {renderAction(record)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
