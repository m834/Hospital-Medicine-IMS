/**
 * Rupees in words for printed slips: 50 -> "Fifty Rupees Only",
 * 1250.5 -> "One Thousand Two Hundred Fifty Rupees and Fifty Paisa Only".
 * Groups follow the Pakistani convention: thousand, lakh, crore.
 */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n];
  return [TENS[Math.floor(n / 10)], ONES[n % 10]].filter(Boolean).join(' ');
}

function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  return [hundreds ? `${ONES[hundreds]} Hundred` : '', belowHundred(n % 100)].filter(Boolean).join(' ');
}

/** A whole number in words; 0 is "Zero". */
export function numberToWords(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return 'Zero';

  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;

  if (crore) parts.push(`${numberToWords(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (n) parts.push(belowThousand(n));
  return parts.join(' ');
}

export function amountInWords(amount: number | string | null | undefined): string {
  const value = Math.round(Math.abs(Number(amount) || 0) * 100);
  const rupees = Math.floor(value / 100);
  const paisa = value % 100;
  const words = `${numberToWords(rupees)} Rupees`;
  return paisa ? `${words} and ${numberToWords(paisa)} Paisa Only` : `${words} Only`;
}
