import * as XLSX from 'xlsx';
import {
  buildSheetRows,
  buildExportName,
  EXPORT_COLUMNS,
  MEDICINE_SUBTOTAL_COLUMN,
  type ExportBatch,
} from '@/lib/inventory-export';

// Far-future expiry so batches are treated as active regardless of run date.
const FUTURE = '2999-12-31';

const outCols = [...EXPORT_COLUMNS, MEDICINE_SUBTOTAL_COLUMN];
const colIdx = (key: string) => outCols.findIndex(c => c.key === key);

const makeBatch = (over: Partial<ExportBatch>): ExportBatch => ({
  batchNo: 'B1',
  medicine: { name: 'Panadol', strength: '500mg', form: 'TABLET' },
  qtyAvailable: 10,
  purchasePrice: 2,
  expiryDate: FUTURE,
  status: 'AVAILABLE',
  category: 'NORMAL',
  manufacturer: 'GSK',
  ...over,
});

describe('buildSheetRows — no double counting', () => {
  const batches: ExportBatch[] = [
    makeBatch({ batchNo: 'B1', qtyAvailable: 10, purchasePrice: 2 }), // 20
    makeBatch({ batchNo: 'B2', qtyAvailable: 5, purchasePrice: 4 }), //  20
    makeBatch({ batchNo: 'B3', qtyAvailable: 3, purchasePrice: 7 }), //  21
  ];
  const expectedTotal = 10 * 2 + 5 * 4 + 3 * 7; // 61
  const expectedQty = 10 + 5 + 3; // 18

  const rows = buildSheetRows(batches, EXPORT_COLUMNS, 'active');

  const qi = colIdx('quantity');
  const pi = colIdx('pricePerUnit');
  const ti = colIdx('totalPrice');

  it('leaves the header row Quantity, Price per Unit and Total Price blank', () => {
    // rows[0] = column labels, rows[1] = medicine group header row
    const header = rows[1];
    expect(header[qi]).toBeNull();
    expect(header[pi]).toBeNull();
    expect(header[ti]).toBeNull();
  });

  it('sums the Total Price column to the real total, not double', () => {
    // Batch rows are rows[2..4]; Total Price is a formula, so evaluate qty*price
    // from the row cells (the same values the formula references).
    const batchRows = rows.slice(2, 5);
    const columnSum = batchRows.reduce((s, r) => s + Number(r[qi]) * Number(r[pi]), 0);
    expect(columnSum).toBe(expectedTotal);
    expect(columnSum).not.toBe(expectedTotal * 2);
  });

  it('sums the Quantity column to the real quantity, not double', () => {
    const batchRows = rows.slice(2, 5);
    const qtySum = batchRows.reduce((s, r) => s + Number(r[qi]), 0);
    expect(qtySum).toBe(expectedQty);
    expect(qtySum).not.toBe(expectedQty * 2);
  });

  it('writes Total Price as an =qty*price formula on each batch row', () => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const qCol = XLSX.utils.encode_col(qi);
    const pCol = XLSX.utils.encode_col(pi);
    const tCol = XLSX.utils.encode_col(ti);
    // First batch is Excel row 3 (row 1 = labels, row 2 = medicine header).
    expect(ws[`${tCol}3`].f).toBe(`${qCol}3*${pCol}3`);
    // Header-row numeric cells are genuinely absent (blank), not zero.
    expect(ws[`${qCol}2`]).toBeUndefined();
    expect(ws[`${tCol}2`]).toBeUndefined();
  });

  it('appends a GRAND TOTAL row that SUMs the full data range', () => {
    const grand = rows[rows.length - 1];
    const blank = rows[rows.length - 2];
    expect(blank.every(cell => cell === null)).toBe(true);
    expect(grand[colIdx('medicineName')]).toBe('GRAND TOTAL');
    const tCol = XLSX.utils.encode_col(ti);
    const qCol = XLSX.utils.encode_col(qi);
    // Data rows span Excel rows 2..5 (medicine header + 3 batches).
    expect(grand[ti]).toEqual({ t: 'n', f: `SUM(${tCol}2:${tCol}5)` });
    expect(grand[qi]).toEqual({ t: 'n', f: `SUM(${qCol}2:${qCol}5)` });
  });

  it('keeps the per-medicine aggregate out of the Total Price column', () => {
    const si = colIdx('medicineSubtotal');
    // Subtotal appears on the medicine header row only, equal to the real total.
    expect(rows[1][si]).toBe(expectedTotal);
    // ...and the batch rows do not repeat it.
    expect(rows[2][si]).toBeNull();
  });
});

describe('buildExportName — strength de-duplication', () => {
  it('does not repeat a strength already embedded in the name', () => {
    expect(buildExportName('ACYCLOVIR inj:500mg', '500mg', 'INJECTION')).toBe(
      'ACYCLOVIR inj:500mg (INJECTION)',
    );
    expect(buildExportName('Abhayrah Anti Rabies 0.1ml', '0.1ml', 'INJECTION')).toBe(
      'Abhayrah Anti Rabies 0.1ml (INJECTION)',
    );
  });

  it('appends the strength when the name does not contain it', () => {
    expect(buildExportName('Panadol', '500mg', 'TABLET')).toBe('Panadol 500mg (TABLET)');
  });

  it('matches case-insensitively and ignores extra whitespace', () => {
    expect(buildExportName('Amoxil 250MG', '250mg', 'CAPSULE')).toBe('Amoxil 250MG (CAPSULE)');
    expect(buildExportName('Brufen  400mg', '400mg', 'TABLET')).toBe('Brufen  400mg (TABLET)');
  });
});
