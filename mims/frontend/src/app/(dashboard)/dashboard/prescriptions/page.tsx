'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import { format } from 'date-fns';

interface Prescription {
  id: string;
  nrNumber: string;
  prescriptionType: string;
  status: string;
  notes?: string;
  createdAt: string;
  patient: {
    id: string;
    nrNumber: string;
    fullName: string;
    gender: string;
    mobile: string;
  };
  doctor?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  items: { id: string }[];
  medicines: { id: string }[];
  visit?: {
    id: string;
    visitDate: string;
    visitNumber: string;
  } | null;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Active', cls: 'bg-green-100 text-green-800' };
    case 'COMPLETED':
      return { label: 'Completed', cls: 'bg-gray-100 text-gray-700' };
    case 'PENDING':
      return { label: 'Pending', cls: 'bg-yellow-100 text-yellow-800' };
    case 'ISSUED':
      return { label: 'Issued', cls: 'bg-blue-100 text-blue-800' };
    case 'PARTIALLY_ISSUED':
      return { label: 'Partial', cls: 'bg-blue-50 text-blue-600' };
    case 'CANCELLED':
      return { label: 'Cancelled', cls: 'bg-red-100 text-red-800' };
    default:
      return { label: status, cls: 'bg-gray-100 text-gray-800' };
  }
}

export default function PrescriptionsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchNR, setSearchNR] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 50;

  const currentHospitalId = selectedHospital?.id || user?.hospitalId;

  const canCreatePrescription = [
    'SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'DOCTOR_ASSISTANT',
    'MAIN_PHARMACY_MANAGER', 'SUB_PHARMACY_MANAGER',
  ].includes(user?.role || '');

  useEffect(() => {
    if (currentHospitalId) fetchPrescriptions();
  }, [currentHospitalId, searchNR, statusFilter, page]);

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      const params: any = { page: Number(page), limit: Number(limit) };
      if (currentHospitalId) params.hospitalId = currentHospitalId;
      if (searchNR) params.nrNumber = searchNR;
      if (statusFilter) params.status = statusFilter;

      if (!params.hospitalId) { setLoading(false); return; }

      const response = await api.get('/prescriptions', { params });
      setPrescriptions(response.data.data || []);
      setTotal(response.data.total || 0);
    } catch (error: any) {
      console.error('Failed to fetch prescriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Prescriptions</h1>
          <p className="text-gray-600 mt-1">Manage patient prescriptions and dispatch rounds</p>
        </div>
        {canCreatePrescription && (
          <button
            onClick={() => router.push('/dashboard/prescriptions/create')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + New Prescription
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search by MRN</label>
            <input
              type="text"
              placeholder="Enter MRN..."
              value={searchNR}
              onChange={(e) => { setSearchNR(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Pending (legacy)</option>
              <option value="ISSUED">Issued (legacy)</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => { setSearchNR(''); setStatusFilter(''); setPage(1); }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors w-full"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading prescriptions...</div>
        ) : prescriptions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No prescriptions found.{' '}
            {canCreatePrescription && 'Create one to get started.'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['MRN', 'Patient', 'Doctor', 'Visit Date', 'Medicines', 'Status', 'Created', 'Action'].map((h) => (
                      <th
                        key={h}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {prescriptions.map((rx) => {
                    const { label, cls } = getStatusBadge(rx.status);
                    const medCount = rx.medicines?.length || rx.items?.length || 0;

                    return (
                      <tr key={rx.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {rx.nrNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{rx.patient.fullName}</div>
                          <div className="text-xs text-gray-500">{rx.patient.mobile}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {rx.doctor?.fullName || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {rx.visit?.visitDate
                            ? format(new Date(rx.visit.visitDate), 'dd MMM yyyy')
                            : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {medCount} {medCount === 1 ? 'medicine' : 'medicines'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs font-semibold rounded-full ${cls}`}>
                            {label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {format(new Date(rx.createdAt), 'dd MMM yyyy')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => router.push(`/dashboard/prescriptions/${rx.id}`)}
                            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Info / Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {total > limit && (
              <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-t border-gray-200">
                <div className="text-sm text-gray-700">
                  Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(page * limit, total)}</span> of{' '}
                  <span className="font-medium">{total}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * limit >= total}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
