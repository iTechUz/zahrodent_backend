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
import { oneLine } from './client-notifier.service';
import {
  addDaysToDateOnly,
  parseDateOnlyToUTC,
  toDateOnlyString,
  todayInTashkent,
} from '../common/utils/date.util';

export const REMINDER_CALLBACK_CONFIRM = 'rem_ok_';
export const REMINDER_CALLBACK_RESCHEDULE = 'rem_re_';
const HOUR_MS = 3_600_000;
const POLL_MS = 5 * 60_000;
const FIRST_RUN_DELAY_MS = 90_000;

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
      const rows = await this.prisma.booking.findMany({
        where: {
          status: { in: ACTIVE_BOOKING_STATUSES },
          date: {
            gte: parseDateOnlyToUTC(today),
            lte: parseDateOnlyToUTC(addDaysToDateOnly(today, 2)),
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
        take: 200,
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
              ? { id: b.id, reminder2SentAt: null }
              : { id: b.id, reminder24SentAt: null },
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
      if (queued) this.logger.log(`Eslatmalar navbatga qo'yildi: ${queued}`);
      return queued;
    } catch (e) {
      this.logger.warn(
        `Eslatmalarni qayta ishlashda xato: ${e instanceof Error ? e.message : String(e)}`,
      );
      return 0;
    }
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
    const groupChat = (
      process.env.TELEGRAM_STATUS_CHAT_ID || process.env.TELEGRAM_LEADS_CHAT_ID
    )?.trim();
    if (groupChat) {
      await this.outbox.enqueue({
        kind: 'booking_reschedule_request',
        chatId: groupChat,
        text: [
          "🔄 Bemor qabulni ko'chirishni so'radi",
          `👤 ${oneLine(`${b.patient.firstName} ${b.patient.lastName}`, 100)}`,
          `📞 ${oneLine(b.patient.phone, 30)}`,
          `🦷 ${oneLine(`${b.doctor.firstName} ${b.doctor.lastName}`, 100)}`,
          `📅 ${toDateOnlyString(b.date)} ${b.time}`,
          "Iltimos, bemor bilan bog'lanib yangi vaqt kelishing.",
        ].join('\n'),
        patientId: b.patientId,
      });
    }
    return 'reschedule';
  }
}
