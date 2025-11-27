/**
 * Export utilities for generating Excel and PDF reports
 */

export interface ExportData {
  pharmacy: {
    name: string;
    type: string;
  };
  hospital: {
    name: string;
  };
  reportDate: string;
  summary: any;
  medicineWiseOpening?: any[];
  medicineWiseClosing?: any[];
  detailedGRNs?: any[];
  detailedTransfersIn?: any[];
  detailedIssues?: any[];
  detailedTransfersOut?: any[];
  medicineConsumption?: any[];
}

/**
 * Export report data to Excel (CSV format)
 * Creates multiple sheets for different sections
 */
export function exportToExcel(data: ExportData) {
  try {
    const date = new Date(data.reportDate).toLocaleDateString();
    const filename = `${data.pharmacy.name}_Daily_Report_${date.replace(/\//g, '-')}.csv`;

    let csv = `Daily Transactions Report\n`;
    csv += `Pharmacy: ${data.pharmacy.name} (${data.pharmacy.type})\n`;
    csv += `Hospital: ${data.hospital.name}\n`;
    csv += `Date: ${date}\n\n`;

    // Summary
    csv += `Summary\n`;
    csv += `Opening Balance,${data.summary.openingBalance}\n`;
    csv += `Closing Balance,${data.summary.closingBalance}\n`;
    csv += `Total GRN Value,${data.summary.totalGRNValue || 0}\n`;
    csv += `Total Transfers In,${data.summary.totalTransfersIn || 0}\n`;
    csv += `Total Issues,${data.summary.totalIssues || 0}\n`;
    csv += `Total Transfers Out,${data.summary.totalTransfersOut || 0}\n\n`;

    // Opening Stock
    if (data.medicineWiseOpening && data.medicineWiseOpening.length > 0) {
      csv += `\nOpening Stock (Medicine-Wise)\n`;
      csv += `Medicine Name,Generic Name,Form,Strength,Total Quantity,Batch Count,Total Value\n`;
      data.medicineWiseOpening.forEach((med) => {
        csv += `"${med.medicineName}","${med.genericName || ''}",${med.form},${med.strength || ''},${med.totalQuantity},${med.batchCount},${med.totalValue}\n`;
      });
      csv += `\n`;
    }

    // GRNs
    if (data.detailedGRNs && data.detailedGRNs.length > 0) {
      csv += `\nGoods Receipt Notes\n`;
      csv += `GRN Number,Received Date,Received By,Total Items,Total Value\n`;
      data.detailedGRNs.forEach((grn) => {
        csv += `${grn.grnNumber},${new Date(grn.receivedDate).toLocaleDateString()},${grn.receivedBy},${grn.totalItems},${grn.totalValue}\n`;
      });
      csv += `\n`;
    }

    // Transfers In
    if (data.detailedTransfersIn && data.detailedTransfersIn.length > 0) {
      csv += `\nTransfers Received\n`;
      csv += `From Pharmacy,To Pharmacy,Requested At,Status,Total Items\n`;
      data.detailedTransfersIn.forEach((transfer) => {
        csv += `"${transfer.fromPharmacy}","${transfer.toPharmacy}",${new Date(transfer.requestedAt).toLocaleDateString()},${transfer.status},${transfer.totalItems}\n`;
      });
      csv += `\n`;
    }

    // Issues
    if (data.detailedIssues && data.detailedIssues.length > 0) {
      csv += `\nPatient Issuances\n`;
      csv += `NR Number,Patient Name,Age,Gender,Visit Type,Issued At,Total Items,Total Amount\n`;
      data.detailedIssues.forEach((issue) => {
        csv += `${issue.nrNumber},"${issue.patientName}",${issue.age || ''},${issue.gender},${issue.visitType},${new Date(issue.issueDate).toLocaleDateString()},${issue.totalItems},${issue.totalAmount}\n`;
      });
      csv += `\n`;
    }

    // Transfers Out
    if (data.detailedTransfersOut && data.detailedTransfersOut.length > 0) {
      csv += `\nTransfers Sent\n`;
      csv += `From Pharmacy,To Pharmacy,Requested At,Status,Total Items\n`;
      data.detailedTransfersOut.forEach((transfer) => {
        csv += `"${transfer.fromPharmacy}","${transfer.toPharmacy}",${new Date(transfer.requestedAt).toLocaleDateString()},${transfer.status},${transfer.totalItems}\n`;
      });
      csv += `\n`;
    }

    // Closing Stock
    if (data.medicineWiseClosing && data.medicineWiseClosing.length > 0) {
      csv += `\nClosing Stock (Medicine-Wise)\n`;
      csv += `Medicine Name,Generic Name,Form,Strength,Total Quantity,Batch Count,Total Value\n`;
      data.medicineWiseClosing.forEach((med) => {
        csv += `"${med.medicineName}","${med.genericName || ''}",${med.form},${med.strength || ''},${med.totalQuantity},${med.batchCount},${med.totalValue}\n`;
      });
      csv += `\n`;
    }

    // Medicine Consumption
    if (data.medicineConsumption && data.medicineConsumption.length > 0) {
      csv += `\nMedicine Consumption Summary\n`;
      csv += `Medicine Name,Generic Name,Form,Strength,Total Quantity,Total Patients,Average per Patient\n`;
      data.medicineConsumption.forEach((med) => {
        csv += `"${med.medicineName}","${med.genericName || ''}",${med.form},${med.strength || ''},${med.totalQuantity},${med.totalPatients},${med.averagePerPatient.toFixed(2)}\n`;
      });
    }

    // Create and download CSV file
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    throw new Error('Failed to export data');
  }
}

/**
 * Export report data to PDF
 * Uses browser's print functionality
 */
export function exportToPDF() {
  window.print();
}

/**
 * Format currency for export
 */
export function formatCurrencyForExport(value: number): string {
  return value.toFixed(2);
}

/**
 * Format date for export
 */
export function formatDateForExport(dateString: string): string {
  return new Date(dateString).toISOString().split('T')[0];
}
