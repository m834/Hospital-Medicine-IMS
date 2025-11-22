/**
 * Hospital Context Hook
 * Provides hospital context for API calls and filters
 */

import { useHospitalStore } from '@/stores/hospital.store';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@/lib/constants';

export function useHospitalContext() {
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();

  // Super Admin can select hospital context
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
  
  // Get current hospital ID based on user role
  const getHospitalId = (): string | null => {
    if (isSuperAdmin) {
      // Super Admin: Use selected hospital or null for all hospitals
      return selectedHospital?.id || null;
    } else {
      // Other roles: Use their assigned hospital
      return user?.hospitalId || null;
    }
  };

  // Get hospital filter for API calls
  const getHospitalFilter = () => {
    const hospitalId = getHospitalId();
    return hospitalId ? { hospitalId } : {};
  };

  // Check if viewing specific hospital
  const isHospitalSpecific = (): boolean => {
    return getHospitalId() !== null;
  };

  // Get context description
  const getContextDescription = (): string => {
    if (isSuperAdmin && !selectedHospital) {
      return 'All Hospitals (System-wide)';
    }
    if (selectedHospital) {
      return `${selectedHospital.name} (${selectedHospital.code})`;
    }
    return 'Current Hospital';
  };

  return {
    hospitalId: getHospitalId(),
    hospitalFilter: getHospitalFilter(),
    isHospitalSpecific: isHospitalSpecific(),
    contextDescription: getContextDescription(),
    selectedHospital,
    isSuperAdmin,
  };
}
