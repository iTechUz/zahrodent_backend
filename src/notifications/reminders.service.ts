import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SettingsService } from '../settings/settings.service';
import {
  formatReminderDate,
  renderReminderTemplate,
} from '../settings/reminder-template';
import { ACTIVE_BOOKING_STATUSES } from '../bookings/bookings.service';
import { BookingStatusService } from '../bookings/booking-status.service';
import { NotificationLogService } from './notification-log.service';
import { oneLine } from '../common/utils/text.util';
import {
  parseDateOnlyToUTC,
  toDateOnlyString,
  todayInTashkent,
} from '../common/utils/date.util';
import { statusChatId } from '../telegram/dev-defaults';

export const REMINDER_CALLBACK_CONFIRM = 'rem_ok_';
export const REMINDER_CALLBACK_RESCHEDULE = 'rem_re_';
const HOUR_MS = 3_600_000;
const POLL_MS = 5 * 60_000;
const PAGE_SIZE = 200;
const MAX_PAGES = 25;
const FIRST_RUN_DELAY_MS = 90_000;

type ReminderRow = {
  id: string;
  date: Date;
  time: string;
  reminder24SentAt: Date | null;
  reminder2SentAt: Date | null;
  patientId: string;
  patient: {
    firstName: string;
    lastName: string;
    telegramChatId: string | null;
  };
  doctor: { firstName: string; lastName: string };
};

export type ReminderAnswer = 'confirmed' | 'reschedule' | 'already' | 'denied';

/** Clinic is in Asia/Tashkent (UTC+5, no DST): booking date + "HH:mm" → instant. */
export function bookingStart(date: Date, time: string): Date {
  return new Date(`${toDateOnlyString(date)}T${time}:00+05:00`);
}

export function reminderKeyboard(bookingId: string) {
  return {
    inline_keyboard: [
      [
        {
          text: '✅ Tasdiqlayman',
          callback_data: `${REMINDER_CALLBACK_CONFIRM}${bookingId}`,
        },
      ],
      [
        {
          text: "🔄 Qabulni ko'chirish",
          callback_data: `${REMINDER_CALLBACK_RESCHEDULE}${bookingId}`,
        },
      ],
    ],
  };
}

/**
 * Scheduled reminders: 24h and 2h before the visit, to patients linked to the
 * bot, with [Tasdiqlayman] / [Qabulni ko'chirish] buttons. `@nestjs/schedule`
 * isn't a dependency → unref'd timer (like refresh-token cleanup). Safe with
 * several replicas: a row is claimed by an `updateMany … WHERE sent_at IS
 * NULL` before anything is queued.
 */
