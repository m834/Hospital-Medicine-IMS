import { printLabStaffDailySummary } from '../print-lab-revenue';
import type { LabRevenueReport } from '@/hooks/use-lab-revenue';

/** printReceiptHtml renders into a hidden iframe through srcdoc; capture it. */
function capturePrintedHtml(run: () => void): string {
  let written = '';

  jest.spyOn(document.body, 'appendChild').mockImplementation((n: any) => {
    if (n instanceof HTMLIFrameElement) written += n.srcdoc;
    return n;
  });

  jest.useFakeTimers();
  run();
  jest.useRealTimers();

  (document.body.appendChild as jest.Mock).mockRestore();
  return written;
}

const report: LabRevenueReport = {
  range: { start: '2026-10-24T03:00:00.000Z', end: '2026-10-24T03:00:00.000Z' },
  generatedAt: '2026-10-24T09:30:00.000Z',
  categories: [
    {
      category: 'Hematology',
      quantity: 3,
      subtotal: 1650,
      tests: [{ testName: 'CBC', unitPrice: 550, quantity: 3, total: 1650 }],
    },
  ],
  grandTotal: 1650,
  totalQuantity: 3,
  resources: [{ resourceId: 'staff-1', resourceName: 'Sana Iqbal', role: 'REGISTRATION_STAFF', tests: 3, amount: 1650 }],
};

describe('printLabStaffDailySummary', () => {
  it('prints the staff member, the day, their order count and total — nothing else', () => {
    const html = capturePrintedHtml(() =>
      printLabStaffDailySummary(report, 'Civil Hospital', 'Sana Iqbal'),
    );

    expect(html).toContain('Civil Hospital');
    expect(html).toContain('Sana Iqbal');
    expect(html).toContain('24 Oct 2026');
    expect(html).toContain('<td class="num">3</td>');
    expect(html).toContain('1,650.00');
    // No per-test or per-category detail on the staff sheet.
    expect(html).not.toContain('CBC');
    expect(html).not.toContain('Hematology');
  });

  it('dates the print by the server, not the desk PC', () => {
    jest.useFakeTimers().setSystemTime(new Date('2020-01-01T00:00:00Z'));
    const html = capturePrintedHtml(() => printLabStaffDailySummary(report, 'Civil Hospital', 'Sana Iqbal'));
    jest.useRealTimers();

    // 09:30 UTC is 2:30 pm in Karachi.
    expect(html).toMatch(/Printed: 24 Oct 2026, 0?2:30 pm/i);
    expect(html).not.toContain('2020');
  });
});
