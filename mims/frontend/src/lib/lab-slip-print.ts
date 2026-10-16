import api, { getErrorMessage } from './api';
import { printLabReceipt, type LabReceiptOrder } from './print-receipt';

/** What happened to a set of lab slips sent to print. */
export type LabSlipPrintResult =
  /**
   * print() started. recordError is set when the print could not be counted
   * on the server afterwards — the paper is out, but the count is behind.
   */
  | { status: 'printed'; recordError?: string }
  /**
   * The slips never reached the printer — print() never started, or the
   * dot-matrix job was not sent. Nothing was counted, so the slips stay
   * printable. error says why.
   */
  | { status: 'not-printed'; error: string };

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
 *    Skipped for orders created a moment ago (skipCheck) — they cannot have
 *    been printed, so the answer is known and the round trip is saved. The
 *    record step still applies every rule.
 * 2. Print. The helper reports whether the slips reached the printer.
 * 3. Only then record the print. A slip whose print never started is not
 *    counted, so the desk can retry it instead of re-entering the order.
 */
export async function printLabSlips(
  orders: (LabReceiptOrder & { id: string })[],
  options: { patientId?: string; createdBy?: string; skipCheck?: boolean },
  deps: PrintDeps = { client: api, print: printLabReceipt },
): Promise<LabSlipPrintResult> {
  const orderIds = orders.map((order) => order.id);
  const { skipCheck, ...slipOptions } = options;

  if (!skipCheck) {
    await deps.client.get('/lab-orders/print-slip/check', {
      params: { orderIds: orderIds.join(',') },
    });
  }

  const result = await deps.print(orders, slipOptions);
  if (!result.printed) return { status: 'not-printed', error: result.error };

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
