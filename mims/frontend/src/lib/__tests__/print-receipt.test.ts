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
    // The lab slip carries the whole MRN, date included, with an MR- prefix.
    expect(html.match(/MR-20260804-482913/g)).toHaveLength(2);
    expect(html).not.toContain('MRN-');
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
    // The printed value itself starts "MR-", so the check is for label forms.
    expect(body).not.toMatch(/Full Name|MRN?:|Printed by|Gender|Mobile|Order No\.|Category|Priority/);
  });

  it('keeps the date on a legacy per-day MRN, which is not unique alone', () => {
    const html = capturePrintedHtml(() =>
      printLabReceipt(
        [{ ...order('CBC', 'Complete Blood Count', 300), patient: { nrNumber: 'MRN-20260627-0001', fullName: 'Ali Khan' } }],
        opts,
      ),
    );

    expect(html).toContain('MR-20260627-0001');
  });

  // The slip is read by the patient at the counter: a test code and a
  // generated reference number mean nothing to them. Both stay in the database
  // and the UI — this is a print-only simplification.
  it('prints the test name alone, with no internal code', () => {
    const html = capturePrintedHtml(() =>
      printLabReceipt([order('LAB-173', 'CT SCAN', 4500)], opts),
    );

    expect(html).toContain('CT SCAN');
    expect(html).not.toContain('LAB-173 —');
    expect(html).not.toMatch(/LAB-173\s*<\/span>/);
  });

  it('prints no generated reference string on the slip', () => {
    const html = capturePrintedHtml(() =>
      printLabReceipt(
        [{ ...order('CBC', 'Complete Blood Count', 300), id: 'abc-def-12389e' }],
        opts,
      ),
    );

    expect(html).not.toContain('LB-');
    expect(html).not.toContain('12389E');
  });

  // The date prints once, in the header; the test line is the name and price.
  it('prints the test name with no date beside it', () => {
    const html = capturePrintedHtml(() =>
      printLabReceipt(
        [{ ...order('CT', 'CT SCAN', 4500), createdAt: '2026-09-25T09:15:00' }],
        opts,
      ),
    );

    const testLine = html.split('class="test"')[1];
    expect(testLine).toContain('CT SCAN');
    expect(testLine).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(html.match(/25\/09\/2026/g)).toHaveLength(1);
  });

  // A backdated order is billed on the day it was raised, so its slip has to
  // say that day rather than the day someone reprinted it.
  it('uses the order date, not the print date', () => {
    const html = capturePrintedHtml(() =>
      printLabReceipt(
        [{ ...order('CBC', 'Complete Blood Count', 300), createdAt: '2026-09-25T09:15:00' }],
        opts,
      ),
    );

    const printedToday = new Date().toLocaleDateString('en-GB');
    expect(html).toContain('25/09/2026');
    if (printedToday !== '25/09/2026') {
      expect(html).not.toContain(printedToday);
    }
  });

  it('falls back to today when the order carries no date', () => {
    const html = capturePrintedHtml(() =>
      printLabReceipt([order('CBC', 'Complete Blood Count', 300)], opts),
    );

    expect(html.split('class="line"')[1]).toContain(new Date().toLocaleDateString('en-GB'));
  });

  it('gives every test in a multi-test order its own line', () => {
    const html = capturePrintedHtml(() =>
      printLabReceipt(
        [
          { ...order('CT', 'CT SCAN', 4500), createdAt: '2026-09-25T09:15:00' },
          { ...order('XR', 'X-RAY CHEST', 800), createdAt: '2026-09-25T09:15:00' },
        ],
        opts,
      ),
    );

    const testLines = html.split('class="test"').slice(1);
    expect(testLines).toHaveLength(2);
    expect(testLines[0]).toContain('CT SCAN');
    expect(testLines[1]).toContain('X-RAY CHEST');
  });

  // The slip drops into a slot on pre-printed paper, so the geometry must not
  // move when the text inside it changes.
  it('keeps the slip geometry the pre-printed form is aligned to', () => {
    const html = capturePrintedHtml(() =>
      printLabReceipt([order('CT', 'CT SCAN', 4500)], opts),
    );

    expect(html).toContain('padding: 46.5mm calc(15mm + 8px) 15mm calc(22mm + 8px)');
    expect(html).toContain('@page { size: A4; margin: 0; }');
  });

  it('does nothing when there is no order to print', () => {
    expect(capturePrintedHtml(() => printLabReceipt([], opts))).toBe('');
  });
});

/**
 * The reception machines run Chrome with --kiosk-printing, where print()
 * returns before the job has spooled. The iframe holding the slip has to
 * outlive the call or the printer can be handed an empty page.
 */
describe('printLabReceipt teardown', () => {
  /**
   * Run a print against a fake iframe and hand back the handles needed to drive
   * its lifecycle: the load event, the print spy and the afterprint listeners.
   */
  function setUpPrint() {
    const print = jest.fn();
    const listeners: Record<string, Array<() => void>> = {};
    const remove = jest.fn();
    const realCreate = document.createElement.bind(document);
    let frame: any;

    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el: any = realCreate(tag);
      if (tag === 'iframe') {
        Object.defineProperty(el, 'contentWindow', {
          value: {
            document: { open: jest.fn(), write: jest.fn(), close: jest.fn() },
            print,
            addEventListener: (event: string, fn: () => void) => {
              (listeners[event] ||= []).push(fn);
            },
          },
        });
        el.remove = remove;
        frame = el;
      }
      return el;
    });
    jest.spyOn(document.body, 'appendChild').mockImplementation((n: any) => n);

    printLabReceipt([order('CBC', 'Complete Blood Count', 300)], {
      patientId: '482913',
      createdBy: 'Sana Iqbal',
    });

    (document.createElement as jest.Mock).mockRestore();
    (document.body.appendChild as jest.Mock).mockRestore();

    return {
      load: () => frame.onload(),
      print,
      remove,
      afterPrint: () => listeners.afterprint?.forEach((fn) => fn()),
    };
  }

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('sends the slip to the printer once the frame has loaded', () => {
    const { load, print } = setUpPrint();

    load();
    expect(print).not.toHaveBeenCalled();

    jest.advanceTimersByTime(250);
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('keeps the frame alive while the job is still spooling', () => {
    const { load, remove } = setUpPrint();

    load();
    jest.advanceTimersByTime(1000);

    expect(remove).not.toHaveBeenCalled();
  });

  it('tears the frame down once the job is done', () => {
    const { load, remove, afterPrint } = setUpPrint();

    load();
    jest.advanceTimersByTime(250);
    afterPrint();
    jest.advanceTimersByTime(500);

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('tears the frame down anyway when afterprint never fires', () => {
    const { load, remove } = setUpPrint();

    load();
    jest.advanceTimersByTime(250 + 10000);

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('removes the frame only once when afterprint and the fallback both land', () => {
    const { load, remove, afterPrint } = setUpPrint();

    load();
    jest.advanceTimersByTime(250);
    afterPrint();
    jest.advanceTimersByTime(20000);

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
