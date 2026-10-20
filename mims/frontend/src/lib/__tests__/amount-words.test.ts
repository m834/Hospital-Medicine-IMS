import { amountInWords, numberToWords } from '../amount-words';

describe('amountInWords', () => {
  it.each([
    [50, 'Fifty Rupees Only'],
    [0, 'Zero Rupees Only'],
    [1200, 'One Thousand Two Hundred Rupees Only'],
    [4515, 'Four Thousand Five Hundred Fifteen Rupees Only'],
    [850.5, 'Eight Hundred Fifty Rupees and Fifty Paisa Only'],
    ['300.00', 'Three Hundred Rupees Only'],
    [null, 'Zero Rupees Only'],
  ])('%p -> %s', (amount, words) => {
    expect(amountInWords(amount as any)).toBe(words);
  });

  it('groups by lakh and crore', () => {
    expect(numberToWords(150000)).toBe('One Lakh Fifty Thousand');
    expect(numberToWords(12345678)).toBe('One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight');
  });
});
