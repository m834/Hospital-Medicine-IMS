import {
  printLabReceipt,
  printPatientReceipt,
  patientSlipValues,
  printReceiptHtml,
  labSlipLines,
  LabReceiptOrder,
} from '../print-receipt';

/**
 * printLabReceipt renders into a hidden iframe through srcdoc. Capture what it
 * hands the frame so the page structure can be asserted without a printer.
 */
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

const patient = { nrNumber: 'MRN-20260804-482913', fullName: 'Ali Khan', gender: 'MALE' };

const order = (testCode: string, testName: string, price: number, testCategory = 'Hematology'): LabReceiptOrder => ({
  orderNumber: `LAB-${testCode}`,
  labTest: { testCode, testName, testCategory, price },
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

  it('repeats the MR, patient and staff name on every slip', () => {
    const html = capturePrintedHtml(() =>
      printLabReceipt([order('CBC', 'Complete Blood Count', 300), order('LFT', 'Liver Function Test', 450)], opts),
    );

    expect(html.match(/Ali Khan/g)).toHaveLength(2);
    expect(html.match(/Sana Iqbal/g)).toHaveLength(2);
    // The lab slip carries the whole MRN, date included, with an MR- prefix.
    expect(html.match(/MR-2026-08-04-482913/g)).toHaveLength(2);
    expect(html).not.toContain('MRN-');
  });

  it('carries each test’s own amount, and no combined total', () => {
    const html = capturePrintedHtml(() =>
      printLabReceipt([order('CBC', 'Complete Blood Count', 300), order('LFT', 'Liver Function Test', 450)], opts),
    );

    expect(html).toContain('Rs. 300.00');
    expect(html).toContain('Rs. 450.00');
    expect(html).not.toContain('750');
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

    expect(html).toContain('MR-2026-06-27-0001');
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

  it('prints three lines: MR, name and date; category centred with Created By right; test with its price', () => {
    const html = capturePrintedHtml(() =>
      printLabReceipt(
        [{ ...order('ECG', 'ECG', 500, 'Cardiac'), createdAt: '2026-09-25T09:15:00' }],
        opts,
      ),
    );

    expect(html.match(/class="(head|middle|line)"/g)).toEqual(['class="head"', 'class="middle"', 'class="line"']);
    // Each value its own span, spread across the line with equal gaps.
    // MR takes the width of two columns; Name and Date one each.
    expect(html).toContain('<div class="head"><span>MR-2026-08-04-482913</span><span>Ali Khan</span><span>25/09/2026</span></div>');
    expect(html).toContain('grid-template-columns: 2fr 1fr auto');
    // An empty cell as wide as Created By's keeps the category centred on the slip.
    expect(html).toContain('<div class="middle"><span></span><span>CARDIAC</span><span>Created By: Sana Iqbal</span></div>');
    expect(html).toContain('grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr)');
    expect(html).not.toContain('MALE');
    expect(html).toContain('<span>ECG</span><span>Rs. 500.00</span>');
    expect(html).toContain('justify-content: space-between');
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

    expect(html).toContain(new Date().toLocaleDateString('en-GB'));
  });

  it('gives every test in a multi-test order its own slip', () => {
    const html = capturePrintedHtml(() =>
      printLabReceipt(
        [
          { ...order('CT', 'CT SCAN', 4500), createdAt: '2026-09-25T09:15:00' },
          { ...order('XR', 'X-RAY CHEST', 800), createdAt: '2026-09-25T09:15:00' },
        ],
        opts,
      ),
    );

    const slips = html.split('class="slip').slice(1);
    expect(slips).toHaveLength(2);
    expect(slips[0]).toContain('CT SCAN');
    expect(slips[1]).toContain('X-RAY CHEST');
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
describe('printReceiptHtml', () => {
  const SLIP = '<!DOCTYPE html><html><body><div>slip</div></body></html>';

  /**
   * Run one print against a frame whose window is faked, and hand back the
   * handles that drive its lifecycle: the load event, the print spy, the
   * afterprint listeners, the frame's remove and the promise's result.
   */
  function setUpPrint(options: { body?: string; printThrows?: boolean } = {}) {
    const order: string[] = [];
    const print = jest.fn(() => {
      if (options.printThrows) throw new Error('print blocked');
    });
    const listeners: Record<string, Array<() => void>> = {};
    const fakeWindow = {
      document: { body: { innerHTML: options.body ?? '<div>slip</div>' } },
      print,
      addEventListener: (event: string, fn: () => void) => {
        (listeners[event] ||= []).push(fn);
      },
    };

    const realCreate = document.createElement.bind(document);
    let frame: any;
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el: any = realCreate(tag);
      if (tag === 'iframe') {
        Object.defineProperty(el, 'contentWindow', { value: fakeWindow });
        const realAdd = el.addEventListener.bind(el);
        el.addEventListener = (type: string, fn: any) => {
          if (type === 'load') order.push('listen');
          realAdd(type, fn);
        };
        jest.spyOn(el, 'remove');
        frame = el;
      }
      return el;
    });
    jest.spyOn(document.body, 'appendChild').mockImplementation((n: any) => {
      order.push('insert');
      return n;
    });

    let result: boolean | undefined;
    printReceiptHtml(SLIP).then((started) => {
      result = started;
    });

    (document.createElement as jest.Mock).mockRestore();
    (document.body.appendChild as jest.Mock).mockRestore();

    return {
      frame,
      order,
      print,
      load: () => frame.dispatchEvent(new Event('load')),
      afterPrint: () => listeners.afterprint?.forEach((fn) => fn()),
      remove: () => frame.remove as jest.Mock,
      // Flush the promise's then() after timers have run.
      result: async () => {
        await Promise.resolve();
        await Promise.resolve();
        return result;
      },
    };
  }

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    document.querySelectorAll('iframe').forEach((f) => f.remove());
  });

  it('loads the slip through srcdoc, listening before the frame is inserted', () => {
    const { frame, order } = setUpPrint();

    expect(frame.srcdoc).toBe(SLIP);
    expect(order).toEqual(['listen', 'insert']);
  });

  it('sends the slip to the printer once the frame has loaded', async () => {
    const { load, print, result } = setUpPrint();

    load();
    expect(print).not.toHaveBeenCalled();

    jest.advanceTimersByTime(250);
    expect(print).toHaveBeenCalledTimes(1);
    expect(await result()).toBe(true);
  });

  // The defect behind the double slips: a second load event printed again.
  it('prints exactly once however many load events arrive', () => {
    const { load, print } = setUpPrint();

    load();
    load();
    jest.advanceTimersByTime(250);
    load();
    jest.advanceTimersByTime(20000);

    expect(print).toHaveBeenCalledTimes(1);
  });

  it('ignores an empty about:blank load and waits for the slip', () => {
    const { load, print, frame } = setUpPrint({ body: '' });

    load();
    jest.advanceTimersByTime(250);
    expect(print).not.toHaveBeenCalled();

    frame.contentWindow.document.body.innerHTML = '<div>slip</div>';
    load();
    jest.advanceTimersByTime(250);
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('reports false and cleans up when the slip never loads', async () => {
    const { print, remove, result } = setUpPrint();

    jest.advanceTimersByTime(5000);

    expect(await result()).toBe(false);
    expect(remove()).toHaveBeenCalledTimes(1);
    expect(print).not.toHaveBeenCalled();
  });

  it('does not print a slip that loads after it was given up on', () => {
    const { load, print } = setUpPrint();

    jest.advanceTimersByTime(5000);
    load();
    jest.advanceTimersByTime(20000);

    expect(print).not.toHaveBeenCalled();
  });

  it('reports false and cleans up when print() throws', async () => {
    const { load, remove, result } = setUpPrint({ printThrows: true });

    load();
    jest.advanceTimersByTime(250);

    expect(await result()).toBe(false);
    expect(remove()).toHaveBeenCalledTimes(1);
  });

  it('keeps the frame alive while the job is still spooling', () => {
    const { load, remove } = setUpPrint();

    load();
    jest.advanceTimersByTime(1000);

    expect(remove()).not.toHaveBeenCalled();
  });

  it('tears the frame down once the job is done', () => {
    const { load, remove, afterPrint } = setUpPrint();

    load();
    jest.advanceTimersByTime(250);
    afterPrint();
    jest.advanceTimersByTime(500);

    expect(remove()).toHaveBeenCalledTimes(1);
  });

  it('tears the frame down anyway when afterprint never fires', () => {
    const { load, remove } = setUpPrint();

    load();
    jest.advanceTimersByTime(250 + 10000);

    expect(remove()).toHaveBeenCalledTimes(1);
  });

  it('removes the frame only once when afterprint and the fallback both land', () => {
    const { load, remove, afterPrint } = setUpPrint();

    load();
    jest.advanceTimersByTime(250);
    afterPrint();
    jest.advanceTimersByTime(20000);

    expect(remove()).toHaveBeenCalledTimes(1);
  });

  describe('leftover frames', () => {
    function leftover(state: string, ageMs: number) {
      const frame = document.createElement('iframe');
      frame.setAttribute('data-print-frame', state);
      frame.setAttribute('data-print-frame-since', String(Date.now() - ageMs));
      document.body.appendChild(frame);
      return frame;
    }

    it('removes print frames left behind by earlier prints', () => {
      const stuckLoading = leftover('loading', 60_000);
      const stuckPrinting = leftover('printing', 60_000);

      setUpPrint();

      expect(stuckLoading.isConnected).toBe(false);
      expect(stuckPrinting.isConnected).toBe(false);
    });

    it('keeps a frame whose slip is still spooling', () => {
      const spooling = leftover('printing', 2_000);

      setUpPrint();

      expect(spooling.isConnected).toBe(true);
    });

    it('leaves frames that are not print frames alone', () => {
      const other = document.createElement('iframe');
      document.body.appendChild(other);

      setUpPrint();

      expect(other.isConnected).toBe(true);
    });
  });
});

describe('slip printers', () => {
  it('report not printed when there is no lab slip to print', async () => {
    await expect(printLabReceipt([], { patientId: '482913' })).resolves.toEqual({
      printed: false,
      error: 'There is no lab slip to print.',
    });
  });
});

describe('printPatientReceipt', () => {
  const registered = {
    nrNumber: 'MRN-20261016-482913',
    fullName: 'Ali Khan',
    gender: 'MALE',
    registeredAt: '2026-10-16T05:00:00Z',
  };

  const shellWith = (mode: 'html' | 'escp-raw', print = jest.fn()) => {
    window.mimsShell = { slipPrinter: { mode: jest.fn().mockResolvedValue(mode), print } };
    return print;
  };

  afterEach(() => {
    delete window.mimsShell;
    jest.restoreAllMocks();
  });

  it('prints two lines: MR, name and date, then Created By on the right', () => {
    expect(patientSlipValues(registered, 'Sana Iqbal')).toEqual([
      { left: ['MR-2026-10-16-482913', 'Ali Khan'], right: ['16/10/2026'] },
      { left: [], right: ['Created By: Sana Iqbal'] },
    ]);
  });

  it('prints raw on a station the shell has set to escp-raw, and builds no HTML', async () => {
    const print = shellWith('escp-raw', jest.fn().mockResolvedValue({ ok: true, jobId: 7 }));
    const appendChild = jest.spyOn(document.body, 'appendChild');

    await expect(printPatientReceipt(registered, 'Civil Hospital', 'Sana Iqbal')).resolves.toEqual({ printed: true });

    expect(print).toHaveBeenCalledWith({
      docName: 'MIMS registration slip',
      slips: [
        {
          lines: [
            { left: ['MR-2026-10-16-482913', 'Ali Khan'], right: ['16/10/2026'], bold: true },
            { left: [], right: ['Created By: Sana Iqbal'], bold: true },
          ],
        },
      ],
    });
    expect(appendChild).not.toHaveBeenCalled();
  });

  it('reports the printer’s reason when the raw job is not sent', async () => {
    shellWith('escp-raw', jest.fn().mockResolvedValue({ ok: false, error: 'Printer is offline.' }));

    await expect(printPatientReceipt(registered, 'Civil Hospital')).resolves.toEqual({
      printed: false,
      error: 'Printer is offline.',
    });
  });

  it('reports a shell that stops answering as not printed, never as printed', async () => {
    shellWith('escp-raw', jest.fn().mockRejectedValue(new Error('gone')));

    await expect(printPatientReceipt(registered, 'Civil Hospital')).resolves.toEqual({ printed: false, error: 'gone' });
  });

  it.each([
    ['in plain Chrome, with no shell', () => undefined],
    ['on a station left on html', () => shellWith('html')],
  ])('prints as HTML %s', async (_label, setup) => {
    const print = setup();
    let written = '';
    jest.spyOn(document.body, 'appendChild').mockImplementation((n: any) => {
      if (n instanceof HTMLIFrameElement) written += n.srcdoc;
      return n;
    });

    jest.useFakeTimers();
    const result = printPatientReceipt(registered, 'Civil Hospital', 'Sana Iqbal');
    // The station check is async; let it settle so the slip frame goes in.
    for (let i = 0; i < 5 && !written; i += 1) await Promise.resolve();

    // Laid out like the lab slip: MR (30px, twice Name's width) | Name | Date,
    // then Created By flush right — everything bold.
    expect(written).toContain(
      '<div class="head"><span>MR-2026-10-16-482913</span><span>Ali Khan</span><span>16/10/2026</span></div>',
    );
    expect(written).toContain('<div class="line"><span></span><span>Created By: Sana Iqbal</span></div>');
    expect(written).toContain('grid-template-columns: 2fr 1fr auto');
    expect(written).toContain('.head > span:first-child { font-size: 30px; }');
    expect(written).toContain('font-weight: 700');
    expect(written).not.toContain('MALE');
    if (print) expect(print).not.toHaveBeenCalled();

    // The frame never loads in jsdom, so the print gives up as not printed.
    jest.runAllTimers();
    await expect(result).resolves.toEqual({ printed: false, error: 'The slip did not print.' });
    jest.useRealTimers();
  });
});

describe('printLabReceipt on a dot-matrix station', () => {
  const opts = { patientId: '482913', createdBy: 'Sana Iqbal' };
  const orders: LabReceiptOrder[] = [
    { ...order('CBC', 'Complete Blood Count', 1200), createdAt: '2026-10-16T05:00:00Z' },
    { ...order('LFT', 'Liver Function Test', 850.5), createdAt: '2026-10-16T05:00:00Z' },
  ];

  const shellWith = (mode: 'html' | 'escp-raw', print = jest.fn()) => {
    window.mimsShell = { slipPrinter: { mode: jest.fn().mockResolvedValue(mode), print } };
    return print;
  };

  afterEach(() => {
    delete window.mimsShell;
    jest.restoreAllMocks();
  });

  it('prints MR, name and date, then category and Created By, then test and price', () => {
    expect(labSlipLines(orders[0], opts)).toEqual([
      { left: ['MR-2026-08-04-482913', 'Ali Khan'], right: ['16/10/2026'] },
      { left: ['HEMATOLOGY'], right: ['Created By: Sana Iqbal'] },
      { left: ['Complete Blood Count'], right: ['Rs. 1200.00'] },
    ]);
  });

  it('leaves the category side empty when the test has none', () => {
    const lines = labSlipLines(order('X', 'Sugar Random', 20, ''), opts);
    expect(lines).toHaveLength(3);
    expect(lines[1]).toEqual({ left: [], right: ['Created By: Sana Iqbal'] });
  });

  it('sends one raw slip per test and no HTML', async () => {
    const print = shellWith('escp-raw', jest.fn().mockResolvedValue({ ok: true, jobId: 3 }));
    const appendChild = jest.spyOn(document.body, 'appendChild');

    await expect(printLabReceipt(orders, opts)).resolves.toEqual({ printed: true });

    const head = [
      { left: ['MR-2026-08-04-482913', 'Ali Khan'], right: ['16/10/2026'], bold: true },
      { left: ['HEMATOLOGY'], right: ['Created By: Sana Iqbal'], bold: true },
    ];
    expect(print).toHaveBeenCalledWith({
      docName: 'MIMS lab slip',
      slips: [
        { lines: [...head, { left: ['Complete Blood Count'], right: ['Rs. 1200.00'], bold: true }] },
        { lines: [...head, { left: ['Liver Function Test'], right: ['Rs. 850.50'], bold: true }] },
      ],
    });
    expect(appendChild).not.toHaveBeenCalled();
  });

  it('reports a raw job that was not sent as not printed, with the reason', async () => {
    shellWith('escp-raw', jest.fn().mockResolvedValue({ ok: false, error: 'Printer is offline.' }));

    await expect(printLabReceipt(orders, opts)).resolves.toEqual({ printed: false, error: 'Printer is offline.' });
  });

  it('prints as HTML on a station left on html', async () => {
    const print = shellWith('html');
    let written = '';
    jest.spyOn(document.body, 'appendChild').mockImplementation((n: any) => {
      if (n instanceof HTMLIFrameElement) written += n.srcdoc;
      return n;
    });

    jest.useFakeTimers();
    const result = printLabReceipt(orders, opts);
    for (let i = 0; i < 5 && !written; i += 1) await Promise.resolve();

    expect(written.split('class="slip').length - 1).toBe(2);
    expect(print).not.toHaveBeenCalled();

    jest.runAllTimers();
    await result;
    jest.useRealTimers();
  });
});
