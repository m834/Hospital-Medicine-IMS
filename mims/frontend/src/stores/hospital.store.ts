/**
 * Hospital Store - For Super Admin Hospital Selection
 * Manages selected hospital context for Super Admin users
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Hospital {
  id: string;
  name: string;
  code: string;
  status: string;
}

interface HospitalStore {
  selectedHospital: Hospital | null;
  hospitals: Hospital[];
  setSelectedHospital: (hospital: Hospital | null) => void;
  setHospitals: (hospitals: Hospital[]) => void;
  clearSelection: () => void;
}

export const useHospitalStore = create<HospitalStore>()(
  persist(
    (set) => ({
      selectedHospital: null,
      hospitals: [],
      setSelectedHospital: (hospital) => set({ selectedHospital: hospital }),
      setHospitals: (hospitals) => set({ hospitals }),
      clearSelection: () => set({ selectedHospital: null }),
    }),
    {
      name: 'hospital-storage',
    }
  )
);
