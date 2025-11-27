/**
 * Detailed Report Response Interfaces
 * Complete breakdown of stock movements with medicine-level details
 */

export interface MedicineBatchDetail {
  batchId: string;
  batchNo: string;
  expiryDate: Date;
  qtyAvailable: number;
  purchasePrice: number;
  governmentPrice: number;
  retailPrice: number;
  storageType: string;
}

export interface MedicineStockBalance {
  medicineId: string;
  medicineName: string;
  genericName: string | null;
  form: string;
  strength: string | null;
  totalQuantity: number;
  totalValue: number;
  batchCount: number;
  batches: MedicineBatchDetail[];
}

export interface DetailedGRNItem {
  grnItemId: string;
  medicineId: string;
  medicineName: string;
  genericName: string | null;
  form: string;
  strength: string | null;
  batchNo: string;
  expiryDate: Date;
  qtyReceived: number;
  purchasePrice: number;
  governmentPrice: number;
  retailPrice: number;
  storageType: string;
  totalValue: number;
}

export interface DetailedGRN {
  id: string;
  grnNumber: string;
  invoiceNumber: string | null;
  supplierName: string | null;
  receivedDate: Date;
  receivedBy: string | null;
  itemCount: number;
  totalQuantity: number;
  totalValue: number;
  items: DetailedGRNItem[];
}

export interface DetailedIssueItem {
  issueItemId: string;
  medicineId: string;
  medicineName: string;
  genericName: string | null;
  form: string;
  strength: string | null;
  batchNo: string;
  expiryDate: Date;
  qtyIssued: number;
  unitPrice: number;
  totalAmount: number;
}

export interface DetailedIssue {
  id: string;
  patientNrNumber: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  visitType: string;
  issuedAt: Date;
  issuedBy: string | null;
  prescriptionId: string | null;
  itemCount: number;
  totalQuantity: number;
  totalAmount: number;
  items: DetailedIssueItem[];
}

export interface TransferBatchDetail {
  sourceBatchNo: string;
  sourceExpiryDate: Date;
  destinationBatchNo: string;
  destinationExpiryDate: Date;
  qtyTransferred: number;
}

export interface DetailedTransferItem {
  transferItemId: string;
  medicineId: string;
  medicineName: string;
  genericName: string | null;
  form: string;
  strength: string | null;
  qtyRequested: number;
  qtyApproved: number | null;
  batchMappings: TransferBatchDetail[];
}

export interface DetailedTransfer {
  id: string;
  requestNumber: string;
  fromPharmacyId: string;
  fromPharmacyName: string;
  toPharmacyId: string;
  toPharmacyName: string;
  requestedAt: Date;
  approvedAt: Date | null;
  dispatchedAt: Date | null;
  receivedAt: Date | null;
  status: string;
  requestedBy: string | null;
  approvedBy: string | null;
  itemCount: number;
  totalQuantity: number;
  items: DetailedTransferItem[];
}

export interface MedicineConsumptionSummary {
  medicineId: string;
  medicineName: string;
  genericName: string | null;
  form: string;
  strength: string | null;
  totalQuantityIssued: number;
  numberOfPatients: number;
  numberOfIssues: number;
  totalValue: number;
  averagePerPatient: number;
  averagePerIssue: number;
}

export interface StockMovementEntry {
  timestamp: Date;
  transactionType: 'OPENING' | 'GRN' | 'TRANSFER_IN' | 'ISSUE' | 'TRANSFER_OUT' | 'CLOSING';
  referenceNumber: string | null;
  batchNo: string | null;
  quantityIn: number;
  quantityOut: number;
  runningBalance: number;
  remarks: string | null;
}

export interface MedicineStockLedger {
  medicineId: string;
  medicineName: string;
  genericName: string | null;
  form: string;
  strength: string | null;
  openingBalance: number;
  closingBalance: number;
  totalReceived: number;
  totalIssued: number;
  totalTransferredOut: number;
  movements: StockMovementEntry[];
}

export interface DetailedDailyReport {
  pharmacy: {
    id: string;
    name: string;
    type: string;
    code: string;
  };
  hospital: {
    id: string;
    name: string;
  };
  reportDate: string;
  summary: {
    openingBalance: number;
    openingQuantity: number;
    stockReceived: number;
    stockReceivedQuantity: number;
    stockIssued: number;
    stockIssuedQuantity: number;
    stockTransferred: number;
    stockTransferredQuantity: number;
    closingBalance: number;
    closingQuantity: number;
  };
  medicineWiseOpening: MedicineStockBalance[];
  medicineWiseClosing: MedicineStockBalance[];
  detailedGRNs: DetailedGRN[];
  detailedTransfersIn: DetailedTransfer[];
  detailedIssues: DetailedIssue[];
  detailedTransfersOut: DetailedTransfer[];
  medicineConsumption: MedicineConsumptionSummary[];
}
