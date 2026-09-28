import { formatMRN } from './mrn';
import { formatKarachiDate } from './karachi-date';

export interface ReceiptPatient {
  nrNumber: string;
  fullName: string;
  gender?: string;
  registeredAt?: string;
}

/**
 * Print a patient registration slip.
 *
 * The slip drops into a slot on a pre-printed A4 form, so the details go out as
 * a single run of values — no "Label: value" pairs, no grid. Empty fields are
 * dropped entirely so the line never carries a dangling separator.
 */
export function printPatientReceipt(
  patient: ReceiptPatient,

  hospitalName: string,
  registeredBy?: string,
) {
  const leftValues = [
    patient.fullName,
    formatMRN(patient.nrNumber),
    patient.gender,
  ]
    .filter((v) => v != null && String(v).trim() !== '')
    .map((v) => String(v).trim());

  const rightValues = [
    patient.registeredAt
      ? formatKarachiDate(patient.registeredAt)
      : '',
    registeredBy,
  ]
    .filter((v) => v != null && String(v).trim() !== '')
    .map((v) => String(v).trim());

  const receiptHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: A4; margin: 0; }
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #111827; padding: 15mm 15mm 15mm 22mm; margin-top: 15%; }
          .line {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            font-size: 14px;
            font-weight: 700;
            line-height: 1.4;
          }
          .sep { font-weight: 400; color: #6b7280; padding: 0 14px; }
        </style>
      </head>
      <body>
        <div class="line">
          <span>${leftValues.join('<span class="sep">|</span>')}</span>
          <span>${rightValues.join('<span class="sep">|</span>')}</span>
        </div>
      </body>
    </html>
  `;

  printReceiptHtml(receiptHTML);
}

export interface LabReceiptOrder {
  id?: string;
  orderNumber?: string;
  priority?: string;
  /** When the order was raised — the billing date printed on the slip. */
  createdAt?: string;
  labTest?: {
    testCode?: string;
    testName?: string;
    testCategory?: string;
    price?: number | string | null;
    requirements?: string | null;
  } | null;
  patient?: {
    nrNumber?: string;
    fullName?: string;
    gender?: string;
    mobile?: string | null;
  } | null;
}

/**
 * Print one lab slip per test.
 *
 * Each slip drops into a slot on a pre-printed A4 lab form, so an order of six
 * tests prints as six pages — one form per test — rather than one page listing
 * all six. Same single run of values as the patient slip: no "Label: value"
 * pairs, patient and order details on one line, the test on its own line.
 */
export function printLabReceipt(
  orders: LabReceiptOrder[],
  opts: {
    patientId?: string;
    createdBy?: string;
  },
) {
  if (orders.length === 0) return;

  const slips = orders
    .map((order, i) => {
      const patient = order.patient;

      const leftValues = [
        patient?.fullName,
        formatMRN(patient?.nrNumber) || opts.patientId,
      ]
        .filter((v) => v != null && String(v).trim() !== '')
        .map((v) => String(v).trim());

      // The receipt's own date in Karachi time, used for both the header and
      // the test line. Not the moment of printing: a reprint, and an order a
      // manager booked on a past date, must both show the day the receipt was
      // raised. Falls back to today for an order that carries no date.
      const receiptDate = formatKarachiDate(order.createdAt);

      const rightValues = [receiptDate, opts.createdBy]
        .filter((v) => v != null && String(v).trim() !== '')
        .map((v) => String(v).trim());

      // The display name alone: the internal test code (LAB-173) means nothing
      // to the patient holding the slip. It stays in the database, the UI and
      // search — this is a print-only simplification.
      const test = String(order.labTest?.testName || '').trim();

      // The final slip must not break, or the printer ejects a blank page.
      const isLast = i === orders.length - 1;

      return `
        <div class="slip${isLast ? '' : ' break'}">
          <div class="line">
            <span>${leftValues.join('<span class="sep">|</span>')}</span>
            <span>${rightValues.join('<span class="sep">|</span>')}</span>
          </div>
          <div class="test">
            <span>${test}<span class="sep">|</span><span class="test-date">${receiptDate}</span></span>
            <span>Rs. ${Number(order.labTest?.price || 0).toFixed(2)}</span>
          </div>
        </div>`;
    })
    .join('');

  const receiptHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: A4; margin: 0; }
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #111827; margin: 0; }
          /* Reproduces the previous single-page geometry exactly, now per slip so
             every page lands on the same spot of the pre-printed form:
             46.5mm top = the old body margin-top of 15% (31.5mm of the 210mm
             page) plus its 15mm padding, and the 8px is the default body margin
             the old slip also printed with. Verified against the old layout in a
             browser — same landing point to within 0.01mm. */
          .slip { padding: 46.5mm calc(15mm + 8px) 15mm calc(22mm + 8px); }
          .break { page-break-after: always; }
          .line {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            font-size: 14px;
            font-weight: 700;
            line-height: 1.4;
          }
          .sep { font-weight: 400; color: #6b7280; padding: 0 14px; }
          .test {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            margin-top: 16px;
            font-size: 14px;
            font-weight: 700;
          }
          /* Same size the reference number printed at, so the test line keeps
             the line box it had and nothing on the pre-printed form shifts. */
          .test-date { font-size: 16px; }
        </style>
      </head>
      <body>${slips}
      </body>
    </html>
  `;

  printReceiptHtml(receiptHTML);
}

/**
 * Render the given HTML in a hidden iframe and send it to the printer.
 *
 * On an ordinary browser this opens the print dialog. On the reception
 * machines, where Chrome runs with --kiosk-printing, there is no dialog: the
 * slip goes straight to the default printer as one copy. That path is the
 * reason for the teardown below — kiosk printing returns from print() at once
 * and spools in the background, so tearing the iframe down on a short timer
 * can empty the page out from under the job. Wait for afterprint instead, with
 * a generous timeout for the browsers that never fire it.
 */
export function printReceiptHtml(html: string) {
  const printFrame = document.createElement('iframe');
  printFrame.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
  document.body.appendChild(printFrame);

  const frameDoc = printFrame.contentWindow?.document;
  if (frameDoc) {
    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();

    printFrame.onload = () => {
      const frameWindow = printFrame.contentWindow;
      if (!frameWindow) return;

      let removed = false;
      const removeFrame = () => {
        if (removed) return;
        removed = true;
        printFrame.remove();
      };

      frameWindow.addEventListener('afterprint', () => setTimeout(removeFrame, 500));

      setTimeout(() => {
        frameWindow.print();
        setTimeout(removeFrame, 10000);
      }, 250);
    };
  }
}
