import { NotFoundException } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { PatientsRepository } from './patients.repository';
import type { AuthUserView } from '../auth/auth.service';

describe('PatientsService', () => {
  let service: PatientsService;
  let repo: jest.Mocked<
    Pick<
      PatientsRepository,
      | 'findAll'
      | 'findById'
      | 'count'
      | 'create'
      | 'update'
      | 'delete'
      | 'groupBySource'
      | 'createComment'
      | 'findCommentsByPatientId'
    >
  >;

  const admin: AuthUserView = {
    id: 'u1',
    name: 'Admin',
    phone: '+998901234567',
    role: 'admin',
  };
  const doctor: AuthUserView = {
    id: 'u2',
    name: 'Dr',
    phone: '+998901234568',
    role: 'doctor',
    doctorId: 'd1',
  };
  const doctorScope = {
    OR: [
      { bookings: { some: { doctorId: 'd1' } } },
      { visits: { some: { doctorId: 'd1' } } },
    ],
  };

  const row = (partial: Record<string, unknown> = {}) => ({
    id: 'p1',
    firstName: 'Ali',
    lastName: 'Valiyev',
    age: 30,
    phone: '+998901112233',
    source: 'walk-in',
    notes: '',
    address: 'Toshkent',
    workplace: 'IT',
    avatar: null,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    toothChart: null,
    assignedDoctor: null,
    payments: [],
    visits: [],
    ...partial,
  });

  beforeEach(() => {
    repo = {
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      findById: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      groupBySource: jest.fn(),
      createComment: jest.fn(),
      findCommentsByPatientId: jest.fn(),
    };
    service = new PatientsService(repo as unknown as PatientsRepository);
  });

  describe('findAll', () => {
    it('default pagination va bo‘sh where', async () => {
      await service.findAll({}, admin);
      expect(repo.findAll).toHaveBeenCalledWith({}, { skip: 0, take: 10 });
    });

    it('page*limit skip ga aylanadi', async () => {
      await service.findAll({ page: 3, limit: 20 }, admin);
      expect(repo.findAll).toHaveBeenCalledWith({}, { skip: 60, take: 20 });
    });

    it('source "all" bo‘lsa filtr yo‘q, aks holda bor', async () => {
      await service.findAll({ source: 'all' }, admin);
      expect(repo.findAll.mock.calls[0][0]).toEqual({});
      await service.findAll({ source: 'telegram' }, admin);
      expect(repo.findAll.mock.calls[1][0]).toEqual({ source: 'telegram' });
    });

    it('sana oralig‘i — endDate kun oxirigacha', async () => {
      await service.findAll(
        { startDate: '2026-06-01', endDate: '2026-06-30' },
        admin,
      );
      const expectedEnd = new Date('2026-06-30');
      expectedEnd.setHours(23, 59, 59, 999);
      expect(repo.findAll.mock.calls[0][0]).toEqual({
        createdAt: { gte: new Date('2026-06-01'), lte: expectedEnd },
      });
    });

    it('faqat endDate', async () => {
      await service.findAll({ endDate: '2026-06-30' }, admin);
      const where = repo.findAll.mock.calls[0][0] as any;
      expect(where.createdAt.gte).toBeUndefined();
      expect(where.createdAt.lte).toBeInstanceOf(Date);
    });

    it('search — ism/familiya/telefon bo‘yicha OR', async () => {
      await service.findAll({ search: 'ali' }, admin);
      expect(repo.findAll.mock.calls[0][0]).toEqual({
        OR: [
          { firstName: { contains: 'ali', mode: 'insensitive' } },
          { lastName: { contains: 'ali', mode: 'insensitive' } },
          { phone: { contains: 'ali', mode: 'insensitive' } },
        ],
      });
    });

    it('bo‘sh joyli search e’tiborsiz', async () => {
      await service.findAll({ search: '   ' }, admin);
      expect(repo.findAll.mock.calls[0][0]).toEqual({});
    });

    it('doctor — faqat o‘z bemorlari (booking yoki visit orqali)', async () => {
      await service.findAll({}, doctor);
      expect(repo.findAll.mock.calls[0][0]).toEqual({
        OR: undefined,
        AND: [doctorScope],
      });
    });

    it('doctor + search — scope va search AND bilan birlashtiriladi', async () => {
      await service.findAll({ search: 'ali', source: 'phone' }, doctor);
      const where = repo.findAll.mock.calls[0][0] as any;
      expect(where.OR).toBeUndefined();
      expect(where.source).toBe('phone');
      expect(where.AND).toEqual([
        doctorScope,
        {
          OR: [
            { firstName: { contains: 'ali', mode: 'insensitive' } },
            { lastName: { contains: 'ali', mode: 'insensitive' } },
            { phone: { contains: 'ali', mode: 'insensitive' } },
          ],
        },
      ]);
    });

    it('natija response formatiga o‘giriladi va total saqlanadi', async () => {
      repo.findAll.mockResolvedValue({ data: [row() as any], total: 7 });
      const out = await service.findAll({}, admin);
      expect(out.total).toBe(7);
      expect(out.data[0]).toMatchObject({
        id: 'p1',
        createdAt: '2026-06-01',
        balance: 0,
        avatar: undefined,
        assignedDoctor: undefined,
        toothChart: undefined,
      });
    });

    // BUG (patients.service.ts:61-80, also 93-104 and 161-166): a user with
    // role 'doctor' but no linked Doctor record has doctorId === undefined;
    // Prisma drops `doctorId: undefined`, so `bookings: { some: {} }` matches
    // every patient with any booking — the doctor scope silently disappears.
    // The same pattern exists in BookingsService.findAll/getStats
    // (bookings.service.ts:44-46, 181-183) and VisitsService.findAll
    // (visits.service.ts:33-34). Expected: empty result / 403.
    it.todo(
      'doctor, lekin doctorId yo‘q — boshqa bemorlar ko‘rinmasligi kerak',
    );
  });

  describe('findOne', () => {
    it('topilmasa 404', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findOne('x', admin)).rejects.toThrow(
        new NotFoundException('Patient not found'),
      );
    });

    it('admin — access tekshiruvisiz', async () => {
      repo.findById.mockResolvedValue(row() as any);
      await expect(service.findOne('p1', admin)).resolves.toMatchObject({
        id: 'p1',
      });
      expect(repo.count).not.toHaveBeenCalled();
    });

    it('doctor — bog‘liq bo‘lmagan bemor 404 (access restricted)', async () => {
      repo.findById.mockResolvedValue(row() as any);
      repo.count.mockResolvedValue(0);
      await expect(service.findOne('p1', doctor)).rejects.toThrow(
        'Patient not found (access restricted)',
      );
      expect(repo.count).toHaveBeenCalledWith({ id: 'p1', ...doctorScope });
    });

    it('doctor — bog‘liq bemor ko‘rinadi', async () => {
      repo.findById.mockResolvedValue(row() as any);
      repo.count.mockResolvedValue(1);
      await expect(service.findOne('p1', doctor)).resolves.toMatchObject({
        id: 'p1',
      });
    });
  });

  describe('toResponse (findOne orqali)', () => {
    it('balance = to‘lovlar - tashriflar narxi', async () => {
      repo.findById.mockResolvedValue(
        row({
          payments: [{ amount: 100_000 }, { amount: 50_000 }, {}],
          visits: [{ price: 200_000 }, { price: null }],
        }) as any,
      );
      const out = await service.findOne('p1', admin);
      expect(out.balance).toBe(-50_000);
    });

    it('payments/visits yo‘q bo‘lsa balance 0', async () => {
      repo.findById.mockResolvedValue(
        row({ payments: undefined, visits: undefined }) as any,
      );
      expect((await service.findOne('p1', admin)).balance).toBe(0);
    });

    it('assignedDoctor, avatar, toothChart xaritalanadi', async () => {
      repo.findById.mockResolvedValue(
        row({
          avatar: 'a.png',
          assignedDoctor: { firstName: 'Dr', lastName: 'X', id: 'hidden' },
          toothChart: { 11: 'caries' },
        }) as any,
      );
      const out = await service.findOne('p1', admin);
      expect(out.avatar).toBe('a.png');
      expect(out.assignedDoctor).toEqual({ firstName: 'Dr', lastName: 'X' });
      expect(out.toothChart).toEqual({ 11: 'caries' });
    });
  });

  describe('create', () => {
    const dto = {
      firstName: 'Ali',
      lastName: 'Valiyev',
      age: 30,
      phone: '+998901112233',
      source: 'walk-in' as const,
      address: 'Toshkent',
      workplace: 'IT',
    };

    it('notes default "" va assignedDoctor/toothChart undefined', async () => {
      repo.create.mockResolvedValue(row() as any);
      await service.create(dto);
      expect(repo.create).toHaveBeenCalledWith({
        ...dto,
        notes: '',
        assignedDoctor: undefined,
        avatar: undefined,
        toothChart: undefined,
      });
    });

    it('assignedDoctorId connect ga, toothChart saqlanadi', async () => {
      repo.create.mockResolvedValue(row() as any);
      await service.create({
        ...dto,
        notes: 'n',
        assignedDoctorId: 'd1',
        toothChart: { 11: 'x' },
      });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: 'n',
          assignedDoctor: { connect: { id: 'd1' } },
          toothChart: { 11: 'x' },
        }),
      );
    });
  });

  describe('update', () => {
    it('mavjud bo‘lmasa 404 va update chaqirilmaydi', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.update('x', {}, admin)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('doctor boshqa bemorni yangilay olmaydi', async () => {
      repo.findById.mockResolvedValue(row() as any);
      repo.count.mockResolvedValue(0);
      await expect(
        service.update('p1', { notes: 'x' }, doctor),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('qisman update — faqat berilgan maydonlar, notes default yo‘q', async () => {
      repo.findById.mockResolvedValue(row() as any);
      repo.update.mockResolvedValue(row({ firstName: 'Vali' }) as any);
      const out = await service.update('p1', { firstName: 'Vali' }, admin);
      expect(out.firstName).toBe('Vali');
      const data = repo.update.mock.calls[0][1] as any;
      expect(repo.update.mock.calls[0][0]).toBe('p1');
      expect(data.firstName).toBe('Vali');
      expect(data.notes).toBeUndefined();
      expect(data.assignedDoctor).toBeUndefined();
      expect(data.toothChart).toBeUndefined();
    });

    it('assignedDoctorId va toothChart uzatiladi', async () => {
      repo.findById.mockResolvedValue(row() as any);
      repo.update.mockResolvedValue(row() as any);
      await service.update(
        'p1',
        { assignedDoctorId: 'd2', toothChart: {} },
        admin,
      );
      expect(repo.update.mock.calls[0][1]).toMatchObject({
        assignedDoctor: { connect: { id: 'd2' } },
        toothChart: {},
      });
    });
  });

  describe('remove', () => {
    it('404 bo‘lsa o‘chirmaydi', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.remove('x', admin)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('o‘chiradi va id qaytaradi', async () => {
      repo.findById.mockResolvedValue(row() as any);
      await expect(service.remove('p1', admin)).resolves.toEqual({ id: 'p1' });
      expect(repo.delete).toHaveBeenCalledWith('p1');
    });
  });

  describe('getStats', () => {
    afterEach(() => jest.useRealTimers());

    it('admin — umumiy, shu oy va top source', async () => {
      jest.useFakeTimers({ now: new Date(2026, 5, 15, 12, 0, 0) });
      repo.count.mockResolvedValueOnce(100).mockResolvedValueOnce(12);
      repo.groupBySource.mockResolvedValue([
        { source: 'telegram', _count: { source: 40 } },
      ] as any);

      await expect(service.getStats(admin)).resolves.toEqual({
        total: 100,
        newThisMonth: 12,
        topSource: 'telegram',
      });
      expect(repo.count).toHaveBeenNthCalledWith(1, {});
      expect(repo.count).toHaveBeenNthCalledWith(2, {
        createdAt: { gte: new Date(2026, 5, 1, 0, 0, 0, 0) },
      });
    });

    it('source yo‘q bo‘lsa N/A', async () => {
      repo.count.mockResolvedValue(0);
      repo.groupBySource.mockResolvedValue([] as any);
      expect((await service.getStats(admin)).topSource).toBe('N/A');
    });

    it('doctor — count lar scope bilan', async () => {
      repo.count.mockResolvedValue(3);
      repo.groupBySource.mockResolvedValue([] as any);
      await service.getStats(doctor);
      expect(repo.count).toHaveBeenNthCalledWith(1, doctorScope);
      expect(repo.count).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining(doctorScope),
      );
    });

    // BUG (patients.service.ts:179): groupBySource() is not scoped by the
    // doctor filter, so a doctor's stats show the clinic-wide top source.
    it.todo(
      'doctor — topSource ham faqat o‘z bemorlari bo‘yicha hisoblanishi kerak',
    );
  });

  describe('comments', () => {
    it('addComment — authorId bilan saqlaydi', async () => {
      repo.createComment.mockResolvedValue({ id: 'c1' } as any);
      await expect(
        service.addComment({ content: 'Salom', patientId: 'p1' }, 'u1'),
      ).resolves.toEqual({ id: 'c1' });
      expect(repo.createComment).toHaveBeenCalledWith({
        content: 'Salom',
        patientId: 'p1',
        authorId: 'u1',
      });
    });

    it('findComments — patientId bo‘yicha', async () => {
      repo.findCommentsByPatientId.mockResolvedValue([] as any);
      await service.findComments('p1');
      expect(repo.findCommentsByPatientId).toHaveBeenCalledWith('p1');
    });

    // BUG (patients.service.ts:190-203 + patients.controller.ts:86-102):
    // comments endpoints take no user scope — a doctor can read/write
    // comments of any patient (bypassing the findOne access restriction),
    // and a non-existent patientId surfaces as a Prisma FK error (500)
    // instead of 404.
    it.todo(
      'comments — doctor faqat o‘z bemorlariga kira olishi va 404 qaytarishi kerak',
    );
  });
});
