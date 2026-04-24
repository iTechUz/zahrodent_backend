import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Telegraf, Markup } from 'telegraf';
import { LeadsService } from '../leads/leads.service';

@Injectable()
export class TelegramService implements OnModuleInit {
  private bot: Telegraf;
  private readonly logger = new Logger(TelegramService.name);
  private userStates = new Map<number, string>(); // simple state management

  constructor(private readonly leadsService: LeadsService) {}

  onModuleInit() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN topilmadi. Telegram bot ishlamaydi.');
      return;
    }

    this.bot = new Telegraf(token);
    this.registerCommands();
    
    // Webhook o'rniga hozircha long-polling ishlatamiz oson ishlashi uchun
    this.bot.launch().catch(err => this.logger.error('Telegram bot launch error:', err));
    this.logger.log('Telegram bot is running...');
  }

  private registerCommands() {
    this.bot.start((ctx) => {
      ctx.reply(
        `Zahro Dental klinikasiga xush kelibsiz, ${ctx.from.first_name}!\n\nIltimos, telefon raqamingizni yuboring:`,
        Markup.keyboard([
          Markup.button.contactRequest('📱 Telefon raqamni yuborish'),
        ])
          .resize()
          .oneTime(),
      );
    });

    this.bot.on('contact', async (ctx) => {
      const contact = ctx.message.contact;
      
      // Save contact info to session/state
      this.userStates.set(ctx.from.id, JSON.stringify({ phone: contact.phone_number, name: contact.first_name }));

      await ctx.reply(
        'Rahmat! Endi qaysi xizmat bo\'yicha murojaat qilmoqchisiz?',
        Markup.inlineKeyboard([
          [Markup.button.callback('🦷 Konsultatsiya', 'service_consultation')],
          [Markup.button.callback('💉 Tish davolash', 'service_treatment')],
          [Markup.button.callback('😁 Tish oqartirish', 'service_whitening')],
          [Markup.button.callback('🔧 Breketlar / Eleynerlar', 'service_braces')],
          [Markup.button.callback('Boshqa', 'service_other')],
        ]),
      );
    });

    this.bot.action(/service_(.+)/, async (ctx) => {
      const serviceType = ctx.match[1];
      const state = this.userStates.get(ctx.from.id);
      
      let serviceName = 'Boshqa';
      if (serviceType === 'consultation') serviceName = 'Konsultatsiya';
      if (serviceType === 'treatment') serviceName = 'Tish davolash';
      if (serviceType === 'whitening') serviceName = 'Tish oqartirish';
      if (serviceType === 'braces') serviceName = 'Breketlar';

      if (state) {
        const userData = JSON.parse(state);
        // Create lead in database
        try {
          await this.leadsService.create({
            name: userData.name || ctx.from.first_name,
            phone: userData.phone,
            service: serviceName,
            source: 'telegram_bot'
          });
          
          await ctx.reply('Sizning murojaatingiz muvaffaqiyatli qabul qilindi. Tez orada ma\'muriyatimiz siz bilan bog\'lanadi!', Markup.removeKeyboard());
          this.userStates.delete(ctx.from.id);
        } catch (error) {
          this.logger.error('Error creating lead:', error);
          await ctx.reply('Kechirasiz, xatolik yuz berdi. Iltimos keyinroq qayta urinib ko\'ring.');
        }
      } else {
        await ctx.reply('Iltimos, avval /start buyrug\'ini bosing.');
      }
    });

    // Handle normal messages as 'other' requests if they already provided contact
    this.bot.on('text', async (ctx) => {
      const text = ctx.message.text;
      if (text.startsWith('/')) return; // ignore commands
      
      const state = this.userStates.get(ctx.from.id);
      if (state) {
        const userData = JSON.parse(state);
        try {
          await this.leadsService.create({
            name: userData.name || ctx.from.first_name,
            phone: userData.phone,
            message: text,
            source: 'telegram_bot'
          });
          
          await ctx.reply('Sizning xabaringiz va murojaatingiz qabul qilindi!', Markup.removeKeyboard());
          this.userStates.delete(ctx.from.id);
        } catch (error) {
           await ctx.reply('Xatolik yuz berdi.');
        }
      }
    });
  }
}
