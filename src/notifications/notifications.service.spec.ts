import { ForbiddenException, Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';
import { PatientsRepository } from '../patients/patients.repository';
import { EskizService } from './eskiz.service';
import { PrismaService } from '../database/prisma.service';
import { SettingsService, SettingsView } from '../settings/settings.service';
import { TelegramBotRegistry } from '../telegram/telegram-bot.registry';
import { DEFAULT_REMINDER_TEMPLATE } from '../settings/reminder-template';

type Mocks = {
  service: NotificationsService;
  notificationsRepo: jest.Mocked<
    Pick<
      NotificationsRepository,
      'createMany' | 'findAll' | 'create' | 'findReminderCandidates'
    >
  >;
  patientsRepo: jest.Mocked<Pick<PatientsRepository, 'findById'>>;
  eskiz: jest.Mocked<
    Pick<EskizService, 'isConfigured' | 'normalizeMobile' | 'sendSms'>
  >;
  settings: { get: jest.Mock };
  telegram: { isAvailable: jest.Mock; sendMessage: jest.Mock };
  prisma: any;
  txMock: any;
};

const SETTINGS: SettingsView = {
  clinicName: 'Zahro Dental',
  address: '',
  phone: '',
  workingHours: '',
  smsReminderTemplate: DEFAULT_REMINDER_TEMPLATE,
  telegramReminderTemplate: 'TG: {name} {date} {time} {doctor} {clinic}',
  reminderDaysAhead: 1,
};

function setup(): Mocks {
  const notificationsRepo = {
    createMany: jest.fn().mockResolvedValue(undefined),
    findAll: jest.fn(),
    create: jest.fn(),
    findReminderCandidates: jest.fn().mockResolvedValue([]),
  };
  const patientsRepo = {
    findById: jest.fn(),
  };
  const eskiz = {
    isConfigured: jest.fn().mockReturnValue(false),
    normalizeMobile: jest.fn(),
    sendSms: jest.fn(),
  };
  const settings = { get: jest.fn().mockResolvedValue({ ...SETTINGS }) };
  const telegram = {
    isAvailable: jest.fn().mockReturnValue(false),
    sendMessage: jest.fn().mockResolvedValue({ ok: true }),
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
    patientsRepo as unknown as PatientsRepository,
    eskiz as unknown as EskizService,
    prisma as unknown as PrismaService,
    settings as unknown as SettingsService,
    telegram as unknown as TelegramBotRegistry,
  );
  return {
    service,
    notificationsRepo,
    patientsRepo,
    eskiz,
    settings,
    telegram,
    prisma,
    txMock,
  } as unknown as Mocks;
}

const realNormalize = (phone: string) =>
  new EskizService().normalizeMobile(phone);

describe('NotificationsService.sendReminders', () => {
  let m: Mocks;

  beforeEach(() => {
    m = setup();
    m.eskiz.normalizeMobile.mockImplementation(realNormalize);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const cand = (
    id: string,
    over: {
      phone?: string;
      chat?: string | null;
      time?: string;
      patientId?: string;
    } = {},
  ) => ({
    id,
    patientId: over.patientId ?? `p-${id}`,
    date: new Date('2026-07-01T00:00:00.000Z'),
    time: over.time ?? '10:30',
    patient: {
      firstName: 'Ali',
      lastName: 'Valiyev',
      phone: over.phone ?? '+998901112233',
      telegramChatId: over.chat ?? null,
    },
    doctor: { firstName: 'Aziz', lastName: 'Karimov' },
  });

  const rows = () => m.txMock.notification.createMany.mock.calls[0][0].data;

  it('booking bo‘lmasa — tranzaksiya yo‘q, hammasi 0', async () => {
    await expect(m.service.sendReminders()).resolves.toEqual({
      created: 0,
      smsSent: 0,
      smsFailed: 0,
      telegramSent: 0,
      telegramFailed: 0,
      skipped: 0,
    });
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('oyna — bugun..bugun+reminderDaysAhead (Toshkent), faol statuslar', async () => {
    // 2026-06-30 20:00Z = 2026-07-01 01:00 Toshkent
    jest.useFakeTimers({ now: new Date('2026-06-30T20:00:00.000Z') });
    m.settings.get.mockResolvedValue({ ...SETTINGS, reminderDaysAhead: 3 });
    await m.service.sendReminders();
    expect(m.notificationsRepo.findReminderCandidates).toHaveBeenCalledWith(
      new Date('2026-07-01T00:00:00.000Z'),
      new Date('2026-07-04T00:00:00.000Z'),
      ['pending', 'confirmed'],
    );
  });

  it('reminderDaysAhead = 0 — faqat bugun', async () => {
    jest.useFakeTimers({ now: new Date('2026-07-01T06:00:00.000Z') });
    m.settings.get.mockResolvedValue({ ...SETTINGS, reminderDaysAhead: 0 });
    await m.service.sendReminders();
    const [from, to] = m.notificationsRepo.findReminderCandidates.mock.calls[0];
    expect(from).toEqual(to);
  });

  it('Telegram bog‘langan + bot ishlayapti — bot orqali, shablon bilan, belgilanadi', async () => {
    m.telegram.isAvailable.mockReturnValue(true);
    m.eskiz.isConfigured.mockReturnValue(true);
    m.notificationsRepo.findReminderCandidates.mockResolvedValue([
      cand('b1', { chat: '777' }),
    ] as any);

    const out = await m.service.sendReminders();

    expect(m.telegram.sendMessage).toHaveBeenCalledWith(
      '777',
      'TG: Ali Valiyev 01.07.2026 10:30 Aziz Karimov Zahro Dental',
    );
    expect(m.eskiz.sendSms).not.toHaveBeenCalled();
    expect(out).toMatchObject({ created: 1, telegramSent: 1, smsSent: 0 });
    expect(rows()[0]).toMatchObject({
      patientId: 'p-b1',
      type: 'telegram',
      status: 'sent',
    });
    expect(m.txMock.booking.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['b1'] }, reminderSentAt: null },
      data: { reminderSentAt: expect.any(Date) },
    });
  });

  it('Telegram xatosi — failed, belgilanmaydi, SMS ga o‘tmaydi', async () => {
    m.telegram.isAvailable.mockReturnValue(true);
    m.eskiz.isConfigured.mockReturnValue(true);
    m.telegram.sendMessage.mockResolvedValue({
      ok: false,
      error: 'Forbidden: bot was blocked by the user',
    });
    m.notificationsRepo.findReminderCandidates.mockResolvedValue([
      cand('b1', { chat: '777' }),
    ] as any);

    const out = await m.service.sendReminders();

    expect(out).toMatchObject({ telegramFailed: 1, telegramSent: 0 });
    expect(rows()[0]).toMatchObject({ type: 'telegram', status: 'failed' });
    expect(m.eskiz.sendSms).not.toHaveBeenCalled();
    expect(m.txMock.booking.updateMany).not.toHaveBeenCalled();
  });

  it('chatId bor, lekin bot ishlamayapti — SMS (SMS shabloni)', async () => {
    m.eskiz.isConfigured.mockReturnValue(true);
    m.eskiz.sendSms.mockResolvedValue({ ok: true } as any);
    m.notificationsRepo.findReminderCandidates.mockResolvedValue([
      cand('b1', { chat: '777' }),
    ] as any);

    const out = await m.service.sendReminders();

    expect(m.telegram.sendMessage).not.toHaveBeenCalled();
    expect(m.eskiz.sendSms).toHaveBeenCalledWith(
      '998901112233',
      'Hurmatli Ali Valiyev, 01.07.2026 kuni soat 10:30 da Aziz Karimov qabuliga yozilgansiz. Zahro Dental',
    );
    expect(out).toMatchObject({ smsSent: 1 });
    expect(rows()[0]).toMatchObject({ type: 'sms', status: 'sent' });
  });

  it('Eskiz o‘chiq — SMS yozuvi failed (skipped), belgilanmaydi', async () => {
    m.notificationsRepo.findReminderCandidates.mockResolvedValue([
      cand('b1'),
    ] as any);
    const out = await m.service.sendReminders();
    expect(out).toMatchObject({ created: 1, skipped: 1, smsFailed: 0 });
    expect(m.eskiz.sendSms).not.toHaveBeenCalled();
    expect(rows()[0]).toMatchObject({ type: 'sms', status: 'failed' });
    expect(m.txMock.booking.updateMany).not.toHaveBeenCalled();
  });

  it('aralash: SMS ok, SMS xato, telefon noto‘g‘ri, reject, Telegram ok', async () => {
    m.eskiz.isConfigured.mockReturnValue(true);
    m.telegram.isAvailable.mockReturnValue(true);
    m.eskiz.sendSms.mockImplementation(async (mobile: string) => {
      if (mobile === '998900000002') return { ok: false, error: 'x' } as any;
      if (mobile === '998900000004') throw new Error('timeout');
      return { ok: true } as any;
    });
    m.notificationsRepo.findReminderCandidates.mockResolvedValue([
      cand('b1', { phone: '+998900000001' }),
      cand('b2', { phone: '+998900000002' }),
      cand('b3', { phone: 'bad' }),
      cand('b4', { phone: '+998900000004' }),
      cand('b5', { chat: '55' }),
    ] as any);

    const out = await m.service.sendReminders();

    expect(out).toEqual({
      created: 5,
      smsSent: 1,
      smsFailed: 3,
      telegramSent: 1,
      telegramFailed: 0,
      skipped: 0,
    });
    expect(rows().map((r: any) => [r.type, r.status])).toEqual([
      ['sms', 'sent'],
      ['sms', 'failed'],
      ['sms', 'failed'],
      ['sms', 'failed'],
      ['telegram', 'sent'],
    ]);
    expect(m.txMock.booking.updateMany.mock.calls[0][0].where.id).toEqual({
      in: ['b1', 'b5'],
    });
  });

  it('shifokor ismi bo‘sh — "shifokor"', async () => {
    m.eskiz.isConfigured.mockReturnValue(true);
    m.eskiz.sendSms.mockResolvedValue({ ok: true } as any);
    const c = cand('b1');
    c.doctor = { firstName: '', lastName: '' };
    m.notificationsRepo.findReminderCandidates.mockResolvedValue([c] as any);
    await m.service.sendReminders();
    expect(m.eskiz.sendSms.mock.calls[0][1]).toContain(
      'soat 10:30 da shifokor',
    );
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
            patient: { deletedAt: null },
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
        expect.objectContaining({
          where: { id: { in: ['p1', 'p2', 'p3'] }, deletedAt: null },
        }),
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

    it('Telegram bog‘langan bemor + bot ishlayapti — bot orqali, SMS emas', async () => {
      m.eskiz.isConfigured.mockReturnValue(true);
      m.telegram.isAvailable.mockReturnValue(true);
      m.telegram.sendMessage
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false, error: 'blocked' });
      m.prisma.patient.findMany.mockResolvedValue([
        { ...target('p1', '+998901112233', upcoming), telegramChatId: '11' },
        {
          ...target('p2', '+998901112244', { ...upcoming, id: 'b2' }),
          telegramChatId: '22',
        },
      ]);
      const out = await m.service.bulkSend({
        targetIds: ['p1', 'p2'],
        targetType: 'patient',
        message: 'Salom [bemor]',
      });
      expect(out).toEqual({ sent: 1, failed: 1, total: 2 });
      expect(m.eskiz.sendSms).not.toHaveBeenCalled();
      expect(m.telegram.sendMessage).toHaveBeenCalledWith(
        '11',
        'Salom Ali Valiyev',
      );
      const rows = m.txMock.notification.createMany.mock.calls[0][0].data;
      expect(rows.map((r: any) => [r.type, r.status])).toEqual([
        ['telegram', 'sent'],
        ['telegram', 'failed'],
      ]);
      expect(m.txMock.booking.updateMany.mock.calls[0][0].where.id).toEqual({
        in: ['b1'],
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
