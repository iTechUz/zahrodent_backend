import {
  RemindersService,
  bookingStart,
  reminderKeyboard,
} from './reminders.service';

describe('RemindersService', () => {
  let prisma: any;
  let outbox: { enqueue: jest.Mock };
  let status: { onChanged: jest.Mock };
  let svc: RemindersService;
  // 2026-11-02 10:00 Tashkent = 05:00Z
  const bDate = new Date('2026-11-02T00:00:00Z');
  const at = (iso: string) => new Date(iso);
  const row = (o: object = {}) => ({
    id: 'b1',
    date: bDate,
    time: '10:00',
    reminder24SentAt: null,
    reminder2SentAt: null,
    patientId: 'p1',
    patient: { firstName: 'Ali', lastName: 'V', telegramChatId: '555' },
    doctor: { firstName: 'Dr', lastName: 'K' },
    ...o,
  });

  beforeEach(() => {
    prisma = {
      booking: {
        findMany: jest.fn().mockResolvedValue([row()]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(),
      },
    };
    outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'n1' }) };
    status = { onChanged: jest.fn().mockResolvedValue(undefined) };
    const settings = {
      get: jest.fn().mockResolvedValue({
        telegramReminderTemplate: 'Salom {name}, {date} {time} {doctor}',
        clinicName: 'Zahro',
      }),
    };
    svc = new RemindersService(
      prisma,
      settings as never,
      outbox as never,
      status as never,
    );
    delete process.env.TELEGRAM_STATUS_CHAT_ID;
    process.env.TELEGRAM_LEADS_CHAT_ID = '-100';
  });

  it('bookingStart is Tashkent time', () => {
    expect(bookingStart(bDate, '10:00').toISOString()).toBe(
      '2026-11-02T05:00:00.000Z',
    );
  });

  it('~20h before → one 24h reminder with both buttons', async () => {
    await expect(svc.run(at('2026-11-01T09:00:00Z'))).resolves.toBe(1);
    const a = outbox.enqueue.mock.calls[0][0];
    expect(a.kind).toBe('reminder_24h');
    expect(a.chatId).toBe('555');
    expect(a.text).toContain('02.11.2026');
    expect(
      a.replyMarkup.inline_keyboard.flat().map((b: any) => b.callback_data),
    ).toEqual(['rem_ok_b1', 'rem_re_b1']);
    expect(prisma.booking.updateMany.mock.calls[0][0].where).toEqual({
      id: 'b1',
      reminder24SentAt: null,
    });
  });

  it('~1h before → 2h reminder (and 24h marked so it is not sent later)', async () => {
    await svc.run(at('2026-11-02T04:00:00Z'));
    expect(outbox.enqueue.mock.calls[0][0].kind).toBe('reminder_2h');
    expect(prisma.booking.updateMany.mock.calls[0][0].data).toMatchObject({
      reminder24SentAt: expect.any(Date),
      reminder2SentAt: expect.any(Date),
    });
  });

  it('more than 24h ahead / already started / already sent → nothing', async () => {
    await expect(svc.run(at('2026-10-31T00:00:00Z'))).resolves.toBe(0);
    await expect(svc.run(at('2026-11-02T06:00:00Z'))).resolves.toBe(0);
    prisma.booking.findMany.mockResolvedValue([
      row({ reminder24SentAt: new Date() }),
    ]);
    await expect(svc.run(at('2026-11-01T09:00:00Z'))).resolves.toBe(0);
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('lost claim (other replica) → not sent twice', async () => {
    prisma.booking.updateMany.mockResolvedValue({ count: 0 });
    await expect(svc.run(at('2026-11-01T09:00:00Z'))).resolves.toBe(0);
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('outbox storage failure releases the claim', async () => {
    outbox.enqueue.mockResolvedValue(null);
    await svc.run(at('2026-11-01T09:00:00Z'));
    expect(prisma.booking.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'b1' },
      data: { reminder24SentAt: null },
    });
  });

  it('never throws', async () => {
    prisma.booking.findMany.mockRejectedValue(new Error('db'));
    await expect(svc.run()).resolves.toBe(0);
  });

  describe('handleAnswer', () => {
    const now = at('2026-11-01T09:00:00Z');
    const bk = (o: object = {}) => ({
      id: 'b1',
      status: 'pending',
      date: bDate,
      time: '10:00',
      patientConfirmedAt: null,
      rescheduleRequestedAt: null,
      patientId: 'p1',
      patient: {
        firstName: 'Ali',
        lastName: 'V',
        phone: '+998901234567',
        telegramChatId: '555',
      },
      doctor: { firstName: 'Dr', lastName: 'K' },
      ...o,
    });
    beforeEach(() => prisma.booking.findUnique.mockResolvedValue(bk()));

    it('confirm → confirmed + audit/group via status service', async () => {
      await expect(svc.handleAnswer(555, 'b1', 'confirm', now)).resolves.toBe(
        'confirmed',
      );
      expect(prisma.booking.updateMany.mock.calls[0][0].data.status).toBe(
        'confirmed',
      );
      expect(status.onChanged).toHaveBeenCalledWith({
        bookingId: 'b1',
        from: 'pending',
        to: 'confirmed',
        actor: { id: null, name: 'Bemor (Telegram)' },
      });
    });

    it('reschedule → staff group notified, status unchanged', async () => {
      await expect(
        svc.handleAnswer(555, 'b1', 'reschedule', now),
      ).resolves.toBe('reschedule');
      const m = outbox.enqueue.mock.calls[0][0];
      expect(m.kind).toBe('booking_reschedule_request');
      expect(m.chatId).toBe('-100');
      expect(
        prisma.booking.updateMany.mock.calls[0][0].data,
      ).not.toHaveProperty('status');
      expect(status.onChanged).not.toHaveBeenCalled();
    });

    it('someone else’s chat / cancelled / past → denied, nothing written', async () => {
      await expect(svc.handleAnswer(999, 'b1', 'confirm', now)).resolves.toBe(
        'denied',
      );
      prisma.booking.findUnique.mockResolvedValue(bk({ status: 'cancelled' }));
      await expect(svc.handleAnswer(555, 'b1', 'confirm', now)).resolves.toBe(
        'denied',
      );
      prisma.booking.findUnique.mockResolvedValue(bk());
      await expect(
        svc.handleAnswer(555, 'b1', 'confirm', at('2026-11-02T06:00:00Z')),
      ).resolves.toBe('denied');
      prisma.booking.findUnique.mockResolvedValue(null);
      await expect(svc.handleAnswer(555, 'x', 'confirm', now)).resolves.toBe(
        'denied',
      );
      expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    });

    it('second press → already', async () => {
      prisma.booking.findUnique.mockResolvedValue(
        bk({ patientConfirmedAt: new Date() }),
      );
      await expect(svc.handleAnswer(555, 'b1', 'confirm', now)).resolves.toBe(
        'already',
      );
      expect(status.onChanged).not.toHaveBeenCalled();
    });
  });

  it('keyboard helper', () => {
    expect(reminderKeyboard('z').inline_keyboard).toHaveLength(2);
  });
});
