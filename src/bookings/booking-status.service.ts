import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { NotificationLogService } from '../notifications/notification-log.service';
import { oneLine } from '../common/utils/text.util';
import { toDateOnlyString } from '../common/utils/date.util';
import { formatReminderDate } from '../settings/reminder-template';
import { statusChatId } from '../telegram/dev-defaults';

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: 'Yangi ariza',
  confirmed: 'Tasdiqlandi',
  arrived: 'Keldi (qabulda)',
  'no-show': 'Kelmadi',
  completed: 'Yakunlandi',
  cancelled: 'Bekor qilindi',
};

const STATUS_ICONS: Record<string, string> = {
  pending: '🆕',
  confirmed: '✅',
  arrived: '🚪',
  'no-show': '🚫',
  completed: '🏁',
  cancelled: '❌',
};

export const FEEDBACK_CALLBACK_PREFIX = 'fb_';

export type StatusChange = {
  bookingId: string;
  from: string;
  to: string;
  reason?: string;
  actor: { id: string | null; name: string };
};

/**
 * Status-change audit log (who/when/why) + the two notifications it triggers:
 * the staff group (every status, with the admin's name) and the patient's
 * personal Telegram (confirmed / cancelled + reason / completed + rating
 * buttons). Plain text only; never throws.
 */
@Injectable()
export class BookingStatusService {
  private readonly logger = new Logger(BookingStatusService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: NotificationLogService,
  ) {}

