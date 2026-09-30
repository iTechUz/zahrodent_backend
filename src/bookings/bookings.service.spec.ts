import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsRepository } from './bookings.repository';
import type { AuthUserView } from '../auth/auth.service';

describe('BookingsService', () => {
  let service: BookingsService;
  let repo: jest.Mocked<
    Pick<
      BookingsRepository,
      | 'findAll'
      | 'findById'
      | 'create'
      | 'update'
      | 'delete'
      | 'count'
      | 'findServiceById'
      | 'findManyWithService'
      | 'findDoctorAvailability'
      | 'withDoctorDayLock'
    >
  >;
  const user: AuthUserView = {
    id: 'u1',
    name: 'Test',
    phone: '+998901234567',
    role: 'receptionist',
  };
  const doctor: AuthUserView = {
    id: 'u2',
    name: 'Dr',
    phone: '+998901234568',
    role: 'doctor',
    doctorId: 'd1',
  };

  const booking = (partial: Record<string, unknown> = {}) =>
    ({
      id: 'b1',
      patientId: 'p1',
      doctorId: 'd1',
      date: new Date('2026-06-10T00:00:00.000Z'),
      time: '10:00',
      source: 'phone',
      status: 'pending',
      notes: '',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      serviceId: null,
      reminderSentAt: null,
      ...partial,
    }) as any;

  beforeEach(() => {
    repo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn().mockResolvedValue(booking()),
      update: jest.fn().mockResolvedValue(booking()),
      delete: jest.fn(),
      count: jest.fn(),
      findServiceById: jest.fn(),
      findManyWithService: jest.fn().mockResolvedValue([]),
      findDoctorAvailability: jest
        .fn()
        .mockResolvedValue({ id: 'd1', schedule: null, daysOff: null }),
      withDoctorDayLock: jest.fn(
        async (_d: string, _date: string, fn: (tx: any) => Promise<any>) =>
          fn('tx'),
      ) as any,
    };
    service = new BookingsService(repo as unknown as BookingsRepository);
  });

  afterEach(() => jest.useRealTimers());

  it('findAll — patientId where ga tushadi', async () => {
    repo.findAll.mockResolvedValue({ data: [], total: 0 } as any);
    await service.findAll({ patientId: 'p1', limit: 10, page: 0 }, user);
    expect(repo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: 'p1' }),
      { skip: 0, take: 10 },
    );
  });

  it('findAll — status "all" bo‘lsa where.status yo‘q', async () => {
    repo.findAll.mockResolvedValue({ data: [], total: 0 } as any);
    await service.findAll({ status: 'all', limit: 10, page: 0 }, user);
    expect(repo.findAll).toHaveBeenCalledWith({}, { skip: 0, take: 10 });
  });

  it('findOne — topilmasa 404', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.findOne('x', user)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  describe('findAll — filtrlar', () => {
    beforeEach(() => {
      repo.findAll.mockResolvedValue({ data: [], total: 0 } as any);
    });
    const where = () => repo.findAll.mock.calls[0][0] as any;

    it('default page/limit', async () => {
      await service.findAll({}, user);
      expect(repo.findAll).toHaveBeenCalledWith({}, { skip: 0, take: 10 });
    });

    it('status, source filtrlari ("all" dan boshqa)', async () => {
      await service.findAll(
        { status: 'confirmed', source: 'telegram', page: 2, limit: 5 },
        user,
      );
      expect(repo.findAll).toHaveBeenCalledWith(
        { status: 'confirmed', source: 'telegram' },
        { skip: 10, take: 5 },
      );
    });

    it('source "all" e’tiborsiz', async () => {
      await service.findAll({ source: 'all' }, user);
      expect(where()).toEqual({});
    });

    it('doctor — faqat o‘z qabullari', async () => {
      await service.findAll({}, doctor);
      expect(where()).toEqual({ doctorId: 'd1' });
    });

    it('search — bemor ismi/familiyasi (trim)', async () => {
      await service.findAll({ search: '  ali ' }, user);
      expect(where()).toEqual({
        patient: {
          OR: [
            { firstName: { contains: 'ali', mode: 'insensitive' } },
            { lastName: { contains: 'ali', mode: 'insensitive' } },
          ],
        },
      });
    });

    it('startDate/endDate — UTC date-only', async () => {
      await service.findAll(
        { startDate: '2026-06-01', endDate: '2026-06-30' },
        user,
      );
      expect(where().date).toEqual({
        gte: new Date('2026-06-01T00:00:00.000Z'),
        lte: new Date('2026-06-30T00:00:00.000Z'),
      });
    });

    it('faqat startDate', async () => {
      await service.findAll({ startDate: '2026-06-01' }, user);
      expect(where().date).toEqual({
        gte: new Date('2026-06-01T00:00:00.000Z'),
      });
    });

    it('faqat endDate', async () => {
      await service.findAll({ endDate: '2026-06-30' }, user);
      expect(where().date).toEqual({
        lte: new Date('2026-06-30T00:00:00.000Z'),
      });
    });

    it('startDate dateRange dan ustun', async () => {
      await service.findAll(
        { startDate: '2026-06-01', dateRange: 'today' },
        user,
      );
      expect(where().date).toEqual({
        gte: new Date('2026-06-01T00:00:00.000Z'),
      });
    });

    it('dateRange today — Asia/Tashkent bo‘yicha bugun (UTC+5)', async () => {
      // 2026-06-17 20:00Z = 2026-06-18 01:00 Toshkent
      jest.useFakeTimers({ now: new Date('2026-06-17T20:00:00.000Z') });
      await service.findAll({ dateRange: 'today' }, user);
      expect(where().date).toEqual({
        gte: new Date('2026-06-18T00:00:00.000Z'),
        lte: new Date('2026-06-18T00:00:00.000Z'),
      });
    });

    it('doctorId filtri (admin/receptionist)', async () => {
      await service.findAll({ doctorId: 'd7' }, user);
      expect(where()).toEqual({ doctorId: 'd7' });
    });

    it('doctor — doctorId query e’tiborsiz, doim o‘ziniki', async () => {
      await service.findAll({ doctorId: 'd7' }, doctor);
      expect(where()).toEqual({ doctorId: 'd1' });
    });

    it('sortBy/order — orderBy va id tie-breaker', async () => {
      await service.findAll({ sortBy: 'time', order: 'asc' }, user);
      expect(repo.findAll.mock.calls[0][1]).toEqual({
        skip: 0,
        take: 10,
        orderBy: [{ time: 'asc' }, { id: 'asc' }],
      });
    });

    it('faqat order — standart maydon (date) ga qo‘llanadi', async () => {
      await service.findAll({ order: 'asc' }, user);
      expect(repo.findAll.mock.calls[0][1].orderBy).toEqual([
        { date: 'asc' },
        { id: 'asc' },
      ]);
    });

    it('dateRange today — bugungi UTC kun', async () => {
      jest.useFakeTimers({ now: new Date('2026-06-17T15:30:00.000Z') });
      await service.findAll({ dateRange: 'today' }, user);
      expect(where().date).toEqual({
        gte: new Date('2026-06-17T00:00:00.000Z'),
        lte: new Date('2026-06-17T00:00:00.000Z'),
      });
    });

    it('dateRange week — dushanbadan yakshanbagacha (chorshanba)', async () => {
      // 2026-06-17 — chorshanba
      jest.useFakeTimers({ now: new Date('2026-06-17T15:30:00.000Z') });
      await service.findAll({ dateRange: 'week' }, user);
      expect(where().date).toEqual({
        gte: new Date('2026-06-15T00:00:00.000Z'),
        lte: new Date('2026-06-21T00:00:00.000Z'),
      });
    });

    it('dateRange week — yakshanba oldingi dushanbaga tegishli', async () => {
      jest.useFakeTimers({ now: new Date('2026-06-21T10:00:00.000Z') });
      await service.findAll({ dateRange: 'week' }, user);
      expect(where().date).toEqual({
        gte: new Date('2026-06-15T00:00:00.000Z'),
        lte: new Date('2026-06-21T00:00:00.000Z'),
      });
    });

    it('dateRange week — dushanba o‘zi boshlanish', async () => {
      jest.useFakeTimers({ now: new Date('2026-06-15T01:00:00.000Z') });
      await service.findAll({ dateRange: 'week' }, user);
      expect(where().date.gte).toEqual(new Date('2026-06-15T00:00:00.000Z'));
    });

    it('dateRange week — oy chegarasidan o‘tadi', async () => {
      // 2026-07-01 — chorshanba
      jest.useFakeTimers({ now: new Date('2026-07-01T12:00:00.000Z') });
      await service.findAll({ dateRange: 'week' }, user);
      expect(where().date).toEqual({
        gte: new Date('2026-06-29T00:00:00.000Z'),
        lte: new Date('2026-07-05T00:00:00.000Z'),
      });
    });

    it('dateRange month — oyning 1-sidan oxirigacha (fevral, kabisa)', async () => {
      jest.useFakeTimers({ now: new Date('2028-02-10T12:00:00.000Z') });
      await service.findAll({ dateRange: 'month' }, user);
      expect(where().date).toEqual({
        gte: new Date('2028-02-01T00:00:00.000Z'),
        lte: new Date('2028-02-29T00:00:00.000Z'),
      });
    });

    it('response formatiga o‘giradi', async () => {
      repo.findAll.mockResolvedValue({
        data: [booking({ notes: 'x', serviceId: 's1' }), booking({ id: 'b2' })],
        total: 2,
      } as any);
      const out = await service.findAll({}, user);
      expect(out.total).toBe(2);
      expect(out.data[0]).toEqual({
        id: 'b1',
        patientId: 'p1',
        doctorId: 'd1',
        date: '2026-06-10',
        time: '10:00',
        source: 'phone',
        status: 'pending',
        notes: 'x',
        createdAt: '2026-06-01',
        serviceId: 's1',
      });
      expect(out.data[1].notes).toBeUndefined();
      expect(out.data[1].serviceId).toBeUndefined();
    });

    it('o‘chirilgan bemor qabuli — patient nomi va deletedAt saqlanadi', async () => {
      repo.findAll.mockResolvedValue({
        data: [
          {
            ...booking(),
            patient: {
              firstName: 'Ali',
              lastName: 'Valiyev',
              deletedAt: new Date('2026-07-01T10:00:00.000Z'),
            },
          },
        ],
        total: 1,
      } as any);
      const out = await service.findAll({}, user);
      expect(out.data[0].patient).toEqual({
        firstName: 'Ali',
        lastName: 'Valiyev',
        deletedAt: '2026-07-01T10:00:00.000Z',
      });
    });
  });

  describe('findOne', () => {
    it('receptionist — istalgan qabul', async () => {
      repo.findById.mockResolvedValue(booking({ doctorId: 'other' }));
      await expect(service.findOne('b1', user)).resolves.toMatchObject({
        id: 'b1',
      });
    });

    it('doctor — boshqa shifokor qabuli 404 (access restricted)', async () => {
      repo.findById.mockResolvedValue(booking({ doctorId: 'other' }));
      await expect(service.findOne('b1', doctor)).rejects.toThrow(
        new NotFoundException('Qabul topilmadi'),
      );
    });

    it('doctor — o‘z qabuli', async () => {
      repo.findById.mockResolvedValue(booking());
      await expect(service.findOne('b1', doctor)).resolves.toMatchObject({
        doctorId: 'd1',
      });
    });
  });

  describe('create', () => {
    beforeEach(() => {
      jest.useFakeTimers({ now: new Date('2026-06-01T08:00:00.000Z') });
    });

    const dto = {
      patientId: 'p1',
      doctorId: 'd1',
      date: '2026-06-10',
      time: '10:00',
      source: 'phone' as const,
      status: 'pending' as const,
    };

    it('to‘qnashuv yo‘q — yaratadi (service siz)', async () => {
      const out = await service.create(dto);
      expect(repo.findServiceById).not.toHaveBeenCalled();
      expect(repo.withDoctorDayLock).toHaveBeenCalledWith(
        'd1',
        '2026-06-10',
        expect.any(Function),
      );
      expect(repo.findManyWithService).toHaveBeenCalledWith(
        {
          doctorId: 'd1',
          date: new Date('2026-06-10T00:00:00.000Z'),
          id: undefined,
          status: { in: ['pending', 'confirmed'] },
        },
        'tx',
      );
      expect(repo.create).toHaveBeenCalledWith(
        {
          patient: { connect: { id: 'p1', deletedAt: null } },
          doctor: { connect: { id: 'd1' } },
          date: new Date('2026-06-10T00:00:00.000Z'),
          time: '10:00',
          source: 'phone',
          status: 'pending',
          notes: '',
          service: undefined,
          createdAt: new Date('2026-06-01T00:00:00.000Z'),
        },
        'tx',
      );
      expect(out.date).toBe('2026-06-10');
    });

    it('o‘tgan sana — 400, hech narsa yozilmaydi', async () => {
      await expect(
        service.create({ ...dto, date: '2026-05-31' }),
      ).rejects.toThrow(
        new BadRequestException("O'tgan sanaga qabul yaratib bo'lmaydi"),
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('bugungi sana (Toshkent) — ruxsat', async () => {
      // 2026-06-01 20:00Z = 2026-06-02 01:00 Toshkent
      jest.setSystemTime(new Date('2026-06-01T20:00:00.000Z'));
      await expect(
        service.create({ ...dto, date: '2026-06-01' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.create({ ...dto, date: '2026-06-02' }),
      ).resolves.toBeDefined();
    });

    it('shifokor topilmasa — 404', async () => {
      repo.findDoctorAvailability.mockResolvedValue(null);
      await expect(service.create(dto)).rejects.toThrow('Shifokor topilmadi');
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('dam olish kuni (daysOff) — 400', async () => {
      repo.findDoctorAvailability.mockResolvedValue({
        id: 'd1',
        schedule: null,
        daysOff: ['2026-06-10'],
      } as any);
      await expect(service.create(dto)).rejects.toThrow(
        'Shifokor 2026-06-10 kuni dam oladi — boshqa sanani tanlang',
      );
    });

    describe('ish jadvali (0 = dushanba)', () => {
      // 2026-06-10 — chorshanba → day 2
      const schedule = (slot: Record<string, unknown>) => [
        { day: 0, startTime: '09:00', endTime: '18:00', isWorking: true },
        {
          day: 2,
          startTime: '09:00',
          endTime: '12:00',
          isWorking: true,
          ...slot,
        },
      ];

      it('ishlamaydigan kun — 400', async () => {
        repo.findDoctorAvailability.mockResolvedValue({
          id: 'd1',
          schedule: schedule({ isWorking: false }),
          daysOff: null,
        } as any);
        await expect(service.create(dto)).rejects.toThrow(
          'Shifokor bu hafta kunida ishlamaydi',
        );
      });

      it('ish vaqtidan tashqarida (tugashi oshib ketadi) — 400', async () => {
        repo.findDoctorAvailability.mockResolvedValue({
          id: 'd1',
          schedule: schedule({}),
          daysOff: null,
        } as any);
        await expect(service.create({ ...dto, time: '11:45' })).rejects.toThrow(
          '(09:00–12:00)',
        );
        await expect(
          service.create({ ...dto, time: '08:30' }),
        ).rejects.toBeInstanceOf(BadRequestException);
      });

      it('ish vaqti ichida — yaratadi', async () => {
        repo.findDoctorAvailability.mockResolvedValue({
          id: 'd1',
          schedule: schedule({ startTime: '09:00:00', endTime: '12:00:00' }),
          daysOff: null,
        } as any);
        await expect(
          service.create({ ...dto, time: '11:30' }),
        ).resolves.toBeDefined();
      });

      it('hamma kun isWorking=false (sozlanmagan) — tekshirilmaydi', async () => {
        repo.findDoctorAvailability.mockResolvedValue({
          id: 'd1',
          schedule: [
            { day: 2, startTime: '09:00', endTime: '10:00', isWorking: false },
          ],
          daysOff: null,
        } as any);
        await expect(service.create(dto)).resolves.toBeDefined();
      });
    });

    it('cancelled holatda yaratish — to‘qnashuv tekshirilmaydi', async () => {
      repo.findManyWithService.mockResolvedValue([
        booking({ time: '10:00', service: null }),
      ]);
      await expect(
        service.create({ ...dto, status: 'cancelled' as any }),
      ).resolves.toBeDefined();
      expect(repo.findManyWithService).not.toHaveBeenCalled();
    });

    it('serviceId bilan — connect va duration olinadi', async () => {
      repo.findServiceById.mockResolvedValue({ duration: 60 } as any);
      await service.create({ ...dto, serviceId: 's1', notes: 'n' });
      expect(repo.findServiceById).toHaveBeenCalledWith('s1');
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: 'n',
          service: { connect: { id: 's1' } },
        }),
        'tx',
      );
    });

    it('bir xil vaqt — 409 Uzbek xabar', async () => {
      repo.findManyWithService.mockResolvedValue([
        booking({ time: '10:00', service: null }),
      ]);
      await expect(service.create(dto)).rejects.toThrow(
        new ConflictException(
          "Vaqtlar to'qnashuvi: Shifokor bu vaqtda band (10:00)",
        ),
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('mavjud qabul uzun (60 min) — xabarda tugash vaqti', async () => {
      repo.findManyWithService.mockResolvedValue([
        booking({ time: '09:30', service: { duration: 60 } }),
      ]);
      await expect(service.create(dto)).rejects.toThrow(
        "Vaqtlar to'qnashuvi: Shifokor bu vaqtda band (09:30 - 10:30)",
      );
    });

    it('yangi qabul uzun bo‘lib keyingisiga kirsa — 409', async () => {
      repo.findServiceById.mockResolvedValue({ duration: 90 } as any);
      repo.findManyWithService.mockResolvedValue([
        booking({ time: '11:00', service: null }),
      ]);
      await expect(
        service.create({ ...dto, serviceId: 's1' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('ketma-ket (tegib turgan) oraliqlar to‘qnashmaydi', async () => {
      repo.findManyWithService.mockResolvedValue([
        booking({ time: '09:30', service: null }), // 09:30-10:00
        booking({ id: 'b3', time: '10:30', service: null }), // 10:30-11:00
      ]);
      await expect(service.create(dto)).resolves.toBeDefined();
    });

    it('service topilmasa default 30 min', async () => {
      repo.findServiceById.mockResolvedValue(null);
      repo.findManyWithService.mockResolvedValue([
        booking({ time: '10:30', service: null }),
      ]);
      await expect(
        service.create({ ...dto, serviceId: 'missing' }),
      ).resolves.toBeDefined();
    });

    it('tugash vaqti HH:MM formatida (125 min)', async () => {
      repo.findManyWithService.mockResolvedValue([
        booking({ time: '08:00', service: { duration: 125 } }),
      ]);
      await expect(service.create({ ...dto, time: '09:00' })).rejects.toThrow(
        '(08:00 - 10:05)',
      );
    });
  });

  describe('update', () => {
    it('topilmasa 404', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.update('x', {}, user)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('doctor — boshqa shifokor qabulini o‘zgartira olmaydi', async () => {
      repo.findById.mockResolvedValue(booking({ doctorId: 'other' }));
      await expect(
        service.update('b1', { notes: 'x' }, doctor),
      ).rejects.toThrow('Qabul topilmadi');
    });

    it('faqat status/notes — to‘qnashuv tekshirilmaydi', async () => {
      repo.findById.mockResolvedValue(booking());
      await service.update('b1', { status: 'confirmed', notes: 'ok' }, user);
      expect(repo.findManyWithService).not.toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalledWith('b1', {
        date: undefined,
        time: undefined,
        source: undefined,
        status: 'confirmed',
        notes: 'ok',
        patient: undefined,
        doctor: undefined,
        service: undefined,
      });
    });

    it('vaqt o‘zgarsa — joriy qiymatlar bilan tekshiriladi, o‘zi chiqarib tashlanadi', async () => {
      repo.findById.mockResolvedValue(booking({ serviceId: 's1' }));
      repo.findServiceById.mockResolvedValue({ duration: 45 } as any);
      await service.update('b1', { time: '11:00' }, user);
      expect(repo.findServiceById).toHaveBeenCalledWith('s1');
      expect(repo.findManyWithService).toHaveBeenCalledWith(
        {
          doctorId: 'd1',
          date: new Date('2026-06-10T00:00:00.000Z'),
          id: { not: 'b1' },
          status: { in: ['pending', 'confirmed'] },
        },
        'tx',
      );
      expect(repo.update.mock.calls[0][1]).toMatchObject({ time: '11:00' });
      expect(repo.update.mock.calls[0][2]).toBe('tx');
    });

    it('yangi sana/shifokor bilan to‘qnashuv — 409', async () => {
      repo.findById.mockResolvedValue(booking());
      repo.findManyWithService.mockResolvedValue([
        booking({ id: 'b9', doctorId: 'd2', time: '10:15', service: null }),
      ]);
      await expect(
        service.update('b1', { doctorId: 'd2', date: '2026-06-11' }, user),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repo.findManyWithService).toHaveBeenCalledWith(
        expect.objectContaining({
          doctorId: 'd2',
          date: new Date('2026-06-11T00:00:00.000Z'),
        }),
        'tx',
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('relation o‘zgarishlari connect ko‘rinishida', async () => {
      repo.findById.mockResolvedValue(booking());
      await service.update(
        'b1',
        {
          patientId: 'p2',
          doctorId: 'd2',
          serviceId: 's2',
          date: '2026-07-01',
          source: 'website',
        },
        user,
      );
      expect(repo.update).toHaveBeenCalledWith(
        'b1',
        expect.objectContaining({
          date: new Date('2026-07-01T00:00:00.000Z'),
          source: 'website',
          patient: { connect: { id: 'p2', deletedAt: null } },
          doctor: { connect: { id: 'd2' } },
          service: { connect: { id: 's2' } },
        }),
        'tx',
      );
    });

    it('serviceId "" — service disconnect, default 30 min bilan tekshiriladi', async () => {
      repo.findById.mockResolvedValue(booking({ serviceId: 's1' }));
      await service.update('b1', { serviceId: '', time: '12:00' }, user);
      expect(repo.findServiceById).not.toHaveBeenCalled();
      expect(repo.update.mock.calls[0][1].service).toEqual({
        disconnect: true,
      });
    });

    // Fixed: re-activating a cancelled/no-show booking into a slot that has
    // since been taken used to skip the conflict check (double-booking).
    it('update — status faol holatga qaytarilsa ham to‘qnashuv tekshiriladi', async () => {
      repo.findById.mockResolvedValue(booking({ status: 'cancelled' }));
      repo.findManyWithService.mockResolvedValue([
        booking({ id: 'b9', time: '10:00', service: null }),
      ]);
      await expect(
        service.update('b1', { status: 'pending' }, user),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repo.findManyWithService).toHaveBeenCalledWith(
        expect.objectContaining({ id: { not: 'b1' }, doctorId: 'd1' }),
        'tx',
      );
      expect(repo.update).not.toHaveBeenCalled();
      // slot unchanged → schedule is not re-checked
      expect(repo.findDoctorAvailability).not.toHaveBeenCalled();
    });

    it('update — faol → faol (pending → confirmed) qayta tekshirilmaydi', async () => {
      repo.findById.mockResolvedValue(booking({ status: 'pending' }));
      await service.update('b1', { status: 'confirmed' }, user);
      expect(repo.findManyWithService).not.toHaveBeenCalled();
    });

    it('update — bekor qilinayotgan qabul vaqti o‘zgarsa ham tekshirilmaydi', async () => {
      repo.findById.mockResolvedValue(booking());
      repo.findManyWithService.mockResolvedValue([
        booking({ id: 'b9', time: '11:00', service: null }),
      ]);
      await service.update('b1', { status: 'cancelled', time: '11:00' }, user);
      expect(repo.findManyWithService).not.toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalled();
    });

    it('doctor profili yo‘q (doctorId yo‘q) — 403, hech narsa o‘qilmaydi', async () => {
      const orphan = { ...doctor, doctorId: undefined };
      await expect(service.findAll({}, orphan)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.findOne('b1', orphan)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.getStats(orphan)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(repo.findAll).not.toHaveBeenCalled();
      expect(repo.findById).not.toHaveBeenCalled();
      expect(repo.count).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('404', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.remove('x', user)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('doctor — begona qabulni o‘chira olmaydi', async () => {
      repo.findById.mockResolvedValue(booking({ doctorId: 'other' }));
      await expect(service.remove('b1', doctor)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('o‘chiradi', async () => {
      repo.findById.mockResolvedValue(booking());
      await expect(service.remove('b1', user)).resolves.toEqual({ id: 'b1' });
      expect(repo.delete).toHaveBeenCalledWith('b1');
    });
  });

  describe('getStats', () => {
    it('bugun, pending, bugun yakunlangan', async () => {
      // 2026-06-17 20:00Z = 2026-06-18 01:00 Toshkent
      jest.useFakeTimers({ now: new Date('2026-06-17T20:00:00.000Z') });
      repo.count
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2);
      await expect(service.getStats(user)).resolves.toEqual({
        today: 8,
        pending: 3,
        completedToday: 2,
      });
      const today = new Date('2026-06-18T00:00:00.000Z');
      expect(repo.count).toHaveBeenNthCalledWith(1, { date: today });
      expect(repo.count).toHaveBeenNthCalledWith(2, { status: 'pending' });
      expect(repo.count).toHaveBeenNthCalledWith(3, {
        status: 'completed',
        date: today,
      });
    });

    it('doctor — barcha count lar doctorId bilan', async () => {
      repo.count.mockResolvedValue(0);
      await service.getStats(doctor);
      expect(repo.count).toHaveBeenCalledTimes(3);
      for (const call of repo.count.mock.calls) {
        expect(call[0]).toMatchObject({ doctorId: 'd1' });
      }
    });
  });
});
