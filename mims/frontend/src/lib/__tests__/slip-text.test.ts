import { labSlipText, registrationSlipText, SLIP_TEXT_MARGIN_PX, SLIP_TEXT_WIDTH } from '../slip-text';

const LEFT = Math.round(SLIP_TEXT_MARGIN_PX.left / 8);
const RIGHT_EDGE = LEFT + SLIP_TEXT_WIDTH;
/** What the shell prints: the one left value of each line. */
const text = (lines: { left?: string[] }[]) => lines.map((l) => (l.left ?? [])[0] ?? '');

describe('dot-matrix text slips', () => {
  it('turns the px margins into 12 cpi characters inside the 80-character line', () => {
    expect(LEFT).toBe(9);
    expect(SLIP_TEXT_WIDTH).toBe(80 - 9 - 9);
  });

  it('lays the lab slip out like the HTML slip, inside both margins', () => {
    const lines = labSlipText([
      { left: ['MR-2026-08-04-482913', 'Ali Khan'], right: ['16/10/2026'] },
      { left: ['HEMATOLOGY'], right: ['Created By: Sana Iqbal'] },
      { left: ['Complete Blood Count'], right: ['Rs. 1200.00'] },
    ]);
    const [head, middle, test] = text(lines);

    expect(lines.every((l) => l.bold && (l.right ?? []).length === 0)).toBe(true);
    expect(head.indexOf('MR-2026-08-04-482913')).toBe(LEFT);
    expect(head).toContain('Ali Khan');
    expect(head.endsWith('16/10/2026')).toBe(true);
    expect(head.length).toBe(RIGHT_EDGE);
    // Category centred on the slip, Created By flush right.
    const centre = middle.indexOf('HEMATOLOGY') + 'HEMATOLOGY'.length / 2;
    expect(Math.abs(centre - (LEFT + SLIP_TEXT_WIDTH / 2))).toBeLessThanOrEqual(1);
    expect(middle.endsWith('Created By: Sana Iqbal')).toBe(true);
    expect(test.indexOf('Complete Blood Count')).toBe(LEFT);
    expect(test.endsWith('Rs. 1200.00')).toBe(true);
    expect(test.length).toBe(RIGHT_EDGE);
  });

  it('cuts a long name short, never the MR or the date', () => {
    const [head] = text(
      labSlipText([
        { left: ['MR-2026-08-04-482913', 'A'.repeat(60)], right: ['16/10/2026'] },
        { left: [], right: [] },
        { left: ['CBC'], right: ['Rs. 20.00'] },
      ]),
    );
    expect(head).toContain('MR-2026-08-04-482913');
    expect(head.endsWith('16/10/2026')).toBe(true);
    expect(head.length).toBe(RIGHT_EDGE);
  });

  it('centres the registration block with Date and Created By aligned on the right', () => {
    const [row1, row2] = text(
      registrationSlipText([
        { left: ['MR-2026-10-16-482913'], right: ['16/10/2026'] },
        { left: ['Ali Khan'], right: ['Created By: Sana Iqbal'] },
      ]),
    );
    const start = row1.indexOf('MR-');
    expect(row2.indexOf('Ali Khan')).toBe(start);
    expect(row1.length).toBe(row2.length);
    expect(row1.endsWith('16/10/2026')).toBe(true);
    expect(row2.endsWith('Created By: Sana Iqbal')).toBe(true);
    // Equal space either side of the block, within one character.
    expect(Math.abs(start - LEFT - (RIGHT_EDGE - row1.length))).toBeLessThanOrEqual(1);
  });
});
