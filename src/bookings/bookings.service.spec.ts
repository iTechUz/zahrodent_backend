import { ConflictException, NotFoundException } from '@nestjs/common';
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

    it('dateRange today — bugungi UTC kun', async () => {
      jest.useFakeTimers({ now: new Date('2026-06-17T15:30:00.000Z') });
      await service.findAll({ dateRange: 'today' }, user);
      expect(where().date).toEqual({
        gte: new Date('2026-06-17T00:00:00.000Z'),
        lte: new Date('2026-06-17T23:59:59.999Z'),
      });
    });

    it('dateRange week — dushanbadan yakshanbagacha (chorshanba)', async () => {
      // 2026-06-17 — chorshanba
      jest.useFakeTimers({ now: new Date('2026-06-17T15:30:00.000Z') });
      await service.findAll({ dateRange: 'week' }, user);
      expect(where().date).toEqual({
        gte: new Date('2026-06-15T00:00:00.000Z'),
        lte: new Date('2026-06-21T23:59:59.999Z'),
      });
    });

    it('dateRange week — yakshanba oldingi dushanbaga tegishli', async () => {
      jest.useFakeTimers({ now: new Date('2026-06-21T10:00:00.000Z') });
      await service.findAll({ dateRange: 'week' }, user);
      expect(where().date).toEqual({
        gte: new Date('2026-06-15T00:00:00.000Z'),
        lte: new Date('2026-06-21T23:59:59.999Z'),
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
        lte: new Date('2026-07-05T23:59:59.999Z'),
      });
    });

    it('dateRange month — oyning 1-sidan oxirigacha (fevral, kabisa)', async () => {
      jest.useFakeTimers({ now: new Date('2028-02-10T12:00:00.000Z') });
      await service.findAll({ dateRange: 'month' }, user);
      expect(where().date).toEqual({
        gte: new Date('2028-02-01T00:00:00.000Z'),
        lte: new Date('2028-02-29T23:59:59.999Z'),
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
        'Booking not found (access restricted)',
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
      expect(repo.findManyWithService).toHaveBeenCalledWith({
        doctorId: 'd1',
        date: new Date('2026-06-10T00:00:00.000Z'),
        id: undefined,
        status: { in: ['pending', 'confirmed'] },
      });
      expect(repo.create).toHaveBeenCalledWith({
        patient: { connect: { id: 'p1' } },
        doctor: { connect: { id: 'd1' } },
        date: new Date('2026-06-10T00:00:00.000Z'),
        time: '10:00',
        source: 'phone',
        status: 'pending',
        notes: '',
        service: undefined,
      });
      expect(out.date).toBe('2026-06-10');
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
      ).rejects.toThrow('Booking not found (access restricted)');
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
      expect(repo.findManyWithService).toHaveBeenCalledWith({
        doctorId: 'd1',
        date: new Date('2026-06-10T00:00:00.000Z'),
        id: { not: 'b1' },
        status: { in: ['pending', 'confirmed'] },
      });
      expect(repo.update.mock.calls[0][1]).toMatchObject({ time: '11:00' });
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
          patient: { connect: { id: 'p2' } },
          doctor: { connect: { id: 'd2' } },
          service: { connect: { id: 's2' } },
        }),
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

    // BUG (bookings.service.ts:125): the conflict check only runs when
    // date/time/doctorId/serviceId change. Re-activating a cancelled/no-show
    // booking (status → 'pending' | 'confirmed') into a slot that has since
    // been taken is allowed, producing a double-booking.
    it.todo(
      'update — status faol holatga qaytarilsa ham to‘qnashuv tekshirilishi kerak',
    );
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
      const today = {
        gte: new Date('2026-06-17T00:00:00.000Z'),
        lt: new Date('2026-06-18T00:00:00.000Z'),
      };
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
