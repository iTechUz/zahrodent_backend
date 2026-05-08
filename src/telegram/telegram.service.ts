import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Telegraf, Markup } from 'telegraf';
import { LeadsService } from '../leads/leads.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TelegramService implements OnModuleInit {
  private bots = new Map<string, Telegraf>();
  private readonly logger = new Logger(TelegramService.name);
  private userStates = new Map<string, string>(); // Format: `${branchId}_${userId}` -> JSON state

  constructor(
    private readonly leadsService: LeadsService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    this.logger.log('Starting dynamic Telegram bots initialization...');
    const branches = await this.prisma.branch.findMany({
      where: { telegramBotToken: { not: null }, isActive: true, deletedAt: null },
      select: { id: true, telegramBotToken: true, name: true },
    });

    for (const branch of branches) {
      if (branch.telegramBotToken && branch.telegramBotToken.trim() !== '') {
        await this.startBot(branch.id, branch.telegramBotToken, branch.name);
      }
    }
  }

  async updateBot(branchId: string, token: string | null | undefined, branchName: string) {
    // Stop existing bot if running
    const existingBot = this.bots.get(branchId);
    if (existingBot) {
      this.logger.log(`Stopping bot for branch ${branchName}...`);
      existingBot.stop('Settings changed');
      this.bots.delete(branchId);
    }

    if (token) {
      await this.startBot(branchId, token, branchName);
    }
  }

  private async startBot(branchId: string, token: string, branchName: string) {
    try {
      const bot = new Telegraf(token);
      this.registerCommands(bot, branchId, branchName);
      
      // We use catch to prevent one faulty token from bringing down the whole app
      bot.launch().catch(err => {
        this.logger.error(`Failed to launch bot for branch ${branchName}:`, err);
      });
      
      this.bots.set(branchId, bot);
      this.logger.log(`Telegram bot started successfully for branch: ${branchName}`);
    } catch (err) {
      this.logger.error(`Error initializing bot for branch ${branchName}:`, err);
    }
  }

  private registerCommands(bot: Telegraf, branchId: string, branchName: string) {
    bot.start((ctx) => {
      ctx.reply(
        `${branchName} klinikasiga xush kelibsiz, ${ctx.from.first_name}!\n\nIltimos, telefon raqamingizni yuboring:`,
        Markup.keyboard([
          Markup.button.contactRequest('📱 Telefon raqamni yuborish'),
        ])
          .resize()
          .oneTime(),
      );
    });

    bot.on('contact', async (ctx) => {
      const contact = ctx.message.contact;
      const stateKey = `${branchId}_${ctx.from.id}`;
      
      this.userStates.set(stateKey, JSON.stringify({ phone: contact.phone_number, name: contact.first_name }));

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

    bot.action(/service_(.+)/, async (ctx) => {
      const serviceType = ctx.match[1];
      const stateKey = `${branchId}_${ctx.from.id}`;
      const state = this.userStates.get(stateKey);
      
      let serviceName = 'Boshqa';
      if (serviceType === 'consultation') serviceName = 'Konsultatsiya';
      if (serviceType === 'treatment') serviceName = 'Tish davolash';
      if (serviceType === 'whitening') serviceName = 'Tish oqartirish';
      if (serviceType === 'braces') serviceName = 'Breketlar';

      if (state) {
        const userData = JSON.parse(state);
        try {
          await this.leadsService.create({
            name: userData.name || ctx.from.first_name,
            phone: userData.phone,
            service: serviceName,
            source: 'telegram_bot',
            branchId, // inject the correct branchId
          });
          
          await ctx.reply('Sizning murojaatingiz muvaffaqiyatli qabul qilindi. Tez orada ma\'muriyatimiz siz bilan bog\'lanadi!', Markup.removeKeyboard());
          this.userStates.delete(stateKey);
        } catch (error) {
          this.logger.error('Error creating lead:', error);
          await ctx.reply('Kechirasiz, xatolik yuz berdi. Iltimos keyinroq qayta urinib ko\'ring.');
        }
      } else {
        await ctx.reply('Iltimos, avval /start buyrug\'ini bosing.');
      }
    });

    bot.on('text', async (ctx) => {
      const text = ctx.message.text;
      if (text.startsWith('/')) return;
      
      const stateKey = `${branchId}_${ctx.from.id}`;
      const state = this.userStates.get(stateKey);
      
      if (state) {
        const userData = JSON.parse(state);
        try {
          await this.leadsService.create({
            name: userData.name || ctx.from.first_name,
            phone: userData.phone,
            message: text,
            source: 'telegram_bot',
            branchId, // inject the correct branchId
          });
          
          await ctx.reply('Sizning xabaringiz va murojaatingiz qabul qilindi!', Markup.removeKeyboard());
          this.userStates.delete(stateKey);
        } catch (error) {
           await ctx.reply('Xatolik yuz berdi.');
        }
      }
    });
  }
}
