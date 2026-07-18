import * as XLSX from 'xlsx';

/**
 * Pure helpers for building the inventory Excel export.
 *
 * Kept out of the page component so the grouping / totals logic can be unit
 * tested. The header row is a *label only* — all figures live on the batch
 * rows — which is what prevents the Total Price / Quantity columns from being
 * double counted when summed.
 */

export interface ExportBatch {
  batchNo: string;
  medicine: { name: string; strength?: string; form: string };
  qtyAvailable: number;
  purchasePrice: number | string;
  expiryDate: string;
  status: string;
  category: string;
  manufacturer?: string;
}

export interface ExportColumn {
  key: string;
  label: string;
}

export const EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'medicineName', label: 'Medicine Name' },
  { key: 'batchNo', label: 'Batch Number' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'pricePerUnit', label: 'Price per Unit' },
  { key: 'totalPrice', label: 'Total Price' },
  { key: 'expiryDate', label: 'Expiry Date' },
  { key: 'category', label: 'Category (Normal / LP)' },
  { key: 'manufacturer', label: 'Supplier / Manufacturer' },
];

/** Appended column that carries the per-medicine aggregate on header rows only. */
export const MEDICINE_SUBTOTAL_COLUMN: ExportColumn = {
  key: 'medicineSubtotal',
  label: 'Medicine Subtotal',
};

export const isExpired = (d: string): boolean => new Date(d) < new Date();

export const formatExportDate = (dateString: string): string => {
  const d = new Date(dateString);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Build the medicine display name. The strength is often already embedded in
 * the name (from bulk import), e.g. "ACYCLOVIR inj:500mg" with strength
 * "500mg". Only append the strength when the name does not already contain it
 * (case-insensitive, whitespace-normalised) so we don't get "500mg 500mg".
 */
export const buildExportName = (name: string, strength?: string, form?: string): string => {
  const norm = (s?: string) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const appendStrength = !!strength && !norm(name).includes(norm(strength));
  const base = appendStrength ? `${name} ${strength}` : name;
  return form ? `${base} (${form})` : base;
};

interface ExportGroup {
  medicineName: string;
  medicineStrength?: string;
  medicineForm: string;
  batches: ExportBatch[];
  totalQtyAvailable: number;
  totalValue: number;
  nearestExpiry: string;
}

const groupBatches = (batches: ExportBatch[]): ExportGroup[] => {
  const map: Record<string, ExportGroup> = {};
  for (const batch of batches) {
    const key = `${batch.medicine.name}|${batch.medicine.strength ?? ''}|${batch.medicine.form}`;
    if (!map[key]) {
      map[key] = {
        medicineName: batch.medicine.name,
        medicineStrength: batch.medicine.strength,
        medicineForm: batch.medicine.form,
        batches: [],
        totalQtyAvailable: 0,
        totalValue: 0,
        nearestExpiry: batch.expiryDate,
      };
    }
    const g = map[key];
    g.batches.push(batch);
    g.totalQtyAvailable += batch.qtyAvailable;
    g.totalValue += batch.qtyAvailable * Number(batch.purchasePrice);
    if (new Date(batch.expiryDate) < new Date(g.nearestExpiry)) g.nearestExpiry = batch.expiryDate;
  }
  return Object.values(map).sort((a, b) => a.medicineName.localeCompare(b.medicineName));
};

/**
 * Build the array-of-arrays for a single export sheet.
 *
 * Layout per medicine group:
 *   - one header row: medicine name + nearest expiry only (figures blank/null)
 *   - one row per batch: qty, price, Total Price as a live `=qty*price` formula
 * Followed by a blank separator row and a GRAND TOTAL row that SUMs the whole
 * Quantity and Total Price columns (safe because header rows are blank).
 */
export function buildSheetRows(
  batches: ExportBatch[],
  cols: ExportColumn[],
  mode: 'active' | 'expired' = 'active',
): any[][] {
  const scoped = mode === 'expired'
    ? batches.filter(b => isExpired(b.expiryDate) || b.status === 'EXPIRED')
    : batches.filter(b => !isExpired(b.expiryDate) && b.status !== 'EXPIRED');
  const groups = groupBatches(scoped);

  // Output columns = selected columns + an appended "Medicine Subtotal" column.
  // The per-medicine aggregate lives ONLY there (header rows), never in the
  // Total Price column — mixing the two is what produced the doubled sum.
  const outCols: ExportColumn[] = [...cols, MEDICINE_SUBTOTAL_COLUMN];

  const colLetter = (key: string): string | null => {
    const idx = outCols.findIndex(c => c.key === key);
    return idx >= 0 ? XLSX.utils.encode_col(idx) : null;
  };
  const qtyCol = colLetter('quantity');
  const priceCol = colLetter('pricePerUnit');
  const totalCol = colLetter('totalPrice');

  const rows: any[][] = [outCols.map(c => c.label)];

  for (const group of groups) {
    // Header row: label only. Numeric columns null so they are genuinely blank.
    rows.push(outCols.map(c => {
      if (c.key === 'medicineName') {
        return buildExportName(group.medicineName, group.medicineStrength, group.medicineForm);
      }
      if (c.key === 'expiryDate') return formatExportDate(group.nearestExpiry) + ' (nearest)';
      if (c.key === 'category') return group.batches[0]?.category === 'LP' ? 'LP' : 'Normal';
      if (c.key === 'medicineSubtotal') return group.totalValue;
      return null;
    }));

    for (const batch of group.batches) {
      const excelRow = rows.length + 1; // 1-based Excel row of the row about to be pushed
      rows.push(outCols.map(c => {
        if (c.key === 'batchNo') return batch.batchNo;
        if (c.key === 'quantity') return batch.qtyAvailable;
        if (c.key === 'pricePerUnit') return Number(batch.purchasePrice);
        if (c.key === 'totalPrice') {
          // Live formula so the sheet recalculates when a qty/rate is edited.
          // Fall back to a number only if a referenced column was deselected.
          if (qtyCol && priceCol) return { t: 'n', f: `${qtyCol}${excelRow}*${priceCol}${excelRow}` };
          return batch.qtyAvailable * Number(batch.purchasePrice);
        }
        if (c.key === 'expiryDate') return formatExportDate(batch.expiryDate);
        if (c.key === 'category') return batch.category === 'LP' ? 'LP' : 'Normal';
        if (c.key === 'manufacturer') return batch.manufacturer || '';
        return null;
      }));
    }
  }

  // Grand total: blank separator row, then a SUM over the full data range.
  // Header rows are blank in the numeric columns, so a whole-column SUM is safe.
  if (rows.length > 1) {
    const lastDataRow = rows.length; // 1-based Excel row of the last data row
    rows.push(outCols.map(() => null));
    rows.push(outCols.map(c => {
      if (c.key === 'medicineName') return 'GRAND TOTAL';
      if (c.key === 'quantity' && qtyCol) return { t: 'n', f: `SUM(${qtyCol}2:${qtyCol}${lastDataRow})` };
      if (c.key === 'totalPrice' && totalCol) return { t: 'n', f: `SUM(${totalCol}2:${totalCol}${lastDataRow})` };
      return null;
    }));
  }

  return rows;
}
