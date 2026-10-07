import * as React from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import api, { getErrorMessage } from "@/lib/api";

/** Mirrors LAB_ORDER_DELETE_ROLES on the server, which is what enforces it. */
export const LAB_ORDER_DELETE_ROLES: string[] = ["SUPER_ADMIN"];

export interface DeletableLabOrder {
  id: string;
  orderNumber: string;
  labTest?: { testName?: string } | null;
  patient?: { fullName?: string } | null;
}

/**
 * Delete a lab test from the Test List. Super admin only. Asks first: the
 * order and its receipt are removed for good and drop out of the revenue
 * report; the server keeps a full copy in the audit log.
 */
export function DeleteLabOrderButton({
  order,
  user,
  onDeleted,
}: {
  order: DeletableLabOrder;
  user: { role: string } | null | undefined;
  onDeleted: (order: DeletableLabOrder) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState("");

  if (!user || !LAB_ORDER_DELETE_ROLES.includes(user.role)) return null;

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setError("");
    try {
      await api.delete(`/lab-orders/${order.id}`);
      setOpen(false);
      onDeleted(order);
    } catch (err) {
      setError(getErrorMessage(err) || "Could not delete this lab test.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-red-600 hover:text-red-700"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        aria-label={`Delete ${order.orderNumber}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={(next) => !deleting && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this lab test?</DialogTitle>
            <DialogDescription>
              {order.orderNumber} — {order.labTest?.testName || "Lab test"} for{" "}
              {order.patient?.fullName || "this patient"}.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The test and its receipt are removed and no longer count in Lab Revenue. This cannot
            be undone from here; a full copy is kept in the audit log.
          </p>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
