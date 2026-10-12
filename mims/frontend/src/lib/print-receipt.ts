import { formatMRN, formatSlipMRN } from './mrn';
import { formatKarachiDate } from './karachi-date';

export interface ReceiptPatient {
  nrNumber: string;
  fullName: string;
  gender?: string;
  registeredAt?: string;
}

export function printPatientReceipt(
  patient: ReceiptPatient,

  hospitalName: string,
  registeredBy?: string,
): Promise<boolean> {
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

  return printReceiptHtml(receiptHTML);
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


export function printLabReceipt(
  orders: LabReceiptOrder[],
  opts: {
    patientId?: string;
    createdBy?: string;
  },
): Promise<boolean> {
  if (orders.length === 0) return Promise.resolve(false);

  const slips = orders
    .map((order, i) => {
      const patient = order.patient;

     
      const leftValues = [
        patient?.fullName,
        formatSlipMRN(patient?.nrNumber) || formatSlipMRN(opts.patientId),
      ]
        .filter((v) => v != null && String(v).trim() !== '')
        .map((v) => String(v).trim());

    
      const receiptDate = formatKarachiDate(order.createdAt);

      const rightValues = [receiptDate, opts.createdBy]
        .filter((v) => v != null && String(v).trim() !== '')
        .map((v) => String(v).trim());

      
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
            <span>${test}</span>
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
        </style>
      </head>
      <body>${slips}
      </body>
    </html>
  `;

  return printReceiptHtml(receiptHTML);
}

/** Marks the hidden frames printReceiptHtml creates, with their state. */
const PRINT_FRAME_ATTR = 'data-print-frame';
/** When the frame entered its current state, so a leftover can be aged. */
const PRINT_FRAME_SINCE_ATTR = 'data-print-frame-since';

/** Settle time between the slip loading and print(), as before. */
const PRINT_DELAY_MS = 250;
/** A slip that has not loaded by now never will; give up and report it. */
const LOAD_TIMEOUT_MS = 5000;
/** Grace after afterprint before the frame goes. */
const AFTERPRINT_GRACE_MS = 500;
/** Teardown for browsers that never fire afterprint. */
const SPOOL_FALLBACK_MS = 10000;

type PrintFrameState = 'loading' | 'printing';

function markPrintFrame(frame: HTMLIFrameElement, state: PrintFrameState) {
  frame.setAttribute(PRINT_FRAME_ATTR, state);
  frame.setAttribute(PRINT_FRAME_SINCE_ATTR, String(Date.now()));
}


function removeLeftoverPrintFrames() {
  const now = Date.now();
  document.querySelectorAll<HTMLIFrameElement>(`iframe[${PRINT_FRAME_ATTR}]`).forEach((frame) => {
    const state = frame.getAttribute(PRINT_FRAME_ATTR);
    const age = now - Number(frame.getAttribute(PRINT_FRAME_SINCE_ATTR) || 0);
    const inFlight =
      (state === 'loading' && age < LOAD_TIMEOUT_MS) ||
      (state === 'printing' && age < SPOOL_FALLBACK_MS);
    if (!inFlight) frame.remove();
  });
}


export function printReceiptHtml(html: string): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false);

  removeLeftoverPrintFrames();

  return new Promise<boolean>((resolve) => {
    const printFrame = document.createElement('iframe');
    printFrame.style.cssText =
      'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
    markPrintFrame(printFrame, 'loading');

    let claimed = false; // the one print() this slip is allowed
    let settled = false;
    let removed = false;

    const removeFrame = () => {
      if (removed) return;
      removed = true;
      printFrame.remove();
    };

    const settle = (started: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(loadTimer);
      resolve(started);
    };

    const loadTimer = setTimeout(() => {
      if (claimed) return;
      settle(false);
      removeFrame();
    }, LOAD_TIMEOUT_MS);

    printFrame.addEventListener('load', () => {
      if (claimed || settled) return;

      const frameWindow = printFrame.contentWindow;
      if (!frameWindow) return;

      // Only the slip itself counts. An empty about:blank load, which some
      // browsers fire on insertion, is not the slip and is ignored.
      let hasSlip = false;
      try {
        hasSlip = !!frameWindow.document.body?.innerHTML.trim();
      } catch {
        hasSlip = false;
      }
      if (!hasSlip) return;

      // Claimed before the delay, so a second load in the meantime is a no-op.
      claimed = true;
      markPrintFrame(printFrame, 'printing');
      frameWindow.addEventListener('afterprint', () =>
        setTimeout(removeFrame, AFTERPRINT_GRACE_MS),
      );

      setTimeout(() => {
        try {
          frameWindow.print();
        } catch {
          settle(false);
          removeFrame();
          return;
        }
        settle(true);
        setTimeout(removeFrame, SPOOL_FALLBACK_MS);
      }, PRINT_DELAY_MS);
    });

    printFrame.srcdoc = html;
    document.body.appendChild(printFrame);
  });
}
