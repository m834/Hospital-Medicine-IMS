'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  Calendar,
  Loader2,
  PackagePlus,
  TrendingDown,
  Clock,
  CheckCircle,
  Bell,
  Package,
} from 'lucide-react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import { useRouter } from 'next/navigation';

interface StockBatch {
  id: string;
  batchNo: string;
  medicine: {
    name: string;
    strength?: string;
    form: string;
  };
  pharmacy: {
    name: string;
    code: string;
  };
  qtyReceived: number;
  qtyAvailable: number;
  expiryDate: string;
  purchasePrice: number;
  governmentPrice: number;
  retailPrice: number;
  receivedDate: string;
  status: string;
  storageType: string;
}

export default function StockAlertsPage() {
  const [allBatches, setAllBatches] = useState<StockBatch[]>([]);
  const [loading, setLoading] = useState(true);

  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();
  const router = useRouter();

  const currentHospitalId = user?.hospitalId || selectedHospital?.id;
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isHospitalAdmin = user?.role === 'HOSPITAL_ADMIN';
  const isMainManager = user?.role === 'MAIN_PHARMACY_MANAGER';
  const userPharmacyId = user?.pharmacyId;

  useEffect(() => {
    if (currentHospitalId || isSuperAdmin) {
      fetchStockBatches();
    }
  }, [currentHospitalId]);

  const fetchStockBatches = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 200 };  // Max allowed by backend validation
      
      // For non-admin users with a pharmacy, ALWAYS filter by their pharmacy
      if (!isSuperAdmin && !isHospitalAdmin && !isMainManager && userPharmacyId) {
        params.pharmacyId = userPharmacyId;
      }
      
      // Backend has a max limit of 200, so we need to fetch in pages
      const response = await api.get('/inventory/batches', { params });
      const batches = response.data?.data || response.data || [];
      // Filter only AVAILABLE batches on frontend
      setAllBatches(batches.filter((b: StockBatch) => b.status === 'AVAILABLE'));
    } catch (error) {
      console.error('Error fetching stock batches:', error);
      setAllBatches([]);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stock level based on absolute quantity thresholds
  // Low Stock: < 15
  // Medium Stock: 15-30
  // Good Stock: > 30
  const getStockLevel = (qtyAvailable: number) => {
    if (qtyAvailable > 30) {
      return { level: 'good', color: 'bg-green-500', label: 'Good Stock', qty: qtyAvailable };
    } else if (qtyAvailable >= 15) {
      return { level: 'medium', color: 'bg-yellow-500', label: 'Medium Stock', qty: qtyAvailable };
    } else {
      return { level: 'low', color: 'bg-red-500', label: 'Low Stock', qty: qtyAvailable };
    }
  };

  const isExpiringSoon = (expiryDate: string) => {
    const daysUntilExpiry = Math.ceil(
      (new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  };

  const isExpired = (expiryDate: string) => {
    return new Date(expiryDate) < new Date();
  };

  const getDaysUntilExpiry = (expiryDate: string) => {
    return Math.ceil(
      (new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStorageColor = (storage: string) => {
    const colors: { [key: string]: string } = {
      ROOM_TEMPERATURE: 'bg-blue-100 text-blue-800',
      COLD_STORAGE: 'bg-cyan-100 text-cyan-800',
      REFRIGERATED: 'bg-purple-100 text-purple-800',
    };
    return colors[storage] || 'bg-gray-100 text-gray-800';
  };

  // Filter batches by alert type
  const lowStockBatches = allBatches.filter((batch) => {
    const stockLevel = getStockLevel(batch.qtyAvailable);
    return stockLevel.level === 'low';
  });

  const mediumStockBatches = allBatches.filter((batch) => {
    const stockLevel = getStockLevel(batch.qtyAvailable);
    return stockLevel.level === 'medium';
  });

  const expiringSoonBatches = allBatches.filter((batch) => 
    isExpiringSoon(batch.expiryDate) && !isExpired(batch.expiryDate)
  );

  const expiredBatches = allBatches.filter((batch) => isExpired(batch.expiryDate));

  if (!currentHospitalId && !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Hospital Selection Required</CardTitle>
            <CardDescription>
              Please select a hospital from the dropdown to view alerts
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add custom styles for blinking animation */}
      <style jsx>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .blink-yellow {
          animation: blink 2s ease-in-out infinite;
        }
        .blink-red {
          animation: blink 1.5s ease-in-out infinite;
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-8 w-8 text-orange-600" />
            Stock Alerts
          </h1>
          <p className="text-muted-foreground">
            Critical alerts for low stock levels and expiring medicines
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/dashboard/inventory')}>
            <Package className="mr-2 h-4 w-4" />
            View Inventory
          </Button>
          <Button onClick={() => router.push('/dashboard/inventory/receive')}>
            <PackagePlus className="mr-2 h-4 w-4" />
            Receive Stock
          </Button>
        </div>
      </div>

      {/* Alert Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Low Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{lowStockBatches.length}</div>
            <p className="text-xs text-muted-foreground">Quantity below 15</p>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Medium Stock</CardTitle>
            <TrendingDown className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{mediumStockBatches.length}</div>
            <p className="text-xs text-muted-foreground">Quantity 15-30</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{expiringSoonBatches.length}</div>
            <p className="text-xs text-muted-foreground">Within 7 days</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 bg-gray-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
            <Calendar className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{expiredBatches.length}</div>
            <p className="text-xs text-muted-foreground">Past expiry date</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Tabs */}
      <Tabs defaultValue="low-stock" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="low-stock" className="relative">
            Critical Low Stock
            {lowStockBatches.length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
                {lowStockBatches.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="medium-stock">
            Medium Stock
            {mediumStockBatches.length > 0 && (
              <Badge className="ml-2 h-5 w-5 rounded-full p-0 text-xs bg-yellow-500">
                {mediumStockBatches.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="expiring-soon">
            Expiring Soon
            {expiringSoonBatches.length > 0 && (
              <Badge className="ml-2 h-5 w-5 rounded-full p-0 text-xs bg-orange-500">
                {expiringSoonBatches.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="expired">
            Expired
            {expiredBatches.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
                {expiredBatches.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Critical Low Stock Tab */}
        <TabsContent value="low-stock">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500 blink-red" />
                Critical Low Stock Batches
              </CardTitle>
              <CardDescription>
                Stock quantity below 15 - immediate reorder recommended
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : lowStockBatches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <p className="text-lg font-medium">No Critical Low Stock Alerts</p>
                  <p className="text-sm text-muted-foreground">All batches have adequate stock levels</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alert</TableHead>
                      <TableHead>Batch No</TableHead>
                      <TableHead>Medicine</TableHead>
                      <TableHead>Pharmacy</TableHead>
                      <TableHead>Stock Level</TableHead>
                      <TableHead>Qty Available</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead>Storage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStockBatches.map((batch) => {
                      const stockLevel = getStockLevel(batch.qtyAvailable);
                      return (
                        <TableRow key={batch.id} className="bg-red-50">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded-full bg-red-500 blink-red" />
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{batch.batchNo}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{batch.medicine.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {batch.medicine.strength} • {batch.medicine.form}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{batch.pharmacy.code}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-semibold text-red-600">
                                Qty: {stockLevel.qty}
                              </div>
                              <Badge variant="destructive" className="text-xs">
                                {stockLevel.label}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p className="font-medium text-red-600">{batch.qtyAvailable.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">
                                of {batch.qtyReceived.toLocaleString()}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {isExpired(batch.expiryDate) && (
                                <AlertTriangle className="h-3 w-3 text-red-600" />
                              )}
                              {isExpiringSoon(batch.expiryDate) && !isExpired(batch.expiryDate) && (
                                <Calendar className="h-3 w-3 text-yellow-600" />
                              )}
                              <span className="text-sm">{formatDate(batch.expiryDate)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getStorageColor(batch.storageType)}>
                              {batch.storageType.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Medium Stock Tab */}
        <TabsContent value="medium-stock">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500 blink-yellow" />
                Medium Stock Batches
              </CardTitle>
              <CardDescription>
                Stock quantity between 15-30 - consider reordering soon
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : mediumStockBatches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <p className="text-lg font-medium">No Medium Stock Alerts</p>
                  <p className="text-sm text-muted-foreground">All batches are either well-stocked or critically low</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alert</TableHead>
                      <TableHead>Batch No</TableHead>
                      <TableHead>Medicine</TableHead>
                      <TableHead>Pharmacy</TableHead>
                      <TableHead>Stock Level</TableHead>
                      <TableHead>Qty Available</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead>Storage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mediumStockBatches.map((batch) => {
                      const stockLevel = getStockLevel(batch.qtyAvailable);
                      return (
                        <TableRow key={batch.id} className="bg-yellow-50">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded-full bg-yellow-500 blink-yellow" />
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{batch.batchNo}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{batch.medicine.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {batch.medicine.strength} • {batch.medicine.form}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{batch.pharmacy.code}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-semibold text-yellow-600">
                                Qty: {stockLevel.qty}
                              </div>
                              <Badge className="text-xs bg-yellow-500">
                                {stockLevel.label}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p className="font-medium text-yellow-600">{batch.qtyAvailable.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">
                                of {batch.qtyReceived.toLocaleString()}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {isExpired(batch.expiryDate) && (
                                <AlertTriangle className="h-3 w-3 text-red-600" />
                              )}
                              {isExpiringSoon(batch.expiryDate) && !isExpired(batch.expiryDate) && (
                                <Calendar className="h-3 w-3 text-yellow-600" />
                              )}
                              <span className="text-sm">{formatDate(batch.expiryDate)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getStorageColor(batch.storageType)}>
                              {batch.storageType.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expiring Soon Tab */}
        <TabsContent value="expiring-soon">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-600" />
                Medicines Expiring Soon
              </CardTitle>
              <CardDescription>
                Batches expiring within the next 7 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : expiringSoonBatches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <p className="text-lg font-medium">No Expiring Soon Alerts</p>
                  <p className="text-sm text-muted-foreground">No batches expiring within 7 days</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Days Left</TableHead>
                      <TableHead>Batch No</TableHead>
                      <TableHead>Medicine</TableHead>
                      <TableHead>Pharmacy</TableHead>
                      <TableHead>Qty Available</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead>Storage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expiringSoonBatches
                      .sort((a, b) => getDaysUntilExpiry(a.expiryDate) - getDaysUntilExpiry(b.expiryDate))
                      .map((batch) => {
                        const daysLeft = getDaysUntilExpiry(batch.expiryDate);
                        return (
                          <TableRow key={batch.id} className="bg-yellow-50">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-orange-600" />
                                <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                                  {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{batch.batchNo}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{batch.medicine.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {batch.medicine.strength} • {batch.medicine.form}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{batch.pharmacy.code}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <p className="font-medium">{batch.qtyAvailable.toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground">
                                  of {batch.qtyReceived.toLocaleString()}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-medium text-orange-600">
                                {formatDate(batch.expiryDate)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={getStorageColor(batch.storageType)}>
                                {batch.storageType.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expired Tab */}
        <TabsContent value="expired">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Expired Batches
              </CardTitle>
              <CardDescription>
                Batches that have passed their expiry date - quarantine immediately
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : expiredBatches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <p className="text-lg font-medium">No Expired Batches</p>
                  <p className="text-sm text-muted-foreground">All batches are within their expiry dates</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Expired Since</TableHead>
                      <TableHead>Batch No</TableHead>
                      <TableHead>Medicine</TableHead>
                      <TableHead>Pharmacy</TableHead>
                      <TableHead>Qty Available</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead>Storage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expiredBatches.map((batch) => {
                      const daysExpired = Math.abs(getDaysUntilExpiry(batch.expiryDate));
                      return (
                        <TableRow key={batch.id} className="bg-red-50">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                              <Badge variant="destructive">
                                {daysExpired} {daysExpired === 1 ? 'day' : 'days'} ago
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{batch.batchNo}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{batch.medicine.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {batch.medicine.strength} • {batch.medicine.form}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{batch.pharmacy.code}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p className="font-medium text-red-600">{batch.qtyAvailable.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">
                                of {batch.qtyReceived.toLocaleString()}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium text-red-600">
                              {formatDate(batch.expiryDate)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getStorageColor(batch.storageType)}>
                              {batch.storageType.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