  history(bookingId: string) {
    return this.prisma.bookingStatusLog.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /** Writes the log row, then queues Telegram messages. Never throws. */
  async onChanged(c: StatusChange): Promise<void> {
    const reason = c.reason?.trim() ? oneLine(c.reason, 300) : null;
    try {
      await this.prisma.bookingStatusLog.create({
        data: {
          bookingId: c.bookingId,
          fromStatus: c.from,
          toStatus: c.to,
          reason,
          changedById: c.actor.id,
          changedByName: oneLine(c.actor.name, 100),
        },
      });
    } catch (e) {
      this.logger.warn(`Status logini yozib bo'lmadi: ${errMsg(e)}`);
    }
    try {
      const ctx = await this.snapshot(c.bookingId);
      if (!ctx) return;
      await this.toGroup(
        'booking_status_group',
        ctx,
        formatGroupStatusMessage({
          to: c.to,
          from: c.from,
          patientName: ctx.patientName,
          phone: ctx.phone,
          doctor: ctx.doctor,
          when: ctx.when,
          reason,
          admin: oneLine(c.actor.name, 100),
        }),
      );
      const msg = formatClientStatusMessage(c.to, {
        doctor: ctx.doctor,
        when: ctx.when,
        reason,
      });
      if (msg) {
        await this.toPatient(
          'patient_status',
          ctx,
          msg,
          c.to === 'completed' ? feedbackKeyboard(c.bookingId) : undefined,
        );
      }
    } catch (e) {
      this.logger.warn(`Status xabarini yuborib bo'lmadi: ${errMsg(e)}`);
    }
  }

  /** New booking: staff group + (pending/confirmed) the patient. Never throws. */
  async onCreated(
    bookingId: string,
    actor?: { id: string | null; name: string },
  ): Promise<void> {
    try {
      const ctx = await this.snapshot(bookingId);
      if (!ctx) return;
      await this.toGroup(
        'booking_created_group',
        ctx,
        [
          '🆕 Yangi qabul yaratildi',
          `👤 ${ctx.patientName}`,
          `📞 ${ctx.phone}`,
          `🦷 ${ctx.doctor}`,
          `📅 ${ctx.when}`,
          `↔️ Holat: ${statusLabel(ctx.status)}`,
          actor ? `👨‍💼 Yaratdi: ${oneLine(actor.name, 100)}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      );
      if (ctx.status === 'pending' || ctx.status === 'confirmed') {
        await this.toPatient(
          'patient_booking_created',
          ctx,
          ctx.status === 'confirmed'
            ? `✅ Qabulingiz belgilandi.\n📅 ${ctx.when}\n🦷 Shifokor ${ctx.doctor} sizni kutmoqda.`
            : `📩 Arizangiz qabul qilindi.\n📅 ${ctx.when}\n🦷 Shifokor: ${ctx.doctor}\nAdministrator vaqtni tez orada tasdiqlaydi.`,
        );
      }
    } catch (e) {
      this.logger.warn(`Yangi qabul xabari yuborilmadi: ${errMsg(e)}`);
    }
  }

  /**
   * Date/time/doctor of an active booking changed. `notifyPatient=false` when
   * a status message (which already carries the new time) goes out instead.
   */
  async onRescheduled(c: {
    bookingId: string;
    previousWhen: string;
    actor: { id: string | null; name: string };
    notifyPatient: boolean;
  }): Promise<void> {
    try {
      const ctx = await this.snapshot(c.bookingId);
      if (!ctx) return;
      await this.toGroup(
        'booking_rescheduled_group',
        ctx,
        [
          '🔄 Qabul vaqti o‘zgartirildi',
          `👤 ${ctx.patientName}`,
          `📞 ${ctx.phone}`,
          `🦷 ${ctx.doctor}`,
          `📅 ${c.previousWhen} → ${ctx.when}`,
          `👨‍💼 O'zgartirdi: ${oneLine(c.actor.name, 100)}`,
        ].join('\n'),
      );
      if (c.notifyPatient) {
        await this.toPatient(
          'patient_rescheduled',
          ctx,
          `🔄 Qabulingiz vaqti o'zgartirildi.\n📅 Yangi vaqt: ${ctx.when}\n(avval: ${c.previousWhen})\n🦷 Shifokor: ${ctx.doctor}\nSavollar bo'lsa, klinikaga murojaat qiling.`,
        );
      }
    } catch (e) {
      this.logger.warn(`Ko'chirish xabari yuborilmadi: ${errMsg(e)}`);
    }
  }

  /**
   * A booking is hard-deleted (status logs cascade away): keep an audit line
   * in the application log + staff group, and tell the patient if the
   * booking was still active. `snap` must be taken BEFORE the delete.
   */
  async onDeleted(
    snap: BookingSnapshot | null,
    actor: { id: string | null; name: string },
  ): Promise<void> {
    if (!snap) return;
    this.logger.log(
      `Qabul o'chirildi: id=${snap.id} bemor=${snap.patientId} ${snap.when} holat=${snap.status} kim=${actor.id ?? '-'} (${oneLine(actor.name, 100)})`,
    );
    try {
      await this.toGroup(
        'booking_deleted_group',
        snap,
        [
          "🗑 Qabul o'chirildi",
          `👤 ${snap.patientName}`,
          `📞 ${snap.phone}`,
          `🦷 ${snap.doctor}`,
          `📅 ${snap.when}`,
          `↔️ Holat: ${statusLabel(snap.status)}`,
          `👨‍💼 O'chirdi: ${oneLine(actor.name, 100)}`,
        ].join('\n'),
      );
      if (
        (snap.status === 'pending' || snap.status === 'confirmed') &&
        snap.startsAt.getTime() > Date.now()
      ) {
        await this.toPatient(
          'patient_status',
          snap,
          `Afsuski, ${snap.when} dagi qabulingiz bekor qilindi.\nQayta yozilish uchun klinikaga murojaat qiling.`,
        );
      }
    } catch (e) {
      this.logger.warn(`O'chirish xabari yuborilmadi: ${errMsg(e)}`);
    }
  }

  /** Everything the messages need about a booking (null if it's gone). */
  async snapshot(bookingId: string): Promise<BookingSnapshot | null> {
    const b = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            telegramChatId: true,
            deletedAt: true,
          },
        },
        doctor: { select: { firstName: true, lastName: true } },
      },
    });
    if (!b) return null;
    return {
      id: b.id,
      status: b.status,
      patientId: b.patient.id,
      chatId: b.patient.deletedAt ? null : b.patient.telegramChatId,
      patientName: oneLine(`${b.patient.firstName} ${b.patient.lastName}`, 100),
      phone: oneLine(b.patient.phone, 30),
      doctor:
        oneLine(`${b.doctor.firstName} ${b.doctor.lastName}`, 100) ||
        'shifokor',
      when: `${formatReminderDate(toDateOnlyString(b.date))} ${b.time}`,
      startsAt: new Date(`${toDateOnlyString(b.date)}T${b.time}:00+05:00`),
    };
  }

  private async toGroup(kind: string, ctx: BookingSnapshot, text: string) {
    const groupChat = statusChatId();
    if (!groupChat) return;
    await this.outbox.enqueue({
      kind,
      chatId: groupChat,
      text,
      patientId: ctx.patientId,
    });
  }

  private async toPatient(
    kind: string,
    ctx: BookingSnapshot,
    text: string,
    replyMarkup?: Prisma.InputJsonValue,
  ) {
    if (!ctx.chatId) {
      this.logger.log(
        `Bemor ${ctx.patientId} Telegramga ulanmagan — "${kind}" xabari o'tkazib yuborildi`,
      );
      return;
    }
    await this.outbox.enqueue({
      kind,
      chatId: ctx.chatId,
      text,
      replyMarkup,
      patientId: ctx.patientId,
    });
  }
}

