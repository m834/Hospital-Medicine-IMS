/**
 * The MIMS Desktop shell's raw slip printer, for dot-matrix stations.
 *
 * Inside the shell, a station set to "escp-raw" prints slips as plain ESC/P
 * text straight to the printer — fast text mode instead of a page image the
 * dot-matrix paints in slow passes. The shell exposes this as
 * window.mimsShell.slipPrinter. Everywhere else (plain Chrome, an older shell
 * install, a station left on "html") it is unavailable and slips print as HTML.
 */

/** One printed line: values joined with " | ", flush left and flush right. */
export interface RawSlipLine {
  left?: string[];
  right?: string[];
  bold?: boolean;
}

/** One slip — one form on the dot-matrix. */
export interface RawSlip {
  lines: RawSlipLine[];
}

export type RawSlipResult = { ok: true; jobId?: number } | { ok: false; error: string };

export interface ShellSlipPrinter {
  mode(): Promise<'html' | 'escp-raw'>;
  print(job: { docName: string; slips: RawSlip[] }): Promise<RawSlipResult>;
}

declare global {
  interface Window {
    mimsShell?: { slipPrinter?: ShellSlipPrinter };
  }
}

/** Whether this page runs inside a shell that can print slips raw at all. */
export function hasShellSlipPrinter(): boolean {
  return typeof window !== 'undefined' && Boolean(window.mimsShell?.slipPrinter);
}

/** The shell's slip printer when this station prints slips raw, otherwise null. */
export async function rawSlipPrinter(): Promise<ShellSlipPrinter | null> {
  if (typeof window === 'undefined') return null;
  const printer = window.mimsShell?.slipPrinter;
  if (!printer) return null;
  try {
    return (await printer.mode()) === 'escp-raw' ? printer : null;
  } catch {
    // A shell that cannot answer is treated like no shell: print as HTML.
    return null;
  }
}

/**
 * Sends slips to the shell. Resolves ok only once Windows has the whole job;
 * a failure carries a message the desk can act on.
 */
export async function printRawSlips(
  printer: ShellSlipPrinter,
  docName: string,
  slips: RawSlip[],
): Promise<RawSlipResult> {
  try {
    return await printer.print({ docName, slips });
  } catch (error: any) {
    return { ok: false, error: error?.message || 'The slip printer did not respond.' };
  }
}
