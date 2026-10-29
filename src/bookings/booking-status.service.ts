import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationLogService } from '../notifications/notification-log.service';
import { oneLine } from '../notifications/client-notifier.service';
import { toDateOnlyString } from '../common/utils/date.util';

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
      const b = await this.prisma.booking.findUnique({
        where: { id: c.bookingId },
        include: {
          patient: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
              telegramChatId: true,
              id: true,
            },
          },
          doctor: { select: { firstName: true, lastName: true } },
        },
      });
      if (!b) return;
      const doctor =
        oneLine(`${b.doctor.firstName} ${b.doctor.lastName}`, 100) ||
        'shifokor';
      const when = `${toDateOnlyString(b.date)} ${b.time}`;
      const patientName = oneLine(
        `${b.patient.firstName} ${b.patient.lastName}`,
        100,
      );

      const groupChat = (
        process.env.TELEGRAM_STATUS_CHAT_ID ||
        process.env.TELEGRAM_LEADS_CHAT_ID
      )?.trim();
      if (groupChat) {
        await this.outbox.enqueue({
          kind: 'booking_status_group',
          chatId: groupChat,
          text: formatGroupStatusMessage({
            to: c.to,
            from: c.from,
            patientName,
            phone: oneLine(b.patient.phone, 30),
            doctor,
            when,
            reason,
            admin: oneLine(c.actor.name, 100),
          }),
          patientId: b.patient.id,
        });
      }

      const chatId = b.patient.telegramChatId;
      const msg = chatId
        ? formatClientStatusMessage(c.to, { doctor, when, reason })
        : null;
      if (chatId && msg) {
        await this.outbox.enqueue({
          kind: 'patient_status',
          chatId,
          text: msg,
          replyMarkup:
            c.to === 'completed' ? feedbackKeyboard(c.bookingId) : undefined,
          patientId: b.patient.id,
        });
      }
    } catch (e) {
      this.logger.warn(`Status xabarini yuborib bo'lmadi: ${errMsg(e)}`);
    }
  }
}

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

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
