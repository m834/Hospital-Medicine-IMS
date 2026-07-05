'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import { Bell, Loader2 } from 'lucide-react';

interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  recipient?: { id: string; fullName: string; role: string } | null;
  sender?: { id: string; fullName: string } | null;
}

const PAGE_SIZE = 50;

function formatRole(role: string) {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatType(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminNotificationsPage() {
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();

  const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'MASTER_ADMIN';
  // Hospital admins are scoped to their own hospital; super admins use the picker.
  const hospitalId = isSuperAdmin ? selectedHospital?.id : user?.hospitalId;

  const [items, setItems] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setPage(1);
  }, [hospitalId]);

  useEffect(() => {
    if (!hospitalId) {
      setItems([]);
      setTotal(0);
      setTotalPages(1);
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hospitalId, page]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/notifications/admin', {
        params: { hospitalId, page, limit: PAGE_SIZE },
      });
      setItems(res.data.data ?? []);
      setTotal(res.data.meta?.total ?? 0);
      setTotalPages(res.data.meta?.totalPages ?? 1);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load notifications');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Bell className="h-6 w-6 text-indigo-600" /> Notifications
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          All notifications sent across
          {isSuperAdmin
            ? selectedHospital?.name
              ? ` ${selectedHospital.name}.`
              : ' the selected hospital.'
            : ' your hospital.'}
        </p>
      </div>

      {isSuperAdmin && !hospitalId ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 py-12 text-center">
          <Bell className="h-10 w-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            Select a hospital from the header to view its notifications.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {error && (
            <div className="bg-red-50 border-b border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>
          )}

          {loading ? (
            <div className="py-16 text-center text-gray-400">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center">
              <Bell className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No notifications yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500">
                    <th className="px-4 py-2.5">Notification</th>
                    <th className="px-4 py-2.5">Recipient</th>
                    <th className="px-4 py-2.5">From</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 whitespace-nowrap">Sent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((n) => (
                    <tr key={n.id} className="hover:bg-gray-50 align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{n.title}</div>
                        <div className="text-gray-500 text-xs mt-0.5 max-w-md">{n.message}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-800">{n.recipient?.fullName ?? '—'}</div>
                        {n.recipient?.role && (
                          <div className="text-xs text-gray-400">{formatRole(n.recipient.role)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{n.sender?.fullName ?? 'System'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-xs font-medium whitespace-nowrap">
                          {formatType(n.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            n.isRead ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-700'
                          }`}
                        >
                          {n.isRead ? 'Read' : 'Unread'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(n.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
              <span className="text-xs text-gray-500">
                Page {page} of {totalPages} · {total} notifications
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
