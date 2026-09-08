# Silent slip printing on the reception machines

Registration and lab slips print from the browser. A browser will not print
without showing its dialog — that restriction is in Chrome itself, not in MIMS,
and no change to the app can lift it. What *can* lift it is how Chrome is
launched: started with `--kiosk-printing`, Chrome sends every `window.print()`
straight to the machine's default printer as a single copy, with no dialog and
no copy count.

This is a per-machine setup step. Nothing in the app changes.

## Setup — the quick way

Copy `setup-kiosk-printing.ps1` (next to this file) onto the reception machine
and run it once:

```
powershell -ExecutionPolicy Bypass -File .\setup-kiosk-printing.ps1
```

It finds Chrome, reports which printer is currently the Windows default, creates
the two desktop shortcuts, and offers to close any running Chrome (the step that
otherwise makes it look like nothing changed). Pass `-BaseUrl "http://<address>"`
if the machines reach MIMS on a LAN address rather than the public one.

The manual steps below are the same thing done by hand.

## Setup (Windows, once per reception machine)

1. **Confirm the slip printer is the Windows default.**
   Settings → Bluetooth & devices → Printers & scanners. Turn *off* "Let Windows
   manage my default printer", then open the slip printer and click **Set as
   default**. Kiosk printing always uses the default — it never asks.

2. **Set the printer's paper size to A4.** The slips are laid out for a
   pre-printed A4 form; a printer defaulting to Letter shifts every field.

3. **Create the launch shortcut.** Right-click the desktop → New → Shortcut, and
   use this as the location:

   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --app=http://civil.codehustlerssol.com/lab
   ```

   Name it something staff will recognise, e.g. **MIMS Lab (Print)**. Pin it to
   the taskbar and remove the plain Chrome icon from the taskbar so nobody
   starts the wrong one.

   For the registration desk, point the same shortcut at
   `http://civil.codehustlerssol.com/reception` instead.

4. **Close every other Chrome window before first use.** Chrome only applies the
   flag when it starts a fresh process. If Chrome is already running, the
   shortcut opens a tab in the existing window and the flag is ignored — the
   dialog comes back. Ending all `chrome.exe` processes in Task Manager and
   reopening the shortcut fixes it.

5. **Test.** Create a lab order, click **Print Lab Slip**, and confirm one page
   per test comes out of the tray with no dialog.

## What this changes

- Every print from that Chrome window is silent, including patient registration
  slips. This is intended.
- The printer is always the Windows default. Kiosk printing has no printer
  picker; changing printers means changing the Windows default.
- Copy count is always 1.

## What this does not change

- **The one-print rule still holds.** The server counts a slip's prints before
  anything reaches the printer, and refuses a second one to anyone below
  registration staff manager (`recordSlipPrints` in `lab-orders.service.ts`).
  Silent printing cannot be used to run off duplicates.
- **The print is still logged** to the audit log as PRINT or REPRINT against the
  user who clicked.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Dialog still appears | Chrome was already running when the shortcut was used, or the shortcut is missing the flag. Close all `chrome.exe` and reopen. |
| Prints to the wrong printer | Windows default is wrong, or "Let Windows manage my default printer" is back on. |
| Fields land in the wrong slot on the form | Printer paper size is not A4, or scaling is not 100%. |
| Blank page comes out | Check the printer's paper size first. |

## If kiosk mode proves unworkable

The fallback is a local print agent (QZ Tray or similar) installed on each
machine, which the page talks to over a local socket. It prints silently from
any browser and can target a named printer rather than the default, at the cost
of an install and a signing certificate per machine, plus a change in
`frontend/src/lib/print-receipt.ts` to route the slip HTML to the agent instead
of the hidden iframe. Not needed unless the shortcut above fails in practice.
