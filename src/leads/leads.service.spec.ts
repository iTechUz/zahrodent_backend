import { NotFoundException } from '@nestjs/common';
import { LeadsService } from './leads.service';
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
      | 'update'
      | 'delete'
      | 'updateAndEnsurePatient'
    >
  >;
  let gateway: jest.Mocked<Pick<NotificationsGateway, 'sendNewLead'>>;
  let tg: { enqueue: jest.Mock };
  let notifier: { notifyLeadReceived: jest.Mock };

  const lead = { id: 'l1', name: 'Ali', phone: '+998901112233' } as any;

  beforeEach(() => {
    repo = {
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      findById: jest.fn(),
      create: jest.fn(),
      findOpenByPhoneSince: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
      delete: jest.fn(),
      updateAndEnsurePatient: jest.fn(),
    };
    gateway = { sendNewLead: jest.fn() };
    tg = { enqueue: jest.fn().mockResolvedValue({}) };
    notifier = { notifyLeadReceived: jest.fn().mockResolvedValue('sms') };
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

    it('website re-submit with an open lead → returns it, no new row, no ping', async () => {
      repo.findOpenByPhoneSince.mockResolvedValue(lead);
      const r = await service.create({
        name: 'Ali',
        phone: '+998901112233',
        source: 'website',
      });
      expect(r).toBe(lead);
      expect(repo.create).not.toHaveBeenCalled();
      expect(gateway.sendNewLead).not.toHaveBeenCalled();
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
