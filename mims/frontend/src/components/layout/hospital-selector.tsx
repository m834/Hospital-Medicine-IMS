/**
 * Hospital Selector Component
 * Dropdown for Super Admin to select and switch between hospitals
 */

'use client';

import { useState, useEffect } from 'react';
import { Check, ChevronDown, Building2, Globe } from 'lucide-react';
import { useHospitalStore } from '@/stores/hospital.store';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

interface Hospital {
  id: string;
  name: string;
  code: string;
  status: string;
}

export function HospitalSelector() {
  const { selectedHospital, hospitals, setSelectedHospital, setHospitals } = useHospitalStore();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch hospitals on mount
  useEffect(() => {
    async function fetchHospitals() {
      setLoading(true);
      try {
        const response = await api.get('/hospitals');
        const hospitalList = response.data || [];
        setHospitals(hospitalList);
        
        // If no hospital selected, don't auto-select (show "All Hospitals")
      } catch (error) {
        console.error('[HospitalSelector] Failed to fetch hospitals:', error);
        // Use fallback data for demo
        const fallbackHospitals = [
          { id: '1', name: 'City General Hospital', code: 'CGH001', status: 'ACTIVE' },
          { id: '2', name: 'District Medical Center', code: 'DMC002', status: 'ACTIVE' },
        ];
        setHospitals(fallbackHospitals);
      } finally {
        setLoading(false);
      }
    }

    fetchHospitals();
  }, [setHospitals]);

  const handleSelect = (hospital: Hospital | null) => {
    setSelectedHospital(hospital);
    setIsOpen(false);
    
    // Log selection for debugging
    if (hospital) {
      console.log('[HospitalSelector] Selected hospital:', hospital.name, hospital.code);
    } else {
      console.log('[HospitalSelector] Viewing all hospitals');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-accent hover:shadow"
        disabled={loading}
      >
        {selectedHospital ? (
          <>
            <Building2 className="h-4 w-4 text-primary" />
            <span className="max-w-[150px] truncate">{selectedHospital.name}</span>
            <span className="text-xs text-muted-foreground">({selectedHospital.code})</span>
          </>
        ) : (
          <>
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span>All Hospitals</span>
          </>
        )}
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          
          {/* Dropdown */}
          <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-border bg-card shadow-lg animate-scale-in">
            <div className="border-b border-border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Select Hospital Context
              </p>
            </div>
            
            <div className="max-h-80 overflow-y-auto p-2">
              {/* All Hospitals Option */}
              <button
                onClick={() => handleSelect(null)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent',
                  !selectedHospital && 'bg-primary/10 text-primary'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg',
                    !selectedHospital ? 'bg-primary/20' : 'bg-muted'
                  )}>
                    <Globe className={cn('h-5 w-5', !selectedHospital ? 'text-primary' : 'text-muted-foreground')} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">All Hospitals</p>
                    <p className="text-xs text-muted-foreground">System-wide view</p>
                  </div>
                </div>
                {!selectedHospital && <Check className="h-4 w-4 text-primary" />}
              </button>

              {/* Individual Hospitals */}
              <div className="my-2 border-t border-border" />
              
              {hospitals.map((hospital) => (
                <button
                  key={hospital.id}
                  onClick={() => handleSelect(hospital)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent',
                    selectedHospital?.id === hospital.id && 'bg-primary/10 text-primary'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg',
                      selectedHospital?.id === hospital.id ? 'bg-primary/20' : 'bg-muted'
                    )}>
                      <Building2 className={cn('h-5 w-5', selectedHospital?.id === hospital.id ? 'text-primary' : 'text-muted-foreground')} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="truncate text-sm font-semibold">{hospital.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">{hospital.code}</p>
                        <span className={cn(
                          'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                          hospital.status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700'
                        )}>
                          {hospital.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  {selectedHospital?.id === hospital.id && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}

              {hospitals.length === 0 && !loading && (
                <div className="py-8 text-center">
                  <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">No hospitals found</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
