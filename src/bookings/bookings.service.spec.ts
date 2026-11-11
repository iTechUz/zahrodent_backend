import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ACTIVE_BOOKING_STATUSES,
  BOOKING_TOO_FAR_MESSAGE,
  BookingsService,
  DOCTOR_INACTIVE_MESSAGE,
  maxBookingDate,
  SLOT_OCCUPYING_STATUSES,
} from './bookings.service';
import { COMPLETE_NEEDS_SERVICE_MESSAGE } from './booking-transitions';
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
      | 'withLocks'
      | 'ensureVisitForCompleted'
      | 'findPatientIdsByPhoneDigits'
    >
  >;
  const user: AuthUserView = {
    id: 'u1',
    name: 'Test',
    phone: '+998901234567',
    role: 'receptionist',
  };
  const admin: AuthUserView = { ...user, id: 'u0', role: 'admin' };
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
      withLocks: jest.fn(async (_k: string[], fn: (tx: any) => Promise<any>) =>
        fn('tx'),
      ) as any,
      ensureVisitForCompleted: jest.fn().mockResolvedValue({ created: true }),
      findPatientIdsByPhoneDigits: jest.fn().mockResolvedValue([]),
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
          AND: [
            {
              OR: [
                { firstName: { contains: 'ali', mode: 'insensitive' } },
                { lastName: { contains: 'ali', mode: 'insensitive' } },
              ],
            },
          ],
        },
      });
    });

    it('search — "Ali Valiyev": har bir so‘z ism yoki familiyaga mos (AND)', async () => {
      await service.findAll({ search: 'Ali  Valiyev' }, user);
      const and = where().patient.AND;
      expect(and).toHaveLength(2);
      expect(and[1].OR[0]).toEqual({
        firstName: { contains: 'Valiyev', mode: 'insensitive' },
      });
      expect(repo.findPatientIdsByPhoneDigits).not.toHaveBeenCalled();
    });

    it('search — telefon raqami raqamlar bo‘yicha (formatdan qat’i nazar)', async () => {
      repo.findPatientIdsByPhoneDigits.mockResolvedValue(['p1', 'p2']);
      await service.findAll({ search: '+998 (90) 123' }, user);
      expect(repo.findPatientIdsByPhoneDigits).toHaveBeenCalledWith('99890123');
      expect(where().patient.AND).toEqual([{ id: { in: ['p1', 'p2'] } }]);
    });

    it('search — ism + telefon birga; 3 tadan kam raqam hech narsa topmaydi', async () => {
      repo.findPatientIdsByPhoneDigits.mockResolvedValue(['p1']);
      await service.findAll({ search: 'ali 901234' }, user);
      expect(where().patient.AND).toHaveLength(2);
      expect(where().patient.AND[1]).toEqual({ id: { in: ['p1'] } });
      repo.findAll.mockClear();
      repo.findPatientIdsByPhoneDigits.mockClear();
      await service.findAll({ search: '12' }, user);
      expect(repo.findPatientIdsByPhoneDigits).not.toHaveBeenCalled();
      expect(where().patient.AND).toEqual([{ id: { in: [] } }]);
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

    it('faqat order — standart maydon (date) ga qo‘llanadi: date, time, id', async () => {
      await service.findAll({ order: 'asc' }, user);
      expect(repo.findAll.mock.calls[0][1].orderBy).toEqual([
        { date: 'asc' },
        { time: 'asc' },
        { id: 'asc' },
      ]);
    });

    it('sortBy=date — date, time, id tartibi', async () => {
      await service.findAll({ sortBy: 'date', order: 'desc' }, user);
      expect(repo.findAll.mock.calls[0][1].orderBy).toEqual([
        { date: 'desc' },
        { time: 'desc' },
        { id: 'desc' },
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
          status: { in: ['pending', 'confirmed', 'arrived'] },
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

  describe('bemor ustma-ust, 1 yil limit, nofaol shifokor, shifokor almashtirish', () => {
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

    it('bemor boshqa shifokorda shu vaqtda band — 409, yaratilmaydi', async () => {
      repo.findManyWithService
        .mockResolvedValueOnce([]) // shifokor kuni bo'sh
        .mockResolvedValueOnce([
          booking({ id: 'b9', doctorId: 'd2', time: '10:15', service: null }),
        ]);
      await expect(service.create(dto)).rejects.toThrow(
        "Vaqtlar to'qnashuvi: Bemorning bu vaqtda boshqa shifokorda qabuli bor (10:15 - 10:45)",
      );
      expect(repo.findManyWithService).toHaveBeenLastCalledWith(
        {
          patientId: 'p1',
          doctorId: { not: 'd1' },
          date: new Date('2026-06-10T00:00:00.000Z'),
          id: undefined,
          status: { in: SLOT_OCCUPYING_STATUSES },
        },
        'tx',
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('bemorning boshqa shifokordagi qabuli tegib tursa (ketma-ket) — o‘tadi', async () => {
      repo.findManyWithService
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          booking({ id: 'b9', doctorId: 'd2', time: '09:30', service: null }),
        ]);
      await service.create(dto);
      expect(repo.create).toHaveBeenCalled();
    });

    it('bekor qilingan status bilan yaratishda bemor tekshiruvi yo‘q', async () => {
      await service.create({ ...dto, status: 'cancelled' });
      expect(repo.findManyWithService).not.toHaveBeenCalled();
    });

    it('update — vaqt ko‘chirilsa bemor tekshiriladi (o‘zi chiqarib tashlanadi)', async () => {
      repo.findById.mockResolvedValue(booking());
      repo.findManyWithService
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          booking({ id: 'b9', doctorId: 'd2', time: '11:00', service: null }),
        ]);
      await expect(
        service.update('b1', { time: '11:00' }, user),
      ).rejects.toThrow('Bemorning bu vaqtda boshqa shifokorda');
      expect(repo.findManyWithService).toHaveBeenLastCalledWith(
        expect.objectContaining({ patientId: 'p1', id: { not: 'b1' } }),
        'tx',
      );
    });

    it('create — aynan 1 yil oldinga o‘tadi, undan keyin 400', async () => {
      await service.create({ ...dto, date: '2027-06-01' });
      await expect(
        service.create({ ...dto, date: '2027-06-02' }),
      ).rejects.toThrow(BOOKING_TOO_FAR_MESSAGE);
    });

    it('update — sanani 1 yildan keyinga ko‘chirish 400; sana o‘zgarmasa tekshirilmaydi', async () => {
      repo.findById.mockResolvedValue(booking());
      await expect(
        service.update('b1', { date: '2027-07-01' }, user),
      ).rejects.toThrow(BOOKING_TOO_FAR_MESSAGE);
      // kelajakdagi (limitdan o'tgan) eski qabulning izohi o'zgartirilishi mumkin
      repo.findById.mockResolvedValue(
        booking({ date: new Date('2028-01-01T00:00:00.000Z') }),
      );
      await expect(
        service.update('b1', { notes: 'x' }, user),
      ).resolves.toBeDefined();
    });

    it('maxBookingDate', () => {
      expect(maxBookingDate('2026-06-01')).toBe('2027-06-01');
    });

    it('nofaol shifokorga qabul yaratib bo‘lmaydi — 409', async () => {
      repo.findDoctorAvailability.mockResolvedValue({
        id: 'd1',
        schedule: null,
        daysOff: null,
        isActive: false,
      } as any);
      await expect(service.create(dto)).rejects.toThrow(
        DOCTOR_INACTIVE_MESSAGE,
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('nofaol shifokorga ko‘chirish — 409; mavjud qabul izohi/statusi esa o‘zgaradi', async () => {
      repo.findById.mockResolvedValue(booking());
      repo.findDoctorAvailability.mockResolvedValue({
        id: 'd2',
        schedule: null,
        daysOff: null,
        isActive: false,
      } as any);
      await expect(
        service.update('b1', { doctorId: 'd2' }, user),
      ).rejects.toThrow(DOCTOR_INACTIVE_MESSAGE);
      repo.findDoctorAvailability.mockClear();
      await service.update('b1', { notes: 'x', status: 'confirmed' }, user);
      expect(repo.findDoctorAvailability).not.toHaveBeenCalled();
    });

    it('shifokor almashtirilsa — onDoctorChanged chaqiriladi', async () => {
      const statusService = {
        onChanged: jest.fn(),
        onRescheduled: jest.fn(),
        onDoctorChanged: jest.fn().mockResolvedValue(undefined),
      };
      const svc = new BookingsService(repo as never, statusService as never);
      repo.findById.mockResolvedValue(booking());
      repo.update.mockResolvedValue(booking({ doctorId: 'd2' }));
      await svc.update('b1', { doctorId: 'd2' }, user);
      expect(statusService.onDoctorChanged).toHaveBeenCalledWith({
        bookingId: 'b1',
        status: 'pending',
        fromDoctorId: 'd1',
        toDoctorId: 'd2',
        actor: { id: 'u1', name: 'Test' },
      });
      statusService.onDoctorChanged.mockClear();
      await svc.update('b1', { notes: 'x' }, user);
      expect(statusService.onDoctorChanged).not.toHaveBeenCalled();
    });
  });

  describe('update — status log', () => {
    beforeEach(() => {
      jest.useFakeTimers({ now: new Date('2026-06-01T00:00:00.000Z') });
    });

    it('status really changed → onChanged with actor and reason', async () => {
      const statusService = {
        onChanged: jest.fn().mockResolvedValue(undefined),
      };
      const svc = new BookingsService(repo as never, statusService as never);
      repo.findById.mockResolvedValue(booking());
      await svc.update(
        'b1',
        { status: 'cancelled', statusReason: 'Bemor so‘radi' },
        user,
      );
      expect(statusService.onChanged).toHaveBeenCalledWith({
        bookingId: 'b1',
        from: 'pending',
        to: 'cancelled',
        reason: 'Bemor so‘radi',
        actor: { id: 'u1', name: 'Test' },
      });
      expect(repo.update.mock.calls[0][1]).not.toHaveProperty('statusReason');
    });

    it('same status / no status → no log', async () => {
      const statusService = { onChanged: jest.fn() };
      const svc = new BookingsService(repo as never, statusService as never);
      repo.findById.mockResolvedValue(booking());
      await svc.update('b1', { status: 'pending' }, user);
      await svc.update('b1', { notes: 'x' }, user);
      expect(statusService.onChanged).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    beforeEach(() => {
      jest.useFakeTimers({ now: new Date('2026-06-01T00:00:00.000Z') });
    });

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
      expect(repo.update).toHaveBeenCalledWith(
        'b1',
        {
          date: undefined,
          time: undefined,
          source: undefined,
          status: 'confirmed',
          notes: 'ok',
          patient: undefined,
          doctor: undefined,
          service: undefined,
        },
        'tx',
      );
    });

    it.each([
      ['time', { time: '11:00' }],
      ['date', { date: '2026-06-11' }],
      ['doctorId', { doctorId: 'd2' }],
    ])(
      '%s o‘zgarsa — eslatma/tasdiq maydonlari tozalanadi',
      async (_n, dto) => {
        repo.findById.mockResolvedValue(booking());
        repo.findManyWithService.mockResolvedValue([]);
        await service.update('b1', dto as any, user);
        expect(repo.update.mock.calls[0][1]).toMatchObject({
          reminder24SentAt: null,
          reminder2SentAt: null,
          patientConfirmedAt: null,
          rescheduleRequestedAt: null,
        });
      },
    );

    it('bir xil time yuborilsa — eslatma maydonlari tegilmaydi', async () => {
      repo.findById.mockResolvedValue(booking());
      await service.update('b1', { time: '10:00', notes: 'x' }, user);
      expect(repo.update.mock.calls[0][1]).not.toHaveProperty(
        'reminder24SentAt',
      );
    });

    it('arrived qabul slotni band qiladi — ACTIVE ga kirmaydi', async () => {
      expect(SLOT_OCCUPYING_STATUSES).toContain('arrived');
      expect(ACTIVE_BOOKING_STATUSES).not.toContain('arrived');
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
          status: { in: ['pending', 'confirmed', 'arrived'] },
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
        service.update('b1', { status: 'pending' }, admin),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repo.findManyWithService).toHaveBeenCalledWith(
        expect.objectContaining({ id: { not: 'b1' }, doctorId: 'd1' }),
        'tx',
      );
      expect(repo.update).not.toHaveBeenCalled();
      // reactivation re-checks the doctor's schedule too
      expect(repo.findDoctorAvailability).toHaveBeenCalledWith('d1');
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
      await service.update(
        'b1',
        { status: 'cancelled', time: '11:00', statusReason: 'Bemor so‘radi' },
        user,
      );
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

  describe('status qoidalari', () => {
    beforeEach(() => {
      jest.useFakeTimers({ now: new Date('2026-06-10T12:00:00.000Z') });
    });

    it.each([
      ['completed', 'cancelled'],
      ['completed', 'no-show'],
      ['cancelled', 'arrived'],
      ['no-show', 'completed'],
    ])('%s → %s taqiqlangan (admin uchun ham)', async (from, to) => {
      repo.findById.mockResolvedValue(booking({ status: from }));
      await expect(
        service.update('b1', { status: to as any, statusReason: 'x' }, admin),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('yakunlangan qabulni bekor qilish — aniq xabar', async () => {
      repo.findById.mockResolvedValue(booking({ status: 'completed' }));
      await expect(
        service.update('b1', { status: 'cancelled', statusReason: 'x' }, admin),
      ).rejects.toThrow("Yakunlangan qabulni bekor qilib bo'lmaydi");
    });

    it('terminal holatni faqat admin qayta ochadi', async () => {
      repo.findById.mockResolvedValue(booking({ status: 'cancelled' }));
      await expect(
        service.update('b1', { status: 'pending' }, user),
      ).rejects.toThrow('faqat administrator');
      await expect(
        service.update('b1', { status: 'confirmed' }, admin),
      ).resolves.toBeDefined();
    });

    it('terminal holatda holat o‘zgarmasa (izoh tahriri) ruxsat', async () => {
      repo.findById.mockResolvedValue(booking({ status: 'completed' }));
      await expect(
        service.update('b1', { status: 'completed', notes: 'n' }, user),
      ).resolves.toBeDefined();
      expect(repo.ensureVisitForCompleted).not.toHaveBeenCalled();
    });

    it('kelajakdagi qabul "completed" bo‘la olmaydi; bugungi bo‘ladi', async () => {
      repo.findById.mockResolvedValue(
        booking({
          date: new Date('2026-06-11T00:00:00.000Z'),
          serviceId: 's1',
        }),
      );
      await expect(
        service.update('b1', { status: 'completed' }, user),
      ).rejects.toThrow('Kelajakdagi qabul');
      repo.findById.mockResolvedValue(
        booking({
          date: new Date('2026-06-10T00:00:00.000Z'),
          serviceId: 's1',
        }),
      );
      await expect(
        service.update('b1', { status: 'completed' }, user),
      ).resolves.toBeDefined();
    });

    it('bekor qilish sababsiz — 400; sabab bilan o‘tadi', async () => {
      repo.findById.mockResolvedValue(booking());
      await expect(
        service.update('b1', { status: 'cancelled' }, user),
      ).rejects.toThrow('sababini kiriting');
      await expect(
        service.update('b1', { status: 'cancelled', statusReason: '  ' }, user),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.update(
          'b1',
          { status: 'cancelled', statusReason: 'Kasal' },
          user,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('completed → Visit', () => {
    beforeEach(() => {
      jest.useFakeTimers({ now: new Date('2026-06-10T12:00:00.000Z') });
    });

    it('update completed — visit shu tranzaksiyada yaratiladi', async () => {
      repo.findById.mockResolvedValue(
        booking({ status: 'confirmed', serviceId: 's1' }),
      );
      repo.update.mockResolvedValue(
        booking({ status: 'completed', serviceId: 's1' }),
      );
      await service.update('b1', { status: 'completed' }, user);
      expect(repo.ensureVisitForCompleted).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'b1' }),
        'tx',
      );
    });

    it('visit yaratish xatosi — butun update xato (tranzaksiya qaytadi)', async () => {
      repo.findById.mockResolvedValue(booking({ serviceId: 's1' }));
      repo.ensureVisitForCompleted.mockRejectedValue(new Error('db'));
      await expect(
        service.update('b1', { status: 'completed' }, user),
      ).rejects.toThrow('db');
    });

    it('create status=completed (bugun) — visit yaratiladi', async () => {
      repo.create.mockResolvedValue(booking({ status: 'completed' }));
      await service.create(
        {
          patientId: 'p1',
          doctorId: 'd1',
          date: '2026-06-10',
          time: '18:00',
          source: 'walk-in',
          status: 'completed',
          serviceId: 's1',
        },
        user,
      );
      expect(repo.ensureVisitForCompleted).toHaveBeenCalled();
    });

    it('create status=completed xizmatsiz — 400, hech narsa yozilmaydi', async () => {
      await expect(
        service.create(
          {
            patientId: 'p1',
            doctorId: 'd1',
            date: '2026-06-10',
            time: '18:00',
            source: 'walk-in',
            status: 'completed',
          },
          user,
        ),
      ).rejects.toThrow(
        new BadRequestException(COMPLETE_NEEDS_SERVICE_MESSAGE),
      );
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.ensureVisitForCompleted).not.toHaveBeenCalled();
    });

    it('update completed xizmatsiz — 400; shu so‘rovda xizmat berilsa o‘tadi', async () => {
      repo.findById.mockResolvedValue(booking({ status: 'confirmed' }));
      await expect(
        service.update('b1', { status: 'completed' }, user),
      ).rejects.toThrow('Yakunlash uchun xizmat tanlang');
      expect(repo.update).not.toHaveBeenCalled();
      repo.update.mockResolvedValue(
        booking({ status: 'completed', serviceId: 's1' }),
      );
      await service.update(
        'b1',
        { status: 'completed', serviceId: 's1' },
        user,
      );
      expect(repo.ensureVisitForCompleted).toHaveBeenCalled();
    });

    it('xizmatsiz boshqa o‘tishlar o‘zgarmaydi (arrived, cancelled, no-show)', async () => {
      repo.findById.mockResolvedValue(booking({ status: 'confirmed' }));
      await service.update('b1', { status: 'arrived' }, user);
      await service.update('b1', { status: 'no-show' }, user);
      await service.update(
        'b1',
        { status: 'cancelled', statusReason: 'x' },
        user,
      );
      expect(repo.update).toHaveBeenCalledTimes(3);
    });
  });

  describe('o‘tgan vaqt', () => {
    beforeEach(() => {
      // 2026-06-10 15:00 Toshkent
      jest.useFakeTimers({ now: new Date('2026-06-10T10:00:00.000Z') });
    });
    const base = {
      patientId: 'p1',
      doctorId: 'd1',
      date: '2026-06-10',
      source: 'phone' as const,
    };

    it('create — bugun, vaqti o‘tib ketgan (pending) — 400', async () => {
      await expect(
        service.create({ ...base, time: '14:00', status: 'pending' }),
      ).rejects.toThrow("o'tib ketgan vaqt");
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('create — bugun, kelasi vaqt — ruxsat', async () => {
      await service.create({ ...base, time: '15:30', status: 'pending' });
      expect(repo.create).toHaveBeenCalled();
    });

    it('update — sana/vaqt o‘tmishga ko‘chirilsa (faol) — 400', async () => {
      repo.findById.mockResolvedValue(
        booking({ date: new Date('2026-06-12T00:00:00.000Z') }),
      );
      await expect(
        service.update('b1', { date: '2026-06-09' }, user),
      ).rejects.toThrow("O'tib ketgan");
      await expect(
        service.update('b1', { date: '2026-06-10', time: '09:00' }, user),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('update — vaqt o‘zgarmasa o‘tmishdagi qabul tahrirlanadi', async () => {
      repo.findById.mockResolvedValue(
        booking({ date: new Date('2026-06-01T00:00:00.000Z') }),
      );
      await expect(
        service.update('b1', { notes: 'x' }, user),
      ).resolves.toBeDefined();
    });
  });

  describe('update — poyga va xabarlar', () => {
    beforeEach(() => {
      jest.useFakeTimers({ now: new Date('2026-06-01T00:00:00.000Z') });
    });

    it('current qulf ichida qayta o‘qiladi (tx bilan)', async () => {
      repo.findById.mockResolvedValue(booking());
      await service.update('b1', { notes: 'x' }, user);
      expect(repo.withLocks).toHaveBeenCalledWith(
        ['booking-row:b1', 'booking:d1:2026-06-10'],
        expect.any(Function),
      );
      expect(repo.findById).toHaveBeenLastCalledWith('b1', 'tx');
    });

    it('qulf ichida boshqa so‘rov sanani o‘zgartirgan bo‘lsa — 409', async () => {
      repo.findById
        .mockResolvedValueOnce(booking())
        .mockResolvedValueOnce(
          booking({ date: new Date('2026-06-20T00:00:00.000Z') }),
        );
      await expect(
        service.update('b1', { notes: 'x' }, user),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('qulf ichida qabul o‘chirilgan bo‘lsa — 404', async () => {
      repo.findById
        .mockResolvedValueOnce(booking())
        .mockResolvedValueOnce(null);
      await expect(
        service.update('b1', { notes: 'x' }, user),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('from-status qulf ichida o‘qilgan current dan olinadi', async () => {
      const statusService = {
        onChanged: jest.fn(),
        onRescheduled: jest.fn(),
      };
      const svc = new BookingsService(repo as never, statusService as never);
      repo.findById
        .mockResolvedValueOnce(booking({ status: 'pending' }))
        .mockResolvedValueOnce(booking({ status: 'confirmed' }));
      await svc.update('b1', { status: 'arrived' }, user);
      expect(statusService.onChanged).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'confirmed', to: 'arrived' }),
      );
    });

    it('ko‘chirish — bemorga reschedule xabari; status xabari bo‘lsa takrorlanmaydi', async () => {
      const statusService = {
        onChanged: jest.fn(),
        onRescheduled: jest.fn(),
      };
      const svc = new BookingsService(repo as never, statusService as never);
      repo.findById.mockResolvedValue(booking());
      await svc.update('b1', { time: '11:00' }, user);
      expect(statusService.onRescheduled).toHaveBeenCalledWith(
        expect.objectContaining({
          previousWhen: '10.06.2026 10:00',
          notifyPatient: true,
        }),
      );
      await svc.update('b1', { time: '11:00', status: 'confirmed' }, user);
      expect(statusService.onRescheduled).toHaveBeenLastCalledWith(
        expect.objectContaining({ notifyPatient: false }),
      );
    });

    it('create — onCreated chaqiriladi', async () => {
      jest.useFakeTimers({ now: new Date('2026-06-01T00:00:00.000Z') });
      const statusService = { onCreated: jest.fn() };
      const svc = new BookingsService(repo as never, statusService as never);
      await svc.create(
        {
          patientId: 'p1',
          doctorId: 'd1',
          date: '2026-06-10',
          time: '10:00',
          source: 'phone',
          status: 'pending',
        },
        user,
      );
      expect(statusService.onCreated).toHaveBeenCalledWith('b1', {
        id: 'u1',
        name: 'Test',
      });
    });

    it('remove — snapshot oldin, onDeleted keyin', async () => {
      const calls: string[] = [];
      const statusService = {
        snapshot: jest.fn(async () => {
          calls.push('snapshot');
          return { id: 'b1' };
        }),
        onDeleted: jest.fn(async () => {
          calls.push('onDeleted');
        }),
      };
      repo.delete.mockImplementation((async () => {
        calls.push('delete');
      }) as any);
      const svc = new BookingsService(repo as never, statusService as never);
      repo.findById.mockResolvedValue(booking());
      await svc.remove('b1', user);
      await Promise.resolve();
      expect(calls).toEqual(['snapshot', 'delete', 'onDeleted']);
      expect(statusService.onDeleted).toHaveBeenCalledWith(
        { id: 'b1' },
        { id: 'u1', name: 'Test' },
      );
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
      expect(repo.count).toHaveBeenNthCalledWith(1, {
        date: today,
        status: { notIn: ['cancelled', 'no-show'] },
      });
      expect(repo.count).toHaveBeenNthCalledWith(2, {
        status: 'pending',
        date: { gte: today },
      });
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
