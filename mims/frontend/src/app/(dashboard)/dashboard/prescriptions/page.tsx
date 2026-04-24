'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import { format } from 'date-fns';
import { DollarSign } from 'lucide-react';

interface PrescriptionItem {
  id: string;
  medicineId: string;
  qtyPrescribed: number;
  dosage?: string;
  frequency?: string;
  duration?: string;
  status: string;
  medicine: {
    id: string;
    name: string;
    genericName?: string;
    strength?: string;
    form: string;
  };
}

interface Prescription {
  id: string;
  nrNumber: string;
  prescriptionType: 'E_PRESCRIPTION' | 'SCANNED' | 'WRITTEN';
  status: 'PENDING' | 'ISSUED' | 'PARTIALLY_ISSUED' | 'CANCELLED';
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
  items: PrescriptionItem[];
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
  const [statusEdits, setStatusEdits] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const limit = 50;

  // Master Admin & Super Admin must select hospital, others use their hospitalId
  const currentHospitalId = selectedHospital?.id || user?.hospitalId;

  useEffect(() => {
    if (currentHospitalId) {
      fetchPrescriptions();
    }
  }, [currentHospitalId, searchNR, statusFilter, page]);

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      const params: any = { 
        page: Number(page), 
        limit: Number(limit) 
      };
      
      // Include hospitalId from user or selected hospital
      if (currentHospitalId) {
        params.hospitalId = currentHospitalId;
      }
      
      if (searchNR) {
        params.nrNumber = searchNR;
      }
      
      if (statusFilter) {
        params.status = statusFilter;
      }

      // Validate hospitalId before making request
      if (!params.hospitalId) {
        console.warn('No hospital selected. Please select a hospital from the dropdown.');
        setLoading(false);
        return;
      }

      const response = await api.get('/prescriptions', { params });
      setPrescriptions(response.data.data || []);
      setTotal(response.data.total || 0);
    } catch (error: any) {
      console.error('Failed to fetch prescriptions:', error);
      alert(error.response?.data?.message || 'Failed to fetch prescriptions');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'ISSUED':
        return 'bg-green-100 text-green-800';
      case 'PARTIALLY_ISSUED':
        return 'bg-blue-100 text-blue-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'E_PRESCRIPTION':
        return 'bg-purple-100 text-purple-800';
      case 'SCANNED':
        return 'bg-blue-100 text-blue-800';
      case 'WRITTEN':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const canCreatePrescription = ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'DOCTOR_ASSISTANT', 'MAIN_PHARMACY_MANAGER', 'SUB_PHARMACY_MANAGER'].includes(
    user?.role || ''
  );

  const statusOptions = ['PENDING', 'ISSUED', 'PARTIALLY_ISSUED', 'CANCELLED'];

  const handleStatusChange = (id: string, value: string) => {
    setStatusEdits((prev) => ({ ...prev, [id]: value }));
  };

  const handleStatusUpdate = async (prescription: Prescription) => {
    const nextStatus = statusEdits[prescription.id] || prescription.status;
    if (nextStatus === prescription.status) return;

    try {
      setUpdatingId(prescription.id);
      await api.patch(`/prescriptions/${prescription.id}/status`, {
        status: nextStatus,
      });

      setPrescriptions((prev) =>
        prev.map((item) =>
          item.id === prescription.id ? { ...item, status: nextStatus as Prescription['status'] } : item
        )
      );
    } catch (error: any) {
      console.error('Failed to update prescription status:', error);
      alert(error.response?.data?.message || 'Failed to update prescription status');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Prescriptions</h1>
          <p className="text-gray-600 mt-1">Manage patient prescriptions</p>
        </div>
        {canCreatePrescription && (
          <button
            onClick={() => router.push('/dashboard/prescriptions/create')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Create Prescription
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search by MRN
            </label>
            <input
              type="text"
              placeholder="Enter MRN..."
              value={searchNR}
              onChange={(e) => {
                setSearchNR(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="ISSUED">Issued</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchNR('');
                setStatusFilter('');
                setPage(1);
              }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors w-full"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Prescriptions Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading prescriptions...</div>
        ) : prescriptions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No prescriptions found. {canCreatePrescription && 'Create one to get started.'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      MRN
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Doctor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {prescriptions.map((prescription) => (
                    <tr key={prescription.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {prescription.nrNumber}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{prescription.patient.fullName}</div>
                        <div className="text-sm text-gray-500">{prescription.patient.mobile}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {prescription.doctor?.fullName || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeColor(
                            prescription.prescriptionType
                          )}`}
                        >
                          {prescription.prescriptionType.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{prescription.items.length} items</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                            prescription.status
                          )}`}
                        >
                          {prescription.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(prescription.createdAt), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            onClick={() => router.push(`/dashboard/prescriptions/${prescription.id}`)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View
                          </button>
                          <button
                            onClick={() =>
                              router.push(`/dashboard/payments/patient/${prescription.patient.id}?scope=pharmacy`)
                            }
                            className="inline-flex items-center text-green-600 hover:text-green-800 text-sm font-medium"
                          >
                            <DollarSign className="h-4 w-4 mr-1" />
                            Pay
                          </button>
                          <div className="flex items-center gap-2">
                            <select
                              value={statusEdits[prescription.id] || prescription.status}
                              onChange={(event) => handleStatusChange(prescription.id, event.target.value)}
                              disabled={prescription.status === 'ISSUED' || prescription.status === 'CANCELLED'}
                              className="px-2 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                            >
                              {statusOptions.map((status) => (
                                <option key={status} value={status}>
                                  {status.replace('_', ' ')}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleStatusUpdate(prescription)}
                              disabled={
                                updatingId === prescription.id ||
                                prescription.status === 'ISSUED' ||
                                prescription.status === 'CANCELLED' ||
                                (statusEdits[prescription.id] || prescription.status) === prescription.status
                              }
                              className="px-2 py-1 text-xs font-semibold rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {updatingId === prescription.id ? 'Updating...' : 'Update'}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {total > limit && (
              <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-t border-gray-200">
                <div className="text-sm text-gray-700">
                  Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(page * limit, total)}</span> of{' '}
                  <span className="font-medium">{total}</span> prescriptions
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * limit >= total}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