export type BookingSnapshot = {
  id: string;
  status: string;
  patientId: string;
  chatId: string | null;
  patientName: string;
  phone: string;
  doctor: string;
  /** `DD.MM.YYYY HH:mm` (clinic time). */
  when: string;
  startsAt: Date;
};

export function formatGroupStatusMessage(v: {
  to: string;
  from: string;
  patientName: string;
  phone: string;
  doctor: string;
  when: string;
  reason: string | null;
  admin: string;
}): string {
  const label = (s: string) => BOOKING_STATUS_LABELS[s] ?? oneLine(s, 30);
  const lines = [
    `${STATUS_ICONS[v.to] ?? '🔔'} Qabul holati: ${label(v.to)}`,
    `👤 ${v.patientName}`,
    `📞 ${v.phone}`,
    `🦷 ${v.doctor}`,
    `📅 ${v.when}`,
  ];
  if (v.to === 'cancelled')
    lines.push(`📝 Sabab: ${v.reason ?? "ko'rsatilmagan"}`);
  lines.push(
    `↔️ ${label(v.from)} → ${label(v.to)}`,
    `👨‍💼 O'zgartirdi: ${v.admin}`,
  );
  return lines.join('\n');
}

/** Patient-facing text; null for statuses the patient isn't told about. */
export function formatClientStatusMessage(
  to: string,
  v: { doctor: string; when: string; reason: string | null },
): string | null {
  switch (to) {
    case 'confirmed':
      return `✅ Sizning arizangiz tasdiqlandi.\n📅 ${v.when}\n🦷 Shifokor ${v.doctor} sizni kutmoqda.`;
    case 'cancelled':
      return `Afsuski, qabulingiz bekor qilindi.\nSababi: ${v.reason ?? "ko'rsatilmagan"}\nQayta yozilish uchun klinikaga murojaat qiling.`;
    case 'completed':
      return `Klinikamizga tashrif buyurganingiz uchun rahmat! 🦷\nIltimos, xizmatimizni baholang:`;
    default:
      return null;
  }
}

export function feedbackKeyboard(bookingId: string) {
  return {
    inline_keyboard: [
      [1, 2, 3, 4, 5].map((n) => ({
        text: `${n}⭐`,
        callback_data: `${FEEDBACK_CALLBACK_PREFIX}${bookingId}_${n}`,
      })),
    ],
  };
}

const statusLabel = (s: string) => BOOKING_STATUS_LABELS[s] ?? oneLine(s, 30);

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
