import { createSingleFlight, printLabSlips } from '../lab-slip-print';

/** A promise the test settles by hand, to hold a flow mid-flight. */
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createSingleFlight — the New Order lock', () => {
  it('sends an order once however many times the button is pressed', async () => {
    const lock = createSingleFlight();
    const saving = deferred();
    const sendOrder = jest.fn(() => saving.promise);

    // Three presses in the same instant — a double click and a held Enter.
    const first = lock.run(sendOrder);
    const second = lock.run(sendOrder);
    const third = lock.run(sendOrder);

    expect(sendOrder).toHaveBeenCalledTimes(1);
    expect(lock.busy).toBe(true);

    saving.resolve();
    await Promise.all([first, second, third]);

    expect(sendOrder).toHaveBeenCalledTimes(1);
  });

  it('takes the lock before any await, so a press in the same tick is dropped', () => {
    const lock = createSingleFlight();
    const sendOrder = jest.fn(() => new Promise<void>(() => {}));

    lock.run(sendOrder);

    // No await between the two presses: the lock must already be held.
    expect(lock.busy).toBe(true);
    lock.run(sendOrder);
    expect(sendOrder).toHaveBeenCalledTimes(1);
  });

  it('releases the lock once the flow finishes, for the next patient', async () => {
    const lock = createSingleFlight();
    const sendOrder = jest.fn(async () => {});

    await lock.run(sendOrder);
    expect(lock.busy).toBe(false);

    await lock.run(sendOrder);
    expect(sendOrder).toHaveBeenCalledTimes(2);
  });

  it('releases the lock when the flow fails, so the desk is not stuck', async () => {
    const lock = createSingleFlight();

    await expect(
      lock.run(async () => {
        throw new Error('server down');
      }),
    ).rejects.toThrow('server down');

    expect(lock.busy).toBe(false);
    const retry = jest.fn(async () => {});
    await lock.run(retry);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('drops a press made while a print is still in flight', async () => {
    const lock = createSingleFlight();
    const printing = deferred<boolean>();
    const print = jest.fn(() => printing.promise);
    const client = { get: jest.fn().mockResolvedValue({}), post: jest.fn().mockResolvedValue({}) };
    const orders = [{ id: 'order-1', orderNumber: 'LAB-1' }];

    const run = () => lock.run(() => printLabSlips(orders, {}, { client: client as any, print }));
    const first = run();
    const second = run();

    await Promise.resolve();
    printing.resolve(true);
    await Promise.all([first, second]);

    expect(client.get).toHaveBeenCalledTimes(1);
    expect(print).toHaveBeenCalledTimes(1);
    expect(client.post).toHaveBeenCalledTimes(1);
  });
});

describe('printLabSlips', () => {
  const orders = [
    { id: 'order-1', orderNumber: 'LAB-1' },
    { id: 'order-2', orderNumber: 'LAB-2' },
  ];

  function setUp(printStarted: boolean) {
    const calls: string[] = [];
    const client = {
      get: jest.fn(async (url: string) => {
        calls.push(`check ${url}`);
        return {};
      }),
      post: jest.fn(async (url: string) => {
        calls.push(`record ${url}`);
        return {};
      }),
    };
    const print = jest.fn(async () => {
      calls.push('print');
      return printStarted;
    });
    return { calls, client, print, deps: { client: client as any, print } };
  }

  it('checks, prints, then records — in that order', async () => {
    const { calls, client, deps } = setUp(true);

    await expect(printLabSlips(orders, {}, deps)).resolves.toEqual({ status: 'printed' });

    expect(calls).toEqual([
      'check /lab-orders/print-slip/check',
      'print',
      'record /lab-orders/print-slip',
    ]);
    expect(client.get).toHaveBeenCalledWith('/lab-orders/print-slip/check', {
      params: { orderIds: 'order-1,order-2' },
    });
    expect(client.post).toHaveBeenCalledWith('/lab-orders/print-slip', {
      orderIds: ['order-1', 'order-2'],
    });
  });

  it('does not record a print that never started', async () => {
    const { client, deps } = setUp(false);

    await expect(printLabSlips(orders, {}, deps)).resolves.toEqual({ status: 'not-printed' });

    expect(client.post).not.toHaveBeenCalled();
  });

  it('never prints when the server refuses the slip', async () => {
    const { client, print, deps } = setUp(true);
    client.get.mockRejectedValueOnce(Object.assign(new Error('already printed'), {
      response: { status: 403 },
    }));

    await expect(printLabSlips(orders, {}, deps)).rejects.toThrow('already printed');

    expect(print).not.toHaveBeenCalled();
    expect(client.post).not.toHaveBeenCalled();
  });

  it('still reports a started print as printed when recording it fails', async () => {
    const { client, deps } = setUp(true);
    client.post.mockRejectedValueOnce(new Error('network down'));

    const result = await printLabSlips(orders, {}, deps);

    expect(result.status).toBe('printed');
    expect(result).toHaveProperty('recordError');
  });
});
