import { printLabReceipt, LabReceiptOrder } from '../print-receipt';

/**
 * printLabReceipt renders into a hidden iframe. Capture what it writes so the
 * page structure can be asserted without a real printer.
 */
function capturePrintedHtml(run: () => void): string {
  let written = '';
  const realCreate = document.createElement.bind(document);

  jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = realCreate(tag);
    if (tag === 'iframe') {
      Object.defineProperty(el, 'contentWindow', {
        value: {
          document: {
            open: jest.fn(),
            write: (html: string) => {
              written += html;
            },
            close: jest.fn(),
          },
          print: jest.fn(),
        },
      });
    }
    return el;
  });

  jest.spyOn(document.body, 'appendChild').mockImplementation((n: any) => n);

  run();

  (document.createElement as jest.Mock).mockRestore();
  (document.body.appendChild as jest.Mock).mockRestore();
  return written;
}

const patient = { nrNumber: 'MRN-20260804-482913', fullName: 'Ali Khan' };

const order = (testCode: string, testName: string, price: number): LabReceiptOrder => ({
  orderNumber: `LAB-${testCode}`,
  labTest: { testCode, testName, price },
  patient,
});

describe('printLabReceipt', () => {
  const opts = { patientId: '482913', createdBy: 'Sana Iqbal' };

  it('prints one slip per test, not one slip listing every test', () => {
    const html = capturePrintedHtml(() =>
      printLabReceipt(
        [
          order('CBC', 'Complete Blood Count', 300),
          order('LFT', 'Liver Function Test', 450),
          order('RFT', 'Renal Function Test', 400),
        ],
        opts,
      ),
    );

    expect(html.match(/class="slip/g)).toHaveLength(3);
    expect(html).toContain('Complete Blood Count');
    expect(html).toContain('Liver Function Test');
    expect(html).toContain('Renal Function Test');
  });

  it('breaks the page between slips but not after the last one', () => {
    const html = capturePrintedHtml(() =>
      printLabReceipt([order('CBC', 'Complete Blood Count', 300), order('LFT', 'Liver Function Test', 450)], opts),
    );

    // Two slips, one break: a trailing break would eject a blank page.
    expect(html.match(/class="slip break"/g)).toHaveLength(1);
    expect(html.match(/class="slip"/g)).toHaveLength(1);
  });

  it('repeats the patient, MR, creator and date on every slip', () => {
    const html = capturePrintedHtml(() =>
      printLabReceipt([order('CBC', 'Complete Blood Count', 300), order('LFT', 'Liver Function Test', 450)], opts),
    );

    expect(html.match(/Ali Khan/g)).toHaveLength(2);
    expect(html.match(/Sana Iqbal/g)).toHaveLength(2);
    // MRN prints as the short code users recognise, not the full stored value.
    expect(html.match(/482913/g)).toHaveLength(2);
    expect(html).not.toContain('MRN-20260804');
  });

  it('carries each test’s own amount and no combined total', () => {
    const html = capturePrintedHtml(() =>
      printLabReceipt([order('CBC', 'Complete Blood Count', 300), order('LFT', 'Liver Function Test', 450)], opts),
    );

    expect(html).toContain('Rs. 300.00');
    expect(html).toContain('Rs. 450.00');
    expect(html).not.toContain('750');
    expect(html).not.toMatch(/Total/i);
  });

  it('prints values only — no field labels', () => {
    const html = capturePrintedHtml(() =>
      printLabReceipt([order('CBC', 'Complete Blood Count', 300)], opts),
    );

    const body = html.slice(html.indexOf('<body>'));
    expect(body).not.toMatch(/Full Name|MRN|Printed by|Gender|Mobile|Order No\.|Category|Priority/);
  });

  it('keeps the date on a legacy per-day MRN, which is not unique alone', () => {
    const html = capturePrintedHtml(() =>
      printLabReceipt(
        [{ ...order('CBC', 'Complete Blood Count', 300), patient: { nrNumber: 'MRN-20260627-0001', fullName: 'Ali Khan' } }],
        opts,
      ),
    );

    expect(html).toContain('20260627-0001');
  });

  it('does nothing when there is no order to print', () => {
    expect(capturePrintedHtml(() => printLabReceipt([], opts))).toBe('');
  });
});
