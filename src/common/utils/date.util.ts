function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Date-only string formatter (YYYY-MM-DD) using UTC parts to avoid
 * "off-by-one" shifts caused by local timezone when slicing toISOString().
 */
export function toDateOnlyString(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/**
 * Parse a date-only string (YYYY-MM-DD) into a Date at UTC midnight.
 * Used for Prisma fields with `@db.Date`.
 */
export function parseDateOnlyToUTC(dateOnly: string): Date {
  // Accept exactly YYYY-MM-DD; everything else fallback to Date parsing.
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return new Date(`${dateOnly}T00:00:00.000Z`);
  }
  const d = new Date(dateOnly);
  return d;
}

export function startOfUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

export function endOfUTCDayInclusive(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}
