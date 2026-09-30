/**
 * Uzbek mobile number in canonical `+998XXXXXXXXX` form, or `null`.
 * Accepts `+998 90 123-45-67`, `998901234567`, `901234567`, ...
 */
export function normalizeUzPhone(
  raw: string | null | undefined,
): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('998')) return `+${digits}`;
  if (digits.length === 9) return `+998${digits}`;
  return null;
}
