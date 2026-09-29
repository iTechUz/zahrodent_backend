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
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

export function endOfUTCDayInclusive(d: Date): Date {
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

/**
 * Clinic time zone helpers. Asia/Tashkent is a fixed UTC+5 offset (no DST),
 * so no tz database is needed.
 */
export const CLINIC_TZ_OFFSET_MINUTES = 5 * 60;
const CLINIC_TZ_OFFSET_MS = CLINIC_TZ_OFFSET_MINUTES * 60_000;

export const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/** `YYYY-MM-DD` of the given instant in Asia/Tashkent. */
export function toTashkentDateOnly(instant: Date = new Date()): string {
  return toDateOnlyString(new Date(instant.getTime() + CLINIC_TZ_OFFSET_MS));
}

/** Today in Asia/Tashkent (`YYYY-MM-DD`). */
export function todayInTashkent(now: Date = new Date()): string {
  return toTashkentDateOnly(now);
}

/** Calendar arithmetic on a `YYYY-MM-DD` string. */
export function addDaysToDateOnly(dateOnly: string, days: number): string {
  const d = parseDateOnlyToUTC(dateOnly);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateOnlyString(d);
}

/** Month arithmetic on a `YYYY-MM` key. */
export function addMonthsToMonthKey(monthKey: string, months: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

/** First and last day (`YYYY-MM-DD`) of the month that contains `dateOnly`. */
export function monthBoundsOf(dateOnly: string): {
  start: string;
  end: string;
} {
  const [y, m] = dateOnly.split('-').map(Number);
  const start = `${y}-${pad2(m)}-01`;
  const end = toDateOnlyString(new Date(Date.UTC(y, m, 0)));
  return { start, end };
}

/**
 * Inclusive range of UTC-midnight Dates for `@db.Date` columns
 * (bookings.date, payments.date, visits.date, patients.created_at).
 */
export function dateOnlyColumnRange(
  from?: string,
  to?: string,
): { gte?: Date; lte?: Date } {
  const range: { gte?: Date; lte?: Date } = {};
  if (from) range.gte = parseDateOnlyToUTC(from);
  if (to) range.lte = parseDateOnlyToUTC(to);
  return range;
}

/** Instant of 00:00 Asia/Tashkent on `dateOnly`. */
export function tashkentDayStart(dateOnly: string): Date {
  return new Date(parseDateOnlyToUTC(dateOnly).getTime() - CLINIC_TZ_OFFSET_MS);
}

/** Last millisecond (23:59:59.999 Asia/Tashkent) of `dateOnly`. */
export function tashkentDayEnd(dateOnly: string): Date {
  return new Date(
    tashkentDayStart(addDaysToDateOnly(dateOnly, 1)).getTime() - 1,
  );
}

/**
 * Inclusive instant range for TIMESTAMP columns (leads.created_at, ...),
 * where the bounds are clinic-local calendar days.
 */
export function tashkentInstantRange(
  from?: string,
  to?: string,
): { gte?: Date; lte?: Date } {
  const range: { gte?: Date; lte?: Date } = {};
  if (from) range.gte = tashkentDayStart(from);
  if (to) range.lte = tashkentDayEnd(to);
  return range;
}

export type RelativeDateRange = 'today' | 'week' | 'month';

/**
 * `today` / `week` (Mon–Sun) / `month` relative to "today" in Asia/Tashkent,
 * as `YYYY-MM-DD` bounds (inclusive).
 */
export function relativeDateRange(
  range: RelativeDateRange,
  now: Date = new Date(),
): { start: string; end: string } {
  const today = todayInTashkent(now);
  if (range === 'week') {
    const weekday = (parseDateOnlyToUTC(today).getUTCDay() + 6) % 7; // 0 = Mon
    const start = addDaysToDateOnly(today, -weekday);
    return { start, end: addDaysToDateOnly(start, 6) };
  }
  if (range === 'month') return monthBoundsOf(today);
  return { start: today, end: today };
}

/** Weekday index used by doctor schedules: 0 = Monday … 6 = Sunday. */
export function scheduleWeekday(dateOnly: string): number {
  return (parseDateOnlyToUTC(dateOnly).getUTCDay() + 6) % 7;
}
