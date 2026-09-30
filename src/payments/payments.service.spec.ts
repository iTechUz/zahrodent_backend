import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repository';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let repo: jest.Mocked<
    Pick<
      PaymentsRepository,
      | 'findAll'
      | 'findById'
      | 'create'
      | 'update'
      | 'delete'
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
      create: jest.fn().mockResolvedValue(payment()),
      update: jest.fn().mockResolvedValue(payment()),
      delete: jest.fn(),
      sumAmount: jest.fn(),
      getDoctorStats: jest.fn(),
      getDebtSummary: jest.fn().mockResolvedValue({ total: 0, count: 0 }),
      findVisitOwner: jest
        .fn()
        .mockResolvedValue({ id: 'v1', patientId: 'p1' }),
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
      await service.create(dto);
      expect(repo.create).toHaveBeenCalledWith({
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
      });
    });

    it('EXPENSE, sana, service va visit bilan', async () => {
      await service.create({
        ...dto,
        type: 'EXPENSE',
        date: '2026-06-01',
        discount: 5,
        serviceId: 's1',
        visitId: 'v1',
      });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'EXPENSE',
          date: new Date('2026-06-01T00:00:00.000Z'),
          discount: 5,
          service: { connect: { id: 's1' } },
          visit: { connect: { id: 'v1' } },
        }),
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
      repo.findVisitOwner.mockResolvedValue({ id: 'v9', patientId: 'p2' });
      await expect(
        service.create({ ...dto, visitId: 'v9' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('create — tashrif topilmasa 404', async () => {
      repo.findVisitOwner.mockResolvedValue(null);
      await expect(service.create({ ...dto, visitId: 'nope' })).rejects.toThrow(
        new NotFoundException('Tashrif topilmadi'),
      );
    });

    it('create — visitId siz tekshirilmaydi', async () => {
      await service.create(dto);
      expect(repo.findVisitOwner).not.toHaveBeenCalled();
    });

    it('update — patientId o‘zgarsa mavjud tashrif bilan tekshiriladi', async () => {
      repo.findById.mockResolvedValue(payment({ visitId: 'v1' }));
      repo.findVisitOwner.mockResolvedValue({ id: 'v1', patientId: 'p1' });
      await expect(
        service.update('pay1', { patientId: 'p2' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.findVisitOwner).toHaveBeenCalledWith('v1');
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('update — faqat status o‘zgarsa tashrif tekshirilmaydi', async () => {
      repo.findById.mockResolvedValue(payment({ visitId: 'v1' }));
      await service.update('pay1', { status: 'partial' });
      expect(repo.findVisitOwner).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('404 — update chaqirilmaydi', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.update('x', { amount: 1 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('qisman update', async () => {
      repo.findById.mockResolvedValue(payment());
      await service.update('pay1', { status: 'partial' });
      expect(repo.update).toHaveBeenCalledWith('pay1', {
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
      });
    });

    it('connect va disconnect', async () => {
      repo.findById.mockResolvedValue(payment());
      await service.update('pay1', {
        patientId: 'p2',
        serviceId: 's2',
        visitId: '',
        date: '2026-06-02',
      });
      expect(repo.update.mock.calls[0][1]).toMatchObject({
        date: new Date('2026-06-02T00:00:00.000Z'),
        patient: { connect: { id: 'p2' } },
        service: { connect: { id: 's2' } },
        visit: { disconnect: true },
      });
    });

    it('serviceId "" — disconnect, visitId — connect', async () => {
      repo.findById.mockResolvedValue(payment());
      await service.update('pay1', { serviceId: '', visitId: 'v3' });
      expect(repo.update.mock.calls[0][1]).toMatchObject({
        service: { disconnect: true },
        visit: { connect: { id: 'v3' } },
      });
    });
  });

  describe('remove', () => {
    it('404', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.remove('x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('o‘chiradi', async () => {
      repo.findById.mockResolvedValue(payment());
      await expect(service.remove('pay1')).resolves.toEqual({ id: 'pay1' });
      expect(repo.delete).toHaveBeenCalledWith('pay1');
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

  it('getDoctorStats — repo ga delegatsiya', async () => {
    repo.getDoctorStats.mockResolvedValue([{ doctorId: 'd1', total: 10 }]);
    await expect(service.getDoctorStats()).resolves.toEqual([
      { doctorId: 'd1', total: 10 },
    ]);
  });
});
