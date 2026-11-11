import { scheduleWeekday } from '../common/utils/date.util';

export type ScheduleSlot = {
  day: number;
  startTime: string;
  endTime: string;
  isWorking: boolean;
  /** Ixtiyoriy tushlik tanaffusi (HH:mm); ikkalasi birga beriladi. */
  breakStart?: string | null;
  breakEnd?: string | null;
};

export const DEFAULT_DURATION_MIN = 30;

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Why a booking cannot happen under this doctor schedule / days off, or null
 * when it fits. Schedules with no working day at all (the untouched default)
 * are ignored; once a schedule is defined, a weekday with no entry counts as
 * non-working. Shared by booking validation and the "schedule change hits N
 * bookings" report.
 */
export function scheduleViolation(
  doctor: { schedule: unknown; daysOff: unknown },
  dateOnly: string,
  time: string,
  duration: number,
): string | null {
  const daysOff = Array.isArray(doctor.daysOff)
    ? (doctor.daysOff as unknown[]).map((d) => String(d).trim())
    : [];
  if (daysOff.includes(dateOnly)) {
    return `Shifokor ${dateOnly} kuni dam oladi — boshqa sanani tanlang`;
  }

  const schedule = Array.isArray(doctor.schedule)
    ? (doctor.schedule as ScheduleSlot[])
    : [];
  if (!schedule.some((s) => s?.isWorking)) return null;

  const slot = schedule.find(
    (s) => Number(s?.day) === scheduleWeekday(dateOnly),
  );
  if (!slot || !slot.isWorking) return 'Shifokor bu hafta kunida ishlamaydi';
  const start = timeToMinutes(String(slot.startTime).slice(0, 5));
  const end = timeToMinutes(String(slot.endTime).slice(0, 5));
  const bookingStart = timeToMinutes(time);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  if (bookingStart < start || bookingStart + duration > end) {
    return `Qabul vaqti shifokorning ish vaqtidan tashqarida (${minutesToTime(start)}–${minutesToTime(end)})`;
  }
  if (slot.breakStart && slot.breakEnd) {
    const bs = timeToMinutes(String(slot.breakStart).slice(0, 5));
    const be = timeToMinutes(String(slot.breakEnd).slice(0, 5));
    if (
      !Number.isNaN(bs) &&
      !Number.isNaN(be) &&
      bs < be &&
      bookingStart < be &&
      bookingStart + duration > bs
    ) {
      return `Qabul vaqti shifokorning tanaffusiga to'g'ri keladi (${minutesToTime(bs)}–${minutesToTime(be)})`;
    }
  }
  return null;
}
