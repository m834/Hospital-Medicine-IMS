# Native dialogs still to replace (phase 2)

Native `alert()` / `confirm()` / `prompt()` break input focus in the MIMS
Desktop (Electron) window on Windows: after one closes, text boxes stop taking
clicks until the app is restarted. Phase 1 replaced the ones on the
registration, patient and lab screens and in shared components (in-app toasts,
banners and `useConfirmDialog` from `src/components/ui/confirm-dialog.tsx`).
These remain, to be replaced the same way:

| File | Line | Call |
|---|---|---|
| `mims/frontend/src/app/dashboard/expenditure/page.tsx` | 187 | `confirm` |
| `mims/frontend/src/app/(dashboard)/admin/feature-flags/page.tsx` | 121 | `confirm` |
| `mims/frontend/src/app/(dashboard)/admin/lab-tests/page.tsx` | 117 | `confirm` |
| `mims/frontend/src/app/(dashboard)/admin/backups/page.tsx` | 168 | `confirm` |
| `mims/frontend/src/app/(dashboard)/admin/backups/page.tsx` | 204 | `confirm` |
| `mims/frontend/src/app/(dashboard)/dashboard/medicines/page.tsx` | 164 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/medicines/page.tsx` | 181 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/transfers/receive/[id]/page.tsx` | 129 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/transfers/request/page.tsx` | 356 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/transfers/request/page.tsx` | 367 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/transfers/request/page.tsx` | 372 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/transfers/request/page.tsx` | 381 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/transfers/request/page.tsx` | 386 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/transfers/request/page.tsx` | 391 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/transfers/request/page.tsx` | 401 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/transfers/request/page.tsx` | 406 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/transfers/request/page.tsx` | 427 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/transfers/request/page.tsx` | 431 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/transfers/[id]/page.tsx` | 117 | `confirm` |
| `mims/frontend/src/app/(dashboard)/dashboard/transfers/[id]/page.tsx` | 124 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/transfers/[id]/page.tsx` | 128 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/dispensing/page.tsx` | 105 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/dispensing/page.tsx` | 117 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/dispensing/page.tsx` | 130 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/dispensing/page.tsx` | 170 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/dispensing/page.tsx` | 228 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/dispensing/page.tsx` | 233 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/dispensing/page.tsx` | 241 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/dispensing/page.tsx` | 264 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/dispensing/page.tsx` | 276 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/issuance/dispatch/[id]/page.tsx` | 122 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/issuance/dispatch/[id]/page.tsx` | 273 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/issuance/dispatch/[id]/page.tsx` | 279 | `confirm` |
| `mims/frontend/src/app/(dashboard)/dashboard/issuance/dispatch/[id]/page.tsx` | 295 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/issuance/dispatch/[id]/page.tsx` | 299 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/issuance/approve/[id]/page.tsx` | 266 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/issuance/approve/[id]/page.tsx` | 270 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/issuance/approve/[id]/page.tsx` | 280 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/issuance/approve/[id]/page.tsx` | 291 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/issuance/approve/[id]/page.tsx` | 295 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/issuance/approve/[id]/page.tsx` | 323 | `confirm` |
| `mims/frontend/src/app/(dashboard)/dashboard/issuance/approve/[id]/page.tsx` | 344 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/issuance/approve/[id]/page.tsx` | 350 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/inventory/receive/page.tsx` | 311 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/inventory/receive/page.tsx` | 427 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/inventory/receive/page.tsx` | 479 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/inventory/receive/page.tsx` | 482 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/inventory/receive/page.tsx` | 490 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/inventory/receive/page.tsx` | 498 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/inventory/receive/page.tsx` | 571 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/dispose/page.tsx` | 247 | `confirm` |
| `mims/frontend/src/app/(dashboard)/dashboard/dispose/ward/page.tsx` | 170 | `confirm` |
| `mims/frontend/src/app/(dashboard)/dashboard/pharmacies/page.tsx` | 180 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/prescriptions/page.tsx` | 239 | `confirm` |
| `mims/frontend/src/app/(dashboard)/dashboard/prescriptions/page.tsx` | 277 | `confirm` |
| `mims/frontend/src/app/(dashboard)/dashboard/prescriptions/[id]/page.tsx` | 261 | `confirm` |
| `mims/frontend/src/app/(dashboard)/dashboard/medicine-templates/page.tsx` | 256 | `confirm` |
| `mims/frontend/src/app/(dashboard)/dashboard/reports/daily-transactions/page.tsx` | 238 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/reports/main-pharmacy/page.tsx` | 116 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/reports/main-pharmacy/page.tsx` | 176 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/reports/sub-pharmacy/page.tsx` | 101 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/reports/sub-pharmacy/page.tsx` | 120 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/reports/detailed-daily/page.tsx` | 100 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/reports/detailed-daily/page.tsx` | 119 | `alert` |
| `mims/frontend/src/app/(dashboard)/dashboard/reports/detailed-daily/page.tsx` | 134 | `alert` |
