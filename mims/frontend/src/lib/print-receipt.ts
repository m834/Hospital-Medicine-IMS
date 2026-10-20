import { formatSlipMRN } from './mrn';
import { amountInWords } from './amount-words';
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

/** One printed line: values joined with " | ", flush left and flush right. */
export interface SlipLine {
  left: string[];
  right: string[];
}

function present(values: (string | null | undefined)[]): string[] {
  return values
    .filter((v) => v != null && String(v).trim() !== '')
    .map((v) => String(v).trim());
}

/**
 * What the registration slip prints, on two lines: the full MR number
 * (MR-2026-10-18-482913), with who registered on the right; then the
 * patient's name, with their gender and the registration date on the right.
 * The HTML slip and the dot-matrix text slip both print exactly these.
 */
export function patientSlipValues(patient: ReceiptPatient, registeredBy?: string): SlipLine[] {
  return [
    {
      left: present([formatSlipMRN(patient.nrNumber)]),
      right: present([registeredBy]),
    },
    {
      left: present([patient.fullName]),
      right: present([patient.gender, patient.registeredAt ? formatKarachiDate(patient.registeredAt) : '']),
    },
  ];
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
  const lines = patientSlipValues(patient, registeredBy);

  return printSlips(
    'MIMS registration slip',
    [{ lines: lines.map((line) => ({ ...line, bold: true })) }],
    () => patientSlipHtml(lines),
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

function slipLineHtml(line: SlipLine): string {
  return `
        <div class="line">
          <span>${line.left.join('<span class="sep">|</span>')}</span>
          <span>${line.right.join('<span class="sep">|</span>')}</span>
        </div>`;
}

function patientSlipHtml(lines: SlipLine[]): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: A4; margin: 0; }
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #000; padding: 15mm 15mm 15mm 22mm; margin-top: 15%; }
          .line {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            font-size: 20px;
            font-weight: 700;
            line-height: 1.4;
          }
          .sep { font-weight: 700; color: #374151; padding: 0 14px; }
        </style>
      </head>
      <body>${lines.map(slipLineHtml).join('')}
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


/**
 * What one lab slip prints, one value per pre-printed row of the form. The
 * form carries the labels; the slip prints values only.
 */
export interface LabSlipValues {
  mr: string;
  name: string;
  sex: string;
  category: string;
  test: string;
  date: string;
  /** In figures, e.g. 50.00 — the form prints the "Rs.". */
  amount: string;
  amountWords: string;
}

export function labSlipValues(
  order: LabReceiptOrder,
  opts: { patientId?: string; createdBy?: string },
): LabSlipValues {
  const patient = order.patient;
  const text = (value: unknown) => String(value ?? '').trim();
  const price = Number(order.labTest?.price || 0);

  return {
    mr: formatSlipMRN(patient?.nrNumber) || formatSlipMRN(opts.patientId),
    name: text(patient?.fullName),
    sex: text(patient?.gender).toUpperCase(),
    category: text(order.labTest?.testCategory).toUpperCase(),
    test: text(order.labTest?.testName),
    date: formatKarachiDate(order.createdAt),
    amount: price.toFixed(2),
    amountWords: amountInWords(price),
  };
}

/** Columns the amount takes before its words start on the Total row. */
const AMOUNT_COLUMNS = 15;

/**
 * The slip's rows, top to bottom, one per row of the pre-printed form, each
 * 1/6 in below the last: MR no., Name, Sex, Address, Category, Test, Date,
 * Total. A row with nothing to print (Address, which registration does not
 * collect, or a test with no category) is left empty, so every row below it
 * still lands in its own box.
 */
export function labSlipRows(slip: LabSlipValues): string[] {
  return [
    slip.mr,
    slip.name,
    slip.sex,
    '', // Address
    slip.category,
    slip.test,
    slip.date,
    `${slip.amount.padEnd(AMOUNT_COLUMNS)}${slip.amountWords}`,
  ];
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

  const slips = orders.map((order) => labSlipRows(labSlipValues(order, opts)));

  return printSlips(
    'MIMS lab slip',
    slips.map((rows) => ({
      lines: rows.map((row) => (row ? { left: [row], right: [], bold: true } : {})),
    })),
    () => labSlipHtml(slips),
  );
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function labSlipHtml(slips: string[][]): string {
  const pages = slips
    .map((rows, i) => {
      // The final slip must not break, or the printer ejects a blank page.
      const isLast = i === slips.length - 1;

      return `
        <div class="slip${isLast ? '' : ' break'}">${rows
          .map((row) => `
          <div class="row">${escapeHtml(row)}</div>`)
          .join('')}
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
          body { font-family: Arial, sans-serif; color: #000; margin: 0; }
          /* Same landing point as before: 46.5mm top, 22mm + 8px left. */
          .slip { padding: 46.5mm calc(15mm + 8px) 15mm calc(22mm + 8px); }
          .break { page-break-after: always; }
          /* One row of the form each, 1/6 in apart — the dot-matrix pitch. */
          .row {
            height: calc(1in / 6);
            line-height: calc(1in / 6);
            font-size: 15px;
            font-weight: 700;
            white-space: pre;
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
