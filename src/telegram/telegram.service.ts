import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Telegraf, Markup } from 'telegraf';
import { LeadsService } from '../leads/leads.service';
import { PatientsRepository } from '../patients/patients.repository';
import { TelegramBotRegistry } from './telegram-bot.registry';
import { normalizeUzPhone } from '../common/utils/phone.util';
import { PrismaService } from '../database/prisma.service';
import { RemindersService } from '../notifications/reminders.service';
import { NotificationLogService } from '../notifications/notification-log.service';
import { oneLine } from '../common/utils/text.util';
import { formatReminderDate } from '../settings/reminder-template';
import { toDateOnlyString } from '../common/utils/date.util';
import { statusChatId, telegramBotToken } from './dev-defaults';

/** Max leads one Telegram user can create per window (spam guard). */
export const TELEGRAM_LEAD_LIMIT = 3;
export const TELEGRAM_LEAD_WINDOW_MS = 60 * 60 * 1000;
/** An abandoned conversation (shared contact, never picked a service) is forgotten after this. */
export const TELEGRAM_STATE_TTL_MS = 30 * 60 * 1000;

type FlowState = { phone: string; name: string; chatId: number; at: number };

/** TELEGRAM_BOT_ENABLED=false|0|no|off disables polling (default: on). */
export function isTelegramBotEnabled(): boolean {
  const v = process.env.TELEGRAM_BOT_ENABLED?.trim().toLowerCase();
  return !(v === 'false' || v === '0' || v === 'no' || v === 'off');
}

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private bot: Telegraf | null = null;
  private launched = false;
  private readonly logger = new Logger(TelegramService.name);
  private userStates = new Map<number, FlowState>(); // simple state management
  private leadTimestamps = new Map<number, number[]>();

  constructor(
    private readonly leadsService: LeadsService,
    private readonly patientsRepository: PatientsRepository,
    private readonly registry: TelegramBotRegistry,
    private readonly prisma?: PrismaService,
    private readonly reminders?: RemindersService,
    private readonly outbox?: NotificationLogService,
  ) {}

  onModuleInit() {
    if (!isTelegramBotEnabled()) {
      this.logger.log("TELEGRAM_BOT_ENABLED=false — Telegram bot o'chirilgan.");
      return;
    }
    const token = telegramBotToken();
    if (!token) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN topilmadi. Telegram bot ishlamaydi.',
      );
      return;
    }
    // Guard against a second launch in the same process (two long-pollers
    // on one token → Telegram 409 Conflict).
    if (this.launched) return;
    this.launched = true;

    const bot = new Telegraf(token);
    this.bot = bot;
    this.registerCommands(bot);
    // Reminders are sent through this bot while it runs.
    this.registry.register(bot.telegram);

    // Webhook o'rniga hozircha long-polling ishlatamiz oson ishlashi uchun
    bot
      .launch()
      .then(() => {
        // launch() resolves only when polling ends; unless we are shutting
        // down (launched=false) that means it stopped on its own.
        if (this.launched) {
          this.registry.reportFailure('polling stopped');
          this.logger.error('Telegram polling stopped unexpectedly');
        }
      })
      .catch((err) => {
        this.launched = false;
        this.registry.register(null);
        // 409 Conflict (second poller), bad token, network at startup…
        this.registry.reportFailure(
          err instanceof Error ? err.message : String(err),
        );
        this.logger.error('Telegram bot launch error:', err);
      });
    this.logger.log('Telegram bot is running...');
  }

  onModuleDestroy() {
    this.registry.register(null);
    if (!this.bot || !this.launched) return;
    this.launched = false;
    try {
      this.bot.stop('shutdown');
    } catch (err) {
      // stop() throws if polling never actually started.
      this.logger.warn(`Telegram bot stop: ${String(err)}`);
    }
  }

  /**
   * Stores the chat id on every non-deleted patient with this phone. Never
   * throws — linking must not break the lead flow.
   */
  private async linkPatientChat(rawPhone: string, chatId: number) {
    const phone = normalizeUzPhone(rawPhone);
    if (!phone) return;
    try {
      const matches =
        await this.patientsRepository.findActiveIdsByMobile(phone);
      const n = await this.patientsRepository.setTelegramChatId(
        matches.map((m) => m.id),
        String(chatId),
      );
      if (n) this.logger.log(`Telegram chat ${n} ta bemor kartasiga bog'landi`);
      // Same for the person's applications (status updates), still only their own contact.
      if (this.prisma) {
        const l = await this.prisma.lead.updateMany({
          where: { phone },
          data: { telegramChatId: String(chatId) },
        });
        if (l.count)
          this.logger.log(`Telegram chat ${l.count} ta arizaga bog'landi`);
      }
    } catch (err) {
      this.logger.warn(
        `Bemorni Telegram chatga bog'lashda xato: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Stores a patient's 1..5 rating for a completed booking. Only the chat
   * linked to that booking's patient may rate (callback data is guessable by
   * anyone who sees a booking id), and only once.
   */
  async saveFeedback(
    chatId: number | string,
    bookingId: string,
    rating: number,
  ): Promise<'saved' | 'already' | 'denied'> {
    if (!this.prisma || !(rating >= 1 && rating <= 5)) return 'denied';
    const b = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        status: true,
        feedbackRating: true,
        date: true,
        time: true,
        patientId: true,
        patient: {
          select: {
            telegramChatId: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        doctor: { select: { firstName: true, lastName: true } },
      },
    });
    if (
      !b ||
      b.status !== 'completed' ||
      !b.patient.telegramChatId ||
      b.patient.telegramChatId !== String(chatId)
    ) {
      return 'denied';
    }
    if (b.feedbackRating != null) return 'already';
    const r = await this.prisma.booking.updateMany({
      where: { id: bookingId, feedbackRating: null },
      data: { feedbackRating: rating, feedbackAt: new Date() },
    });
    if (!r.count) return 'already';
    if (rating <= 3) await this.alertLowRating(bookingId, rating, b);
    return 'saved';
  }

  /** Low ratings (1-3) are pushed to the staff group so someone follows up. */
  private async alertLowRating(
    bookingId: string,
    rating: number,
    b: {
      date: Date;
      time: string;
      patientId: string;
      patient: { firstName: string; lastName: string; phone: string };
      doctor: { firstName: string; lastName: string };
    },
  ) {
    const group = statusChatId();
    if (!group || !this.outbox) return;
    await this.outbox.enqueue({
      kind: 'feedback_low_group',
      chatId: group,
      text: [
        `⭐ Past baho: ${rating}/5`,
        `👤 ${oneLine(`${b.patient.firstName} ${b.patient.lastName}`, 100)}`,
        `📞 ${oneLine(b.patient.phone, 30)}`,
        `🦷 ${oneLine(`${b.doctor.firstName} ${b.doctor.lastName}`, 100)}`,
        `📅 ${formatReminderDate(toDateOnlyString(b.date))} ${b.time}`,
        `Qabul: ${bookingId}`,
      ].join('\n'),
      patientId: b.patientId,
    });
  }

  /** Remembers the shared (own) contact; also drops abandoned conversations. */
  private setState(
    userId: number,
    st: Omit<FlowState, 'at'>,
    now = Date.now(),
  ) {
    for (const [id, v] of this.userStates) {
      if (now - v.at >= TELEGRAM_STATE_TTL_MS) this.userStates.delete(id);
    }
    this.userStates.set(userId, { ...st, at: now });
  }

  /** The live (not expired) state, without removing it. */
  private getState(userId: number, now = Date.now()): FlowState | undefined {
    const v = this.userStates.get(userId);
    if (!v) return undefined;
    if (now - v.at >= TELEGRAM_STATE_TTL_MS) {
      this.userStates.delete(userId);
      return undefined;
    }
    return v;
  }

  /** Takes the state out (a double tap can't create two leads); put it back on failure. */
  private takeState(userId: number): FlowState | undefined {
    const v = this.getState(userId);
    this.userStates.delete(userId);
    return v;
  }

  /** Sliding-window limit per Telegram user: has the user room for one more CREATED lead? */
  private leadAllowed(telegramUserId: number, now = Date.now()): boolean {
    const recent = (this.leadTimestamps.get(telegramUserId) ?? []).filter(
      (t) => now - t < TELEGRAM_LEAD_WINDOW_MS,
    );
    if (recent.length) this.leadTimestamps.set(telegramUserId, recent);
    else this.leadTimestamps.delete(telegramUserId);
    return recent.length < TELEGRAM_LEAD_LIMIT;
  }

  /** Counts a lead that was really created (failed attempts don't count). */
  private recordLead(telegramUserId: number, now = Date.now()) {
    const recent = (this.leadTimestamps.get(telegramUserId) ?? []).filter(
      (t) => now - t < TELEGRAM_LEAD_WINDOW_MS,
    );
    recent.push(now);
    this.leadTimestamps.set(telegramUserId, recent);
  }

  private async replyRateLimited(ctx: { reply: (t: string) => unknown }) {
    await ctx.reply(
      "Siz yaqinda bir nechta murojaat yubordingiz. Iltimos, birozdan so'ng qayta urinib ko'ring yoki klinikaga qo'ng'iroq qiling.",
    );
  }

  /** Stops the button spinner; a stale/odd callback must never throw. */
  private async ack(
    ctx: { answerCbQuery?: (t?: string) => unknown },
    t?: string,
  ) {
    try {
      await ctx.answerCbQuery?.(t);
    } catch {
      /* ignore */
    }
  }

  private async clinicInfo(): Promise<string> {
    let row: {
      clinicName: string;
      phone: string;
      address: string;
      workingHours: string;
    } | null = null;
    try {
      row =
        (await this.prisma?.clinicSettings?.findUnique({
          where: { id: 1 },
        })) ?? null;
    } catch {
      row = null;
    }
    return [
      `🦷 ${oneLine(row?.clinicName || 'Zahro Dental', 100)}`,
      row?.address && `📍 ${oneLine(row.address, 200)}`,
      row?.workingHours && `🕒 ${oneLine(row.workingHours, 100)}`,
      row?.phone && `📞 ${oneLine(row.phone, 30)}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private askContact(
    ctx: { reply: (t: string, extra?: unknown) => unknown },
    text: string,
  ) {
    return ctx.reply(
      text,
      Markup.keyboard([
        Markup.button.contactRequest('📱 Telefon raqamni yuborish'),
      ])
        .resize()
        .oneTime(),
    );
  }

  /** Files the lead for the user's remembered OWN contact; shared by the service buttons and free text. */
  private async submitLead(
    ctx: {
      from: { id: number; first_name: string };
      reply: (t: string, extra?: unknown) => unknown;
    },
    details: { service?: string; message?: string },
    okText: string,
    errText: string,
  ) {
    const state = this.takeState(ctx.from.id);
    if (!state) {
      await ctx.reply(
        'Murojaatingiz muddati tugagan yoki boshlanmagan. Iltimos, qayta /start bosing.',
      );
      return;
    }
    if (!this.leadAllowed(ctx.from.id)) {
      this.userStates.set(ctx.from.id, state);
      await this.replyRateLimited(ctx);
      return;
    }
    try {
      await this.leadsService.create({
        name: state.name || ctx.from.first_name,
        phone: state.phone,
        ...details,
        source: 'telegram_bot',
        // Own contact only (checked when it was shared) → status updates reach this chat.
        telegramChatId: String(state.chatId),
      });
      this.recordLead(ctx.from.id);
      await ctx.reply(okText, Markup.removeKeyboard());
    } catch (error) {
      this.logger.error('Error creating lead:', error);
      // Keep the conversation so the user can simply try again.
      this.userStates.set(ctx.from.id, state);
      await ctx.reply(errText);
    }
  }

  private registerCommands(bot: Telegraf) {
    // Staff helper: shows the chat id to put into TELEGRAM_STATUS_CHAT_ID (groups only).
    bot.command('chatid', (ctx) => {
      if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') return;
      return ctx.reply(`Chat ID: ${ctx.chat.id}`);
    });

    bot.command('help', async (ctx) => {
      await ctx.reply(
        `${await this.clinicInfo()}\n\nMurojaat qoldirish: /start bosing, telefon raqamingizni yuboring va xizmatni tanlang (yoki xabar yozing). Administrator siz bilan bog'lanadi.\nBekor qilish: /cancel`,
      );
    });

    bot.command('cancel', async (ctx) => {
      this.userStates.delete(ctx.from.id);
      await ctx.reply(
        'Bekor qilindi. Qayta boshlash uchun /start bosing.',
        Markup.removeKeyboard(),
      );
    });

    // Plain /start and a deep link (?start=lead) run the same flow.
    bot.start(async (ctx) => {
      this.userStates.delete(ctx.from.id);
      await this.askContact(
        ctx,
        `Zahro Dental klinikasiga xush kelibsiz, ${ctx.from.first_name}!\n\nIltimos, telefon raqamingizni yuboring:`,
      );
    });

    bot.on('contact', async (ctx) => {
      const contact = ctx.message.contact;

      // Only the user's OWN contact is trusted: a request must never be filed
      // for (or linked to the chat of) somebody else's number.
      if (contact.user_id === undefined || contact.user_id !== ctx.from.id) {
        await this.askContact(
          ctx,
          "Iltimos, o'zingizning telefon raqamingizni yuboring (pastdagi tugma orqali). Boshqa odamning kontakti qabul qilinmaydi.",
        );
        return;
      }
      await this.linkPatientChat(contact.phone_number, ctx.chat.id);

      this.setState(ctx.from.id, {
        phone: contact.phone_number,
        name: contact.first_name,
        chatId: ctx.chat.id,
      });

      await ctx.reply(
        "Rahmat! Endi qaysi xizmat bo'yicha murojaat qilmoqchisiz?",
        Markup.inlineKeyboard([
          [Markup.button.callback('🦷 Konsultatsiya', 'service_consultation')],
          [Markup.button.callback('💉 Tish davolash', 'service_treatment')],
          [Markup.button.callback('😁 Tish oqartirish', 'service_whitening')],
          [
            Markup.button.callback(
              '🔧 Breketlar / Eleynerlar',
              'service_braces',
            ),
          ],
          [Markup.button.callback('Boshqa', 'service_other')],
        ]),
      );
    });

    bot.action(/^fb_(.+)_([1-5])$/, async (ctx) => {
      try {
        const r = await this.saveFeedback(
          ctx.chat?.id ?? ctx.from.id,
          ctx.match[1],
          Number(ctx.match[2]),
        );
        await ctx.answerCbQuery(
          r === 'saved'
            ? 'Rahmat! Fikringiz qabul qilindi 🙏'
            : r === 'already'
              ? 'Siz allaqachon baho bergansiz'
              : 'Bu tugma siz uchun emas',
        );
        if (r === 'saved') await ctx.editMessageReplyMarkup(undefined);
      } catch (err) {
        this.logger.warn(`Feedback xatosi: ${String(err)}`);
      }
    });

    bot.action(/^rem_(ok|re)_(.+)$/, async (ctx) => {
      try {
        const r = await this.reminders?.handleAnswer(
          ctx.chat?.id ?? ctx.from.id,
          ctx.match[2],
          ctx.match[1] === 'ok' ? 'confirm' : 'reschedule',
        );
        await ctx.answerCbQuery(
          r === 'confirmed'
            ? 'Rahmat! Qabulingiz tasdiqlandi ✅'
            : r === 'reschedule'
              ? "Ariza qabul qilindi — administrator siz bilan bog'lanadi"
              : r === 'already'
                ? 'Javobingiz allaqachon qabul qilingan'
                : 'Bu tugma endi amal qilmaydi',
          { show_alert: r === 'reschedule' },
        );
        if (r === 'confirmed' || r === 'reschedule') {
          await ctx.editMessageReplyMarkup(undefined);
        }
      } catch (err) {
        this.logger.warn(`Eslatma javobi xatosi: ${String(err)}`);
      }
    });

    bot.action(/^service_(.+)/, async (ctx) => {
      const serviceType = ctx.match[1];
      await this.ack(ctx);

      let serviceName = 'Boshqa';
      if (serviceType === 'consultation') serviceName = 'Konsultatsiya';
      if (serviceType === 'treatment') serviceName = 'Tish davolash';
      if (serviceType === 'whitening') serviceName = 'Tish oqartirish';
      if (serviceType === 'braces') serviceName = 'Breketlar';

      await this.submitLead(
        ctx,
        { service: serviceName },
        "Sizning murojaatingiz muvaffaqiyatli qabul qilindi. Tez orada ma'muriyatimiz siz bilan bog'lanadi!",
        "Kechirasiz, xatolik yuz berdi. Iltimos keyinroq qayta urinib ko'ring.",
      );
    });

    // Handle normal messages as 'other' requests if they already provided contact
    bot.on('text', async (ctx) => {
      const text = ctx.message.text;
      if (text.startsWith('/')) return; // ignore commands

      if (this.getState(ctx.from.id)) {
        await this.submitLead(
          ctx,
          { message: text.slice(0, 2000) },
          'Sizning xabaringiz va murojaatingiz qabul qilindi!',
          'Xatolik yuz berdi.',
        );
      } else {
        await ctx.reply(
          "Murojaat qoldirish uchun /start buyrug'ini bosing va telefon raqamingizni yuboring (so'rovingiz muddati tugagan bo'lsa, qayta /start bosing).",
        );
      }
    });

    // Never let a handler error (e.g. an expired callback) kill the poller.
    bot.catch((err) => {
      this.logger.warn(`Telegram handler xatosi: ${String(err)}`);
    });
  }
}
