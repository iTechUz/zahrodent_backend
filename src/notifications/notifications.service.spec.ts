import { ForbiddenException, Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';
import { BookingsRepository } from '../bookings/bookings.repository';
import { PatientsRepository } from '../patients/patients.repository';
import { EskizService } from './eskiz.service';
import { PrismaService } from '../database/prisma.service';

type Mocks = {
  service: NotificationsService;
  notificationsRepo: jest.Mocked<
    Pick<NotificationsRepository, 'createMany' | 'findAll' | 'create'>
  >;
  bookingsRepo: jest.Mocked<
    Pick<BookingsRepository, 'findAll' | 'markReminderSent'>
  >;
  patientsRepo: jest.Mocked<
    Pick<
      PatientsRepository,
      'findSourcesByPatientIds' | 'findPhonesByPatientIds' | 'findById'
    >
  >;
  eskiz: jest.Mocked<
    Pick<EskizService, 'isConfigured' | 'normalizeMobile' | 'sendSms'>
  >;
  prisma: any;
  txMock: any;
};

function setup(): Mocks {
  const notificationsRepo = {
    createMany: jest.fn().mockResolvedValue(undefined),
    findAll: jest.fn(),
    create: jest.fn(),
  };
  const bookingsRepo = {
    findAll: jest.fn(),
    markReminderSent: jest.fn().mockResolvedValue(undefined),
  };
  const patientsRepo = {
    findSourcesByPatientIds: jest.fn(),
    findPhonesByPatientIds: jest.fn().mockResolvedValue([]),
    findById: jest.fn(),
  };
  const eskiz = {
    isConfigured: jest.fn().mockReturnValue(false),
    normalizeMobile: jest.fn(),
    sendSms: jest.fn(),
  };
  const txMock = {
    notification: { createMany: jest.fn().mockResolvedValue(undefined) },
    booking: { updateMany: jest.fn().mockResolvedValue(undefined) },
  };
  const prisma = {
    $transaction: jest.fn(async (cb: any) => cb(txMock)),
    doctor: { findUnique: jest.fn(), findMany: jest.fn() },
    patient: { findMany: jest.fn() },
    booking: { findMany: jest.fn() },
  };
  const service = new NotificationsService(
    notificationsRepo as unknown as NotificationsRepository,
    bookingsRepo as unknown as BookingsRepository,
    patientsRepo as unknown as PatientsRepository,
    eskiz as unknown as EskizService,
    prisma as unknown as PrismaService,
  );
  return {
    service,
    notificationsRepo,
    bookingsRepo,
    patientsRepo,
    eskiz,
    prisma,
    txMock,
  } as unknown as Mocks;
}

const realNormalize = (phone: string) =>
  new EskizService().normalizeMobile(phone);

describe('NotificationsService.sendReminders', () => {
  let service: NotificationsService;
  let notificationsRepo: Mocks['notificationsRepo'];
  let bookingsRepo: Mocks['bookingsRepo'];
  let patientsRepo: Mocks['patientsRepo'];
  let eskiz: Mocks['eskiz'];
  let prisma: PrismaService;
  let txMock: any;

  beforeEach(() => {
    ({
      service,
      notificationsRepo,
      bookingsRepo,
      patientsRepo,
      eskiz,
      prisma,
      txMock,
    } = setup());
    void notificationsRepo;
  });

  const b = (id: string, patientId: string, time = '10:00') => ({
    id,
    patientId,
    doctorId: 'd1',
    date: new Date('2026-06-01'),
    time,
    source: 'phone',
    status: 'pending',
    notes: '',
    createdAt: new Date('2026-06-01'),
    serviceId: null,
    reminderSentAt: null,
  });

  it('booking bo‘lmasa created: 0', async () => {
    bookingsRepo.findAll.mockResolvedValue({ data: [], total: 0 } as any);
    const out = await service.sendReminders();
    expect(out).toEqual(expect.objectContaining({ created: 0 }));
    expect((prisma as any).$transaction).not.toHaveBeenCalled();
  });

  it('bir marta patients batch, createMany bitta chaqiruv', async () => {
    const d = new Date('2026-06-01');
    bookingsRepo.findAll.mockResolvedValue({
      data: [
        {
          id: 'b1',
          patientId: 'p1',
          doctorId: 'd1',
          date: d,
          time: '10:00',
          source: 'phone',
          status: 'pending',
          notes: '',
          createdAt: d,
          serviceId: null,
          reminderSentAt: null,
        },
      ],
      total: 1,
    } as any);
    patientsRepo.findSourcesByPatientIds.mockResolvedValue([
      { id: 'p1', source: 'phone' },
    ]);
    patientsRepo.findPhonesByPatientIds.mockResolvedValue([
      { id: 'p1', phone: '+998901112233' },
    ]);
    eskiz.isConfigured.mockReturnValue(true);
    eskiz.normalizeMobile.mockImplementation(realNormalize);
    eskiz.sendSms.mockResolvedValue({ ok: true });

    const out = await service.sendReminders();
    expect(out.created).toBe(1);
    expect(patientsRepo.findSourcesByPatientIds).toHaveBeenCalledTimes(1);
    expect(patientsRepo.findPhonesByPatientIds).toHaveBeenCalledWith(['p1']);
    expect(patientsRepo.findSourcesByPatientIds).toHaveBeenCalledWith(['p1']);
    expect((prisma as any).$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.notification.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          patientId: 'p1',
          type: 'sms',
          status: 'sent',
        }),
      ]),
    });
    expect(txMock.booking.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['b1'] }, reminderSentAt: null },
      data: { reminderSentAt: expect.any(Date) },
    });
  });

  it('faqat pending/confirmed, hali eslatilmagan, bugun..ertaga (Toshkent)', async () => {
    bookingsRepo.findAll.mockResolvedValue({ data: [], total: 0 } as any);
    // 2026-06-01 20:00Z = 2026-06-02 01:00 Toshkent
    await service.sendReminders(new Date('2026-06-01T20:00:00.000Z'));
    expect(bookingsRepo.findAll).toHaveBeenCalledWith({
      status: { in: ['confirmed', 'pending'] },
      reminderSentAt: null,
      date: {
        gte: new Date('2026-06-02T00:00:00.000Z'),
        lte: new Date('2026-06-03T00:00:00.000Z'),
      },
    });
  });

  it('xabar matni sana va vaqt bilan', async () => {
    bookingsRepo.findAll.mockResolvedValue({
      data: [b('b1', 'p1', '14:30')],
      total: 1,
    } as any);
    patientsRepo.findSourcesByPatientIds.mockResolvedValue([
      { id: 'p1', source: 'telegram' },
    ]);
    await service.sendReminders();
    expect(
      txMock.notification.createMany.mock.calls[0][0].data[0].message,
    ).toBe('Eslatma: Sizning qabulingiz 2026-06-01 kuni soat 14:30 da');
  });

  it('bemor topilmasa (source yo‘q) — o‘tkazib yuboriladi, tranzaksiya yo‘q', async () => {
    bookingsRepo.findAll.mockResolvedValue({
      data: [b('b1', 'ghost')],
      total: 1,
    } as any);
    patientsRepo.findSourcesByPatientIds.mockResolvedValue([]);
    await expect(service.sendReminders()).resolves.toEqual({
      created: 0,
      smsSent: 0,
      smsFailed: 0,
      skipped: 0,
    });
    expect((prisma as any).$transaction).not.toHaveBeenCalled();
  });

  // Fixed: with Eskiz not configured, reminders were recorded as "sent" and
  // bookings marked, so the patient never got a real reminder later.
  it('Eskiz o‘chiq — SMS yozuvi "failed", booking belgilanmaydi', async () => {
    bookingsRepo.findAll.mockResolvedValue({
      data: [b('b1', 'p1')],
      total: 1,
    } as any);
    patientsRepo.findSourcesByPatientIds.mockResolvedValue([
      { id: 'p1', source: 'walk-in' },
    ]);
    const out = await service.sendReminders();
    expect(out).toEqual({ created: 1, smsSent: 0, smsFailed: 0, skipped: 1 });
    expect(eskiz.sendSms).not.toHaveBeenCalled();
    expect(
      txMock.notification.createMany.mock.calls[0][0].data[0],
    ).toMatchObject({ type: 'sms', status: 'failed' });
    expect(txMock.booking.updateMany).not.toHaveBeenCalled();
  });

  it('telegram manbali bemor — kanal yo‘q: "failed", booking belgilanmaydi', async () => {
    bookingsRepo.findAll.mockResolvedValue({
      data: [b('b1', 'p1')],
      total: 1,
    } as any);
    patientsRepo.findSourcesByPatientIds.mockResolvedValue([
      { id: 'p1', source: 'telegram' },
    ]);
    eskiz.isConfigured.mockReturnValue(true);
    const out = await service.sendReminders();
    expect(out).toEqual({ created: 1, smsSent: 0, smsFailed: 0, skipped: 1 });
    expect(
      txMock.notification.createMany.mock.calls[0][0].data[0],
    ).toMatchObject({ type: 'telegram', status: 'failed' });
    expect(txMock.booking.updateMany).not.toHaveBeenCalled();
  });

  describe('Eskiz yoqiq', () => {
    beforeEach(() => {
      eskiz.isConfigured.mockReturnValue(true);
      eskiz.normalizeMobile.mockImplementation(realNormalize);
    });

    it('muvaffaqiyatli, xato va telefonsiz holatlar aralash', async () => {
      bookingsRepo.findAll.mockResolvedValue({
        data: [
          b('b1', 'p1'),
          b('b2', 'p2'),
          b('b3', 'p3'),
          b('b4', 'p4'),
          b('b5', 'p5'),
        ],
        total: 5,
      } as any);
      patientsRepo.findSourcesByPatientIds.mockResolvedValue([
        { id: 'p1', source: 'phone' },
        { id: 'p2', source: 'phone' },
        { id: 'p3', source: 'phone' },
        { id: 'p4', source: 'telegram' },
        { id: 'p5', source: 'website' },
      ]);
      patientsRepo.findPhonesByPatientIds.mockResolvedValue([
        { id: 'p1', phone: '+998 90 111 22 33' },
        { id: 'p2', phone: '+998901112244' },
        { id: 'p3', phone: '12345' },
      ]);
      eskiz.sendSms.mockImplementation(async (mobile: string) =>
        mobile === '998901112233'
          ? { ok: true as const }
          : { ok: false as const, error: 'HTTP 500' },
      );

      const out = await service.sendReminders();
      expect(out).toEqual({
        created: 5,
        smsSent: 1,
        smsFailed: 3,
        skipped: 1,
      });
      expect(eskiz.sendSms).toHaveBeenCalledTimes(2);
      expect(eskiz.sendSms).toHaveBeenCalledWith(
        '998901112233',
        expect.stringContaining('Eslatma'),
      );

      const rows = txMock.notification.createMany.mock.calls[0][0].data;
      expect(rows.map((r: any) => [r.patientId, r.type, r.status])).toEqual([
        ['p1', 'sms', 'sent'],
        ['p2', 'sms', 'failed'],
        ['p3', 'sms', 'failed'],
        ['p4', 'telegram', 'failed'],
        ['p5', 'sms', 'failed'],
      ]);
      // Faqat muvaffaqiyatli yuborilganlar belgilanadi (qayta urinish uchun).
      expect(txMock.booking.updateMany.mock.calls[0][0].where.id.in).toEqual([
        'b1',
      ]);
    });

    it('hammasi xato — updateMany chaqirilmaydi, lekin yozuvlar saqlanadi', async () => {
      bookingsRepo.findAll.mockResolvedValue({
        data: [b('b1', 'p1')],
        total: 1,
      } as any);
      patientsRepo.findSourcesByPatientIds.mockResolvedValue([
        { id: 'p1', source: 'phone' },
      ]);
      patientsRepo.findPhonesByPatientIds.mockResolvedValue([]);
      const out = await service.sendReminders();
      expect(out).toEqual({
        created: 1,
        smsSent: 0,
        smsFailed: 1,
        skipped: 0,
      });
      expect(txMock.notification.createMany).toHaveBeenCalled();
      expect(txMock.booking.updateMany).not.toHaveBeenCalled();
    });

    it('ko‘p booking (concurrency > 5) — tartib saqlanadi', async () => {
      const ids = Array.from({ length: 12 }, (_, i) => i);
      bookingsRepo.findAll.mockResolvedValue({
        data: ids.map((i) => b(`b${i}`, `p${i}`)),
        total: 12,
      } as any);
      patientsRepo.findSourcesByPatientIds.mockResolvedValue(
        ids.map((i) => ({ id: `p${i}`, source: 'phone' })),
      );
      patientsRepo.findPhonesByPatientIds.mockResolvedValue(
        ids.map((i) => ({
          id: `p${i}`,
          phone: `+9989011122${String(i).padStart(2, '0')}`,
        })),
      );
      let inFlight = 0;
      let maxInFlight = 0;
      eskiz.sendSms.mockImplementation(async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setImmediate(r));
        inFlight--;
        return { ok: true as const };
      });
      const out = await service.sendReminders();
      expect(out).toEqual({
        created: 12,
        smsSent: 12,
        smsFailed: 0,
        skipped: 0,
      });
      expect(maxInFlight).toBeLessThanOrEqual(5);
      expect(maxInFlight).toBeGreaterThan(1);
      const rows = txMock.notification.createMany.mock.calls[0][0].data;
      expect(rows.map((r: any) => r.patientId)).toEqual(
        ids.map((i) => `p${i}`),
      );
    });
  });

  // Fixed: the query had no date window, so reminders went out for every
  // pending/confirmed booking ever (stale past ones and months ahead).
  it('sendReminders — faqat bugungi va ertangi qabullar so‘raladi', async () => {
    bookingsRepo.findAll.mockResolvedValue({ data: [], total: 0 } as any);
    await service.sendReminders(new Date('2026-12-31T10:00:00.000Z'));
    const where = bookingsRepo.findAll.mock.calls[0][0] as any;
    expect(where.date).toEqual({
      gte: new Date('2026-12-31T00:00:00.000Z'),
      lte: new Date('2027-01-01T00:00:00.000Z'),
    });
    // still only not-yet-reminded bookings → a sent reminder is never re-sent
    expect(where.reminderSentAt).toBeNull();
  });

  // Fixed: one rejected sendSms (network error / timeout) rejected the whole
  // run — nothing recorded or marked although other SMS were delivered, so
  // they were re-sent next time.
  it('sendReminders — bitta SMS xatosi (reject) butun partiyani yiqitmaydi', async () => {
    eskiz.isConfigured.mockReturnValue(true);
    eskiz.normalizeMobile.mockImplementation(realNormalize);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    bookingsRepo.findAll.mockResolvedValue({
      data: [b('b1', 'p1'), b('b2', 'p2'), b('b3', 'p3')],
      total: 3,
    } as any);
    patientsRepo.findSourcesByPatientIds.mockResolvedValue([
      { id: 'p1', source: 'phone' },
      { id: 'p2', source: 'phone' },
      { id: 'p3', source: 'phone' },
    ]);
    patientsRepo.findPhonesByPatientIds.mockResolvedValue([
      { id: 'p1', phone: '+998901112201' },
      { id: 'p2', phone: '+998901112202' },
      { id: 'p3', phone: '+998901112203' },
    ]);
    eskiz.sendSms.mockImplementation(async (mobile: string) => {
      if (mobile === '998901112202') throw new Error('socket hang up');
      return { ok: true as const };
    });

    const out = await service.sendReminders();
    expect(out).toEqual({ created: 3, smsSent: 2, smsFailed: 1, skipped: 0 });
    const rows = txMock.notification.createMany.mock.calls[0][0].data;
    expect(rows.map((r: any) => r.status)).toEqual(['sent', 'failed', 'sent']);
    // delivered ones are marked (never re-sent), the failed one is retried
    expect(txMock.booking.updateMany.mock.calls[0][0].where.id.in).toEqual([
      'b1',
      'b3',
    ]);
    jest.restoreAllMocks();
  });
});

