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
  const booking = (chat: string | null, status = 'pending') => ({
    id: 'b1',
    status,
    date: new Date('2026-11-02T00:00:00Z'),
    time: '10:00',
    patient: {
      id: 'p1',
      firstName: 'Ali',
      lastName: 'Valiyev',
      phone: '+998901234567',
      telegramChatId: chat,
      deletedAt: null,
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

  it('notifyChanged — faqat xabar (log yozmaydi), sabab guruhga boradi', async () => {
    await svc.notifyChanged(change('cancelled', 'Bemor arxivlandi'));
    expect(prisma.bookingStatusLog.create).not.toHaveBeenCalled();
    const group = outbox.enqueue.mock.calls.find(
      (c) => c[0].kind === 'booking_status_group',
    )[0];
    expect(group.text).toContain('Sabab: Bemor arxivlandi');
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

  describe('created / rescheduled / deleted', () => {
    const kinds = () => outbox.enqueue.mock.calls.map((c) => c[0].kind);
    const actor = { id: 'u1', name: 'Admin Aziz' };

    it('onCreated: staff group + patient confirmation with Tashkent date', async () => {
      await svc.onCreated('b1', actor);
      expect(kinds()).toEqual([
        'booking_created_group',
        'patient_booking_created',
      ]);
      const patient = outbox.enqueue.mock.calls[1][0];
      expect(patient.chatId).toBe('555');
      expect(patient.text).toContain('02.11.2026 10:00');
      expect(patient.text).toContain('tasdiqlaydi');
      expect(outbox.enqueue.mock.calls[0][0].text).toContain('Admin Aziz');
    });

    it('onCreated confirmed → "belgilandi"; completed/cancelled → group only', async () => {
      prisma.booking.findUnique.mockResolvedValue(booking('555', 'confirmed'));
      await svc.onCreated('b1');
      expect(outbox.enqueue.mock.calls[1][0].text).toContain('belgilandi');
      outbox.enqueue.mockClear();
      prisma.booking.findUnique.mockResolvedValue(booking('555', 'completed'));
      await svc.onCreated('b1');
      expect(kinds()).toEqual(['booking_created_group']);
    });

    it('patient without Telegram / soft-deleted patient → skipped with a log, no throw', async () => {
      prisma.booking.findUnique.mockResolvedValue(booking(null));
      await svc.onCreated('b1');
      expect(kinds()).toEqual(['booking_created_group']);
      outbox.enqueue.mockClear();
      const b: any = booking('555');
      b.patient.deletedAt = new Date();
      prisma.booking.findUnique.mockResolvedValue(b);
      await svc.onCreated('b1');
      expect(kinds()).toEqual(['booking_created_group']);
    });

    it('onRescheduled: old → new time to the group; patient only when asked', async () => {
      await svc.onRescheduled({
        bookingId: 'b1',
        previousWhen: '01.11.2026 09:00',
        actor,
        notifyPatient: true,
      });
      expect(kinds()).toEqual([
        'booking_rescheduled_group',
        'patient_rescheduled',
      ]);
      expect(outbox.enqueue.mock.calls[0][0].text).toContain(
        '01.11.2026 09:00 → 02.11.2026 10:00',
      );
      expect(outbox.enqueue.mock.calls[1][0].text).toContain(
        'Yangi vaqt: 02.11.2026 10:00',
      );
      outbox.enqueue.mockClear();
      await svc.onRescheduled({
        bookingId: 'b1',
        previousWhen: 'x',
        actor,
        notifyPatient: false,
      });
      expect(kinds()).toEqual(['booking_rescheduled_group']);
    });

    it('onDeleted: group audit + patient cancel notice for an active future booking', async () => {
      jest.useFakeTimers({ now: new Date('2026-11-01T00:00:00Z') });
      try {
        const snap = await svc.snapshot('b1');
        await svc.onDeleted(snap, actor);
        expect(kinds()).toEqual(['booking_deleted_group', 'patient_status']);
        expect(outbox.enqueue.mock.calls[0][0].text).toContain(
          "O'chirdi: Admin Aziz",
        );
        expect(outbox.enqueue.mock.calls[1][0].text).toContain('bekor qilindi');
      } finally {
        jest.useRealTimers();
      }
    });

    it('onDeleted: completed or past booking → no patient message; null snapshot → nothing', async () => {
      prisma.booking.findUnique.mockResolvedValue(booking('555', 'completed'));
      await svc.onDeleted(await svc.snapshot('b1'), actor);
      expect(kinds()).toEqual(['booking_deleted_group']);
      outbox.enqueue.mockClear();
      await svc.onDeleted(null, actor);
      expect(outbox.enqueue).not.toHaveBeenCalled();
    });

    it('none of them throw on DB/outbox failure', async () => {
      prisma.booking.findUnique.mockRejectedValue(new Error('db'));
      await expect(svc.onCreated('b1')).resolves.toBeUndefined();
      await expect(
        svc.onRescheduled({
          bookingId: 'b1',
          previousWhen: 'x',
          actor,
          notifyPatient: true,
        }),
      ).resolves.toBeUndefined();
    });
  });
});
