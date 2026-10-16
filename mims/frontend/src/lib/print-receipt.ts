import { formatMRN, formatSlipMRN } from './mrn';
import { formatKarachiDate } from './karachi-date';
import { hasShellSlipPrinter, printRawSlips, rawSlipPrinter, type RawSlip } from './slip-printer';

export interface ReceiptPatient {
  nrNumber: string;
  fullName: string;
  gender?: string;
  registeredAt?: string;
}

/** Whether a slip reached the printer, and if not, why. */
export type SlipPrintResult = { printed: true } | { printed: false; error: string };

/**
 * What the registration slip prints, in order: name, MR number and gender on
 * the left; registration date and who registered on the right. The HTML slip
 * and the dot-matrix text slip both print exactly these.
 */
export function patientSlipValues(
  patient: ReceiptPatient,
  registeredBy?: string,
): { left: string[]; right: string[] } {
  const left = [
    patient.fullName,
    formatMRN(patient.nrNumber),
    patient.gender,
  ]
    .filter((v) => v != null && String(v).trim() !== '')
    .map((v) => String(v).trim());

  const right = [
    patient.registeredAt
      ? formatKarachiDate(patient.registeredAt)
      : '',
    registeredBy,
  ]
    .filter((v) => v != null && String(v).trim() !== '')
    .map((v) => String(v).trim());

  return { left, right };
}

/**
 * Prints the registration slip: as plain text straight to the dot-matrix on a
 * station the MIMS Desktop shell has set to print raw, otherwise as HTML.
 */
export function printPatientReceipt(
  patient: ReceiptPatient,

  hospitalName: string,
  registeredBy?: string,
): Promise<SlipPrintResult> {
  const { left, right } = patientSlipValues(patient, registeredBy);

  return printSlips(
    'MIMS registration slip',
    [{ lines: [{ left, right, bold: true }] }],
    () => patientSlipHtml(left, right),
  );
}

/**
 * Sends slips to the printer: as plain text through the MIMS Desktop shell on
 * a station set to print raw, otherwise as HTML. Printed means the raw job
 * reached Windows whole, or print() was called on the HTML slip.
 */
function printSlips(docName: string, rawSlips: RawSlip[], html: () => string): Promise<SlipPrintResult> {
  // Without the shell, straight to HTML with no await first — exactly as
  // before, so plain Chrome prints in the same turn as the click.
  if (!hasShellSlipPrinter()) return printSlipHtml(html());

  return (async (): Promise<SlipPrintResult> => {
    const raw = await rawSlipPrinter();
    if (!raw) return printSlipHtml(html());

    const result = await printRawSlips(raw, docName, rawSlips);
    return result.ok ? { printed: true } : { printed: false, error: result.error };
  })();
}

async function printSlipHtml(html: string): Promise<SlipPrintResult> {
  const printed = await printReceiptHtml(html);
  return printed ? { printed: true } : { printed: false, error: 'The slip did not print.' };
}

function patientSlipHtml(leftValues: string[], rightValues: string[]): string {
  return `
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


/** What one lab slip prints: the patient line, then the test line. */
export interface LabSlipValues {
  left: string[];
  right: string[];
  test: string;
  amount: string;
}

/**
 * The values on one test's slip, in order: name and full MR number on the
 * left, the order date and who raised it on the right; then the test name and
 * its own amount. The HTML slip and the dot-matrix text slip print exactly these.
 */
export function labSlipValues(
  order: LabReceiptOrder,
  opts: { patientId?: string; createdBy?: string },
): LabSlipValues {
  const patient = order.patient;

  const left = [
    patient?.fullName,
    formatSlipMRN(patient?.nrNumber) || formatSlipMRN(opts.patientId),
  ]
    .filter((v) => v != null && String(v).trim() !== '')
    .map((v) => String(v).trim());

  const receiptDate = formatKarachiDate(order.createdAt);

  const right = [receiptDate, opts.createdBy]
    .filter((v) => v != null && String(v).trim() !== '')
    .map((v) => String(v).trim());

  const test = String(order.labTest?.testName || '').trim();
  const amount = `Rs. ${Number(order.labTest?.price || 0).toFixed(2)}`;

  return { left, right, test, amount };
}

/**
 * Prints one slip per test — one pre-printed form each: as plain text straight
 * to the dot-matrix on a station the MIMS Desktop shell has set to print raw,
 * otherwise as HTML.
 */
export function printLabReceipt(
  orders: LabReceiptOrder[],
  opts: {
    patientId?: string;
    createdBy?: string;
  },
): Promise<SlipPrintResult> {
  if (orders.length === 0) {
    return Promise.resolve({ printed: false, error: 'There is no lab slip to print.' });
  }

  const slips = orders.map((order) => labSlipValues(order, opts));

  return printSlips(
    'MIMS lab slip',
    slips.map((slip) => ({
      lines: [
        { left: slip.left, right: slip.right, bold: true },
        {},
        { left: [slip.test], right: [slip.amount], bold: true },
      ],
    })),
    () => labSlipHtml(slips),
  );
}

function labSlipHtml(slips: LabSlipValues[]): string {
  const pages = slips
    .map((slip, i) => {
      // The final slip must not break, or the printer ejects a blank page.
      const isLast = i === slips.length - 1;

      return `
        <div class="slip${isLast ? '' : ' break'}">
          <div class="line">
            <span>${slip.left.join('<span class="sep">|</span>')}</span>
            <span>${slip.right.join('<span class="sep">|</span>')}</span>
          </div>
          <div class="test">
            <span>${slip.test}</span>
            <span>${slip.amount}</span>
          </div>
        </div>`;
    })
    .join('');

  return `
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
      <body>${pages}
      </body>
    </html>
  `;
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
