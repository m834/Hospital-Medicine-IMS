'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import { format } from 'date-fns';
import { SearchableSelect } from '@/components/ui/searchable-select';

interface Patient {
  id: string;
  nrNumber: string;
  fullName: string;
  gender: string;
  mobile: string;
  visitType: string;
  department?: string;
}

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
  prescriptionType: string;
  status: string;
  notes?: string;
  createdAt: string;
  doctor?: {
    fullName: string;
  } | null;
  items: PrescriptionItem[];
}

interface DispenseItem {
  medicineId: string;
  medicineName: string;
  medicineForm?: string;
  quantity: number;
  customPrice?: number;
  dispenseByTablet?: boolean;
}

export default function DispensingPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();
  const [searchNR, setSearchNR] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [searchingPatient, setSearchingPatient] = useState(false);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(false);
  const [dispenseItems, setDispenseItems] = useState<DispenseItem[]>([]);
  const [priceType, setPriceType] = useState<'GOVERNMENT' | 'RETAIL' | 'CUSTOM'>('GOVERNMENT');
  const [dispensing, setDispensing] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [manualMedicineId, setManualMedicineId] = useState('');
  const [manualQuantity, setManualQuantity] = useState(1);

  const userPharmacyId = user?.pharmacyId;

  useEffect(() => {
    if (selectedHospital?.id) {
      fetchMedicines();
    }
  }, [selectedHospital]);

  const fetchMedicines = async () => {
    if (!selectedHospital?.id) return;
    
    try {
      const response = await api.get('/medicines', {
        params: { 
          hospitalId: selectedHospital.id,
          limit: 2000, 
          status: 'ACTIVE' 
        },
      });
      setMedicines(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch medicines:', error);
    }
  };

  const searchPatient = async () => {
    if (!searchNR.trim()) {
      alert('Please enter MRN');
      return;
    }

    try {
      setSearchingPatient(true);
      const response = await api.get(`/patients`, {
        params: { nrNumber: searchNR.trim() },
      });

      const patients = response.data.data || [];
      if (patients.length === 0) {
        alert('Patient not found');
        setSelectedPatient(null);
        setPrescriptions([]);
        return;
      }

      const patient = patients[0];
      setSelectedPatient(patient);
      
      // Fetch active prescriptions for this patient
      await fetchActivePrescriptions(patient.nrNumber);
    } catch (error: any) {
      console.error('Failed to search patient:', error);
      alert(error.response?.data?.message || 'Failed to search patient');
      setSelectedPatient(null);
      setPrescriptions([]);
    } finally {
      setSearchingPatient(false);
    }
  };

  const fetchActivePrescriptions = async (nrNumber: string) => {
    try {
      setLoadingPrescriptions(true);
      const response = await api.get(`/prescriptions/patient/${nrNumber}/active`);
      setPrescriptions(response.data || []);
    } catch (error: any) {
      console.error('Failed to fetch prescriptions:', error);
      setPrescriptions([]);
    } finally {
      setLoadingPrescriptions(false);
    }
  };

  const selectPrescription = (prescription: Prescription) => {
    setSelectedPrescription(prescription);
    
    // Auto-populate dispense items from prescription
    const items: DispenseItem[] = prescription.items.map((item) => ({
      medicineId: item.medicineId,
      medicineName: item.medicine.name,
      medicineForm: item.medicine?.form,
      quantity: item.qtyPrescribed,
      customPrice: undefined,
      dispenseByTablet: true,
    }));
    
    setDispenseItems(items);
    setShowManualEntry(false);
  };

  const addManualItem = () => {
    if (!manualMedicineId) {
      alert('Please select a medicine');
      return;
    }

    const medicine = medicines.find((m) => m.id === manualMedicineId);
    if (!medicine) return;

    const existingIndex = dispenseItems.findIndex((item) => item.medicineId === manualMedicineId);
    
    if (existingIndex >= 0) {
      // Update existing item
      const updated = [...dispenseItems];
      updated[existingIndex].quantity += manualQuantity;
      setDispenseItems(updated);
    } else {
      // Add new item
      setDispenseItems([
        ...dispenseItems,
        {
          medicineId: manualMedicineId,
          medicineName: medicine.name,
          medicineForm: medicine.form,
          quantity: manualQuantity,
          customPrice: undefined,
          dispenseByTablet: true,
        },
      ]);
    }

    // Reset form
    setManualMedicineId('');
    setManualQuantity(1);
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    const updated = [...dispenseItems];
    updated[index].quantity = Math.max(1, quantity);
    setDispenseItems(updated);
  };

  const updateItemPrice = (index: number, price: number) => {
    const updated = [...dispenseItems];
    updated[index].customPrice = price;
    setDispenseItems(updated);
  };

  const updateDispenseByTablet = (index: number, value: boolean) => {
    const updated = [...dispenseItems];
    updated[index].dispenseByTablet = value;
    setDispenseItems(updated);
  };

  const removeItem = (index: number) => {
    setDispenseItems(dispenseItems.filter((_, i) => i !== index));
  };

  const handleDispense = async () => {
    if (!selectedPatient || !userPharmacyId) {
      alert('Patient or pharmacy not selected');
      return;
    }

    if (dispenseItems.length === 0) {
      alert('Please add at least one medicine to dispense');
      return;
    }

    // Validate custom prices if CUSTOM price type is selected
    if (priceType === 'CUSTOM') {
      const hasInvalidPrices = dispenseItems.some((item) => !item.customPrice || item.customPrice <= 0);
      if (hasInvalidPrices) {
        alert('Please enter valid custom prices for all items');
        return;
      }
    }

    try {
      setDispensing(true);

      const payload = {
        nrNumber: selectedPatient.nrNumber,
        pharmacyId: userPharmacyId,
        prescriptionId: selectedPrescription?.id || undefined,
        priceType,
        items: dispenseItems.map((item) => ({
          medicineId: item.medicineId,
          quantity: item.quantity,
          customPrice: priceType === 'CUSTOM' ? item.customPrice : undefined,
          dispenseByTablet: item.dispenseByTablet !== false,
        })),
      };

      const response = await api.post('/issuance', payload);

      alert(`Medicines dispensed successfully!\nTransaction ID: ${response.data.transactionNumber}`);
      
      // Reset form
      setSearchNR('');
      setSelectedPatient(null);
      setPrescriptions([]);
      setSelectedPrescription(null);
      setDispenseItems([]);
      setPriceType('GOVERNMENT');
      setShowManualEntry(false);
    } catch (error: any) {
      console.error('Failed to dispense medicines:', error);
      alert(error.response?.data?.message || 'Failed to dispense medicines');
    } finally {
      setDispensing(false);
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Medicine Dispensing</h1>
        <p className="text-gray-600 mt-1">Dispense medicines to patients</p>
      </div>

      {/* Patient Search */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Search Patient</h2>
        
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter MRN (e.g., MRN-20251128-0001)"
            value={searchNR}
            onChange={(e) => setSearchNR(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchPatient()}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={searchPatient}
            disabled={searchingPatient}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
          >
            {searchingPatient ? 'Searching...' : 'Search'}
          </button>
        </div>

        {selectedPatient && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Patient Name</p>
                <p className="font-semibold">{selectedPatient.fullName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">MRN</p>
                <p className="font-semibold">{selectedPatient.nrNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Gender</p>
                <p className="font-semibold">{selectedPatient.gender}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Mobile</p>
                <p className="font-semibold">{selectedPatient.mobile}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active Prescriptions */}
      {selectedPatient && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Active Prescriptions</h2>

          {loadingPrescriptions ? (
            <p className="text-gray-500 text-center py-4">Loading prescriptions...</p>
          ) : prescriptions.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No active prescriptions found</p>
          ) : (
            <div className="space-y-3">
              {prescriptions.map((prescription) => (
                <div
                  key={prescription.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedPrescription?.id === prescription.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                  onClick={() => selectPrescription(prescription)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold">
                        {prescription.doctor?.fullName ? `Dr. ${prescription.doctor.fullName}` : 'No Doctor Assigned'}
                      </p>
                      <p className="text-sm text-gray-600">
                        {format(new Date(prescription.createdAt), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      {prescription.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-sm text-gray-700">
                    <strong>{prescription.items.length}</strong> medicine(s):
                    {prescription.items.slice(0, 3).map((item, idx) => (
                      <span key={idx}>
                        {' '}
                        {item.medicine.name} ({item.qtyPrescribed})
                        {idx < Math.min(2, prescription.items.length - 1) && ','}
                      </span>
                    ))}
                    {prescription.items.length > 3 && '...'}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => {
              setShowManualEntry(true);
              setSelectedPrescription(null);
            }}
            className="mt-4 w-full py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Manual Entry (Without Prescription)
          </button>
        </div>
      )}

      {/* Dispense Items */}
      {selectedPatient && (selectedPrescription || showManualEntry) && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Medicines to Dispense</h2>

          {/* Price Type Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Price Type</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="priceType"
                  value="GOVERNMENT"
                  checked={priceType === 'GOVERNMENT'}
                  onChange={(e) => setPriceType(e.target.value as any)}
                  className="mr-2"
                />
                Government
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="priceType"
                  value="RETAIL"
                  checked={priceType === 'RETAIL'}
                  onChange={(e) => setPriceType(e.target.value as any)}
                  className="mr-2"
                />
                Retail
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="priceType"
                  value="CUSTOM"
                  checked={priceType === 'CUSTOM'}
                  onChange={(e) => setPriceType(e.target.value as any)}
                  className="mr-2"
                />
                Custom
              </label>
            </div>
          </div>

          {/* Manual Medicine Entry */}
          {showManualEntry && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="font-medium text-gray-700 mb-3">Add Medicine</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <SearchableSelect
                    options={medicines.map((m) => ({
                      value: m.id,
                      label: m.name,
                      sub: [m.genericName, m.strength].filter(Boolean).join(' · '),
                    }))}
                    value={manualMedicineId}
                    onValueChange={setManualMedicineId}
                    placeholder="Select medicine..."
                    searchPlaceholder="Search medicine by name or strength..."
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    value={manualQuantity}
                    onChange={(e) => setManualQuantity(Number(e.target.value))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Qty"
                  />
                  <button
                    onClick={addManualItem}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Items List */}
          {dispenseItems.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No items added</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Medicine
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Quantity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Unit
                    </th>
                    {priceType === 'CUSTOM' && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Custom Price
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dispenseItems.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.medicineName}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItemQuantity(index, Number(e.target.value))}
                          className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        {(item.medicineForm === 'TABLET' || item.medicineForm === 'CAPSULE') ? (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => updateDispenseByTablet(index, true)}
                              className={`px-2 py-1 text-xs rounded border ${item.dispenseByTablet !== false ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
                            >
                              Tab
                            </button>
                            <button
                              type="button"
                              onClick={() => updateDispenseByTablet(index, false)}
                              className={`px-2 py-1 text-xs rounded border ${item.dispenseByTablet === false ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-300'}`}
                            >
                              Strip
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      {priceType === 'CUSTOM' && (
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.customPrice || ''}
                            onChange={(e) => updateItemPrice(index, Number(e.target.value))}
                            placeholder="0.00"
                            className="w-24 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleDispense}
              disabled={dispensing || dispenseItems.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
            >
              {dispensing ? 'Dispensing...' : 'Dispense Medicines'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
