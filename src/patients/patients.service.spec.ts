import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DOCTOR_PROFILE_MISSING_MESSAGE } from '../common/auth/doctor-scope';
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
      | 'findDebtors'
      | 'countHistory'
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
      { assignedDoctorId: 'd1' },
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
    assignedDoctorId: null,
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
      findDebtors: jest.fn().mockResolvedValue([]),
      countHistory: jest.fn().mockResolvedValue({ visits: 0, payments: 0 }),
    };
    service = new PatientsService(repo as unknown as PatientsRepository);
  });

  describe('findAll', () => {
    const where = () => repo.findAll.mock.calls[0][0] as any;
    const search = (q: string) => ({
      OR: [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ],
    });

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
      expect(repo.findAll.mock.calls[1][0]).toEqual({
        AND: [{ source: 'telegram' }],
      });
    });

    // created_at is a DATE column: both bounds are calendar days (UTC
    // midnight), independent of the server's local time zone.
    it('sana oralig‘i — DATE ustun, endDate kuni ham kiradi', async () => {
      await service.findAll(
        { startDate: '2026-06-01', endDate: '2026-06-30' },
        admin,
      );
      expect(where()).toEqual({
        AND: [
          {
            createdAt: {
              gte: new Date('2026-06-01T00:00:00.000Z'),
              lte: new Date('2026-06-30T00:00:00.000Z'),
            },
          },
        ],
      });
    });

    it('faqat endDate', async () => {
      await service.findAll({ endDate: '2026-06-30' }, admin);
      expect(where().AND[0].createdAt).toEqual({
        lte: new Date('2026-06-30T00:00:00.000Z'),
      });
    });

    it('search — ism/familiya/telefon bo‘yicha OR (trim)', async () => {
      await service.findAll({ search: ' ali ' }, admin);
      expect(where()).toEqual({ AND: [search('ali')] });
    });

    it('bo‘sh joyli search e’tiborsiz', async () => {
      await service.findAll({ search: '   ' }, admin);
      expect(where()).toEqual({});
    });

    it('doctorId — biriktirilgan shifokor bo‘yicha', async () => {
      await service.findAll({ doctorId: 'd9' }, admin);
      expect(where()).toEqual({ AND: [{ assignedDoctorId: 'd9' }] });
    });

    it('doctor — faqat o‘z bemorlari (biriktirilgan, booking yoki visit)', async () => {
      await service.findAll({}, doctor);
      expect(where()).toEqual({ AND: [doctorScope] });
    });

    it('doctor + search + source — hammasi AND bilan', async () => {
      await service.findAll({ search: 'ali', source: 'phone' }, doctor);
      expect(where()).toEqual({
        AND: [doctorScope, { source: 'phone' }, search('ali')],
      });
    });

    it('sortBy/order — orderBy uzatiladi', async () => {
      await service.findAll({ sortBy: 'lastName', order: 'asc' }, admin);
      expect(repo.findAll.mock.calls[0][1]).toEqual({
        skip: 0,
        take: 10,
        orderBy: [{ lastName: 'asc' }, { id: 'asc' }],
      });
    });

    it('debtOnly — faqat balance < 0 bemorlar (id bo‘yicha)', async () => {
      repo.findDebtors.mockResolvedValue([
        { id: 'p1', balance: -100 },
        { id: 'p7', balance: -5 },
      ]);
      await service.findAll({ debtOnly: 'true', source: 'phone' }, admin);
      expect(where()).toEqual({
        AND: [{ source: 'phone' }, { id: { in: ['p1', 'p7'] } }],
      });
    });

    it('debtOnly — qarzdor yo‘q bo‘lsa DB so‘rovisiz bo‘sh', async () => {
      repo.findDebtors.mockResolvedValue([]);
      await expect(
        service.findAll({ debtOnly: 'true' }, admin),
      ).resolves.toEqual({ data: [], total: 0 });
      expect(repo.findAll).not.toHaveBeenCalled();
    });

    it('debtOnly=false — filtr yo‘q', async () => {
      await service.findAll({ debtOnly: 'false' }, admin);
      expect(repo.findDebtors).not.toHaveBeenCalled();
      expect(where()).toEqual({});
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
        assignedDoctorId: null,
        assignedDoctor: undefined,
        toothChart: undefined,
      });
    });

    // Fixed: a doctor user without a linked Doctor record (doctorId
    // undefined) used to get an unscoped `bookings: { some: {} }` filter,
    // i.e. every patient. Now → 403 and no query at all.
    it('doctor, lekin doctorId yo‘q — 403, boshqa bemorlar ko‘rinmaydi', async () => {
      const orphan: AuthUserView = { ...doctor, doctorId: undefined };
      await expect(service.findAll({}, orphan)).rejects.toThrow(
        new ForbiddenException(DOCTOR_PROFILE_MISSING_MESSAGE),
      );
      await expect(service.findOne('p1', orphan)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.getStats(orphan)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.findComments('p1', orphan)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(repo.findAll).not.toHaveBeenCalled();
      expect(repo.findById).not.toHaveBeenCalled();
      expect(repo.count).not.toHaveBeenCalled();
      expect(repo.groupBySource).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('topilmasa 404', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findOne('x', admin)).rejects.toThrow(
        new NotFoundException('Bemor topilmadi'),
      );
    });

    it('admin — access tekshiruvisiz', async () => {
      repo.findById.mockResolvedValue(row() as any);
      await expect(service.findOne('p1', admin)).resolves.toMatchObject({
        id: 'p1',
      });
      expect(repo.count).not.toHaveBeenCalled();
    });

    it('doctor — bog‘liq bo‘lmagan bemor 404 (mavjud emas kabi)', async () => {
      repo.findById.mockResolvedValue(row() as any);
      repo.count.mockResolvedValue(0);
      await expect(service.findOne('p1', doctor)).rejects.toThrow(
        new NotFoundException('Bemor topilmadi'),
      );
      expect(repo.count).toHaveBeenCalledWith({
        AND: [{ id: 'p1' }, doctorScope],
      });
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
    it('balance = INCOME (paid|partial) + chegirma − yakunlangan tashriflar', async () => {
      repo.findById.mockResolvedValue(
        row({
          payments: [
            { amount: 100_000, status: 'paid', discount: null },
            { amount: 50_000, status: 'partial', discount: 10_000 },
            { amount: 70_000, status: 'unpaid', discount: null },
          ],
          visits: [{ price: 200_000 }, { price: null }],
        }) as any,
      );
      const out = await service.findOne('p1', admin);
      // 100k + 50k + 10k discount − 200k (unpaid 70k not counted)
      expect(out.balance).toBe(-40_000);
    });

    it('payments/visits yo‘q bo‘lsa balance 0', async () => {
      repo.findById.mockResolvedValue(
        row({ payments: undefined, visits: undefined }) as any,
      );
      expect((await service.findOne('p1', admin)).balance).toBe(0);
    });

    it('assignedDoctorId, assignedDoctor, avatar, toothChart xaritalanadi', async () => {
      repo.findById.mockResolvedValue(
        row({
          avatar: 'a.png',
          assignedDoctorId: 'd5',
          assignedDoctor: { firstName: 'Dr', lastName: 'X', id: 'd5' },
          toothChart: { 11: 'caries' },
        }) as any,
      );
      const out = await service.findOne('p1', admin);
      expect(out.avatar).toBe('a.png');
      expect(out.assignedDoctorId).toBe('d5');
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
        createdAt: expect.any(Date),
      });
    });

    it('createdAt — Toshkent kuni (DB server TZ emas)', async () => {
      jest.useFakeTimers({ now: new Date('2026-09-29T20:00:00.000Z') });
      repo.create.mockResolvedValue(row() as any);
      await service.create(dto);
      expect(repo.create.mock.calls[0][0].createdAt).toEqual(
        new Date('2026-09-30T00:00:00.000Z'),
      );
      jest.useRealTimers();
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

    it('assignedDoctorId: null — biriktirish olib tashlanadi (disconnect)', async () => {
      repo.findById.mockResolvedValue(row() as any);
      repo.update.mockResolvedValue(row() as any);
      const out = await service.update('p1', { assignedDoctorId: null }, admin);
      expect(repo.update.mock.calls[0][1]).toMatchObject({
        assignedDoctor: { disconnect: true },
      });
      expect(out.assignedDoctorId).toBeNull();
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
      expect(repo.countHistory).toHaveBeenCalledWith('p1');
      expect(repo.delete).toHaveBeenCalledWith('p1');
    });

    it.each([[{ visits: 2, payments: 0 }], [{ visits: 0, payments: 1 }]])(
      'tarixi bor bemor (%p) — 409, o‘chirilmaydi',
      async (history) => {
        repo.findById.mockResolvedValue(row() as any);
        repo.countHistory.mockResolvedValue(history);
        await expect(service.remove('p1', admin)).rejects.toThrow(
          new ConflictException(
            "Bemorni o'chirib bo'lmaydi: unga bog'langan tashriflar yoki to'lovlar mavjud",
          ),
        );
        expect(repo.delete).not.toHaveBeenCalled();
      },
    );
  });

  describe('getStats', () => {
    afterEach(() => jest.useRealTimers());

    it('admin — umumiy, shu oy (Toshkent) va top source', async () => {
      // 2026-06-30 20:00Z = 2026-07-01 01:00 Toshkent → iyul
      jest.useFakeTimers({ now: new Date('2026-06-30T20:00:00.000Z') });
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
        AND: [{}, { createdAt: { gte: new Date('2026-07-01T00:00:00.000Z') } }],
      });
      expect(repo.groupBySource).toHaveBeenCalledWith({});
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
      expect(repo.count).toHaveBeenNthCalledWith(2, {
        AND: [doctorScope, { createdAt: { gte: expect.any(Date) } }],
      });
    });

    // Fixed: groupBySource() was unscoped, so a doctor saw the clinic-wide
    // top source.
    it('doctor — topSource faqat o‘z bemorlari bo‘yicha', async () => {
      repo.count.mockResolvedValue(3);
      repo.groupBySource.mockResolvedValue([
        { source: 'website', _count: { source: 2 } },
      ] as any);
      await expect(service.getStats(doctor)).resolves.toMatchObject({
        topSource: 'website',
      });
      expect(repo.groupBySource).toHaveBeenCalledWith(doctorScope);
    });
  });

  describe('comments', () => {
    it('addComment — authorId bilan saqlaydi', async () => {
      repo.findById.mockResolvedValue(row() as any);
      repo.createComment.mockResolvedValue({ id: 'c1' } as any);
      await expect(
        service.addComment({ content: 'Salom', patientId: 'p1' }, admin),
      ).resolves.toEqual({ id: 'c1' });
      expect(repo.createComment).toHaveBeenCalledWith({
        content: 'Salom',
        patientId: 'p1',
        authorId: 'u1',
      });
    });

    it('findComments — patientId bo‘yicha', async () => {
      repo.findById.mockResolvedValue(row() as any);
      repo.findCommentsByPatientId.mockResolvedValue([] as any);
      await service.findComments('p1', admin);
      expect(repo.findCommentsByPatientId).toHaveBeenCalledWith('p1');
    });

    // Fixed: comments ignored the doctor scope, and a missing patient gave a
    // Prisma FK error (500) instead of 404.
    describe('comments — scope va 404', () => {
      it('mavjud bo‘lmagan bemor — 404 (o‘qish ham, yozish ham)', async () => {
        repo.findById.mockResolvedValue(null);
        await expect(service.findComments('x', admin)).rejects.toThrow(
          new NotFoundException('Bemor topilmadi'),
        );
        await expect(
          service.addComment({ content: 'a', patientId: 'x' }, admin),
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(repo.findCommentsByPatientId).not.toHaveBeenCalled();
        expect(repo.createComment).not.toHaveBeenCalled();
      });

      it('doctor — begona bemor izohlari 404', async () => {
        repo.findById.mockResolvedValue(row() as any);
        repo.count.mockResolvedValue(0);
        await expect(service.findComments('p1', doctor)).rejects.toBeInstanceOf(
          NotFoundException,
        );
        await expect(
          service.addComment({ content: 'a', patientId: 'p1' }, doctor),
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(repo.createComment).not.toHaveBeenCalled();
      });

      it('doctor — o‘z bemoriga izoh yoza oladi (authorId = user.id)', async () => {
        repo.findById.mockResolvedValue(row() as any);
        repo.count.mockResolvedValue(1);
        await service.addComment({ content: 'ok', patientId: 'p1' }, doctor);
        expect(repo.createComment).toHaveBeenCalledWith({
          content: 'ok',
          patientId: 'p1',
          authorId: 'u2',
        });
      });
    });
  });
});
