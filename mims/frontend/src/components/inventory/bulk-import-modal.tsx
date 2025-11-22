'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Upload, Loader2, CheckCircle2, XCircle, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '@/lib/api';

interface Pharmacy {
  id: string;
  name: string;
  code: string;
  type: string;
}

interface BulkImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pharmacies: Pharmacy[];
  onSuccess: () => void;
}

interface ImportResult {
  successful: Array<{
    batchNo: string;
    medicineName: string;
    stockBatchId: string;
  }>;
  failed: Array<{
    batchNo: string;
    medicineName: string;
    error: string;
  }>;
  created: number;
  errors: number;
  medicinesCreated: number;
}

export function BulkImportModal({ open, onOpenChange, pharmacies, onSuccess }: BulkImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [selectedPharmacy, setSelectedPharmacy] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const downloadTemplate = () => {
    // Create template data
    const templateData = [
      {
        'Medicine Name': 'Paracetamol',
        'Generic Name': 'Acetaminophen',
        'Form': 'TABLET',
        'Strength': '500mg',
        'Batch Number': 'BATCH-2024-001',
        'Quantity': 1000,
        'Expiry Date': '2026-12-31',
        'Manufacturer': 'GSK Pakistan',
        'Storage Type': 'ROOM_TEMPERATURE',
        'Purchase Price': 2.50,
        'Government Price': 3.00,
        'Retail Price': 5.00,
      },
      {
        'Medicine Name': 'Amoxicillin',
        'Generic Name': 'Amoxicillin',
        'Form': 'CAPSULE',
        'Strength': '250mg',
        'Batch Number': 'BATCH-2024-002',
        'Quantity': 500,
        'Expiry Date': '2025-06-30',
        'Manufacturer': 'Pfizer',
        'Storage Type': 'COLD_STORAGE',
        'Purchase Price': 5.00,
        'Government Price': 6.00,
        'Retail Price': 10.00,
      },
    ];

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(templateData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 20 }, // Medicine Name
      { wch: 20 }, // Generic Name
      { wch: 12 }, // Form
      { wch: 12 }, // Strength
      { wch: 18 }, // Batch Number
      { wch: 10 }, // Quantity
      { wch: 15 }, // Expiry Date
      { wch: 20 }, // Manufacturer
      { wch: 18 }, // Storage Type
      { wch: 15 }, // Purchase Price
      { wch: 15 }, // Government Price
      { wch: 15 }, // Retail Price
    ];

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Batches');

    // Add instructions sheet
    const instructions = [
      { Instruction: '1. Fill in the medicine and batch details in the "Stock Batches" sheet' },
      { Instruction: '2. Medicine Name and Form are required. If medicine doesn\'t exist, it will be created automatically' },
      { Instruction: '3. Valid Forms: TABLET, CAPSULE, SYRUP, INJECTION, CREAM, DROPS, OINTMENT, POWDER, SUSPENSION' },
      { Instruction: '4. Valid Storage Types: ROOM_TEMPERATURE, COLD_STORAGE, REFRIGERATED' },
      { Instruction: '5. Expiry Date format: YYYY-MM-DD (e.g., 2026-12-31)' },
      { Instruction: '6. All prices should be in PKR' },
      { Instruction: '7. Save the file and upload it in the bulk import dialog' },
    ];
    const wsInstructions = XLSX.utils.json_to_sheet(instructions);
    wsInstructions['!cols'] = [{ wch: 100 }];
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

    // Download file
    XLSX.writeFile(wb, 'stock_batch_import_template.xlsx');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const parseExcelFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsBinaryString(file);
    });
  };

  const handleImport = async () => {
    if (!file || !selectedPharmacy) {
      alert('Please select a pharmacy and upload a file');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Parse Excel file
      const excelData = await parseExcelFile(file);

      // Transform Excel data to API format
      const batches = excelData.map((row: any) => ({
        medicineName: row['Medicine Name'],
        genericName: row['Generic Name'] || undefined,
        form: row['Form'],
        strength: row['Strength'] || undefined,
        medicineManufacturer: row['Manufacturer'] || undefined,
        pharmacyId: selectedPharmacy,
        batchNo: row['Batch Number'],
        qtyReceived: Number(row['Quantity']),
        expiryDate: row['Expiry Date'],
        manufacturer: row['Manufacturer'] || undefined,
        storageType: row['Storage Type'],
        purchasePrice: Number(row['Purchase Price']),
        governmentPrice: Number(row['Government Price']),
        retailPrice: Number(row['Retail Price']),
      }));

      // Submit to API
      const response = await api.post('/inventory/batches/bulk', {
        batches,
        hospitalId: '', // Will be extracted from pharmacy
      });

      setResult(response.data);
      
      if (response.data.created > 0) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Import error:', error);
      alert(error.response?.data?.message || 'Failed to import stock batches');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setSelectedPharmacy('');
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Bulk Import Stock Batches
          </DialogTitle>
          <DialogDescription>
            Upload an Excel file to import multiple stock batches at once
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Download Template */}
          <div className="p-4 border rounded-lg bg-muted/50">
            <h3 className="font-medium mb-2">Step 1: Download Template</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Download the Excel template and fill in your stock batch data
            </p>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Download Template
            </Button>
          </div>

          {/* Select Pharmacy */}
          <div className="space-y-2">
            <Label>Step 2: Select Main Pharmacy *</Label>
            <Select value={selectedPharmacy} onValueChange={setSelectedPharmacy}>
              <SelectTrigger>
                <SelectValue placeholder="Select pharmacy" />
              </SelectTrigger>
              <SelectContent>
                {pharmacies.filter(p => p.type === 'MAIN').map((pharmacy) => (
                  <SelectItem key={pharmacy.id} value={pharmacy.id}>
                    {pharmacy.name} ({pharmacy.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Upload File */}
          <div className="space-y-2">
            <Label>Step 3: Upload Excel File *</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                disabled={loading}
              />
            </div>
            {file && (
              <p className="text-sm text-muted-foreground">
                Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>

          {/* Import Results */}
          {result && (
            <Alert>
              <AlertDescription>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Successfully imported: {result.created} batches
                  </div>
                  {result.medicinesCreated > 0 && (
                    <div className="text-sm text-blue-600">
                      New medicines created: {result.medicinesCreated}
                    </div>
                  )}
                  {result.errors > 0 && (
                    <div className="flex items-center gap-2 text-red-600">
                      <XCircle className="h-4 w-4" />
                      Failed: {result.errors} batches
                    </div>
                  )}
                  
                  {result.failed.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium">
                        View Errors ({result.failed.length})
                      </summary>
                      <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                        {result.failed.map((item, idx) => (
                          <div key={idx} className="text-xs p-2 bg-red-50 rounded">
                            <span className="font-medium">{item.batchNo || item.medicineName}:</span>{' '}
                            {item.error}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Close
          </Button>
          <Button onClick={handleImport} disabled={!file || !selectedPharmacy || loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Importing...' : 'Import Stock Batches'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
