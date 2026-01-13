'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

interface FeatureFlagContextType {
  flags: Record<string, boolean>;
  isLoading: boolean;
  isEnabled: (flagKey: string) => boolean;
  refreshFlags: () => Promise<void>;
}

const FeatureFlagContext = createContext<FeatureFlagContextType>({
  flags: {},
  isLoading: true,
  isEnabled: () => false,
  refreshFlags: async () => {},
});

export const useFeatureFlags = () => useContext(FeatureFlagContext);

interface FeatureFlagProviderProps {
  children: ReactNode;
}

export function FeatureFlagProvider({ children }: FeatureFlagProviderProps) {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchFlags = async () => {
    try {
      const user = getStoredUser();
      const hospitalId = user?.hospitalId;

      const response = await api.get('/feature-flags', {
        params: { hospitalId },
      });

      // Convert array of flags to a map
      const flagMap: Record<string, boolean> = {};
      response.data.forEach((flag: any) => {
        flagMap[flag.key] = flag.enabled;
      });

      setFlags(flagMap);
    } catch (error) {
      console.error('[FeatureFlags] Failed to fetch flags:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, []);

  const isEnabled = (flagKey: string): boolean => {
    return flags[flagKey] === true;
  };

  const refreshFlags = async () => {
    setIsLoading(true);
    await fetchFlags();
  };

  return (
    <FeatureFlagContext.Provider value={{ flags, isLoading, isEnabled, refreshFlags }}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

// Feature Gate component
interface FeatureGateProps {
  flag: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export function FeatureGate({ flag, fallback = null, children }: FeatureGateProps) {
  const { isEnabled, isLoading } = useFeatureFlags();

  if (isLoading) {
    return null; // Or a loading skeleton
  }

  return isEnabled(flag) ? <>{children}</> : <>{fallback}</>;
}
