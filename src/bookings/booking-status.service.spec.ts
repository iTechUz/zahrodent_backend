import {
  BookingStatusService,
  feedbackKeyboard,
  formatClientStatusMessage,
  formatGroupStatusMessage,
} from './booking-status.service';

describe('BookingStatusService', () => {
  let prisma: any;
  let outbox: { enqueue: jest.Mock };
  let svc: BookingStatusService;
  const saved = {
    a: process.env.TELEGRAM_LEADS_CHAT_ID,
    b: process.env.TELEGRAM_STATUS_CHAT_ID,
  };
  const booking = (chat: string | null) => ({
    id: 'b1',
    date: new Date('2026-11-02T00:00:00Z'),
    time: '10:00',
    patient: {
      id: 'p1',
      firstName: 'Ali',
      lastName: 'Valiyev',
      phone: '+998901234567',
      telegramChatId: chat,
    },
    doctor: { firstName: 'Dr', lastName: 'Karimov' },
  });
  const change = (to: string, reason?: string) => ({
    bookingId: 'b1',
    from: 'pending',
    to,
    reason,
    actor: { id: 'u1', name: 'Admin Aziz' },
  });

  beforeEach(() => {
    prisma = {
      bookingStatusLog: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn(),
      },
      booking: { findUnique: jest.fn().mockResolvedValue(booking('555')) },
    };
    outbox = { enqueue: jest.fn().mockResolvedValue({}) };
    svc = new BookingStatusService(prisma, outbox as never);
    process.env.TELEGRAM_LEADS_CHAT_ID = '-100';
    delete process.env.TELEGRAM_STATUS_CHAT_ID;
  });
  afterEach(() => {
    for (const [k, v] of [
      ['TELEGRAM_LEADS_CHAT_ID', saved.a],
      ['TELEGRAM_STATUS_CHAT_ID', saved.b],
    ] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('logs who/when/why and posts to the staff group with admin name', async () => {
    await svc.onChanged(change('cancelled', 'Bemor so‘radi'));
    expect(prisma.bookingStatusLog.create.mock.calls[0][0].data).toMatchObject({
      bookingId: 'b1',
      fromStatus: 'pending',
      toStatus: 'cancelled',
      reason: 'Bemor so‘radi',
      changedById: 'u1',
      changedByName: 'Admin Aziz',
    });
    const group = outbox.enqueue.mock.calls.find(
      (c) => c[0].kind === 'booking_status_group',
    )[0];
    expect(group.chatId).toBe('-100');
    expect(group.text).toContain('Bekor qilindi');
    expect(group.text).toContain('Sabab: Bemor so‘radi');
    expect(group.text).toContain('Admin Aziz');
  });

  it('cancelled → patient gets the reason', async () => {
    await svc.onChanged(change('cancelled', 'Shifokor kasal'));
    const c = outbox.enqueue.mock.calls.find(
      (x) => x[0].kind === 'patient_status',
    )[0];
    expect(c.chatId).toBe('555');
    expect(c.text).toContain('Sababi: Shifokor kasal');
    expect(c.replyMarkup).toBeUndefined();
  });

  it('completed → patient message with rating buttons', async () => {
    await svc.onChanged(change('completed'));
    const c = outbox.enqueue.mock.calls.find(
      (x) => x[0].kind === 'patient_status',
    )[0];
    expect(c.replyMarkup.inline_keyboard[0]).toHaveLength(5);
    expect(c.replyMarkup.inline_keyboard[0][4].callback_data).toBe('fb_b1_5');
  });

  it('patient without Telegram link / status without client template → group only', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking(null));
    await svc.onChanged(change('confirmed'));
    expect(outbox.enqueue.mock.calls.map((c) => c[0].kind)).toEqual([
      'booking_status_group',
    ]);
    outbox.enqueue.mockClear();
    prisma.booking.findUnique.mockResolvedValue(booking('555'));
    await svc.onChanged(change('arrived'));
    expect(outbox.enqueue.mock.calls.map((c) => c[0].kind)).toEqual([
      'booking_status_group',
    ]);
  });

  it('TELEGRAM_STATUS_CHAT_ID overrides; no group env → no group message', async () => {
    process.env.TELEGRAM_STATUS_CHAT_ID = '-200';
    await svc.onChanged(change('arrived'));
    expect(outbox.enqueue.mock.calls[0][0].chatId).toBe('-200');
    outbox.enqueue.mockClear();
    delete process.env.TELEGRAM_STATUS_CHAT_ID;
    delete process.env.TELEGRAM_LEADS_CHAT_ID;
    await svc.onChanged(change('arrived'));
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('never throws (log + notify failures)', async () => {
    prisma.bookingStatusLog.create.mockRejectedValue(new Error('db'));
    prisma.booking.findUnique.mockRejectedValue(new Error('db'));
    await expect(svc.onChanged(change('confirmed'))).resolves.toBeUndefined();
  });

  it('formatters', () => {
    expect(
      formatClientStatusMessage('pending', {
        doctor: 'x',
        when: 'y',
        reason: null,
      }),
    ).toBeNull();
    expect(
      formatClientStatusMessage('cancelled', {
        doctor: 'x',
        when: 'y',
        reason: null,
      }),
    ).toContain("ko'rsatilmagan");
    expect(
      formatGroupStatusMessage({
        to: 'confirmed',
        from: 'pending',
        patientName: 'A',
        phone: '1',
        doctor: 'D',
        when: 'W',
        reason: null,
        admin: 'Ad',
      }),
    ).toContain("O'zgartirdi: Ad");
    expect(feedbackKeyboard('z').inline_keyboard[0][0].callback_data).toBe(
      'fb_z_1',
    );
  });
});
