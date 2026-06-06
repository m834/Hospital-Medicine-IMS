import { format } from 'date-fns';

export interface ReceiptPatient {
  nrNumber: string;
  fullName: string;
  gender?: string;
  mobile?: string | null;
  cnic?: string | null;
  registeredAt?: string;
  visitType?: string;
  departmentInfo?: { name?: string } | null;
  attendingDoctor?: { fullName?: string } | null;
}

/**
 * Print a patient registration receipt using the shared A4 receipt pattern.
 * Only fields that actually have a value are rendered, so the grid has no gaps.
 */
export function printPatientReceipt(
  patient: ReceiptPatient,

  hospitalName: string,
  printedBy?: string,
) {
  const infoFields: { label: string; value?: string | null }[] = [
    { label: 'Full Name', value: patient.fullName },
    { label: 'MRN', value: patient.nrNumber },
    { label: 'Printed by', value: printedBy },
    { label: 'Gender', value: patient.gender },
    { label: 'Mobile', value: patient.mobile },
    { label: 'CNIC', value: patient.cnic },
    {
      label: 'Registered',
      value: patient.registeredAt
        ? format(new Date(patient.registeredAt), 'dd/MM/yyyy')
        : '',
    },
    { label: 'Visit Type', value: patient.visitType },
    { label: 'Department', value: patient.departmentInfo?.name },
    { label: 'Attending Doctor', value: patient.attendingDoctor?.fullName },
  ];

  const infoCells = infoFields
    .filter((f) => f.value && String(f.value).trim() !== '')
    .map(
      (f) =>
        `<div><div class="label">${f.label}</div><div class="value">${f.value}</div></div>`,
    )
    .join('');

  const receiptHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          @page { size: A4; margin: 0; }
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #111827; padding: 15mm 15mm 15mm 22mm; margin-top: 15%; }
          h1, h2 { margin: 0 0 8px 0; }
          .header { border-bottom: 2px solid #111827; padding-bottom: 8px; margin-bottom: 16px; }
          .meta { font-size: 12px; color: #374151; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
          .label { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
          .value { font-size: 13px; }
          .printed-by { text-align: right; font-size: 11px; color: #374151; margin-bottom: 12px; }
        </style>
      </head>
      <body>
        <div class="grid">
          ${infoCells}
        </div>
      </body>
    </html>
  `;

  printReceiptHtml(receiptHTML);
}

export interface LabReceiptOrder {
  orderNumber?: string;
  priority?: string;
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
 * Print a laboratory investigation slip using the same clean A4 pattern
 * as the patient receipt: a label/value info grid plus a compact tests table.
 */
export function printLabReceipt(
  orders: LabReceiptOrder[],
  opts: {
    patientId?: string;
    hospitalName?: string;
    printedBy?: string;
    clinicalNotes?: string;
  },
) {
  const patient = orders[0]?.patient;
  const total = orders.reduce((sum, o) => sum + Number(o.labTest?.price || 0), 0);
  const orderNumbers = orders
    .map((o) => o.orderNumber)
    .filter(Boolean)
    .join(', ');

  const infoFields: { label: string; value?: string | null }[] = [
    { label: 'Full Name', value: patient?.fullName },
    { label: 'MRN', value: patient?.nrNumber || opts.patientId },
    { label: 'Printed by', value: opts.printedBy },
    { label: 'Gender', value: patient?.gender },
    { label: 'Mobile', value: patient?.mobile },
    { label: 'Order No.', value: orderNumbers },
    { label: 'Date', value: format(new Date(), 'dd/MM/yyyy') },
  ];

  const infoCells = infoFields
    .filter((f) => f.value && String(f.value).trim() !== '')
    .map(
      (f) =>
        `<div><div class="label">${f.label}</div><div class="value">${f.value}</div></div>`,
    )
    .join('');

  const rows = orders
    .map(
      (o, i) =>
        `<tr>
          <td>${i + 1}</td>
          <td>${o.labTest?.testCode ?? ''}</td>
          <td>${o.labTest?.testName ?? ''}</td>
          <td>${o.labTest?.testCategory ?? ''}</td>
          <td>${o.priority ?? ''}</td>
          <td class="amt">${Number(o.labTest?.price || 0).toFixed(2)}</td>
        </tr>`,
    )
    .join('');

  const receiptHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          @page { size: A4; margin: 0; }
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #111827; padding: 15mm 15mm 15mm 22mm; margin-top: 15%; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
          .label { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
          .value { font-size: 13px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 12px; }
          th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
          th { background: #f3f4f6; font-weight: 600; }
          .amt { text-align: right; }
          .total td { font-weight: 700; }
          .notes { font-size: 12px; color: #374151; margin-bottom: 12px; }
        </style>
      </head>
      <body>
        <div class="grid">
          ${infoCells}
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Test Code</th>
              <th>Test Name</th>
              <th>Category</th>
              <th>Priority</th>
              <th class="amt">Amount (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr class="total">
              <td colspan="5" class="amt">Total</td>
              <td class="amt">Rs. ${total.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        ${
          opts.clinicalNotes && opts.clinicalNotes.trim() !== ''
            ? `<div class="notes"><strong>Clinical Notes:</strong> ${opts.clinicalNotes}</div>`
            : ''
        }
      </body>
    </html>
  `;

  printReceiptHtml(receiptHTML);
}

/** Render the given HTML in a hidden iframe and trigger the print dialog. */
function printReceiptHtml(html: string) {
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
      setTimeout(() => {
        printFrame.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(printFrame);
        }, 100);
      }, 250);
    };
  }
}
