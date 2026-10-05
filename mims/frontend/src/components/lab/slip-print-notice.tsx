import * as React from "react";
import { AlertTriangle, Printer } from "lucide-react";

/**
 * What the desk is told about the slips it just sent. The green notice is
 * shown only when the print actually started; anything else says plainly that
 * the slip did not print, so nobody walks away from a printer that is silent.
 */
export function SlipPrintNotice({
  printed,
  orderNumbers,
  recordError,
}: {
  printed: boolean;
  orderNumbers: string[];
  /** The print started but the server could not count it. */
  recordError?: string;
}) {
  const count = orderNumbers.length;

  if (printed) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
        <Printer className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
        <div className="text-sm text-green-800">
          <p>
            <span className="font-semibold">
              {count} slip{count > 1 ? "s" : ""} sent to the printer
            </span>{" "}
            — {orderNumbers.join(", ")}. Ready for the next patient.
          </p>
          {recordError && (
            <p className="mt-1 text-amber-700">
              The print could not be recorded on the server: {recordError}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <AlertTriangle className="h-6 w-6 shrink-0 text-amber-600" />
      <div>
        <p className="font-semibold text-amber-900">Slip did not print — reprint from Test List</p>
        <p className="text-sm text-amber-800">
          {count} test(s) ordered and saved. Order numbers: {orderNumbers.join(", ")}. The slip
          {count > 1 ? "s were" : " was"} not counted as printed — press Retry Print below, or a
          manager can reprint from Test List. Do not enter the order again.
        </p>
      </div>
    </div>
  );
}
