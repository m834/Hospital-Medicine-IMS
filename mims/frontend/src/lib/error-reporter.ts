import type { AxiosError } from 'axios';
import { API_BASE_URL } from './constants';
import { getAccessToken } from './auth';

/**
 * Sends errors seen in this browser to the backend (POST /client-errors), so a
 * desk machine that cannot be reached can still be diagnosed. The user keeps
 * seeing the friendly message; the real error — status, URL, stack — is kept
 * here instead of being swallowed.
 *
 * Reporting must never cause trouble of its own: it never throws, never uses
 * the shared axios client (whose failures it reports), drops repeats of the
 * same error, and stops for a while if a burst of errors arrives.
 */

const REPORT_URL = `${API_BASE_URL}/client-errors`;
const MACHINE_ID_KEY = 'mims_machine_id';

/** The same error is sent at most once in this window. */
const REPEAT_WINDOW_MS = 30_000;
/** At most this many reports per minute from one browser. */
const MAX_REPORTS_PER_MINUTE = 20;

type ClientErrorKind = 'error' | 'unhandledrejection' | 'api';

interface ClientErrorReport {
  kind: ClientErrorKind;
  message: string;
  stack?: string;
  apiUrl?: string;
  apiMethod?: string;
  apiStatus?: number;
}

const recentlySent = new Map<string, number>();
let windowStart = 0;
let sentInWindow = 0;

/**
 * A random id kept in this browser's storage: which machine a report came
 * from, without the desktop app having to tell us. Cleared site data or a
 * private window gets a new one, which only splits that machine's reports.
 */
export function getMachineId(): string {
  try {
    const existing = localStorage.getItem(MACHINE_ID_KEY);
    if (existing) return existing;

    const created =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(MACHINE_ID_KEY, created);
    return created;
  } catch {
    return 'unavailable';
  }
}

function allowed(signature: string): boolean {
  const now = Date.now();

  const last = recentlySent.get(signature);
  if (last && now - last < REPEAT_WINDOW_MS) return false;

  if (now - windowStart > 60_000) {
    windowStart = now;
    sentInWindow = 0;
  }
  if (sentInWindow >= MAX_REPORTS_PER_MINUTE) return false;

  sentInWindow += 1;
  recentlySent.set(signature, now);
  if (recentlySent.size > 200) recentlySent.clear();
  return true;
}

export function reportClientError(report: ClientErrorReport): void {
  if (typeof window === 'undefined') return;

  try {
    const signature = `${report.kind}|${report.apiStatus ?? ''}|${report.apiUrl ?? ''}|${report.message}`;
    if (!allowed(signature)) return;

    const body = JSON.stringify({
      ...report,
      message: report.message.slice(0, 2000),
      stack: report.stack?.slice(0, 8000),
      route: `${window.location.pathname}${window.location.search}`.slice(0, 500),
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION,
      machineId: getMachineId(),
      userAgent: navigator.userAgent,
      occurredAt: new Date().toISOString(),
    });

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    // keepalive lets a report made just before a page change still be sent.
    void fetch(REPORT_URL, { method: 'POST', headers, body, keepalive: true }).catch(() => undefined);
  } catch {
    // Reporting is best-effort; it must never break the page.
  }
}

/**
 * A failed API call worth reporting: the server failed (5xx) or never answered
 * (network error, timeout). 4xx answers are the server doing its job —
 * validation, permissions, not found — and are not sent.
 */
export function reportApiFailure(error: AxiosError): void {
  const status = error.response?.status;
  if (status !== undefined && status < 500) return;

  const config = error.config;
  const url = config?.url ?? '';
  if (url.includes('/client-errors')) return;

  const serverMessage = (error.response?.data as { message?: unknown } | undefined)?.message;
  reportClientError({
    kind: 'api',
    message:
      status === undefined
        ? `No response from the server (${error.code ?? 'network error'}): ${error.message}`
        : `${status}: ${typeof serverMessage === 'string' ? serverMessage : error.message}`,
    stack: error.stack,
    apiUrl: `${config?.baseURL ?? ''}${url}`,
    apiMethod: config?.method,
    apiStatus: status,
  });
}

/**
 * Report every uncaught error and unhandled promise rejection in the page.
 * Returns the function that removes the handlers.
 */
export function installGlobalErrorReporting(): () => void {
  const onError = (event: ErrorEvent) => {
    // A failed <img>/<script> load has no message and no error; skip it.
    if (!event.message && !event.error) return;
    reportClientError({
      kind: 'error',
      message: event.message || String(event.error),
      stack: event.error instanceof Error ? event.error.stack : undefined,
    });
  };

  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    // Failed API calls are already reported by the axios client.
    if (reason && typeof reason === 'object' && (reason as { isAxiosError?: boolean }).isAxiosError) return;
    reportClientError({
      kind: 'unhandledrejection',
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