describe('NotificationsService (boshqa metodlar)', () => {
  let m: Mocks;

  beforeEach(() => {
    m = setup();
  });

  afterEach(() => jest.useRealTimers());

  const notif = (partial: Record<string, unknown> = {}) =>
    ({
      id: 'n1',
      patientId: 'p1',
      doctorId: null,
      type: 'sms',
      message: 'Salom',
      sentAt: new Date('2026-06-01T10:00:00.000Z'),
      status: 'sent',
      ...partial,
    }) as any;

  describe('findAll', () => {
    it('pagination va response', async () => {
      m.notificationsRepo.findAll.mockResolvedValue({
        data: [notif()],
        total: 1,
      });
      const out = await m.service.findAll({ page: 2, limit: 5 });
      expect(m.notificationsRepo.findAll).toHaveBeenCalledWith({
        skip: 10,
        take: 5,
      });
      expect(out).toEqual({
        data: [
          {
            id: 'n1',
            patientId: 'p1',
            doctorId: null,
            type: 'sms',
            message: 'Salom',
            sentAt: '2026-06-01T10:00:00.000Z',
            status: 'sent',
          },
        ],
        total: 1,
      });
    });

    it('default pagination', async () => {
      m.notificationsRepo.findAll.mockResolvedValue({ data: [], total: 0 });
      await m.service.findAll({});
      expect(m.notificationsRepo.findAll).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
      });
    });

    const doctorUser = {
      id: 'u2',
      name: 'Dr',
      phone: 'p',
      role: 'doctor' as const,
      doctorId: 'd1',
    };

    it('doctor — faqat o‘ziga yuborilganlar (doctorId)', async () => {
      m.notificationsRepo.findAll.mockResolvedValue({ data: [], total: 0 });
      await m.service.findAll({}, doctorUser);
      expect(m.notificationsRepo.findAll).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        where: { doctorId: 'd1' },
      });
    });

    it('doctor profili yo‘q — 403', async () => {
      await expect(
        m.service.findAll({}, { ...doctorUser, doctorId: undefined }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(m.notificationsRepo.findAll).not.toHaveBeenCalled();
    });

    it('search — xabar matni bo‘yicha', async () => {
      m.notificationsRepo.findAll.mockResolvedValue({ data: [], total: 0 });
      await m.service.findAll(
        { search: ' eslatma ' },
        {
          ...doctorUser,
          role: 'admin',
        },
      );
      expect(m.notificationsRepo.findAll).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        where: { message: { contains: 'eslatma', mode: 'insensitive' } },
      });
    });
  });

  describe('create', () => {
    beforeEach(() => {
      m.notificationsRepo.create.mockResolvedValue(notif());
    });
    const saved = () => m.notificationsRepo.create.mock.calls[0][0] as any;

    it('telegram, Eskiz siz — dto.status yoki default "sent", sentAt hozir', async () => {
      jest.useFakeTimers({ now: new Date('2026-06-17T10:00:00.000Z') });
      m.patientsRepo.findById.mockResolvedValue({
        phone: '+998901112233',
      } as any);
      await m.service.create({
        patientId: 'p1',
        type: 'telegram',
        message: 'Salom',
      });
      expect(saved()).toEqual({
        patient: { connect: { id: 'p1' } },
        doctor: undefined,
        type: 'telegram',
        message: 'Salom',
        status: 'sent',
        sentAt: new Date('2026-06-17T10:00:00.000Z'),
      });
      expect(m.eskiz.sendSms).not.toHaveBeenCalled();
    });

    it('berilgan status va sentAt saqlanadi (Eskiz o‘chiq sms)', async () => {
      await m.service.create({
        type: 'sms',
        message: 'x',
        status: 'delivered',
        sentAt: '2026-06-01T08:00:00Z',
      });
      expect(saved()).toMatchObject({
        status: 'delivered',
        sentAt: new Date('2026-06-01T08:00:00Z'),
        patient: undefined,
        doctor: undefined,
      });
    });

    it('sms + Eskiz yoqiq + bemor telefoni — yuboradi, ok → sent', async () => {
      m.eskiz.isConfigured.mockReturnValue(true);
      m.eskiz.normalizeMobile.mockImplementation(realNormalize);
      m.eskiz.sendSms.mockResolvedValue({ ok: true });
      m.patientsRepo.findById.mockResolvedValue({
        phone: '+998901112233',
      } as any);
      await m.service.create({ patientId: 'p1', type: 'sms', message: 'Hi' });
      expect(m.eskiz.sendSms).toHaveBeenCalledWith('998901112233', 'Hi');
      expect(saved().status).toBe('sent');
    });

    it('sms + Eskiz yoqiq + doctor telefoni — xato → failed', async () => {
      m.eskiz.isConfigured.mockReturnValue(true);
      m.eskiz.normalizeMobile.mockImplementation(realNormalize);
      m.eskiz.sendSms.mockResolvedValue({ ok: false, error: 'x' });
      m.prisma.doctor.findUnique.mockResolvedValue({ phone: '901112233' });
      await m.service.create({
        doctorId: 'd1',
        type: 'sms',
        message: 'Hi',
        status: 'sent',
      });
      expect(m.prisma.doctor.findUnique).toHaveBeenCalledWith({
        where: { id: 'd1' },
      });
      expect(m.eskiz.sendSms).toHaveBeenCalledWith('998901112233', 'Hi');
      expect(saved()).toMatchObject({
        status: 'failed',
        doctor: { connect: { id: 'd1' } },
      });
    });

    it('sms + Eskiz yoqiq + telefon noto‘g‘ri — yubormaydi, failed', async () => {
      m.eskiz.isConfigured.mockReturnValue(true);
      m.eskiz.normalizeMobile.mockImplementation(realNormalize);
      m.patientsRepo.findById.mockResolvedValue({ phone: '123' } as any);
      await m.service.create({ patientId: 'p1', type: 'sms', message: 'Hi' });
      expect(m.eskiz.sendSms).not.toHaveBeenCalled();
      expect(saved().status).toBe('failed');
    });

    it('sms + Eskiz yoqiq + qabul qiluvchi yo‘q — failed', async () => {
      m.eskiz.isConfigured.mockReturnValue(true);
      m.patientsRepo.findById.mockResolvedValue(null);
      await m.service.create({ patientId: 'p1', type: 'sms', message: 'Hi' });
      expect(m.eskiz.normalizeMobile).not.toHaveBeenCalled();
      expect(saved().status).toBe('failed');
    });

    it('doctor topilmasa ham xato tashlamaydi', async () => {
      m.prisma.doctor.findUnique.mockResolvedValue(null);
      await expect(
        m.service.create({ doctorId: 'd1', type: 'telegram', message: 'x' }),
      ).resolves.toBeDefined();
    });
  });

  describe('findRecipients', () => {
    const bk = (partial: Record<string, unknown>) => ({
      id: 'b1',
      patientId: 'p1',
      doctorId: 'd1',
      date: new Date('2026-06-10T00:00:00.000Z'),
      time: '10:00',
      patient: {
        id: 'p1',
        firstName: 'Ali',
        lastName: 'V',
        phone: '+998901112233',
      },
      doctor: {
        id: 'd1',
        firstName: 'Dr',
        lastName: 'K',
        phone: '+998901112200',
      },
      ...partial,
    });

    it('default — bugungi Toshkent kuni, bemorlar uchun reminderSentAt: null', async () => {
      // 2026-06-17 20:00Z = 2026-06-18 01:00 Toshkent
      jest.useFakeTimers({ now: new Date('2026-06-17T20:00:00.000Z') });
      m.prisma.booking.findMany.mockResolvedValue([]);
      await m.service.findRecipients({ targetType: 'patient' });
      expect(m.prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            date: {
              gte: new Date('2026-06-18T00:00:00.000Z'),
              lte: new Date('2026-06-18T00:00:00.000Z'),
            },
            status: { in: ['confirmed', 'pending'] },
            reminderSentAt: null,
          },
          orderBy: { date: 'asc' },
        }),
      );
    });

    it('doctor uchun reminderSentAt filtri yo‘q, oraliq berilgan', async () => {
      m.prisma.booking.findMany.mockResolvedValue([]);
      await m.service.findRecipients({
        targetType: 'doctor',
        startDate: '2026-06-01T12:00:00Z',
        endDate: '2026-06-03T01:00:00Z',
      });
      const where = m.prisma.booking.findMany.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('reminderSentAt');
      expect(where.date).toEqual({
        gte: new Date('2026-06-01T00:00:00.000Z'),
        lte: new Date('2026-06-03T00:00:00.000Z'),
      });
    });

    it('bemorlar — patientId bo‘yicha birinchi booking bilan dedup', async () => {
      m.prisma.booking.findMany.mockResolvedValue([
        bk({ id: 'b1', time: '09:00' }),
        bk({ id: 'b2', time: '11:00' }),
        bk({
          id: 'b3',
          patientId: 'p2',
          patient: { id: 'p2', firstName: 'Vali', lastName: 'A', phone: 'x' },
        }),
      ]);
      const out = await m.service.findRecipients({});
      expect(out).toEqual([
        {
          id: 'p1',
          firstName: 'Ali',
          lastName: 'V',
          phone: '+998901112233',
          bookingId: 'b1',
          bookingDate: '2026-06-10',
          bookingTime: '09:00',
        },
        expect.objectContaining({ id: 'p2', bookingId: 'b3' }),
      ]);
    });

    it('shifokorlar — doctorId bo‘yicha dedup, patientName bilan', async () => {
      m.prisma.booking.findMany.mockResolvedValue([
        bk({ id: 'b1' }),
        bk({ id: 'b2' }),
        bk({ id: 'b3', doctorId: 'd2', doctor: null, patient: null }),
        bk({ id: 'b4', doctorId: null }),
      ]);
      const out = await m.service.findRecipients({ targetType: 'doctor' });
      expect(out).toEqual([
        {
          id: 'd1',
          firstName: 'Dr',
          lastName: 'K',
          phone: '+998901112200',
          bookingId: 'b1',
          bookingDate: '2026-06-10',
          bookingTime: '10:00',
          patientName: 'Ali V',
        },
        {
          id: 'd2',
          firstName: '',
          lastName: '',
          phone: '',
          bookingId: 'b3',
          bookingDate: '2026-06-10',
          bookingTime: '10:00',
          patientName: '',
        },
      ]);
    });
  });

  describe('bulkSend', () => {
    const target = (id: string, phone: string, booking?: any) => ({
      id,
      phone,
      bookings: booking ? [booking] : [],
    });
    const upcoming = {
      id: 'b1',
      date: new Date('2026-06-20T00:00:00.000Z'),
      time: '15:00',
      patient: { firstName: 'Ali', lastName: 'Valiyev' },
    };

    beforeEach(() => {
      m.eskiz.normalizeMobile.mockImplementation(realNormalize);
    });

    it('bemorlar, Eskiz yoqiq — shaxsiylashtirilgan matn, natija hisobi', async () => {
      m.eskiz.isConfigured.mockReturnValue(true);
      m.eskiz.sendSms.mockImplementation(async (mobile: string) =>
        mobile === '998901112233'
          ? { ok: true as const }
          : { ok: false as const, error: 'x' },
      );
      m.prisma.patient.findMany.mockResolvedValue([
        target('p1', '+998901112233', upcoming),
        target('p2', '+998901112244', { ...upcoming, id: 'b2' }),
        target('p3', 'bad'),
      ]);

      const out = await m.service.bulkSend({
        targetIds: ['p1', 'p2', 'p3'],
        targetType: 'patient',
        message: '[bemor], qabulingiz [sana] kuni [vaqt] da. [sana]!',
      });

      expect(out).toEqual({ sent: 1, failed: 2, total: 3 });
      expect(m.prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ['p1', 'p2', 'p3'] } } }),
      );
      expect(m.eskiz.sendSms).toHaveBeenCalledWith(
        '998901112233',
        'Ali Valiyev, qabulingiz 2026-06-20 kuni 15:00 da. 2026-06-20!',
      );
      expect(m.eskiz.sendSms).toHaveBeenCalledTimes(2);

      const rows = m.txMock.notification.createMany.mock.calls[0][0].data;
      expect(rows).toHaveLength(3);
      expect(rows[0]).toMatchObject({
        patientId: 'p1',
        doctorId: undefined,
        type: 'sms',
        status: 'sent',
      });
      expect(rows[1].status).toBe('failed');
      expect(rows[2]).toMatchObject({
        status: 'failed',
        message: '[bemor], qabulingiz [sana] kuni [vaqt] da. [sana]!',
      });
      expect(m.txMock.booking.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['b1'] }, reminderSentAt: null },
        data: { reminderSentAt: expect.any(Date) },
      });
    });

    // Fixed: without Eskiz nothing is sent, but it used to count as "sent"
    // and mark the booking reminded.
    it('Eskiz o‘chiq — hech narsa yuborilmaydi: "failed", booking belgilanmaydi', async () => {
      m.prisma.patient.findMany.mockResolvedValue([
        target('p1', '901112233', upcoming),
        target('p2', ''),
      ]);
      const out = await m.service.bulkSend({
        targetIds: ['p1', 'p2', 'missing'],
        targetType: 'patient',
        message: 'Salom!',
      });
      expect(m.eskiz.sendSms).not.toHaveBeenCalled();
      expect(out).toEqual({ sent: 0, failed: 2, total: 3 });
      const rows = m.txMock.notification.createMany.mock.calls[0][0].data;
      expect(rows.map((r: any) => r.status)).toEqual(['failed', 'failed']);
      expect(m.txMock.booking.updateMany).not.toHaveBeenCalled();
    });

    it('booking siz bemor — matn o‘zgarmaydi, updateMany yo‘q', async () => {
      m.prisma.patient.findMany.mockResolvedValue([
        target('p1', '+998901112233'),
      ]);
      await m.service.bulkSend({
        targetIds: ['p1'],
        targetType: 'patient',
        message: 'Salom [bemor]',
      });
      expect(
        m.txMock.notification.createMany.mock.calls[0][0].data[0].message,
      ).toBe('Salom [bemor]');
      expect(m.txMock.booking.updateMany).not.toHaveBeenCalled();
    });

    it('booking.patient yo‘q — [bemor] almashtirilmaydi', async () => {
      m.prisma.patient.findMany.mockResolvedValue([
        target('p1', '+998901112233', { ...upcoming, patient: null }),
      ]);
      await m.service.bulkSend({
        targetIds: ['p1'],
        targetType: 'patient',
        message: '[bemor] [vaqt]',
      });
      expect(
        m.txMock.notification.createMany.mock.calls[0][0].data[0].message,
      ).toBe('[bemor] 15:00');
    });

    it('shifokorlar — doctor.findMany, doctorId yozuvi', async () => {
      m.eskiz.isConfigured.mockReturnValue(true);
      m.eskiz.normalizeMobile.mockImplementation(realNormalize);
      m.eskiz.sendSms.mockResolvedValue({ ok: true });
      m.prisma.doctor.findMany.mockResolvedValue([
        target('d1', '+998901112200', upcoming),
      ]);
      const out = await m.service.bulkSend({
        targetIds: ['d1'],
        targetType: 'doctor',
        message: 'Bemor: [bemor] [vaqt]',
      });
      expect(m.prisma.patient.findMany).not.toHaveBeenCalled();
      const q = m.prisma.doctor.findMany.mock.calls[0][0];
      expect(q.where).toEqual({ id: { in: ['d1'] } });
      expect(q.select.bookings.where).not.toHaveProperty('reminderSentAt');
      expect(out).toEqual({ sent: 1, failed: 0, total: 1 });
      expect(
        m.txMock.notification.createMany.mock.calls[0][0].data[0],
      ).toMatchObject({
        patientId: undefined,
        doctorId: 'd1',
        message: 'Bemor: Ali Valiyev 15:00',
      });
    });

    it('target topilmasa — tranzaksiya yo‘q', async () => {
      m.prisma.patient.findMany.mockResolvedValue([]);
      await expect(
        m.service.bulkSend({
          targetIds: ['x'],
          targetType: 'patient',
          message: 'Salom!',
        }),
      ).resolves.toEqual({ sent: 0, failed: 0, total: 1 });
      expect(m.prisma.$transaction).not.toHaveBeenCalled();
    });

    // Fixed: an SMS to a doctor marked the doctor's next *patient* booking
    // as reminded, so the patient never got their own reminder.
    it('bulkSend(doctor) — bemor booking.reminderSentAt belgilanmaydi', async () => {
      m.eskiz.isConfigured.mockReturnValue(true);
      m.eskiz.normalizeMobile.mockImplementation(realNormalize);
      m.eskiz.sendSms.mockResolvedValue({ ok: true });
      m.prisma.doctor.findMany.mockResolvedValue([
        target('d1', '+998901112200', upcoming),
      ]);
      const out = await m.service.bulkSend({
        targetIds: ['d1'],
        targetType: 'doctor',
        message: 'Ertaga: [bemor] [vaqt]',
      });
      expect(out).toEqual({ sent: 1, failed: 0, total: 1 });
      expect(m.txMock.notification.createMany).toHaveBeenCalled();
      expect(m.txMock.booking.updateMany).not.toHaveBeenCalled();
    });

    it('bulkSend — sendSms reject qilsa ham qolganlari yuboriladi', async () => {
      m.eskiz.isConfigured.mockReturnValue(true);
      m.eskiz.normalizeMobile.mockImplementation(realNormalize);
      m.eskiz.sendSms
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce({ ok: true });
      m.prisma.patient.findMany.mockResolvedValue([
        target('p1', '+998901112201'),
        target('p2', '+998901112202'),
      ]);
      await expect(
        m.service.bulkSend({
          targetIds: ['p1', 'p2'],
          targetType: 'patient',
          message: 'Salom!',
        }),
      ).resolves.toEqual({ sent: 1, failed: 1, total: 2 });
    });
  });
});
