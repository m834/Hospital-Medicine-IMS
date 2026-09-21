import { printReceiptHtml } from './print-receipt';
import type { LabRevenueReport } from '@/hooks/use-lab-revenue';

/**
 * Print the lab revenue report.
 *
 * The document is built from scratch rather than printing the screen: the page
 * it sits on carries stats cards, filters and the approved-reports list, and
 * the print is meant to be the report and nothing else — no chart, no bar, no
 * navigation. Building the page means none of that can leak in later either,
 * whichever way the screen around it changes.
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

const periodLabel = (range: LabRevenueReport['range']) => {
  if (!range.start || !range.end) return 'All dates';

  const from = prettyDate(range.start);
  const to = prettyDate(range.end);
  return from === to ? from : `${from} – ${to}`;
};

export function printLabRevenueReport(report: LabRevenueReport, hospitalName: string) {
  const categoryBlocks = report.categories
    .map(
      (category) => `
        <tr class="category">
          <td colspan="4">${escapeHtml(category.category)}</td>
        </tr>
        ${category.tests
          .map(
            (test) => `
        <tr>
          <td class="indent">${escapeHtml(test.testName)}</td>
          <td class="num">${test.quantity}</td>
          <td class="num">${money(test.unitPrice)}</td>
          <td class="num">${money(test.total)}</td>
        </tr>`,
          )
          .join('')}
        <tr class="subtotal">
          <td>${escapeHtml(category.category)} subtotal</td>
          <td class="num">${category.quantity}</td>
          <td></td>
          <td class="num">${money(category.subtotal)}</td>
        </tr>`,
    )
    .join('');

  const resourceRows = report.resources
    .map(
      (resource) => `
        <tr>
          <td>${escapeHtml(resource.resourceName)}</td>
          <td class="num">${resource.tests}</td>
        </tr>`,
    )
    .join('');

  const html = `
    <html>
      <head>
        <title>Lab Revenue</title>
        <style>
          @page { size: A4; margin: 1.5cm; }
          body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11pt;
            color: #000;
            margin: 0;
          }
          h1 { font-size: 14pt; margin: 0 0 2px; }
          h2 { font-size: 12pt; margin: 18px 0 6px; }
          .meta { font-size: 10pt; margin-bottom: 14px; }
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
          tr.subtotal td {
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
            font-weight: bold;
          }
          tr.grand td {
            border-top: 2px solid #000;
            border-bottom: 2px double #000;
            font-weight: bold;
            font-size: 12pt;
            padding-top: 6px;
          }
          tr { page-break-inside: avoid; }
          .empty { padding: 16px 0; font-style: italic; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(hospitalName)}</h1>
        <div class="meta">
          Lab Revenue Report &nbsp;|&nbsp; Period: ${escapeHtml(periodLabel(report.range))}
          &nbsp;|&nbsp; Printed: ${escapeHtml(prettyDate(new Date().toISOString()))}
        </div>

        ${
          report.categories.length === 0
            ? '<p class="empty">No lab tests were created in this period.</p>'
            : `<table>
          <thead>
            <tr>
              <th>Test Name</th>
              <th class="num">Quantity</th>
              <th class="num">Test Price</th>
              <th class="num">Total Price</th>
            </tr>
          </thead>
          <tbody>
            ${categoryBlocks}
            <tr class="grand">
              <td>GRAND TOTAL</td>
              <td class="num">${report.totalQuantity}</td>
              <td></td>
              <td class="num">${money(report.grandTotal)}</td>
            </tr>
          </tbody>
        </table>`
        }

        <h2>Tests by Resource</h2>
        ${
          report.resources.length === 0
            ? '<p class="empty">No tests were created in this period.</p>'
            : `<table>
          <thead>
            <tr>
              <th>Resource</th>
              <th class="num">Tests Created</th>
            </tr>
          </thead>
          <tbody>
            ${resourceRows}
            <tr class="subtotal">
              <td>Total</td>
              <td class="num">${report.totalQuantity}</td>
            </tr>
          </tbody>
        </table>`
        }
      </body>
    </html>
  `;

  printReceiptHtml(html);
}
