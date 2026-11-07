import { BadRequestException } from '@nestjs/common';

/** Final states: only an admin may reopen them (to pending/confirmed). */
export const TERMINAL_BOOKING_STATUSES = ['completed', 'cancelled', 'no-show'];
export const REOPEN_BOOKING_STATUSES = ['pending', 'confirmed'];

const STATUS_UZ: Record<string, string> = {
  pending: 'yangi ariza',
  confirmed: 'tasdiqlangan',
  arrived: 'keldi',
  'no-show': 'kelmadi',
  completed: 'yakunlangan',
  cancelled: 'bekor qilingan',
};

export const label = (s: string) => STATUS_UZ[s] ?? s;

/**
 * Single place for booking status rules. Throws a 400 with an Uzbek message.
 *  - completed / cancelled / no-show are final; only an admin may reopen them
 *    to pending/confirmed (completed → cancelled is never allowed);
 *  - "completed" cannot be set before the booking day (Tashkent).
 * Same status → no-op (e.g. editing notes of a completed booking).
 */
export function assertStatusTransition(args: {
  from: string;
  to: string;
  role: string;
  bookingDate: string;
  today: string;
}): void {
  const { from, to, role, bookingDate, today } = args;
  if (from === to) return;

  if (TERMINAL_BOOKING_STATUSES.includes(from)) {
    if (from === 'completed' && to === 'cancelled') {
      throw new BadRequestException(
        "Yakunlangan qabulni bekor qilib bo'lmaydi",
      );
    }
    if (!REOPEN_BOOKING_STATUSES.includes(to)) {
      throw new BadRequestException(
        `${capitalize(label(from))} qabul holatini "${label(to)}" ga o'zgartirib bo'lmaydi`,
      );
    }
    if (role !== 'admin') {
      throw new BadRequestException(
        `${capitalize(label(from))} qabulni faqat administrator qayta ochishi mumkin`,
      );
    }
  }

  if (to === 'completed' && bookingDate > today) {
    throw new BadRequestException(
      "Kelajakdagi qabulni yakunlangan deb belgilab bo'lmaydi",
    );
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
