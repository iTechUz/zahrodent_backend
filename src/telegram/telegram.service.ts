import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Telegraf, Markup } from 'telegraf';
import { LeadsService } from '../leads/leads.service';

/** Max leads one Telegram user can create per window (spam guard). */
export const TELEGRAM_LEAD_LIMIT = 3;
export const TELEGRAM_LEAD_WINDOW_MS = 60 * 60 * 1000;

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
  private userStates = new Map<number, string>(); // simple state management
  private leadTimestamps = new Map<number, number[]>();

  constructor(private readonly leadsService: LeadsService) {}

  onModuleInit() {
    if (!isTelegramBotEnabled()) {
      this.logger.log("TELEGRAM_BOT_ENABLED=false — Telegram bot o'chirilgan.");
      return;
    }
    const token = process.env.TELEGRAM_BOT_TOKEN;
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

    // Webhook o'rniga hozircha long-polling ishlatamiz oson ishlashi uchun
    bot.launch().catch((err) => {
      this.launched = false;
      this.logger.error('Telegram bot launch error:', err);
    });
    this.logger.log('Telegram bot is running...');
  }

  onModuleDestroy() {
    if (!this.bot || !this.launched) return;
    try {
      this.bot.stop('shutdown');
    } catch (err) {
      // stop() throws if polling never actually started.
      this.logger.warn(`Telegram bot stop: ${String(err)}`);
    }
    this.launched = false;
  }

  /** Sliding-window limit per Telegram user; records the attempt if allowed. */
  private allowLead(telegramUserId: number, now = Date.now()): boolean {
    const recent = (this.leadTimestamps.get(telegramUserId) ?? []).filter(
      (t) => now - t < TELEGRAM_LEAD_WINDOW_MS,
    );
    if (recent.length >= TELEGRAM_LEAD_LIMIT) {
      this.leadTimestamps.set(telegramUserId, recent);
      return false;
    }
    recent.push(now);
    this.leadTimestamps.set(telegramUserId, recent);
    return true;
  }

  private async replyRateLimited(ctx: { reply: (t: string) => unknown }) {
    await ctx.reply(
      "Siz yaqinda bir nechta murojaat yubordingiz. Iltimos, birozdan so'ng qayta urinib ko'ring yoki klinikaga qo'ng'iroq qiling.",
    );
  }

  private registerCommands(bot: Telegraf) {
    bot.start((ctx) => {
      ctx.reply(
        `Zahro Dental klinikasiga xush kelibsiz, ${ctx.from.first_name}!\n\nIltimos, telefon raqamingizni yuboring:`,
        Markup.keyboard([
          Markup.button.contactRequest('📱 Telefon raqamni yuborish'),
        ])
          .resize()
          .oneTime(),
      );
    });

    bot.on('contact', async (ctx) => {
      const contact = ctx.message.contact;

      // Save contact info to session/state
      this.userStates.set(
        ctx.from.id,
        JSON.stringify({
          phone: contact.phone_number,
          name: contact.first_name,
        }),
      );

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

    bot.action(/service_(.+)/, async (ctx) => {
      const serviceType = ctx.match[1];
      const state = this.userStates.get(ctx.from.id);

      let serviceName = 'Boshqa';
      if (serviceType === 'consultation') serviceName = 'Konsultatsiya';
      if (serviceType === 'treatment') serviceName = 'Tish davolash';
      if (serviceType === 'whitening') serviceName = 'Tish oqartirish';
      if (serviceType === 'braces') serviceName = 'Breketlar';

      if (state) {
        const userData = JSON.parse(state);
        if (!this.allowLead(ctx.from.id)) {
          await this.replyRateLimited(ctx);
          return;
        }
        // Create lead in database
        try {
          await this.leadsService.create({
            name: userData.name || ctx.from.first_name,
            phone: userData.phone,
            service: serviceName,
            source: 'telegram_bot',
          });

          await ctx.reply(
            "Sizning murojaatingiz muvaffaqiyatli qabul qilindi. Tez orada ma'muriyatimiz siz bilan bog'lanadi!",
            Markup.removeKeyboard(),
          );
          this.userStates.delete(ctx.from.id);
        } catch (error) {
          this.logger.error('Error creating lead:', error);
          await ctx.reply(
            "Kechirasiz, xatolik yuz berdi. Iltimos keyinroq qayta urinib ko'ring.",
          );
        }
      } else {
        await ctx.reply("Iltimos, avval /start buyrug'ini bosing.");
      }
    });

    // Handle normal messages as 'other' requests if they already provided contact
    bot.on('text', async (ctx) => {
      const text = ctx.message.text;
      if (text.startsWith('/')) return; // ignore commands

      const state = this.userStates.get(ctx.from.id);
      if (state) {
        const userData = JSON.parse(state);
        if (!this.allowLead(ctx.from.id)) {
          await this.replyRateLimited(ctx);
          return;
        }
        try {
          await this.leadsService.create({
            name: userData.name || ctx.from.first_name,
            phone: userData.phone,
            message: text.slice(0, 2000),
            source: 'telegram_bot',
          });

          await ctx.reply(
            'Sizning xabaringiz va murojaatingiz qabul qilindi!',
            Markup.removeKeyboard(),
          );
          this.userStates.delete(ctx.from.id);
        } catch (error) {
          this.logger.error('Error creating lead:', error);
          await ctx.reply('Xatolik yuz berdi.');
        }
      }
    });
  }
}
