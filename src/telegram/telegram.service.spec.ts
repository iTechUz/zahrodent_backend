import { Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { LeadsService } from '../leads/leads.service';
import { PatientsRepository } from '../patients/patients.repository';
import { TelegramBotRegistry } from './telegram-bot.registry';

type Handler = (ctx: any) => unknown;

const handlers: {
  start?: Handler;
  chatid?: Handler;
  commands: Record<string, Handler>;
  on: Record<string, Handler>;
  action?: { re: RegExp; fn: Handler };
  catch?: (err: unknown) => void;
} = { on: {}, commands: {} };
const launch = jest.fn();
const stop = jest.fn();
const ctorArgs: string[] = [];

jest.mock('telegraf', () => {
  class FakeTelegraf {
    telegram = { sendMessage: jest.fn(), getMe: jest.fn() };
    constructor(token: string) {
      ctorArgs.push(token);
    }
    command(name: string, fn: Handler) {
      handlers.commands[name] = fn;
      if (name === 'chatid') handlers.chatid = fn;
    }
    start(fn: Handler) {
      handlers.start = fn;
    }
    on(event: string, fn: Handler) {
      handlers.on[event] = fn;
    }
    action(re: RegExp, fn: Handler) {
      handlers.action = { re, fn };
    }
    catch(fn: (err: unknown) => void) {
      handlers.catch = fn;
    }
    launch() {
      return launch();
    }
    stop(reason?: string) {
      return stop(reason);
    }
  }
  const chain = () => {
    const o: any = { resize: () => o, oneTime: () => o };
    return o;
  };
  return {
    Telegraf: FakeTelegraf,
    Markup: {
      keyboard: jest.fn(() => chain()),
      inlineKeyboard: jest.fn((rows: unknown) => ({ inline: rows })),
      removeKeyboard: jest.fn(() => ({ remove: true })),
      button: {
        contactRequest: jest.fn((t: string) => ({ contact: t })),
        callback: jest.fn((t: string, d: string) => ({ t, d })),
      },
    },
  };
});

describe('TelegramService', () => {
  const savedToken = process.env.TELEGRAM_BOT_TOKEN;
  let leads: jest.Mocked<Pick<LeadsService, 'create'>>;
  let patients: {
    findActiveIdsByMobile: jest.Mock;
    setTelegramChatId: jest.Mock;
  };
  let registry: TelegramBotRegistry;
  let service: TelegramService;
  const make = () =>
    new TelegramService(
      leads as unknown as LeadsService,
      patients as unknown as PatientsRepository,
      registry,
    );
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const ctx = (extra: Record<string, unknown> = {}) => ({
    from: { id: 42, first_name: 'Ali' },
    reply: jest.fn().mockResolvedValue(undefined),
    ...extra,
  });

  beforeEach(() => {
    handlers.start = undefined;
    handlers.chatid = undefined;
    handlers.commands = {};
    handlers.on = {};
    handlers.action = undefined;
    ctorArgs.length = 0;
    launch.mockReset().mockResolvedValue(undefined);
    stop.mockReset();
    delete process.env.TELEGRAM_BOT_ENABLED;
    leads = { create: jest.fn().mockResolvedValue({ id: 'l1' } as any) };
    patients = {
      findActiveIdsByMobile: jest.fn().mockResolvedValue([{ id: 'p1' }]),
      setTelegramChatId: jest.fn().mockResolvedValue(1),
    };
    registry = new TelegramBotRegistry();
    service = make();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    if (savedToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = savedToken;
    jest.restoreAllMocks();
  });

  it('token yo‘q — bot ishga tushmaydi', () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    service.onModuleInit();
    expect(warnSpy).toHaveBeenCalledWith(
      'TELEGRAM_BOT_TOKEN topilmadi. Telegram bot ishlamaydi.',
    );
    expect(ctorArgs).toHaveLength(0);
    expect(launch).not.toHaveBeenCalled();
  });

  it('TELEGRAM_BOT_ENABLED=false — token bo‘lsa ham ishga tushmaydi', () => {
    process.env.TELEGRAM_BOT_TOKEN = 'TEST_TOKEN';
    process.env.TELEGRAM_BOT_ENABLED = 'false';
    service.onModuleInit();
    expect(ctorArgs).toHaveLength(0);
    expect(launch).not.toHaveBeenCalled();
    service.onModuleDestroy();
    expect(stop).not.toHaveBeenCalled();
  });

  describe('bot holati (health)', () => {
    beforeEach(() => {
      process.env.TELEGRAM_BOT_TOKEN = 'TEST_TOKEN';
    });
    const tick = () => new Promise((r) => setImmediate(r));

    it('launch xatosi (409) — down', async () => {
      launch.mockRejectedValue(new Error('409: Conflict'));
      service.onModuleInit();
      await tick();
      await expect(registry.health()).resolves.toBe('down');
    });

    it('polling o‘zi to‘xtasa — down', async () => {
      launch.mockResolvedValue(undefined);
      service.onModuleInit();
      await tick();
      await expect(registry.health()).resolves.toBe('down');
    });

    it('normal ishlaganda ok; shutdown down bermaydi', async () => {
      let end!: () => void;
      launch.mockReturnValue(new Promise<void>((r) => (end = r)));
      service.onModuleInit();
      await tick();
      await expect(registry.health()).resolves.toBe('ok');
      service.onModuleDestroy();
      end();
      await tick();
      await expect(registry.health()).resolves.toBe('disabled');
    });

    it('token yo‘q — disabled', async () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      service.onModuleInit();
      await expect(registry.health()).resolves.toBe('disabled');
    });
  });

  describe('token bor', () => {
    beforeEach(() => {
      process.env.TELEGRAM_BOT_TOKEN = 'TEST_TOKEN';
      service.onModuleInit();
    });

    const shareContact = async () =>
      handlers.on.contact(
        ctx({
          chat: { id: 9001 },
          message: {
            contact: {
              phone_number: '+998901112233',
              first_name: 'Vali',
              user_id: 42,
            },
          },
        }),
      );

    it('bot token bilan yaratiladi va launch qilinadi', () => {
      expect(ctorArgs).toEqual(['TEST_TOKEN']);
      expect(launch).toHaveBeenCalledTimes(1);
      expect(handlers.start).toBeDefined();
      expect(handlers.on.contact).toBeDefined();
      expect(handlers.on.text).toBeDefined();
      expect(handlers.action?.re.test('service_braces')).toBe(true);
    });

    it('/chatid — guruhda chat ID ni qaytaradi', () => {
      for (const type of ['group', 'supergroup']) {
        const reply = jest.fn();
        void handlers.chatid?.({ chat: { id: -1001234, type }, reply });
        expect(reply).toHaveBeenCalledWith('Chat ID: -1001234');
      }
    });

    it('/chatid — shaxsiy chatda jim (begona odamga chat id oshkor bo‘lmaydi)', () => {
      const reply = jest.fn();
      void handlers.chatid?.({ chat: { id: 5, type: 'private' }, reply });
      expect(reply).not.toHaveBeenCalled();
    });

    it('ikkinchi onModuleInit — qayta launch qilinmaydi (dublikat poller yo‘q)', () => {
      service.onModuleInit();
      expect(launch).toHaveBeenCalledTimes(1);
      expect(ctorArgs).toHaveLength(1);
    });

    it('onModuleDestroy — bot.stop() chaqiriladi, ikkinchi marta emas', () => {
      service.onModuleDestroy();
      service.onModuleDestroy();
      expect(stop).toHaveBeenCalledTimes(1);
      expect(stop).toHaveBeenCalledWith('shutdown');
    });

    it('onModuleDestroy — stop xatosi yutiladi', () => {
      stop.mockImplementationOnce(() => {
        throw new Error('Bot is not running!');
      });
      expect(() => service.onModuleDestroy()).not.toThrow();
    });

    it('rate limit — 1 soatda 3 tadan ko‘p lead yaratilmaydi', async () => {
      for (let i = 0; i < 4; i++) {
        await shareContact();
        const c = ctx({ message: { text: `savol ${i}` } });
        await handlers.on.text(c);
        if (i === 3) {
          expect(c.reply).toHaveBeenCalledWith(
            expect.stringContaining('bir nechta murojaat'),
          );
        }
      }
      expect(leads.create).toHaveBeenCalledTimes(3);
    });

    it('rate limit — faqat YARATILGAN leadlar sanaladi (xato urinish hisobga kirmaydi)', async () => {
      for (let i = 0; i < 5; i++) {
        await shareContact();
        leads.create.mockRejectedValueOnce(new Error('db'));
        await handlers.on.text(ctx({ message: { text: `x${i}` } }));
      }
      expect(leads.create).toHaveBeenCalledTimes(5); // never rate limited
      await shareContact();
      const c = ctx({ message: { text: 'ok' } });
      await handlers.on.text(c);
      expect(c.reply).toHaveBeenCalledWith(
        'Sizning xabaringiz va murojaatingiz qabul qilindi!',
        { remove: true },
      );
    });

    it('launch xatosi log qilinadi (crash yo‘q)', async () => {
      launch.mockRejectedValueOnce(new Error('409 Conflict'));
      const fresh = make();
      fresh.onModuleInit();
      await new Promise((r) => setImmediate(r));
      expect(errorSpy).toHaveBeenCalledWith(
        'Telegram bot launch error:',
        expect.any(Error),
      );
    });

    it('/start — salomlashadi va kontakt so‘raydi', () => {
      const c = ctx();
      handlers.start!(c);
      expect(c.reply).toHaveBeenCalledWith(
        expect.stringContaining('xush kelibsiz, Ali!'),
        expect.anything(),
      );
    });

    it('bot ishga tushganda registry ga yoziladi, destroy da tozalanadi', () => {
      expect(registry.isAvailable()).toBe(true);
      service.onModuleDestroy();
      expect(registry.isAvailable()).toBe(false);
    });

    it('launch xatosi — registry tozalanadi', async () => {
      launch.mockRejectedValueOnce(new Error('409 Conflict'));
      const reg = new TelegramBotRegistry();
      const fresh = new TelegramService(
        leads as unknown as LeadsService,
        patients as unknown as PatientsRepository,
        reg,
      );
      fresh.onModuleInit();
      expect(reg.isAvailable()).toBe(true);
      await new Promise((r) => setImmediate(r));
      expect(reg.isAvailable()).toBe(false);
    });

    const ownContact = (phone: string, userId = 42) =>
      ctx({
        chat: { id: 9001 },
        message: {
          contact: { phone_number: phone, first_name: 'Vali', user_id: userId },
        },
      });

    it('o‘z kontakti — telefon normallashtiriladi, chatId bemorga yoziladi', async () => {
      await handlers.on.contact(ownContact('998901112233'));
      expect(patients.findActiveIdsByMobile).toHaveBeenCalledWith(
        '+998901112233',
      );
      expect(patients.setTelegramChatId).toHaveBeenCalledWith(['p1'], '9001');
    });

    it('boshqa odamning kontakti yoki user_id yo‘q — bog‘lanmaydi, lead ochilmaydi, o‘z kontaktini so‘raydi', async () => {
      const foreign = ownContact('+998901112233', 7);
      await handlers.on.contact(foreign);
      const noId = ctx({
        message: {
          contact: { phone_number: '+998901112233', first_name: 'Vali' },
        },
      });
      await handlers.on.contact(noId);
      expect(patients.findActiveIdsByMobile).not.toHaveBeenCalled();
      expect(patients.setTelegramChatId).not.toHaveBeenCalled();
      for (const c of [foreign, noId]) {
        expect(c.reply).toHaveBeenCalledWith(
          expect.stringContaining("o'zingizning telefon raqamingizni"),
          expect.anything(),
        );
      }
      // no state → pressing a service button files nothing
      await handlers.action!.fn(ctx({ match: ['service_other', 'other'] }));
      await handlers.on.text(ctx({ message: { text: 'salom' } }));
      expect(leads.create).not.toHaveBeenCalled();
    });

    it('O‘zbek raqami bo‘lmasa — bog‘lanmaydi, lead oqimi davom etadi', async () => {
      const c = ownContact('+7 999 123 45 67');
      await handlers.on.contact(c);
      expect(patients.findActiveIdsByMobile).not.toHaveBeenCalled();
      expect(c.reply).toHaveBeenCalledWith(
        "Rahmat! Endi qaysi xizmat bo'yicha murojaat qilmoqchisiz?",
        expect.anything(),
      );
    });

    it('bog‘lashda DB xatosi — warn, lead oqimi buzilmaydi', async () => {
      patients.findActiveIdsByMobile.mockRejectedValueOnce(new Error('db'));
      const c = ownContact('+998901112233');
      await handlers.on.contact(c);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Telegram chatga bog'lashda xato"),
      );
      expect(c.reply).toHaveBeenCalledWith(
        "Rahmat! Endi qaysi xizmat bo'yicha murojaat qilmoqchisiz?",
        expect.anything(),
      );
      await handlers.action!.fn(ctx({ match: ['service_other', 'other'] }));
      expect(leads.create).toHaveBeenCalledTimes(1);
    });

    it('contact — xizmat tanlash tugmalari', async () => {
      const c = ownContact('+998901112233');
      await handlers.on.contact(c);
      expect(c.reply).toHaveBeenCalledWith(
        "Rahmat! Endi qaysi xizmat bo'yicha murojaat qilmoqchisiz?",
        expect.objectContaining({ inline: expect.any(Array) }),
      );
    });

    it.each([
      ['consultation', 'Konsultatsiya'],
      ['treatment', 'Tish davolash'],
      ['whitening', 'Tish oqartirish'],
      ['braces', 'Breketlar'],
      ['other', 'Boshqa'],
      ['unknown', 'Boshqa'],
    ])('action service_%s — lead "%s" bilan yaratiladi', async (key, name) => {
      await shareContact();
      const c = ctx({ match: [`service_${key}`, key] });
      await handlers.action!.fn(c);
      expect(leads.create).toHaveBeenCalledWith({
        name: 'Vali',
        phone: '+998901112233',
        service: name,
        source: 'telegram_bot',
        telegramChatId: '9001',
      });
      expect(c.reply).toHaveBeenCalledWith(
        expect.stringContaining('muvaffaqiyatli qabul qilindi'),
        { remove: true },
      );
    });

    it('lead faqat o‘z kontakti bo‘yicha chatga bog‘lanadi (chatId lead bilan saqlanadi)', async () => {
      await shareContact();
      await handlers.action!.fn(ctx({ match: ['service_braces', 'braces'] }));
      expect(leads.create.mock.calls[0][0]).toMatchObject({
        telegramChatId: '9001',
      });
    });

    it('action — state tozalanadi, ikkinchi bosish /start so‘raydi', async () => {
      await shareContact();
      await handlers.action!.fn(ctx({ match: ['service_braces', 'braces'] }));
      const again = ctx({ match: ['service_braces', 'braces'] });
      await handlers.action!.fn(again);
      expect(leads.create).toHaveBeenCalledTimes(1);
      expect(again.reply).toHaveBeenCalledWith(
        expect.stringContaining('qayta /start bosing'),
      );
    });

    it('action — kontakt ismi bo‘lmasa telegram first_name', async () => {
      await handlers.on.contact(
        ctx({
          chat: { id: 9001 },
          message: {
            contact: { phone_number: '+998901112233', user_id: 42 },
          },
        }),
      );
      await handlers.action!.fn(ctx({ match: ['service_other', 'other'] }));
      expect(leads.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Ali' }),
      );
    });

    it('action — lead xatosi: log + uzr xabari, state saqlanadi', async () => {
      await shareContact();
      leads.create.mockRejectedValueOnce(new Error('db'));
      const c = ctx({ match: ['service_braces', 'braces'] });
      await handlers.action!.fn(c);
      expect(errorSpy).toHaveBeenCalledWith(
        'Error creating lead:',
        expect.any(Error),
      );
      expect(c.reply).toHaveBeenCalledWith(
        expect.stringContaining('Kechirasiz, xatolik yuz berdi'),
      );
      // retry works because state wasn't cleared
      await handlers.action!.fn(ctx({ match: ['service_braces', 'braces'] }));
      expect(leads.create).toHaveBeenCalledTimes(2);
    });

    it('text — kontaktdan keyin xabar lead sifatida saqlanadi', async () => {
      await shareContact();
      const c = ctx({ message: { text: 'Tishim og‘riyapti' } });
      await handlers.on.text(c);
      expect(leads.create).toHaveBeenCalledWith({
        name: 'Vali',
        phone: '+998901112233',
        message: 'Tishim og‘riyapti',
        source: 'telegram_bot',
        telegramChatId: '9001',
      });
      expect(c.reply).toHaveBeenCalledWith(
        'Sizning xabaringiz va murojaatingiz qabul qilindi!',
        { remove: true },
      );
    });

    it('text — kontaktsiz lead yaratilmaydi, /start eslatiladi', async () => {
      const c = ctx({ message: { text: 'salom' } });
      await handlers.on.text(c);
      expect(leads.create).not.toHaveBeenCalled();
      expect(c.reply).toHaveBeenCalledWith(expect.stringContaining('/start'));
    });

    it('bot.catch — handler xatosi log qilinadi, crash yo‘q', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'tok';
      service.onModuleInit();
      expect(() => handlers.catch?.(new Error('boom'))).not.toThrow();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('boom'));
    });

    it('text — "/" bilan boshlangan buyruqlar e’tiborsiz', async () => {
      await shareContact();
      await handlers.on.text(ctx({ message: { text: '/help' } }));
      expect(leads.create).not.toHaveBeenCalled();
    });

    it('text — lead xatosi foydalanuvchiga bildiriladi', async () => {
      await shareContact();
      leads.create.mockRejectedValueOnce(new Error('db'));
      const c = ctx({ message: { text: 'savol' } });
      await handlers.on.text(c);
      expect(c.reply).toHaveBeenCalledWith('Xatolik yuz berdi.');
    });

    it('state foydalanuvchilar orasida ajratilgan', async () => {
      await shareContact(); // user 42
      const other = ctx({
        from: { id: 7, first_name: 'Boshqa' },
        match: ['service_braces', 'braces'],
      });
      await handlers.action!.fn(other);
      expect(leads.create).not.toHaveBeenCalled();
      expect(other.reply).toHaveBeenCalledWith(
        expect.stringContaining('qayta /start bosing'),
      );
    });

    describe('TTL, /start payload, /help, /cancel', () => {
      afterEach(() => jest.useRealTimers());

      it('30 daqiqadan keyin state yo‘qoladi — tugma "qayta /start" deydi', async () => {
        jest.useFakeTimers({ now: new Date('2026-11-12T10:00:00Z') });
        await shareContact();
        jest.setSystemTime(new Date('2026-11-12T10:31:00Z'));
        const c = ctx({ match: ['service_braces', 'braces'] });
        await handlers.action!.fn(c);
        expect(leads.create).not.toHaveBeenCalled();
        expect(c.reply).toHaveBeenCalledWith(
          expect.stringContaining('qayta /start bosing'),
        );
      });

      it('29 daqiqada hali amal qiladi', async () => {
        jest.useFakeTimers({ now: new Date('2026-11-12T10:00:00Z') });
        await shareContact();
        jest.setSystemTime(new Date('2026-11-12T10:29:00Z'));
        await handlers.action!.fn(ctx({ match: ['service_braces', 'braces'] }));
        expect(leads.create).toHaveBeenCalledTimes(1);
      });

      it('tashlab ketilgan suhbatlar xotiradan tozalanadi (leak yo‘q)', async () => {
        jest.useFakeTimers({ now: new Date('2026-11-12T10:00:00Z') });
        const states = (service as any).userStates as Map<number, unknown>;
        await shareContact(); // user 42
        jest.setSystemTime(new Date('2026-11-12T11:00:00Z'));
        await handlers.on.contact(
          ctx({
            from: { id: 7, first_name: 'B' },
            chat: { id: 7 },
            message: {
              contact: { phone_number: '+998901112244', user_id: 7 },
            },
          }),
        );
        expect([...states.keys()]).toEqual([7]);
      });

      it('/start?start=lead payload ham xuddi shu oqim (kontakt so‘raydi)', () => {
        const c = ctx({ payload: 'lead', message: { text: '/start lead' } });
        handlers.start!(c);
        expect(c.reply).toHaveBeenCalledWith(
          expect.stringContaining('telefon raqamingizni yuboring'),
          expect.anything(),
        );
      });

      it('/cancel — jarayonni bekor qiladi, keyingi tugma lead yaratmaydi', async () => {
        await shareContact();
        const c = ctx();
        await handlers.commands.cancel(c);
        expect(c.reply).toHaveBeenCalledWith(
          expect.stringContaining('Bekor qilindi'),
          { remove: true },
        );
        await handlers.action!.fn(ctx({ match: ['service_braces', 'braces'] }));
        expect(leads.create).not.toHaveBeenCalled();
      });

      it('/help — klinika ma‘lumoti (sozlamalardan) va murojaat yo‘riqnomasi', async () => {
        const prisma = {
          clinicSettings: {
            findUnique: jest.fn().mockResolvedValue({
              clinicName: 'Zahro Dental',
              phone: '+998901234567',
              address: 'Toshkent',
              workingHours: '09:00-18:00',
            }),
          },
        };
        const fresh = new TelegramService(
          leads as unknown as LeadsService,
          patients as unknown as PatientsRepository,
          registry,
          prisma as any,
        );
        fresh.onModuleInit();
        const c = ctx();
        await handlers.commands.help(c);
        const text = c.reply.mock.calls[0][0] as string;
        expect(text).toContain('+998901234567');
        expect(text).toContain('Toshkent');
        expect(text).toContain('/start');
        expect(text).toContain('/cancel');
      });

      it('/help — sozlamalar o‘qilmasa ham javob beradi', async () => {
        const c = ctx();
        await handlers.commands.help(c);
        expect(c.reply.mock.calls[0][0]).toContain('/start');
      });
    });
  });
});
