'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PendingConfirm {
  message: string;
  resolve: (confirmed: boolean) => void;
}

/**
 * An in-app replacement for window.confirm(). Native dialogs break input focus
 * in the MIMS Desktop (Electron) window on Windows — after one, text boxes stop
 * taking clicks until the app is restarted — so screens ask here instead.
 *
 *   const [confirm, confirmDialog] = useConfirmDialog();
 *   if (!(await confirm('Delete this?'))) return;
 *   ...
 *   return <>{...}{confirmDialog}</>;
 */
export function useConfirmDialog(): [(message: string) => Promise<boolean>, React.ReactNode] {
  const [pending, setPending] = React.useState<PendingConfirm | null>(null);

  const confirm = React.useCallback(
    (message: string) => new Promise<boolean>((resolve) => setPending({ message, resolve })),
    [],
  );

  const answer = (confirmed: boolean) => {
    pending?.resolve(confirmed);
    setPending(null);
  };

  const dialog = (
    <Dialog open={!!pending} onOpenChange={(open) => !open && answer(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Please confirm</DialogTitle>
          <DialogDescription>{pending?.message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => answer(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => answer(true)}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return [confirm, dialog];
}
