/**
 * Disposal reasons, shared by the single-item Dispose screen and the
 * Dispose by Ward screen. Kept in one place so the two cannot drift — they
 * must match the DisposalReason enum in the Prisma schema.
 */

export const REASONS = [
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'BROKEN', label: 'Broken' },
  { value: 'CONTAMINATED', label: 'Contaminated' },
  { value: 'RECALLED', label: 'Recalled' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const REASON_LABEL: Record<string, string> = Object.fromEntries(
  REASONS.map((r) => [r.value, r.label]),
);

// Reasons are facts, not severities — colour groups them quietly
export const REASON_STYLE: Record<string, string> = {
  EXPIRED: 'bg-amber-100 text-amber-900',
  DAMAGED: 'bg-rose-100 text-rose-900',
  BROKEN: 'bg-rose-100 text-rose-900',
  CONTAMINATED: 'bg-purple-100 text-purple-900',
  RECALLED: 'bg-blue-100 text-blue-900',
  OTHER: 'bg-slate-100 text-slate-900',
};

export interface DisposalBatch {
  id: string;
  batchNo: string;
  qtyAvailable: number;
  expiryDate: string;
  category: 'NORMAL' | 'LP';
  status: string;
  medicine: { id: string; name: string; strength?: string; form: string };
}

/**
 * A ward is a Room, and a Room belongs to a sub-pharmacy. Stock itself has no
 * ward — it sits with the pharmacy — so a ward selects whose shelves are being
 * written off, and is not a filter on the stock.
 */
export interface DisposalRoom {
  id: string;
  roomNumber: string;
  roomType: string;
  department?: { name: string } | null;
  pharmacy?: { id: string; name: string; code: string; type: string } | null;
}
