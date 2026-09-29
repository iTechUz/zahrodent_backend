import { NotFoundException } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsRepository } from './leads.repository';
import { NotificationsGateway } from '../notifications/notifications.gateway';

describe('LeadsService', () => {
  let service: LeadsService;
  let repo: jest.Mocked<
    Pick<
      LeadsRepository,
      'findAll' | 'findById' | 'create' | 'update' | 'delete'
    >
  >;
  let gateway: jest.Mocked<Pick<NotificationsGateway, 'sendNewLead'>>;

  const lead = { id: 'l1', name: 'Ali', phone: '+998901112233' } as any;

  beforeEach(() => {
    repo = {
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    gateway = { sendNewLead: jest.fn() };
    service = new LeadsService(
      repo as unknown as LeadsRepository,
      gateway as unknown as NotificationsGateway,
    );
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

    it('update — repo ga uzatadi', async () => {
      repo.findById.mockResolvedValue(lead);
      repo.update.mockResolvedValue({ ...lead, status: 'converted' });
      await expect(
        service.update('l1', { status: 'converted' }),
      ).resolves.toMatchObject({ status: 'converted' });
      expect(repo.update).toHaveBeenCalledWith('l1', { status: 'converted' });
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
