import { NotFoundException } from '@nestjs/common';
import {
  LeadsService,
  adminLeadLink,
  formatLeadMessage,
  formatLeadUpdateMessage,
  mergeLeadDetails,
  neutralizeLinks,
} from './leads.service';
import { LeadsRepository } from './leads.repository';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { ClientNotifierService } from '../notifications/client-notifier.service';
import { NotificationLogService } from '../notifications/notification-log.service';
import { Logger } from '@nestjs/common';

describe('LeadsService', () => {
  let service: LeadsService;
  let repo: jest.Mocked<
    Pick<
      LeadsRepository,
      | 'findAll'
      | 'findById'
      | 'create'
      | 'findOpenByPhoneSince'
      | 'createOrMerge'
      | 'update'
      | 'delete'
      | 'updateAndEnsurePatient'
    >
  >;
  let gateway: jest.Mocked<Pick<NotificationsGateway, 'sendNewLead'>>;
  let tg: { enqueue: jest.Mock };
  let notifier: { notifyLeadReceived: jest.Mock; notifyLeadStatus: jest.Mock };

  const lead = { id: 'l1', name: 'Ali', phone: '+998901112233' } as any;

  beforeEach(() => {
    repo = {
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      findById: jest.fn(),
      create: jest.fn(),
      findOpenByPhoneSince: jest.fn().mockResolvedValue(null),
      createOrMerge: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateAndEnsurePatient: jest.fn(),
    };
    gateway = { sendNewLead: jest.fn() };
    tg = { enqueue: jest.fn().mockResolvedValue({}) };
    notifier = {
      notifyLeadReceived: jest.fn().mockResolvedValue('sms'),
      notifyLeadStatus: jest.fn().mockResolvedValue(true),
    };
    service = new LeadsService(
      repo as unknown as LeadsRepository,
      gateway as unknown as NotificationsGateway,
      tg as unknown as NotificationLogService,
      notifier as unknown as ClientNotifierService,
    );
  });

  describe('dublikat va telefon', () => {
    it('stores the normalized phone', async () => {
      repo.create.mockResolvedValue(lead);
      await service.create({ name: 'Ali', phone: '90 111 22 33' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '+998901112233' }),
      );
    });

    it('website/bot lead goes through the atomic createOrMerge (new → pinged)', async () => {
      repo.createOrMerge.mockResolvedValue({ lead, created: true });
      const dto = { name: 'Ali', phone: '+998901112233', source: 'website' };
      await expect(service.create(dto)).resolves.toBe(lead);
      const [phone, since, data] = repo.createOrMerge.mock.calls[0];
      expect(phone).toBe('+998901112233');
      expect(since.getTime()).toBeLessThanOrEqual(Date.now() - 23 * 3600_000);
      expect(data).toEqual(expect.objectContaining(dto));
      expect(repo.create).not.toHaveBeenCalled();
      expect(gateway.sendNewLead).toHaveBeenCalledWith(lead);
    });

    it('bot lead keeps telegramChatId on the stored row', async () => {
      repo.createOrMerge.mockResolvedValue({ lead, created: true });
      await service.create({
        name: 'Ali',
        phone: '+998901112233',
        source: 'telegram_bot',
        telegramChatId: '42',
      });
      expect(repo.createOrMerge.mock.calls[0][2]).toEqual(
        expect.objectContaining({ telegramChatId: '42' }),
      );
    });

    it('repeat submit → no new ping to gateway/customer; merge callback appends details', async () => {
      const prev = {
        ...lead,
        service: 'Implant',
        message: 'Eski matn',
        telegramChatId: null,
      };
      repo.createOrMerge.mockImplementation(async (_p, _s, _d, merge) => {
        const patch = merge(prev);
        return { lead: { ...prev, ...(patch as object) }, created: false };
      });
      const r = await service.create({
        name: 'Ali',
        phone: '+998901112233',
        source: 'website',
        service: 'Breket',
        message: 'Yangi savol',
      });
      expect(r.message).toMatch(
        /^Eski matn\n\[.*\] Xizmat: Breket; Xabar: Yangi savol$/,
      );
      expect(gateway.sendNewLead).not.toHaveBeenCalled();
      expect(notifier.notifyLeadReceived).not.toHaveBeenCalled();
    });

    describe('repeat submit staff note', () => {
      const saved = process.env.TELEGRAM_LEADS_CHAT_ID;
      const flush = () => new Promise((r) => setImmediate(r));
      afterEach(() => {
        if (saved === undefined) delete process.env.TELEGRAM_LEADS_CHAT_ID;
        else process.env.TELEGRAM_LEADS_CHAT_ID = saved;
      });
      const run = async (extra: object) => {
        const prev = { ...lead, service: 'Implant', message: null };
        repo.createOrMerge.mockImplementation(async (_p, _s, _d, merge) => {
          const patch = merge(prev);
          return { lead: { ...prev, ...(patch as object) }, created: false };
        });
        await service.create({
          name: 'Ali',
          phone: '+998901112233',
          source: 'website',
          ...extra,
        });
        await flush();
      };

      it('new details → one short "qo\'shimcha ma\'lumot" note via the outbox', async () => {
        process.env.TELEGRAM_LEADS_CHAT_ID = '-100123';
        await run({ message: 'Yana bir savol' });
        expect(tg.enqueue).toHaveBeenCalledTimes(1);
        const a = tg.enqueue.mock.calls[0][0];
        expect(a.kind).toBe('lead_group_update');
        expect(a.chatId).toBe('-100123');
        expect(a.text).toContain("Qo'shimcha ma'lumot");
        expect(a.text).toContain('Yana bir savol');
      });

      it('nothing new (same service) → no note', async () => {
        process.env.TELEGRAM_LEADS_CHAT_ID = '-100123';
        await run({ service: 'Implant' });
        expect(tg.enqueue).not.toHaveBeenCalled();
      });
    });

    it('CRM-entered leads are never deduped', async () => {
      repo.create.mockResolvedValue(lead);
      await service.create({
        name: 'Ali',
        phone: '+998901112233',
        source: 'crm',
      });
      expect(repo.findOpenByPhoneSince).not.toHaveBeenCalled();
      expect(repo.create).toHaveBeenCalled();
    });
  });

  describe('Telegram guruhga e’lon', () => {
    const saved = process.env.TELEGRAM_LEADS_CHAT_ID;
    const flush = () => new Promise((r) => setImmediate(r));
    const web = {
      id: 'l2',
      name: 'Ali <b>@bad</b>',
      phone: '+998901112233',
      service: 'Implant',
      message: 'Sana: 2026-10-20\nSalom [x](http://evil)',
      source: 'website',
      createdAt: new Date('2026-10-15T09:30:00Z'),
    } as any;
    let warn: jest.SpyInstance;

    beforeEach(() => {
      warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    });
    afterEach(() => {
      if (saved === undefined) delete process.env.TELEGRAM_LEADS_CHAT_ID;
      else process.env.TELEGRAM_LEADS_CHAT_ID = saved;
      jest.restoreAllMocks();
    });

    it('env bor — guruhga yuboriladi (Toshkent vaqti, @ zararsizlangan)', async () => {
      process.env.TELEGRAM_LEADS_CHAT_ID = '-100123';
      repo.create.mockResolvedValue(web);
      await expect(service.create({ name: 'x', phone: '1' })).resolves.toBe(
        web,
      );
      await flush();
      expect(tg.enqueue).toHaveBeenCalledTimes(1);
      const { chatId: chat, text, kind, leadId } = tg.enqueue.mock.calls[0][0];
      expect(kind).toBe('lead_group');
      expect(leadId).toBe('l2');
      expect(chat).toBe('-100123');
      expect(text).toContain('+998901112233');
      expect(text).toContain('Implant');
      expect(text).toContain('Sayt');
      expect(text).toContain('15.10.2026 14:30');
      expect(text).not.toMatch(/@(?!\u200b)/);
    });

    it('env yo‘q — yuborilmaydi, lead qaytadi', async () => {
      delete process.env.TELEGRAM_LEADS_CHAT_ID;
      repo.create.mockResolvedValue(web);
      await expect(service.create({ name: 'x', phone: '1' })).resolves.toBe(
        web,
      );
      await flush();
      expect(tg.enqueue).not.toHaveBeenCalled();
    });

    it('website lead → mijozga tasdiq; crm → yo‘q', async () => {
      repo.create.mockResolvedValue(web);
      await service.create({ name: 'x', phone: '1' });
      expect(notifier.notifyLeadReceived).toHaveBeenCalledWith(web);
      notifier.notifyLeadReceived.mockClear();
      repo.create.mockResolvedValue({ ...web, source: 'crm' });
      await service.create({ name: 'x', phone: '1' });
      expect(notifier.notifyLeadReceived).not.toHaveBeenCalled();
    });

    it('crm manbasi — yuborilmaydi', async () => {
      process.env.TELEGRAM_LEADS_CHAT_ID = '-100123';
      repo.create.mockResolvedValue({ ...web, source: 'crm' });
      await service.create({ name: 'x', phone: '1' });
      await flush();
      expect(tg.enqueue).not.toHaveBeenCalled();
    });

    it('enqueue throw qilsa ham — lead qaytadi, unhandled rejection yo‘q', async () => {
      process.env.TELEGRAM_LEADS_CHAT_ID = '-100123';
      tg.enqueue.mockRejectedValue(new Error('boom'));
      repo.create.mockResolvedValue(web);
      await expect(service.create({ name: 'x', phone: '1' })).resolves.toBe(
        web,
      );
      await flush();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('boom'));
    });
  });

  it('create — saqlaydi va websocket orqali e’lon qiladi', async () => {
    repo.create.mockResolvedValue(lead);
    const dto = { name: 'Ali', phone: '+998901112233', source: 'crm' };
    await expect(service.create(dto)).resolves.toBe(lead);
    expect(repo.create).toHaveBeenCalledWith(dto);
    expect(gateway.sendNewLead).toHaveBeenCalledWith(lead);
  });

  it('create — repo xato bersa e’lon qilinmaydi', async () => {
    repo.create.mockRejectedValue(new Error('db'));
    await expect(service.create({ name: 'A', phone: '1' })).rejects.toThrow(
      'db',
    );
    expect(gateway.sendNewLead).not.toHaveBeenCalled();
  });

  describe('findAll', () => {
    it('default pagination, bo‘sh where', async () => {
      await service.findAll({});
      expect(repo.findAll).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        where: {},
      });
    });

    it('string page/limit raqamga aylanadi', async () => {
      await service.findAll({ page: 2, limit: 25 });
      expect(repo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 50, take: 25 }),
      );
    });

    it('search — name (insensitive) yoki phone', async () => {
      await service.findAll({ search: 'ali' });
      expect(repo.findAll.mock.calls[0][0].where).toEqual({
        OR: [
          { name: { contains: 'ali', mode: 'insensitive' } },
          { phone: { contains: 'ali' } },
        ],
      });
    });

    it('status filtri', async () => {
      await service.findAll({ status: 'contacted' });
      expect(repo.findAll.mock.calls[0][0].where).toEqual({
        status: 'contacted',
      });
    });

    it('status "all" — filtr yo‘q; source filtri', async () => {
      await service.findAll({ status: 'all', source: 'crm' });
      expect(repo.findAll.mock.calls[0][0].where).toEqual({ source: 'crm' });
    });

    // created_at is a timestamp: day bounds are Asia/Tashkent (UTC+5),
    // independent of the server's TZ.
    it('faqat startDate — 00:00 Toshkent (oldingi kun 19:00Z)', async () => {
      await service.findAll({ startDate: '2026-06-01' });
      expect(repo.findAll.mock.calls[0][0].where).toEqual({
        createdAt: { gte: new Date('2026-05-31T19:00:00.000Z') },
      });
    });

    it('endDate — Toshkent kunining oxirigacha (inclusive)', async () => {
      await service.findAll({ startDate: '2026-06-01', endDate: '2026-06-10' });
      const { createdAt } = repo.findAll.mock.calls[0][0].where as any;
      expect(createdAt).toEqual({
        gte: new Date('2026-05-31T19:00:00.000Z'),
        lte: new Date('2026-06-10T18:59:59.999Z'),
      });
    });

    it('sortBy/order — orderBy uzatiladi', async () => {
      await service.findAll({ sortBy: 'name', order: 'asc' });
      expect(repo.findAll.mock.calls[0][0].orderBy).toEqual([
        { name: 'asc' },
        { id: 'asc' },
      ]);
    });
  });

  describe('findOne / update / remove', () => {
    it('findOne — topilmasa 404', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findOne('x')).rejects.toThrow(
        new NotFoundException('Murojaat topilmadi'),
      );
    });

    it('findOne — topilsa qaytaradi', async () => {
      repo.findById.mockResolvedValue(lead);
      await expect(service.findOne('l1')).resolves.toBe(lead);
    });

    it('update — topilmasa 404 va update chaqirilmaydi', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(
        service.update('x', { status: 'new' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('update — oddiy holat repo.update ga uzatiladi', async () => {
      repo.findById.mockResolvedValue(lead);
      repo.update.mockResolvedValue({ ...lead, status: 'contacted' });
      await expect(
        service.update('l1', { status: 'contacted' }),
      ).resolves.toMatchObject({ status: 'contacted' });
      expect(repo.update).toHaveBeenCalledWith('l1', { status: 'contacted' });
      expect(repo.updateAndEnsurePatient).not.toHaveBeenCalled();
    });

    it('update — converted ga o‘tganda bemor yaratiladi', async () => {
      repo.findById.mockResolvedValue({ ...lead, status: 'proposal' });
      repo.updateAndEnsurePatient.mockResolvedValue({
        ...lead,
        status: 'converted',
      });
      await expect(
        service.update('l1', { status: 'converted' }),
      ).resolves.toMatchObject({ status: 'converted' });
      expect(repo.updateAndEnsurePatient).toHaveBeenCalledWith(
        'l1',
        { status: 'converted' },
        expect.objectContaining({ phone: lead.phone, name: 'Ali' }),
        expect.any(Date),
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('update — converted: lead telegramChatId bemorga ko‘chirish uchun uzatiladi', async () => {
      repo.findById.mockResolvedValue({
        ...lead,
        status: 'proposal',
        telegramChatId: '777',
      });
      repo.updateAndEnsurePatient.mockResolvedValue({ ...lead });
      await service.update('l1', { status: 'converted' });
      expect(repo.updateAndEnsurePatient.mock.calls[0][2]).toEqual(
        expect.objectContaining({ telegramChatId: '777' }),
      );
    });

    it('update — status o‘zgarganda mijozga xabar ketadi, o‘zgarmasa ketmaydi', async () => {
      repo.findById.mockResolvedValue(lead);
      repo.update.mockResolvedValue({ ...lead, status: 'contacted' });
      await service.update('l1', { status: 'contacted' });
      expect(notifier.notifyLeadStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'contacted' }),
        'contacted',
      );
      notifier.notifyLeadStatus.mockClear();
      repo.findById.mockResolvedValue({ ...lead, status: 'contacted' });
      await service.update('l1', { status: 'contacted' });
      await service.update('l1', { notes: 'x' });
      expect(notifier.notifyLeadStatus).not.toHaveBeenCalled();
    });

    it('update — converted bo‘lganda ham mijozga xabar ketadi', async () => {
      repo.findById.mockResolvedValue({ ...lead, status: 'proposal' });
      repo.updateAndEnsurePatient.mockResolvedValue({
        ...lead,
        status: 'converted',
      });
      await service.update('l1', { status: 'converted' });
      expect(notifier.notifyLeadStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'converted' }),
        'converted',
      );
    });

    it('update — telefon kanonik +998 formatga keltiriladi', async () => {
      repo.findById.mockResolvedValue(lead);
      repo.update.mockResolvedValue(lead);
      await service.update('l1', { phone: '90 123-45-67' });
      expect(repo.update).toHaveBeenCalledWith('l1', {
        phone: '+998901234567',
      });
    });

    it('update — converted bilan yangi telefon bemorga ham shu raqam bilan uzatiladi', async () => {
      repo.findById.mockResolvedValue({ ...lead, status: 'proposal' });
      repo.updateAndEnsurePatient.mockResolvedValue(lead);
      await service.update('l1', {
        status: 'converted',
        phone: '901234567',
      });
      expect(repo.updateAndEnsurePatient).toHaveBeenCalledWith(
        'l1',
        { status: 'converted', phone: '+998901234567' },
        expect.objectContaining({ phone: '+998901234567' }),
        expect.any(Date),
      );
    });

    it('update — allaqachon converted bo‘lsa takroran bemor yaratilmaydi', async () => {
      repo.findById.mockResolvedValue({ ...lead, status: 'converted' });
      repo.update.mockResolvedValue({ ...lead, status: 'converted' });
      await service.update('l1', { status: 'converted' });
      expect(repo.updateAndEnsurePatient).not.toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalled();
    });

    it('remove — topilmasa 404', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.remove('x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('remove — success: true', async () => {
      repo.findById.mockResolvedValue(lead);
      await expect(service.remove('l1')).resolves.toEqual({ success: true });
      expect(repo.delete).toHaveBeenCalledWith('l1');
    });
  });
});

