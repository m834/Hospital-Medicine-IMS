import { formatSlipMRN } from './mrn';
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
 * What the registration slip prints, on two lines, laid out like the lab
 * slip's first line: the full MR number (MR-2026-10-18-482913), the patient's
 * name and the registration date; then who registered them, on the right.
 * The HTML slip and the dot-matrix text slip both print exactly these.
 */
export function patientSlipValues(patient: ReceiptPatient, registeredBy?: string): SlipLine[] {
  return [
    {
      left: present([formatSlipMRN(patient.nrNumber), patient.fullName]),
      right: present([patient.registeredAt ? formatKarachiDate(patient.registeredAt) : '']),
    },
    {
      left: [],
      right: present([registeredBy ? `Created By: ${registeredBy}` : '']),
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

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const cell = (value = '') => `<span>${escapeHtml(value)}</span>`;

/**
 * The first line of both slips: MR (twice Name's width, printed larger) |
 * Name | Date (as wide as the date).
 */
function slipHeadHtml(line: SlipLine): string {
  return `
          <div class="head">${cell(line.left[0])}${cell(line.left[1])}${cell(line.right[0])}</div>`;
}

/** Values flush left and flush right, as on the lab slip's test line. */
function slipLineHtml(line: SlipLine): string {
  return `
          <div class="line">${[...line.left, ...line.right].map((value) => cell(value)).join('')}</div>`;
}

/** Every value on both slips prints bold, at 20px; the MR at 30px. */
const SLIP_LINE_CSS = `
          .head, .middle, .line {
            gap: 16px;
            font-size: 20px;
            font-weight: 700;
            line-height: 1.4;
          }
          .head { display: grid; grid-template-columns: 2fr 1fr auto; align-items: baseline; }
          .head > span:first-child { font-size: 30px; }
          .middle { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); }
          .head > span, .middle > span { min-width: 0; overflow-wrap: anywhere; }
          .head > span:last-child, .middle > span:last-child { text-align: right; }
          .line { display: flex; justify-content: space-between; }`;

function patientSlipHtml([head, createdBy]: SlipLine[]): string {
  // An empty first cell keeps Created By flush right.
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: A4; margin: 0; }
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #000; padding: 15mm 15mm 15mm 22mm; margin-top: 15%; }${SLIP_LINE_CSS}
        </style>
      </head>
      <body>${slipHeadHtml(head)}${slipLineHtml({ left: [''], right: createdBy.right })}
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
 * What one lab slip prints, on three lines: the full MR number, the patient's
 * name and the order date; then the test's category, with who raised the
 * order on the right; then the test name, with its own amount on the right.
 * The HTML slip lays these out in columns (see labSlipHtml); the dot-matrix
 * text slip prints left and right as given.
 */
export function labSlipLines(
  order: LabReceiptOrder,
  opts: { patientId?: string; createdBy?: string },
): SlipLine[] {
  const patient = order.patient;
  const price = Number(order.labTest?.price || 0);

  return [
    {
      left: present([formatSlipMRN(patient?.nrNumber) || formatSlipMRN(opts.patientId), patient?.fullName]),
      right: present([formatKarachiDate(order.createdAt)]),
    },
    {
      left: present([String(order.labTest?.testCategory ?? '').toUpperCase()]),
      right: present([opts.createdBy ? `Created By: ${opts.createdBy}` : '']),
    },
    {
      left: present([order.labTest?.testName]),
      right: [`Rs. ${price.toFixed(2)}`],
    },
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

  const slips = orders.map((order) => labSlipLines(order, opts));

  return printSlips(
    'MIMS lab slip',
    slips.map((lines) => ({ lines: lines.map((line) => ({ ...line, bold: true })) })),
    () => labSlipHtml(slips),
  );
}

function labSlipHtml(slips: SlipLine[][]): string {
  // Line 1: MR (twice Name's width) | Name | Date (as wide as the date).
  // Line 2: an empty cell as wide as the right one, so the category sits in
  // the middle of the slip, not the middle of what is left; then Created By
  // flush right. Line 3: test name and amount, flush left and right.
  const linesHtml = ([head, middle, test]: SlipLine[]) => `${slipHeadHtml(head)}
          <div class="middle">${cell()}${cell(middle.left[0])}${cell(middle.right[0])}</div>${slipLineHtml(test)}`;

  const pages = slips
    .map((lines, i) => {
      // The final slip must not break, or the printer ejects a blank page.
      const isLast = i === slips.length - 1;

      return `
        <div class="slip${isLast ? '' : ' break'}">${linesHtml(lines)}
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
          .break { page-break-after: always; }${SLIP_LINE_CSS}
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
