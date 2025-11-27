'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Pill, Users, TrendingUp, Package } from 'lucide-react';

interface MedicineConsumptionSummary {
  medicineId: string;
  medicineName: string;
  genericName: string | null;
  form: string;
  strength: string | null;
  totalQuantity: number;
  totalPatients: number;
  averagePerPatient: number;
}

interface MedicineConsumptionSummaryProps {
  data: MedicineConsumptionSummary[];
  startDate?: string;
  endDate?: string;
}

export function MedicineConsumptionSummaryComponent({
  data,
  startDate,
  endDate,
}: MedicineConsumptionSummaryProps) {
  const formatNumber = (value: number, decimals: number = 2) => {
    return value.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const totalQuantity = data.reduce((sum, med) => sum + med.totalQuantity, 0);
  const totalPatients = data.reduce((sum, med) => sum + med.totalPatients, 0);
  const uniqueMedicines = data.length;

  // Sort by total quantity descending
  const sortedData = [...data].sort((a, b) => b.totalQuantity - a.totalQuantity);
  const topMedicines = sortedData.slice(0, 5);

  if (data.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center">
        <Package className="h-12 w-12 mx-auto text-gray-400 mb-3" />
        <h3 className="text-lg font-semibold text-gray-700 mb-1">Medicine Consumption Summary</h3>
        <p className="text-gray-500">No consumption data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Medicine Consumption Summary
            {startDate && endDate && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
                )
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Pill className="h-5 w-5 text-blue-600" />
                <p className="text-sm text-gray-600">Unique Medicines</p>
              </div>
              <p className="text-2xl font-bold text-blue-600">{uniqueMedicines}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-5 w-5 text-green-600" />
                <p className="text-sm text-gray-600">Total Quantity Issued</p>
              </div>
              <p className="text-2xl font-bold text-green-600">{totalQuantity.toLocaleString()}</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5 text-purple-600" />
                <p className="text-sm text-gray-600">Total Patients Served</p>
              </div>
              <p className="text-2xl font-bold text-purple-600">{totalPatients}</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-orange-600" />
                <p className="text-sm text-gray-600">Avg Items per Patient</p>
              </div>
              <p className="text-2xl font-bold text-orange-600">
                {formatNumber(totalQuantity / totalPatients, 1)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top 5 Medicines Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top 5 Most Consumed Medicines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topMedicines.map((medicine, index) => (
              <div key={medicine.medicineId} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 font-bold rounded-full">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{medicine.medicineName}</p>
                  {medicine.genericName && (
                    <p className="text-xs text-gray-500">{medicine.genericName}</p>
                  )}
                </div>
                <Badge variant="outline">{medicine.form}</Badge>
                {medicine.strength && <span className="text-sm text-gray-600">{medicine.strength}</span>}
                <div className="text-right">
                  <p className="text-sm font-semibold">{medicine.totalQuantity.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">{medicine.totalPatients} patients</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Complete Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Complete Consumption Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medicine</TableHead>
                <TableHead>Form</TableHead>
                <TableHead>Strength</TableHead>
                <TableHead className="text-right">Total Quantity</TableHead>
                <TableHead className="text-right">Patients Served</TableHead>
                <TableHead className="text-right">Avg per Patient</TableHead>
                <TableHead className="text-right">% of Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((medicine) => (
                <TableRow key={medicine.medicineId}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{medicine.medicineName}</p>
                      {medicine.genericName && (
                        <p className="text-xs text-gray-500">{medicine.genericName}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{medicine.form}</Badge>
                  </TableCell>
                  <TableCell>{medicine.strength || '-'}</TableCell>
                  <TableCell className="text-right font-medium">
                    {medicine.totalQuantity.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Users className="h-3 w-3 text-gray-400" />
                      {medicine.totalPatients}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(medicine.averagePerPatient, 1)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">
                      {formatNumber((medicine.totalQuantity / totalQuantity) * 100, 1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
