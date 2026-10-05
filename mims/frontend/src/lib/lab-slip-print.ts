import api, { getErrorMessage } from './api';
import { printLabReceipt, type LabReceiptOrder } from './print-receipt';

/** What happened to a set of lab slips sent to print. */
export type LabSlipPrintResult =
  /**
   * print() started. recordError is set when the print could not be counted
   * on the server afterwards — the paper is out, but the count is behind.
   */
  | { status: 'printed'; recordError?: string }
  /** print() never started. Nothing was counted, so the slips stay printable. */
  | { status: 'not-printed' };

interface PrintDeps {
  client: Pick<typeof api, 'get' | 'post'>;
  print: typeof printLabReceipt;
}

/**
 * Print lab slips, counting them on the server only once the print has
 * actually started.
 *
 * 1. Ask the server whether the slips may print. A refusal (already printed,
 *    another hospital) throws here, before anything reaches the printer.
 * 2. Print. The helper reports whether print() started.
 * 3. Only then record the print. A slip whose print never started is not
 *    counted, so the desk can retry it instead of re-entering the order.
 */
export async function printLabSlips(
  orders: (LabReceiptOrder & { id: string })[],
  options: { patientId?: string; createdBy?: string },
  deps: PrintDeps = { client: api, print: printLabReceipt },
): Promise<LabSlipPrintResult> {
  const orderIds = orders.map((order) => order.id);

  await deps.client.get('/lab-orders/print-slip/check', {
    params: { orderIds: orderIds.join(',') },
  });

  const started = await deps.print(orders, options);
  if (!started) return { status: 'not-printed' };

  try {
    await deps.client.post('/lab-orders/print-slip', { orderIds });
    return { status: 'printed' };
  } catch (error) {
    return { status: 'printed', recordError: getErrorMessage(error) };
  }
}

/**
 * A lock that lets one run through at a time and drops any call made while
 * one is in flight. The lock is taken synchronously, before the first await,
 * so a second press in the same instant finds it already held.
 */
export function createSingleFlight() {
  let busy = false;

  return {
    get busy() {
      return busy;
    },
    /** Runs fn unless a run is already in flight; resolves undefined if dropped. */
    async run<T>(fn: () => Promise<T>): Promise<T | undefined> {
      if (busy) return undefined;
      busy = true;
      try {
        return await fn();
      } finally {
        busy = false;
      }
    },
  };
}
