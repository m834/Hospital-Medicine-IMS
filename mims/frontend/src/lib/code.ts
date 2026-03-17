export const generateNextCode = (
  existingCodes: Array<string | null | undefined>,
  prefix: string,
  padLength = 3
): string => {
  const normalizedPrefix = prefix.toUpperCase();
  const pattern = new RegExp(`^${normalizedPrefix}-(\\d+)$`, 'i');

  const maxValue = existingCodes.reduce((max, code) => {
    if (!code) return max;
    const match = code.match(pattern);
    if (!match) return max;
    const value = Number.parseInt(match[1], 10);
    if (Number.isNaN(value)) return max;
    return Math.max(max, value);
  }, 0);

  const nextValue = String(maxValue + 1).padStart(padLength, '0');
  return `${normalizedPrefix}-${nextValue}`;
};
