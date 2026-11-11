import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  PAYMENT_DATE_FUTURE,
  PAYMENT_DATE_TOO_OLD,
  PAYMENT_DISCOUNT_TOO_BIG,
  PAYMENT_DUPLICATE_MESSAGE,
  PAYMENT_PATIENT_REQUIRED,
  PAYMENT_VISIT_NEEDS_PATIENT,
  PaymentsService,
} from './payments.service';
import { PaymentsRepository } from './payments.repository';

describe('PaymentsService', () => {
  const admin = { id: 'u1', name: 'Admin', role: 'admin' } as any;
  let service: PaymentsService;
  let repo: jest.Mocked<
    Pick<
      PaymentsRepository,
      | 'findAll'
      | 'findById'
      | 'createWithAudit'
      | 'updateWithAudit'
      | 'deleteWithAudit'
      | 'listAudit'
      | 'sumAmount'
      | 'getDoctorStats'
      | 'getDebtSummary'
      | 'findVisitOwner'
    >
  >;

  const payment = (partial: Record<string, unknown> = {}) =>
    ({
      id: 'pay1',
      patientId: 'p1',
      amount: 100_000,
      method: 'cash',
      status: 'paid',
      type: 'INCOME',
      date: new Date('2026-06-10T00:00:00.000Z'),
      description: 'Plomba',
      discount: null,
      serviceId: null,
      visitId: null,
      ...partial,
    }) as any;

  beforeEach(() => {
    repo = {
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      findById: jest.fn(),
      createWithAudit: jest.fn().mockResolvedValue(payment()),
      updateWithAudit: jest.fn().mockResolvedValue(payment()),
      deleteWithAudit: jest.fn(),
      listAudit: jest.fn().mockResolvedValue([]),
      sumAmount: jest.fn(),
      getDoctorStats: jest.fn(),
      getDebtSummary: jest.fn().mockResolvedValue({ total: 0, count: 0 }),
      findVisitOwner: jest
        .fn()
        .mockResolvedValue({ id: 'v1', patientId: 'p1', price: 200_000 }),
    };
    service = new PaymentsService(repo as unknown as PaymentsRepository);
  });

  afterEach(() => jest.useRealTimers());

  describe('findAll', () => {
    const where = () => repo.findAll.mock.calls[0][0] as any;

    it('default — bo‘sh where', async () => {
      await service.findAll({});
      expect(repo.findAll).toHaveBeenCalledWith({}, { skip: 0, take: 10 });
    });

    it('"all" qiymatlar e’tiborsiz', async () => {
      await service.findAll({
        status: 'all',
        method: 'all',
        type: 'all',
        dateRange: 'all',
      });
      expect(where()).toEqual({});
    });

    it('status/method/type/patientId filtrlari', async () => {
      await service.findAll({
        status: 'paid',
        method: 'card',
        type: 'EXPENSE',
        patientId: 'p1',
        page: 1,
        limit: 50,
      });
      expect(repo.findAll).toHaveBeenCalledWith(
        { patientId: 'p1', status: 'paid', method: 'card', type: 'EXPENSE' },
        { skip: 50, take: 50 },
      );
    });

    it('search — tavsif yoki bemor ismi', async () => {
      await service.findAll({ search: ' ali ' });
      expect(where()).toEqual({
        OR: [
          { description: { contains: 'ali', mode: 'insensitive' } },
          {
            patient: {
              OR: [
                { firstName: { contains: 'ali', mode: 'insensitive' } },
                { lastName: { contains: 'ali', mode: 'insensitive' } },
              ],
            },
          },
        ],
      });
    });

    it('startDate/endDate', async () => {
      await service.findAll({ startDate: '2026-06-01', endDate: '2026-06-30' });
      expect(where().date).toEqual({
        gte: new Date('2026-06-01T00:00:00.000Z'),
        lte: new Date('2026-06-30T00:00:00.000Z'),
      });
    });

    it('faqat endDate', async () => {
      await service.findAll({ endDate: '2026-06-30' });
      expect(where().date).toEqual({
        lte: new Date('2026-06-30T00:00:00.000Z'),
      });
    });

    it('dateRange today — Toshkent kuni (UTC 19:00 dan keyin ertangi kun)', async () => {
      jest.useFakeTimers({ now: new Date('2026-06-17T19:30:00.000Z') });
      await service.findAll({ dateRange: 'today' });
      expect(where().date).toEqual({
        gte: new Date('2026-06-18T00:00:00.000Z'),
        lte: new Date('2026-06-18T00:00:00.000Z'),
      });
    });

    it('sortBy — orderBy uzatiladi', async () => {
      await service.findAll({ sortBy: 'amount', order: 'desc' });
      expect(repo.findAll.mock.calls[0][1]).toEqual({
        skip: 0,
        take: 10,
        orderBy: [{ amount: 'desc' }, { id: 'desc' }],
      });
    });

    it('dateRange today', async () => {
      jest.useFakeTimers({ now: new Date('2026-06-17T05:00:00.000Z') });
      await service.findAll({ dateRange: 'today' });
      expect(where().date).toEqual({
        gte: new Date('2026-06-17T00:00:00.000Z'),
        lte: new Date('2026-06-17T00:00:00.000Z'),
      });
    });

    it('dateRange week (yakshanba)', async () => {
      jest.useFakeTimers({ now: new Date('2026-06-21T05:00:00.000Z') });
      await service.findAll({ dateRange: 'week' });
      expect(where().date).toEqual({
        gte: new Date('2026-06-15T00:00:00.000Z'),
        lte: new Date('2026-06-21T00:00:00.000Z'),
      });
    });

    it('dateRange week (dushanba)', async () => {
      jest.useFakeTimers({ now: new Date('2026-06-15T05:00:00.000Z') });
      await service.findAll({ dateRange: 'week' });
      expect(where().date).toEqual({
        gte: new Date('2026-06-15T00:00:00.000Z'),
        lte: new Date('2026-06-21T00:00:00.000Z'),
      });
    });

    it('dateRange month (dekabr → yil chegarasi)', async () => {
      jest.useFakeTimers({ now: new Date('2026-12-20T05:00:00.000Z') });
      await service.findAll({ dateRange: 'month' });
      expect(where().date).toEqual({
        gte: new Date('2026-12-01T00:00:00.000Z'),
        lte: new Date('2026-12-31T00:00:00.000Z'),
      });
    });

    it('response — null ixtiyoriy maydonlar undefined', async () => {
      repo.findAll.mockResolvedValue({
        data: [
          payment(),
          payment({ id: 'pay2', discount: 10, serviceId: 's1', visitId: 'v1' }),
        ],
        total: 2,
      });
      const out = await service.findAll({});
      expect(out.data[0]).toEqual({
        id: 'pay1',
        patientId: 'p1',
        amount: 100_000,
        method: 'cash',
        status: 'paid',
        date: '2026-06-10',
        description: 'Plomba',
        type: 'INCOME',
        discount: undefined,
        serviceId: undefined,
        visitId: undefined,
      });
      expect(out.data[1]).toMatchObject({
        discount: 10,
        serviceId: 's1',
        visitId: 'v1',
      });
    });
  });

  describe('findOne', () => {
    it('404', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findOne('x')).rejects.toThrow(
        new NotFoundException("To'lov topilmadi"),
      );
    });

    it('topildi', async () => {
      repo.findById.mockResolvedValue(payment());
      await expect(service.findOne('pay1')).resolves.toMatchObject({
        id: 'pay1',
      });
    });
  });

  describe('create', () => {
    const dto = {
      patientId: 'p1',
      amount: 100_000,
      method: 'cash' as const,
      status: 'paid' as const,
      description: 'Plomba',
    };

    it('default type INCOME va bugungi sana (Asia/Tashkent)', async () => {
      // 2026-06-17 22:00Z = 2026-06-18 03:00 Toshkent
      jest.useFakeTimers({ now: new Date('2026-06-17T22:00:00.000Z') });
      await service.create(dto, admin);
      expect(repo.createWithAudit).toHaveBeenCalledWith(
        {
          patient: { connect: { id: 'p1', deletedAt: null } },
          amount: 100_000,
          method: 'cash',
          status: 'paid',
          date: new Date('2026-06-18T00:00:00.000Z'),
          description: 'Plomba',
          type: 'INCOME',
          discount: undefined,
          service: undefined,
          visit: undefined,
        },
        { id: 'u1', name: 'Admin' },
      );
    });

    it('EXPENSE, sana, service va visit bilan', async () => {
      await service.create(
        {
          ...dto,
          type: 'EXPENSE',
          date: '2026-06-01',
          discount: 5,
          serviceId: 's1',
          visitId: 'v1',
        },
        admin,
      );
      expect(repo.createWithAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'EXPENSE',
          date: new Date('2026-06-01T00:00:00.000Z'),
          discount: 5,
          service: { connect: { id: 's1' } },
          visit: { connect: { id: 'v1' } },
        }),
        { id: 'u1', name: 'Admin' },
      );
    });
  });

  describe('visitId — tashrif shu bemorga tegishli bo‘lishi shart', () => {
    const dto = {
      patientId: 'p1',
      amount: 100_000,
      method: 'cash' as const,
      status: 'paid' as const,
      description: 'Plomba',
    };

    it('create — boshqa bemor tashrifi 400, yozilmaydi', async () => {
      repo.findVisitOwner.mockResolvedValue({
        id: 'v9',
        patientId: 'p2',
        price: 200_000,
      });
      await expect(
        service.create({ ...dto, visitId: 'v9' }, admin),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.createWithAudit).not.toHaveBeenCalled();
    });

    it('create — tashrif topilmasa 404', async () => {
      repo.findVisitOwner.mockResolvedValue(null);
      await expect(
        service.create({ ...dto, visitId: 'nope' }, admin),
      ).rejects.toThrow(new NotFoundException('Tashrif topilmadi'));
    });

    it('create — visitId siz tekshirilmaydi', async () => {
      await service.create(dto, admin);
      expect(repo.findVisitOwner).not.toHaveBeenCalled();
    });

    it('update — patientId o‘zgarsa mavjud tashrif bilan tekshiriladi', async () => {
      repo.findById.mockResolvedValue(payment({ visitId: 'v1' }));
      repo.findVisitOwner.mockResolvedValue({
        id: 'v1',
        patientId: 'p1',
        price: 200_000,
      });
      await expect(
        service.update('pay1', { patientId: 'p2' }, admin),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.findVisitOwner).toHaveBeenCalledWith('v1');
      expect(repo.updateWithAudit).not.toHaveBeenCalled();
    });

    it('update — faqat status o‘zgarsa tashrif tekshirilmaydi', async () => {
      repo.findById.mockResolvedValue(payment({ visitId: 'v1' }));
      await service.update('pay1', { status: 'partial' }, admin);
      expect(repo.findVisitOwner).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('404 — update chaqirilmaydi', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(
        service.update('x', { amount: 1 }, admin),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.updateWithAudit).not.toHaveBeenCalled();
    });

    it('qisman update', async () => {
      repo.findById.mockResolvedValue(payment());
      await service.update('pay1', { status: 'partial' }, admin);
      expect(repo.updateWithAudit).toHaveBeenCalledWith(
        'pay1',
        {
          amount: undefined,
          method: undefined,
          status: 'partial',
          description: undefined,
          type: undefined,
          discount: undefined,
          date: undefined,
          patient: undefined,
          service: undefined,
          visit: undefined,
        },
        { id: 'u1', name: 'Admin' },
      );
    });

    it('connect va disconnect', async () => {
      repo.findById.mockResolvedValue(payment());
      await service.update(
        'pay1',
        {
          patientId: 'p2',
          serviceId: 's2',
          visitId: '',
          date: '2026-06-02',
        },
        admin,
      );
      expect(repo.updateWithAudit.mock.calls[0][1]).toMatchObject({
        date: new Date('2026-06-02T00:00:00.000Z'),
        patient: { connect: { id: 'p2' } },
        service: { connect: { id: 's2' } },
        visit: { disconnect: true },
      });
    });

    it('serviceId "" — disconnect, visitId — connect', async () => {
      repo.findById.mockResolvedValue(payment());
      await service.update('pay1', { serviceId: '', visitId: 'v3' }, admin);
      expect(repo.updateWithAudit.mock.calls[0][1]).toMatchObject({
        service: { disconnect: true },
        visit: { connect: { id: 'v3' } },
      });
    });
  });

  describe('remove', () => {
    it('404', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.remove('x', admin)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.deleteWithAudit).not.toHaveBeenCalled();
    });

    it('o‘chiradi', async () => {
      repo.findById.mockResolvedValue(payment());
      await expect(service.remove('pay1', admin)).resolves.toEqual({
        id: 'pay1',
      });
      expect(repo.deleteWithAudit).toHaveBeenCalledWith('pay1', {
        id: 'u1',
        name: 'Admin',
      });
    });
  });

  describe('getStats', () => {
    it('daromad faqat INCOME (paid|partial), xarajat alohida, qarz — balansdan', async () => {
      // 2026-06-17 20:00Z = 2026-06-18 01:00 Toshkent
      jest.useFakeTimers({ now: new Date('2026-06-17T20:00:00.000Z') });
      repo.sumAmount
        .mockResolvedValueOnce(5_000_000) // totalRevenue
        .mockResolvedValueOnce(300_000) // todayRevenue
        .mockResolvedValueOnce(900_000) // totalExpenses
        .mockResolvedValueOnce(50_000); // todayExpenses
      repo.getDebtSummary.mockResolvedValue({ total: 700_000, count: 3 });
      await expect(service.getStats()).resolves.toEqual({
        totalRevenue: 5_000_000,
        pendingAmount: 700_000,
        todayRevenue: 300_000,
        totalExpenses: 900_000,
        todayExpenses: 50_000,
      });
      const collected = { in: ['paid', 'partial'] };
      const today = new Date('2026-06-18T00:00:00.000Z');
      expect(repo.sumAmount).toHaveBeenNthCalledWith(1, {
        type: 'INCOME',
        status: collected,
      });
      expect(repo.sumAmount).toHaveBeenNthCalledWith(2, {
        type: 'INCOME',
        status: collected,
        date: today,
      });
      expect(repo.sumAmount).toHaveBeenNthCalledWith(3, {
        type: 'EXPENSE',
        status: collected,
      });
      expect(repo.sumAmount).toHaveBeenNthCalledWith(4, {
        type: 'EXPENSE',
        status: collected,
        date: today,
      });
    });

    it('falsy summalar 0 ga', async () => {
      repo.sumAmount.mockResolvedValue(null as any);
      repo.getDebtSummary.mockResolvedValue({ total: 0, count: 0 });
      await expect(service.getStats()).resolves.toEqual({
        totalRevenue: 0,
        pendingAmount: 0,
        todayRevenue: 0,
        totalExpenses: 0,
        todayExpenses: 0,
      });
    });

    // Fixed: revenue sums filtered only by status, so EXPENSE ("Chiqim")
    // payments were counted as revenue.
    it('getStats — EXPENSE to‘lovlar daromadga qo‘shilmaydi', async () => {
      await service.getStats();
      const revenueCalls = repo.sumAmount.mock.calls
        .map((c) => c[0] as any)
        .filter((w) => w.type !== 'EXPENSE');
      expect(revenueCalls).toHaveLength(2);
      for (const w of revenueCalls) expect(w.type).toBe('INCOME');
    });
  });

  describe('getDoctorStats', () => {
    it('total saqlanadi, revenue/linkedTotal/percent qo‘shiladi (faqat bog‘langan to‘lovlar)', async () => {
      repo.getDoctorStats.mockResolvedValue([
        { doctorId: 'd1', total: 300 },
        { doctorId: 'd2', total: 100 },
      ]);
      await expect(service.getDoctorStats()).resolves.toEqual([
        {
          doctorId: 'd1',
          total: 300,
          revenue: 300,
          linkedTotal: 400,
          percent: 75,
        },
        {
          doctorId: 'd2',
          total: 100,
          revenue: 100,
          linkedTotal: 400,
          percent: 25,
        },
      ]);
      expect(repo.getDoctorStats).toHaveBeenCalledWith({});
    });

    it('percent 1 xona aniqlikda; bo‘sh ro‘yxat — bo‘sh', async () => {
      repo.getDoctorStats.mockResolvedValue([
        { doctorId: 'd1', total: 1 },
        { doctorId: 'd2', total: 2 },
      ]);
      const out = await service.getDoctorStats();
      expect(out.map((r) => r.percent)).toEqual([33.3, 66.7]);
      repo.getDoctorStats.mockResolvedValue([]);
      await expect(service.getDoctorStats()).resolves.toEqual([]);
    });

    it('davr — to‘lov sanasi oralig‘i repo ga uzatiladi', async () => {
      repo.getDoctorStats.mockResolvedValue([]);
      await service.getDoctorStats({
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      });
      expect(repo.getDoctorStats).toHaveBeenCalledWith({
        gte: new Date('2026-10-01T00:00:00.000Z'),
        lte: new Date('2026-10-31T00:00:00.000Z'),
      });
    });
  });

  describe('create — qayta yuborishdan himoya', () => {
    const dto = {
      patientId: 'p1',
      amount: 50_000,
      method: 'cash',
      status: 'paid',
      description: 'Plomba',
    } as any;

    it('10 soniya ichida xuddi shu to‘lov — 409, ikkinchisi yozilmaydi', async () => {
      jest.useFakeTimers({ now: new Date('2026-11-08T10:00:00.000Z') });
      await service.create(dto, admin);
      jest.setSystemTime(new Date('2026-11-08T10:00:05.000Z'));
      await expect(service.create(dto, admin)).rejects.toThrow(
        new ConflictException(PAYMENT_DUPLICATE_MESSAGE),
      );
      expect(repo.createWithAudit).toHaveBeenCalledTimes(1);
    });

    it('parallel ikki so‘rov — faqat bittasi o‘tadi', async () => {
      const results = await Promise.allSettled([
        service.create(dto, admin),
        service.create(dto, admin),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([
        'fulfilled',
        'rejected',
      ]);
      expect(repo.createWithAudit).toHaveBeenCalledTimes(1);
    });

    it('10 soniyadan keyin qayta kiritish mumkin', async () => {
      jest.useFakeTimers({ now: new Date('2026-11-08T10:00:00.000Z') });
      await service.create(dto, admin);
      jest.setSystemTime(new Date('2026-11-08T10:00:10.000Z'));
      await service.create(dto, admin);
      expect(repo.createWithAudit).toHaveBeenCalledTimes(2);
    });

    it.each([
      ['summa', { amount: 60_000 }],
      ['tur', { type: 'EXPENSE' }],
      ['bemor', { patientId: 'p2' }],
      ['tashrif', { visitId: 'v1' }],
    ])('%s boshqa bo‘lsa — dublikat emas', async (_n, change) => {
      repo.findVisitOwner.mockResolvedValue({
        id: 'v1',
        price: 200_000,
        patientId: (change as any).patientId ?? 'p1',
      });
      await service.create(dto, admin);
      await service.create({ ...dto, ...change }, admin);
      expect(repo.createWithAudit).toHaveBeenCalledTimes(2);
    });

    it('yozish xatosi — qayta urinish mumkin (kalit bo‘shatiladi)', async () => {
      repo.createWithAudit.mockRejectedValueOnce(new Error('db down'));
      await expect(service.create(dto, admin)).rejects.toThrow('db down');
      await expect(service.create(dto, admin)).resolves.toBeDefined();
    });
  });
  describe('chiqim bemorsiz (EXPENSE) va kirim uchun bemor shart', () => {
    const exp = {
      amount: 50_000,
      method: 'cash' as const,
      status: 'paid' as const,
      type: 'EXPENSE' as const,
      description: 'Ijara',
    };

    it('EXPENSE patientId siz yaratiladi, patient connect qilinmaydi', async () => {
      repo.createWithAudit.mockResolvedValue(
        payment({ patientId: null, type: 'EXPENSE', patient: null }),
      );
      const r = await service.create(exp, admin);
      expect(repo.createWithAudit.mock.calls[0][0].patient).toBeUndefined();
      expect(r.patientId).toBeNull();
      expect(r.patient).toBeUndefined();
    });

    it('INCOME patientId siz — 400 (o‘zbekcha), yozilmaydi', async () => {
      await expect(
        service.create({ ...exp, type: 'INCOME' }, admin),
      ).rejects.toThrow(new BadRequestException(PAYMENT_PATIENT_REQUIRED));
      await expect(
        service.create({ ...exp, type: undefined }, admin),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.createWithAudit).not.toHaveBeenCalled();
    });

    it('bemorsiz to‘lovni tashrifga bog‘lab bo‘lmaydi', async () => {
      await expect(
        service.create({ ...exp, visitId: 'v1' }, admin),
      ).rejects.toThrow(new BadRequestException(PAYMENT_VISIT_NEEDS_PATIENT));
    });

    it('update — bemorsiz EXPENSE ni INCOME ga o‘tkazish 400', async () => {
      repo.findById.mockResolvedValue(
        payment({ patientId: null, type: 'EXPENSE' }),
      );
      await expect(
        service.update('pay1', { type: 'INCOME' }, admin),
      ).rejects.toThrow(new BadRequestException(PAYMENT_PATIENT_REQUIRED));
      await service.update('pay1', { amount: 10 }, admin);
      expect(repo.updateWithAudit).toHaveBeenCalledTimes(1);
    });
  });

  describe('sana va chegirma tekshiruvi', () => {
    const dto = {
      patientId: 'p1',
      amount: 100_000,
      method: 'cash' as const,
      status: 'paid' as const,
      description: 'Plomba',
    };

    it('qabul qilingan to‘lov kelajak sanasida — 400', async () => {
      jest.useFakeTimers({ now: new Date('2026-11-11T05:00:00.000Z') });
      await expect(
        service.create({ ...dto, date: '2026-11-12' }, admin),
      ).rejects.toThrow(new BadRequestException(PAYMENT_DATE_FUTURE));
      await service.create({ ...dto, date: '2026-11-11' }, admin);
    });

    it('yig‘ilmagan (unpaid) to‘lov kelajak sanasida mumkin', async () => {
      jest.useFakeTimers({ now: new Date('2026-11-11T05:00:00.000Z') });
      await service.create(
        { ...dto, status: 'unpaid', date: '2026-12-01' },
        admin,
      );
      expect(repo.createWithAudit).toHaveBeenCalled();
    });

    it('2020 dan oldingi sana — 400', async () => {
      await expect(
        service.create({ ...dto, date: '2019-12-31' }, admin),
      ).rejects.toThrow(new BadRequestException(PAYMENT_DATE_TOO_OLD));
    });

    it('update — sana/status o‘zgarsa tekshiriladi', async () => {
      repo.findById.mockResolvedValue(payment({ status: 'unpaid' }));
      jest.useFakeTimers({ now: new Date('2026-11-11T05:00:00.000Z') });
      await expect(
        service.update('pay1', { date: '2027-01-01', status: 'paid' }, admin),
      ).rejects.toThrow(new BadRequestException(PAYMENT_DATE_FUTURE));
    });

    it('chegirma tashrif narxidan katta — 400; teng — mumkin', async () => {
      repo.findVisitOwner.mockResolvedValue({
        id: 'v1',
        patientId: 'p1',
        price: 200_000,
      });
      await expect(
        service.create({ ...dto, visitId: 'v1', discount: 200_001 }, admin),
      ).rejects.toThrow(new BadRequestException(PAYMENT_DISCOUNT_TOO_BIG));
      await service.create({ ...dto, visitId: 'v1', discount: 200_000 }, admin);
      expect(repo.createWithAudit).toHaveBeenCalledTimes(1);
    });

    it('update — chegirma oshirilsa tashrif narxi bilan tekshiriladi', async () => {
      repo.findById.mockResolvedValue(payment({ visitId: 'v1' }));
      await expect(
        service.update('pay1', { discount: 999_999 }, admin),
      ).rejects.toThrow(new BadRequestException(PAYMENT_DISCOUNT_TOO_BIG));
    });
  });

  describe('audit', () => {
    it('create/update/remove actor bilan repositoryga uzatiladi', async () => {
      repo.findById.mockResolvedValue(payment());
      await service.create(
        {
          patientId: 'p1',
          amount: 1,
          method: 'cash',
          status: 'paid',
          description: 'abc',
        },
        admin,
      );
      expect(repo.createWithAudit.mock.calls[0][1]).toEqual({
        id: 'u1',
        name: 'Admin',
      });
      await service.update('pay1', { amount: 5 }, admin);
      expect(repo.updateWithAudit.mock.calls[0][2]).toEqual({
        id: 'u1',
        name: 'Admin',
      });
    });

    it('getAudit — sana ISO ga o‘giriladi', async () => {
      repo.listAudit.mockResolvedValue([
        {
          id: 'a1',
          paymentId: 'pay1',
          action: 'delete',
          actorId: 'u1',
          actorName: 'Admin',
          before: { id: 'pay1' },
          after: null,
          createdAt: new Date('2026-11-11T05:00:00.000Z'),
        },
      ] as any);
      await expect(service.getAudit('pay1')).resolves.toEqual([
        expect.objectContaining({
          action: 'delete',
          createdAt: '2026-11-11T05:00:00.000Z',
        }),
      ]);
    });

    it('toResponse createdAt/createdById ni qaytaradi', async () => {
      repo.findById.mockResolvedValue(
        payment({
          createdAt: new Date('2026-11-11T05:00:00.000Z'),
          createdById: 'u1',
        }),
      );
      await expect(service.findOne('pay1')).resolves.toMatchObject({
        createdAt: '2026-11-11T05:00:00.000Z',
        createdById: 'u1',
      });
    });
  });
});