@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemindersService.name);
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly outbox: NotificationLogService,
    private readonly status: BookingStatusService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    const first = setTimeout(() => void this.run(), FIRST_RUN_DELAY_MS);
    const every = setInterval(() => void this.run(), POLL_MS);
    first.unref();
    every.unref();
    this.timers = [first, every];
  }

  onModuleDestroy() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  /** Queues every due reminder. Never throws. Returns how many were queued. */
  async run(now: Date = new Date()): Promise<number> {
    try {
      const today = todayInTashkent(now);
      const cs = await this.settings.get();
      // Only bookings starting within the next 24h can be due: today and
      // tomorrow (Tashkent). Ordered by start, claimed page by page, so a big
      // backlog never starves the reminders that are closest to starting.
      const horizon = todayInTashkent(new Date(now.getTime() + 24 * HOUR_MS));
      let queued = 0;
      let cursor: string | undefined;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const rows = await this.prisma.booking.findMany({
          where: {
            status: { in: ACTIVE_BOOKING_STATUSES },
            date: {
              gte: parseDateOnlyToUTC(today),
              lte: parseDateOnlyToUTC(horizon),
            },
            OR: [{ reminder24SentAt: null }, { reminder2SentAt: null }],
            patient: { deletedAt: null, telegramChatId: { not: null } },
          },
          select: {
            id: true,
            date: true,
            time: true,
            reminder24SentAt: true,
            reminder2SentAt: true,
            patientId: true,
            patient: {
              select: { firstName: true, lastName: true, telegramChatId: true },
            },
            doctor: { select: { firstName: true, lastName: true } },
          },
          orderBy: [{ date: 'asc' }, { time: 'asc' }, { id: 'asc' }],
          take: PAGE_SIZE,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        queued += await this.queueDue(rows, now, cs);
        if (rows.length < PAGE_SIZE) break;
        cursor = rows[rows.length - 1].id;
      }
      if (queued) this.logger.log(`Eslatmalar navbatga qo'yildi: ${queued}`);
      return queued;
    } catch (e) {
      this.logger.warn(
        `Eslatmalarni qayta ishlashda xato: ${e instanceof Error ? e.message : String(e)}`,
      );
      return 0;
    }
  }

  private async queueDue(
    rows: ReminderRow[],
    now: Date,
    cs: { telegramReminderTemplate: string; clinicName: string },
  ): Promise<number> {
    // Claim only if the booking was not cancelled/moved since it was read.
    const stillSame = (b: ReminderRow) => ({
      id: b.id,
      status: { in: ACTIVE_BOOKING_STATUSES },
      date: b.date,
      time: b.time,
    });
    let queued = 0;
    for (const b of rows) {
      const diff = bookingStart(b.date, b.time).getTime() - now.getTime();
      if (!(diff > 0)) continue;
      const kind: '2h' | '24h' | null =
        diff <= 2 * HOUR_MS
          ? b.reminder2SentAt
            ? null
            : '2h'
          : diff <= 24 * HOUR_MS
            ? b.reminder24SentAt
              ? null
              : '24h'
            : null;
      if (!kind || !b.patient.telegramChatId) continue;

      const claim = await this.prisma.booking.updateMany({
        where:
          kind === '2h'
            ? { ...stillSame(b), reminder2SentAt: null }
            : { ...stillSame(b), reminder24SentAt: null },
        data:
          kind === '2h'
            ? {
                reminder2SentAt: now,
                reminder24SentAt: b.reminder24SentAt ?? now,
              }
            : { reminder24SentAt: now },
      });
      if (claim.count !== 1) continue;

      const text = renderReminderTemplate(cs.telegramReminderTemplate, {
        name: oneLine(`${b.patient.firstName} ${b.patient.lastName}`, 100),
        date: formatReminderDate(toDateOnlyString(b.date)),
        time: b.time,
        doctor:
          oneLine(`${b.doctor.firstName} ${b.doctor.lastName}`, 100) ||
          'shifokor',
        clinic: cs.clinicName,
      });
      const row = await this.outbox.enqueue({
        kind: kind === '2h' ? 'reminder_2h' : 'reminder_24h',
        chatId: b.patient.telegramChatId,
        text:
          kind === '2h'
            ? `⏰ Qabulingizga 2 soatdan kam qoldi.\n${text}`
            : `⏰ ${text}`,
        replyMarkup: reminderKeyboard(b.id),
        patientId: b.patientId,
        // After the visit starts the reminder is no longer true.
        expiresAt: bookingStart(b.date, b.time),
      });
      if (row) queued += 1;
      else {
        // Could not even store it → release the claim so the next run retries.
        await this.prisma.booking
          .updateMany({
            where: { id: b.id },
            data:
              kind === '2h'
                ? { reminder2SentAt: null }
                : { reminder24SentAt: null },
          })
          .catch(() => undefined);
      }
    }
    return queued;
  }

  /**
   * Patient pressed a reminder button. Only the chat linked to the booking's
   * patient may answer, and only for a still-active, future booking.
   */
  async handleAnswer(
    chatId: number | string,
    bookingId: string,
    action: 'confirm' | 'reschedule',
    now: Date = new Date(),
  ): Promise<ReminderAnswer> {
    const b = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        date: true,
        time: true,
        patientConfirmedAt: true,
        rescheduleRequestedAt: true,
        patientId: true,
        patient: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            telegramChatId: true,
          },
        },
        doctor: { select: { firstName: true, lastName: true } },
      },
    });
    if (
      !b ||
      !b.patient.telegramChatId ||
      b.patient.telegramChatId !== String(chatId) ||
      !ACTIVE_BOOKING_STATUSES.includes(b.status) ||
      bookingStart(b.date, b.time) <= now
    ) {
      return 'denied';
    }

    if (action === 'confirm') {
      if (b.patientConfirmedAt) return 'already';
      const r = await this.prisma.booking.updateMany({
        where: { id: b.id, patientConfirmedAt: null },
        data: { patientConfirmedAt: now, status: 'confirmed' },
      });
      if (!r.count) return 'already';
      if (b.status !== 'confirmed') {
        // Same audit trail + staff-group notice as an admin change.
        await this.status.onChanged({
          bookingId: b.id,
          from: b.status,
          to: 'confirmed',
          actor: { id: null, name: 'Bemor (Telegram)' },
        });
      }
      return 'confirmed';
    }

    if (b.rescheduleRequestedAt) return 'already';
    const r = await this.prisma.booking.updateMany({
      where: { id: b.id, rescheduleRequestedAt: null },
      data: { rescheduleRequestedAt: now },
    });
    if (!r.count) return 'already';
    const groupChat = statusChatId();
    if (!groupChat) {
      this.logger.warn(
        `Ko'chirish so'rovi (qabul ${b.id}) — TELEGRAM_STATUS_CHAT_ID/TELEGRAM_LEADS_CHAT_ID sozlanmagan, xodimlarga xabar ketmadi`,
      );
    } else {
      await this.outbox.enqueue({
        kind: 'booking_reschedule_request',
        chatId: groupChat,
        text: [
          "🔄 Bemor qabulni ko'chirishni so'radi",
          `👤 ${oneLine(`${b.patient.firstName} ${b.patient.lastName}`, 100)}`,
          `📞 ${oneLine(b.patient.phone, 30)}`,
          `🦷 ${oneLine(`${b.doctor.firstName} ${b.doctor.lastName}`, 100)}`,
          `📅 ${formatReminderDate(toDateOnlyString(b.date))} ${b.time}`,
          "Iltimos, bemor bilan bog'lanib yangi vaqt kelishing.",
        ].join('\n'),
        patientId: b.patientId,
      });
    }
    return 'reschedule';
  }
}
