'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Package, TrendingDown, Clock } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import { cn } from '@/lib/utils';

interface StockAlert {
  id: string;
  type: 'EXPIRING_SOON' | 'LOW_STOCK' | 'MEDIUM_STOCK';
  medicine: {
    name: string;
    strength?: string;
    form: string;
  };
  pharmacy: {
    name: string;
    code: string;
  };
  batchNo: string;
  qtyAvailable: number;
  expiryDate?: string;
  daysUntilExpiry?: number;
}

export function StockAlertTicker() {
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();

  const allowedRoles = [
    'SUPER_ADMIN',
    'HOSPITAL_ADMIN',
    'MAIN_PHARMACY_MANAGER',
    'SUB_PHARMACY_MANAGER',
    'PHARMACY_STAFF',
  ];

  const shouldShowTicker = user && allowedRoles.includes(user.role);
  const currentHospitalId = user?.hospitalId || selectedHospital?.id;

  useEffect(() => {
    if (shouldShowTicker && currentHospitalId) {
      fetchStockAlerts();
      // Refresh every 5 minutes
      const interval = setInterval(fetchStockAlerts, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [currentHospitalId, user]);

  const fetchStockAlerts = async () => {
    try {
      setLoading(true);
      const params: any = { limit: 200 }; // Max allowed by backend

      // For non-admin users with a pharmacy, filter by their pharmacy
      const isSuperAdmin = user?.role === 'SUPER_ADMIN';
      const isHospitalAdmin = user?.role === 'HOSPITAL_ADMIN';
      const isMainManager = user?.role === 'MAIN_PHARMACY_MANAGER';
      const userPharmacyId = user?.pharmacyId;

      if (!isSuperAdmin && !isHospitalAdmin && !isMainManager && userPharmacyId) {
        params.pharmacyId = userPharmacyId;
      }

      const response = await api.get('/inventory/batches', { params });
      const batches = response.data?.data || response.data || [];
      
      // Filter only AVAILABLE batches
      const availableBatches = batches.filter((b: any) => b.status === 'AVAILABLE');

      const processedAlerts: StockAlert[] = [];
      const today = new Date();

      availableBatches.forEach((batch: any) => {
        const expiryDate = new Date(batch.expiryDate);
        const daysUntilExpiry = Math.ceil(
          (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Expiring soon (within 30 days)
        if (daysUntilExpiry > 0 && daysUntilExpiry <= 30) {
          processedAlerts.push({
            id: `exp-${batch.id}`,
            type: 'EXPIRING_SOON',
            medicine: batch.medicine,
            pharmacy: batch.pharmacy,
            batchNo: batch.batchNo,
            qtyAvailable: batch.qtyAvailable,
            expiryDate: batch.expiryDate,
            daysUntilExpiry,
          });
        }

        // Low stock (less than 20% of received quantity or less than 10 units)
        const lowStockThreshold = Math.max(Math.floor(batch.qtyReceived * 0.2), 10);
        if (batch.qtyAvailable > 0 && batch.qtyAvailable <= lowStockThreshold) {
          processedAlerts.push({
            id: `low-${batch.id}`,
            type: 'LOW_STOCK',
            medicine: batch.medicine,
            pharmacy: batch.pharmacy,
            batchNo: batch.batchNo,
            qtyAvailable: batch.qtyAvailable,
          });
        }

        // Medium stock (20-50% of received quantity)
        const mediumStockMin = lowStockThreshold;
        const mediumStockMax = Math.floor(batch.qtyReceived * 0.5);
        if (batch.qtyAvailable > mediumStockMin && batch.qtyAvailable <= mediumStockMax) {
          processedAlerts.push({
            id: `med-${batch.id}`,
            type: 'MEDIUM_STOCK',
            medicine: batch.medicine,
            pharmacy: batch.pharmacy,
            batchNo: batch.batchNo,
            qtyAvailable: batch.qtyAvailable,
          });
        }
      });

      // Sort by priority: Expiring Soon > Low Stock > Medium Stock
      const priorityOrder = { EXPIRING_SOON: 1, LOW_STOCK: 2, MEDIUM_STOCK: 3 };
      processedAlerts.sort((a, b) => {
        if (priorityOrder[a.type] !== priorityOrder[b.type]) {
          return priorityOrder[a.type] - priorityOrder[b.type];
        }
        // Within same type, sort by days until expiry (if applicable) or quantity
        if (a.type === 'EXPIRING_SOON' && b.type === 'EXPIRING_SOON') {
          return (a.daysUntilExpiry || 999) - (b.daysUntilExpiry || 999);
        }
        return a.qtyAvailable - b.qtyAvailable;
      });

      setAlerts(processedAlerts);
    } catch (error) {
      console.error('Error fetching stock alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'EXPIRING_SOON':
        return <Clock className="h-4 w-4" />;
      case 'LOW_STOCK':
        return <AlertTriangle className="h-4 w-4" />;
      case 'MEDIUM_STOCK':
        return <TrendingDown className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'EXPIRING_SOON':
        return 'bg-red-600 text-white';
      case 'LOW_STOCK':
        return 'bg-orange-600 text-white';
      case 'MEDIUM_STOCK':
        return 'bg-yellow-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  const getAlertLabel = (type: string) => {
    switch (type) {
      case 'EXPIRING_SOON':
        return 'EXPIRING SOON';
      case 'LOW_STOCK':
        return 'LOW STOCK';
      case 'MEDIUM_STOCK':
        return 'MEDIUM STOCK';
      default:
        return 'ALERT';
    }
  };

  const formatAlertMessage = (alert: StockAlert) => {
    const medicineName = `${alert.medicine.name}${alert.medicine.strength ? ` ${alert.medicine.strength}` : ''} (${alert.medicine.form})`;
    
    if (alert.type === 'EXPIRING_SOON') {
      return `${medicineName} - Batch ${alert.batchNo} expires in ${alert.daysUntilExpiry} day${alert.daysUntilExpiry !== 1 ? 's' : ''} at ${alert.pharmacy.name} (${alert.qtyAvailable} units)`;
    } else {
      return `${medicineName} - ${alert.qtyAvailable} units remaining at ${alert.pharmacy.name} (Batch ${alert.batchNo})`;
    }
  };

  if (!shouldShowTicker || !currentHospitalId) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-primary text-primary-foreground py-2 px-4 border-b border-border shadow-sm">
        <div className="container mx-auto flex items-center gap-2">
          <Package className="h-4 w-4 animate-pulse" />
          <span className="text-sm">Loading stock alerts...</span>
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-accent text-accent-foreground py-2 px-4 border-b border-border shadow-sm">
        <div className="container mx-auto flex items-center gap-2">
          <Package className="h-4 w-4" />
          <span className="text-sm font-medium">✓ All stock levels are healthy</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-primary text-primary-foreground py-2 overflow-hidden border-b border-border shadow-sm">
      <div className="ticker-container">
        <div className="ticker-content">
          {/* Duplicate content for seamless loop */}
          {[...alerts, ...alerts].map((alert, index) => (
            <div
              key={`${alert.id}-${index}`}
              className="ticker-item inline-flex items-center gap-2 px-4"
            >
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold',
                  getAlertColor(alert.type)
                )}
              >
                {getAlertIcon(alert.type)}
                {getAlertLabel(alert.type)}
              </span>
              <span className="text-sm font-medium whitespace-nowrap">
                {formatAlertMessage(alert)}
              </span>
              <span className="text-white/50 mx-2">•</span>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .ticker-container {
          width: 100%;
          overflow: hidden;
        }

        .ticker-content {
          display: inline-flex;
          white-space: nowrap;
          animation: scroll-left ${alerts.length * 8}s linear infinite;
        }

        @keyframes scroll-left {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        .ticker-content:hover {
          animation-play-state: paused;
        }

        .ticker-item {
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
