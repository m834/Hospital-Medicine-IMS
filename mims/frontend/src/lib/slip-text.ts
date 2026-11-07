import type { RawSlipLine } from './slip-printer';

/**
 * The dot-matrix text slips, laid out here with spaces the way the HTML slips
 * lay themselves out with CSS.
 *
 * The MIMS Desktop shell prints each line exactly as given, starting at the
 * station's own calibrated left margin (its Slip printer settings: 80
 * characters at 12 cpi). Everything inside that — the margins below, the
 * columns, the centring — is decided here, so changing it is a server deploy
 * with nothing to reinstall on the stations.
 */

/**
 * Extra space inside the station's margins, in px of the HTML slip.
 * One 12 cpi character is 8px (96px per inch / 12 characters per inch).
 */
export const SLIP_TEXT_MARGIN_PX = { left: 70, right: 70 };

const PX_PER_CHAR = 8;
/** Characters per line the stations print (Slip printer settings default). */
const STATION_LINE_CHARS = 80;

const toChars = (px: number) => Math.max(0, Math.round(px / PX_PER_CHAR));

const LEFT_CHARS = toChars(SLIP_TEXT_MARGIN_PX.left);
/** Characters available between the two margins. */
export const SLIP_TEXT_WIDTH = STATION_LINE_CHARS - LEFT_CHARS - toChars(SLIP_TEXT_MARGIN_PX.right);

/** The HTML slips' 16px column gap. */
const GAP = 2;
/** The registration slip's 36px gap between its two columns. */
const REG_GAP = 4;

const spaces = (n: number) => ' '.repeat(Math.max(n, 0));

/**
 * One printed line: the body, shifted in by the left margin. Sent as a single
 * left value so the shell keeps its spacing as built and never re-flows it.
 */
function textLine(body: string): RawSlipLine {
  const text = body.trimEnd();
  return { left: text ? [spaces(LEFT_CHARS) + text] : [], right: [], bold: true };
}

/** `left` flush left and `right` flush right; only `left` is ever cut short. */
function flush(left: string, right: string): string {
  if (!right) return left.slice(0, SLIP_TEXT_WIDTH);
  const l = left.slice(0, Math.max(SLIP_TEXT_WIDTH - right.length - GAP, 0));
  return l + spaces(SLIP_TEXT_WIDTH - l.length - right.length) + right;
}

/**
 * Lab line 1 — MR | Name | Date. MR takes up to twice Name's share but never
 * less than itself; the date sits flush right. Only the name is cut short.
 */
function labHead(mr: string, name: string, date: string): string {
  const room = SLIP_TEXT_WIDTH - (date ? date.length + GAP : 0) - (name ? GAP : 0);
  const mrCol = Math.max(mr.length, Math.min(Math.round((room * 2) / 3), room - name.length));
  const nameCol = Math.max(room - mrCol, 0);
  const left = name ? mr.padEnd(mrCol) + spaces(GAP) + name.slice(0, nameCol) : mr;
  return flush(left, date);
}

/**
 * Lab line 2 — the category centred on the slip, Created By flush right. A
 * long Created By nudges the category left rather than overlap it.
 */
function centredWithRight(centre: string, right: string): string {
  const room = SLIP_TEXT_WIDTH - (right ? right.length + GAP : 0);
  const c = centre.slice(0, Math.max(room, 0));
  const start = Math.max(0, Math.min(Math.floor((SLIP_TEXT_WIDTH - c.length) / 2), room - c.length));
  const body = spaces(start) + c;
  return right ? body + spaces(SLIP_TEXT_WIDTH - body.length - right.length) + right : body;
}

/** One lab slip: MR | Name | Date; category centred | Created By; test | price. */
export function labSlipText([head, middle, test]: { left: string[]; right: string[] }[]): RawSlipLine[] {
  return [
    textLine(labHead(head.left[0] ?? '', head.left[1] ?? '', head.right[0] ?? '')),
    textLine(centredWithRight(middle.left[0] ?? '', middle.right[0] ?? '')),
    textLine(flush(test.left[0] ?? '', test.right[0] ?? '')),
  ];
}

/**
 * The registration slip: MR | Date, then Name | Created By, as one block
 * centred between the margins with a fixed gap; Date and Created By line up
 * on their right. Only a name too long for the block is cut short.
 */
export function registrationSlipText([first, second]: { left: string[]; right: string[] }[]): RawSlipLine[] {
  const mr = first.left[0] ?? '';
  const date = first.right[0] ?? '';
  const name = second.left[0] ?? '';
  const by = second.right[0] ?? '';

  const rightCol = Math.max(date.length, by.length);
  const leftCol = Math.max(mr.length, Math.min(Math.max(mr.length, name.length), SLIP_TEXT_WIDTH - REG_GAP - rightCol));
  const indent = Math.max(0, Math.floor((SLIP_TEXT_WIDTH - leftCol - REG_GAP - rightCol) / 2));
  const row = (left: string, right: string) =>
    spaces(indent) + left.slice(0, leftCol).padEnd(leftCol) + spaces(REG_GAP) + right.padStart(rightCol);

  return [textLine(row(mr, date)), textLine(row(name, by))];
}