describe('lead group text helpers', () => {
  const base = {
    id: 'l1',
    name: 'Ali',
    phone: '+998901112233',
    service: null,
    doctor: null,
    preferredAt: null,
    message: null,
    source: 'website',
    lang: null,
    telegramChatId: null,
    createdAt: new Date('2026-10-15T09:30:00Z'),
  } as any;
  const saved = process.env.ADMIN_PUBLIC_URL;
  afterEach(() => {
    if (saved === undefined) delete process.env.ADMIN_PUBLIC_URL;
    else process.env.ADMIN_PUBLIC_URL = saved;
  });

  it('neutralizeLinks — havolalar bosib bo‘lmaydigan shaklga o‘tadi', () => {
    const out = neutralizeLinks(
      'Qarang http://evil.com/x va www.site.uz hamda t.me/abc',
    );
    expect(out).not.toMatch(/https?:\/\//);
    expect(out).not.toMatch(/\w\.(com|uz|me)/);
    expect(out).toContain('evil[.]com');
  });

  it('neutralizeLinks — oddiy matn, vaqt va telefon buzilmaydi', () => {
    expect(neutralizeLinks('Soat 10.30, +998 90 111 22 33. Rahmat')).toBe(
      'Soat 10.30, +998 90 111 22 33. Rahmat',
    );
  });

  it('formatLeadMessage — message ichidagi havola zararsizlanadi', () => {
    const t = formatLeadMessage({
      ...base,
      message: 'Bu yerga: https://phish.example.com/login',
    });
    expect(t).not.toContain('://');
    expect(t).not.toContain('example.com');
  });

  it('lang — "🌐 RU" qatori; noma’lum til ko‘rsatilmaydi', () => {
    expect(formatLeadMessage({ ...base, lang: 'ru' })).toContain('🌐 RU');
    expect(formatLeadMessage({ ...base, lang: 'xx' })).not.toContain('🌐');
    expect(formatLeadMessage(base)).not.toContain('🌐');
  });

  it('ADMIN_PUBLIC_URL — faqat o‘rnatilgan bo‘lsa havola qo‘shiladi', () => {
    delete process.env.ADMIN_PUBLIC_URL;
    expect(formatLeadMessage(base)).not.toContain('🔗');
    process.env.ADMIN_PUBLIC_URL = 'https://admin.zahro.uz/';
    expect(adminLeadLink(base.phone)).toBe(
      'https://admin.zahro.uz/leads?search=%2B998901112233',
    );
    expect(formatLeadMessage(base)).toContain(
      '🔗 https://admin.zahro.uz/leads',
    );
    expect(formatLeadUpdateMessage(base, 'x')).toContain('🔗');
    process.env.ADMIN_PUBLIC_URL = 'javascript:alert(1)';
    expect(adminLeadLink(base.phone)).toBeNull();
  });

  describe('mergeLeadDetails', () => {
    const now = new Date('2026-10-15T09:30:00Z');
    it('keeps old text, appends a dated line, fills empty fields', () => {
      const r = mergeLeadDetails(
        { ...base, message: 'Eski' },
        { service: 'Breket', preferredAt: '2026-10-20 10:00', lang: 'ru' },
        now,
      );
      expect(r.patch?.message).toBe(
        'Eski\n[15.10.2026 14:30] Xizmat: Breket; Vaqt: 2026-10-20 10:00',
      );
      expect(r.patch).toMatchObject({ service: 'Breket', lang: 'ru' });
      expect(r.added).toBe('Xizmat: Breket; Vaqt: 2026-10-20 10:00');
    });

    it('does not overwrite an existing service, only notes it', () => {
      const r = mergeLeadDetails(
        { ...base, service: 'Implant' },
        { service: 'Breket' },
        now,
      );
      expect(r.patch).not.toHaveProperty('service');
      expect(r.added).toContain('Breket');
    });

    it('nothing new → null patch and null note', () => {
      const r = mergeLeadDetails(
        { ...base, service: 'Implant', message: 'Salom' },
        { service: 'Implant', message: 'Salom' },
        now,
      );
      expect(r).toEqual({ patch: null, added: null });
    });

    it('links an own-contact chat when the lead had none', () => {
      const r = mergeLeadDetails(base, { telegramChatId: '55' }, now);
      expect(r.patch).toEqual({ telegramChatId: '55' });
      expect(r.added).toBeNull();
    });

    it('respects the 2000 char limit', () => {
      const long = 'a'.repeat(1990);
      const r = mergeLeadDetails(
        { ...base, message: long },
        { message: 'b'.repeat(500) },
        now,
      );
      // no room left for a meaningful line → message untouched, staff still told
      expect(r.patch?.message).toBeUndefined();
      expect(r.added).toContain('Xabar');
      const r2 = mergeLeadDetails(
        { ...base, message: 'a'.repeat(1500) },
        { message: 'b'.repeat(900) },
        now,
      );
      expect((r2.patch?.message as string).length).toBeLessThanOrEqual(2000);
      expect(r2.patch?.message as string).toMatch(/…$/);
    });
  });
});
