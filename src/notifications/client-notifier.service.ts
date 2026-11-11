import { Injectable, Logger } from '@nestjs/common';
import { Lead } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PatientsRepository } from '../patients/patients.repository';
import { normalizeUzPhone } from '../common/utils/phone.util';
import { oneLine } from '../common/utils/text.util';
import { EskizService } from './eskiz.service';
import { NotificationLogService } from './notification-log.service';

export { oneLine };

/**
 * Messages to the client personally. A phone is only ever mapped to a Telegram
 * chat through `patients.telegram_chat_id`, which the bot sets only when the
 * user shares THEIR OWN contact (contact.user_id === from.id). Phone alone is
 * never enough to reach a chat, and messages carry no free-text typed by a
 * third party (no name/note) — a stranger entering someone's number on the
 * website cannot make the clinic bot relay text to that person.
 */
@Injectable()
export class ClientNotifierService {
  private readonly logger = new Logger(ClientNotifierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly patients: PatientsRepository,
    private readonly outbox: NotificationLogService,
    private readonly eskiz: EskizService,
  ) {}

  /** Verified Telegram chat id for this phone (patient card first, then a lead), or null. */
  async findChatId(rawPhone: string): Promise<string | null> {
    const phone = normalizeUzPhone(rawPhone);
    if (!phone) return null;
    const ids = (await this.patients.findActiveIdsByMobile(phone)).map(
      (p) => p.id,
    );
    if (ids.length) {
      const p = await this.prisma.patient.findFirst({
        where: { id: { in: ids }, telegramChatId: { not: null } },
        select: { telegramChatId: true },
      });
      if (p?.telegramChatId) return p.telegramChatId;
    }
    const l = await this.prisma.lead.findFirst({
      where: { phone, telegramChatId: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { telegramChatId: true },
    });
    return l?.telegramChatId ?? null;
  }

  /** `https://t.me/<bot>?start=lead` or null when the bot name isn't set. */
  botDeepLink(): string | null {
    const name = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, '');
    return name && /^[A-Za-z0-9_]{3,64}$/.test(name)
      ? `https://t.me/${name}?start=lead`
      : null;
  }

  /**
   * "Qabulga yozildingiz": Telegram when the phone is linked to the bot,
   * otherwise an SMS carrying the bot deep link. Never throws.
   */
  async notifyLeadReceived(lead: Lead): Promise<'telegram' | 'sms' | 'none'> {
    try {
      const when = [lead.preferredAt, lead.doctor && `Shifokor: ${lead.doctor}`]
        .filter(Boolean)
        .map((v) => oneLine(v, 100))
        .join('\n');
      const chatId = await this.findChatId(lead.phone);
      if (chatId) {
        const text = [
          '✅ Zahro Dental: siz qabulga yozildingiz.',
          when && `📅 ${when}`,
          "Administrator tez orada siz bilan bog'lanib vaqtni tasdiqlaydi.",
        ]
          .filter(Boolean)
          .join('\n');
        await this.outbox.enqueue({
          kind: 'patient_lead_received',
          chatId,
          text,
          leadId: lead.id,
        });
        return 'telegram';
      }
      const mobile = this.eskiz.isConfigured()
        ? this.eskiz.normalizeMobile(lead.phone)
        : null;
      if (!mobile) return 'none';
      const link = this.botDeepLink();
      const sms = [
        "Zahro Dental: arizangiz qabul qilindi, administrator siz bilan bog'lanadi.",
        link && `Telegramda eslatma olish: ${link}`,
      ]
        .filter(Boolean)
        .join(' ');
      const r = await this.eskiz.sendSms(mobile, sms);
      if (!r.ok) this.logger.warn('Lead tasdiq SMS yuborilmadi');
      return r.ok ? 'sms' : 'none';
    } catch (e) {
      this.logger.warn(
        `Mijozga tasdiq yuborilmadi: ${e instanceof Error ? e.message : String(e)}`,
      );
      return 'none';
    }
  }

  /**
   * "Your application moved to <status>" — to the lead's linked Telegram chat only
   * (no SMS: the bot link was already offered on submit). Fixed texts, no user input.
   * Never throws.
   */
  async notifyLeadStatus(lead: Lead, status: string): Promise<boolean> {
    try {
      const text = LEAD_STATUS_TEXTS[status];
      if (!text) return false;
      const chatId = lead.telegramChatId ?? (await this.findChatId(lead.phone));
      if (!chatId) return false;
      await this.outbox.enqueue({
        kind: 'patient_lead_status',
        chatId,
        text,
        leadId: lead.id,
      });
      return true;
    } catch (e) {
      this.logger.warn(
        `Ariza holati xabari yuborilmadi: ${e instanceof Error ? e.message : String(e)}`,
      );
      return false;
    }
  }
}

/** Client-facing text per lead status ("new" is the initial state — no message). */
export const LEAD_STATUS_TEXTS: Record<string, string> = {
  contacted:
    "📞 Zahro Dental: arizangiz ko'rib chiqilmoqda, administrator siz bilan bog'lanadi.",
  consultation:
    '🩺 Zahro Dental: konsultatsiya uchun vaqt kelishilmoqda. Administrator xabar beradi.',
  proposal:
    '📝 Zahro Dental: siz uchun davolash taklifi tayyorlandi. Administrator batafsil aytib beradi.',
  converted:
    "✅ Zahro Dental: arizangiz tasdiqlandi, siz klinikamizda ro'yxatga olindingiz. Qabul eslatmalarini shu yerda olasiz.",
  cancelled:
    "ℹ️ Zahro Dental: arizangiz yopildi. Savollaringiz bo'lsa, bizga yozing yoki qayta ariza qoldiring.",
};
