import { printReceiptHtml } from './print-receipt';
import type { RegistrationReport } from '@/hooks/use-registration-report';

/**
 * Print the registration report's lab side: Lab Charges by Staff Member, then
 * Revenue by Category in full, ending on the grand total.
 *
 * The document is built here rather than printing the screen. The page carries
 * charts, stat tiles, filters, the patient list and the day-by-day table, and
 * none of that belongs on the printed sheet — building the page means none of
 * it can leak in later either, however the screen changes.
 *
 * Categories print expanded: on screen a category is a row you open, on paper
 * there is nothing to click, so every test is listed under its category.
 */

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Plain grouped digits — the printer is not always given a currency glyph. */
const money = (value: number) =>
  new Intl.NumberFormat('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    value || 0,
  );

const prettyDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

export function printRegistrationLabReport(
  report: RegistrationReport,
  hospitalName: string | null | undefined,
  options: { staffName?: string | null } = {},
) {
  const period = report.range.isSingleDay
    ? prettyDate(report.range.start)
    : `${prettyDate(report.range.start)} – ${prettyDate(report.range.end)}`;

  // Only staff who actually raised a charge: a roster of zeros is for reading
  // on screen, not for spending a sheet of paper on.
  const staff = report.staff.filter((row) => row.labTestOrders > 0);

  const staffRows = staff
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.staffName)}</td>
          <td class="num">${row.labTestOrders}</td>
          <td class="num">${money(row.labTestRevenue)}</td>
          <td class="num">${money(row.labTestCollected)}</td>
          <td class="num">${money(row.labTestOutstanding)}</td>
        </tr>`,
    )
    .join('');

  const categoryRows = report.categories
    .map(
      (category) => `
        <tr class="category">
          <td colspan="3">${escapeHtml(category.category)}</td>
        </tr>
        ${category.tests
          .map(
            (test) => `
        <tr>
          <td class="indent">${escapeHtml(test.testName)}</td>
          <td class="num">${test.orders}</td>
          <td class="num">${money(test.revenue)}</td>
        </tr>`,
          )
          .join('')}
        <tr class="subtotal">
          <td>${escapeHtml(category.category)} subtotal</td>
          <td class="num">${category.orders}</td>
          <td class="num">${money(category.revenue)}</td>
        </tr>`,
    )
    .join('');

  const html = `
    <html>
      <head>
        <title>Registration Report — Lab</title>
        <style>
          @page { size: A4; margin: 1.5cm; }
          body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #000; margin: 0; }
          h1 { font-size: 14pt; margin: 0 0 2px; }
          h2 { font-size: 12pt; margin: 20px 0 6px; }
          .meta { font-size: 10pt; margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 4px 6px; text-align: left; }
          th { border-bottom: 1.5px solid #000; font-size: 10pt; text-transform: uppercase; }
          .num { text-align: right; }
          .indent { padding-left: 18px; }
          tr.category td {
            padding-top: 10px;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 10pt;
          }
          tr.subtotal td { border-top: 1px solid #000; border-bottom: 1px solid #000; font-weight: bold; }
          tr.total td { border-top: 1px solid #000; font-weight: bold; }
          tr.grand td {
            border-top: 2px solid #000;
            border-bottom: 2px double #000;
            font-weight: bold;
            font-size: 12pt;
            padding-top: 6px;
          }
          tr { page-break-inside: avoid; }
          .empty { padding: 12px 0; font-style: italic; }
        </style>
      </head>
      <body>
        <h1>${hospitalName ? escapeHtml(hospitalName) : 'Registration Report — Lab'}</h1>
        <div class="meta">
          ${hospitalName ? 'Registration Report — Lab &nbsp;|&nbsp; ' : ''}Period: ${escapeHtml(period)}
          ${options.staffName ? `&nbsp;|&nbsp; Staff: ${escapeHtml(options.staffName)}` : ''}
          &nbsp;|&nbsp; Printed: ${escapeHtml(prettyDate(new Date().toISOString()))}
        </div>

        <h2>Lab Charges by Staff Member</h2>
        ${
          staff.length === 0
            ? '<p class="empty">No lab charges were raised in this period.</p>'
            : `<table>
          <thead>
            <tr>
              <th>Staff Member</th>
              <th class="num">Lab Tests</th>
              <th class="num">Revenue</th>
              <th class="num">Collected</th>
              <th class="num">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            ${staffRows}
            <tr class="total">
              <td>Total</td>
              <td class="num">${report.totals.labTestOrders}</td>
              <td class="num">${money(report.totals.labTestRevenue)}</td>
              <td class="num">${money(report.totals.labTestCollected)}</td>
              <td class="num">${money(report.totals.labTestOutstanding)}</td>
            </tr>
          </tbody>
        </table>`
        }

        <h2>Revenue by Category</h2>
        ${
          report.categories.length === 0
            ? '<p class="empty">No lab tests were charged in this period.</p>'
            : `<table>
          <thead>
            <tr>
              <th>Category / Test</th>
              <th class="num">Tests</th>
              <th class="num">Revenue</th>
            </tr>
          </thead>
          <tbody>
            ${categoryRows}
            <tr class="grand">
              <td>GRAND TOTAL</td>
              <td class="num">${report.totals.labTestOrders}</td>
              <td class="num">${money(report.totals.labTestRevenue)}</td>
            </tr>
          </tbody>
        </table>`
        }
      </body>
    </html>
  `;

  printReceiptHtml(html);
}
