import { TelegramService } from './telegram.service';

describe('TelegramService.saveFeedback', () => {
  let prisma: any;
  let svc: TelegramService;
  let outbox: { enqueue: jest.Mock };
  const saved = process.env.TELEGRAM_LEADS_CHAT_ID;
  afterEach(() => {
    if (saved === undefined) delete process.env.TELEGRAM_LEADS_CHAT_ID;
    else process.env.TELEGRAM_LEADS_CHAT_ID = saved;
  });
  const booking = (o: object = {}) => ({
    status: 'completed',
    feedbackRating: null,
    date: new Date('2026-11-02T00:00:00Z'),
    time: '10:00',
    patientId: 'p1',
    patient: {
      telegramChatId: '555',
      firstName: 'Ali',
      lastName: 'Valiyev',
      phone: '+998901234567',
    },
    doctor: { firstName: 'Dr', lastName: 'K' },
    ...o,
  });

  beforeEach(() => {
    prisma = {
      booking: {
        findUnique: jest.fn().mockResolvedValue(booking()),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    outbox = { enqueue: jest.fn().mockResolvedValue({}) };
    process.env.TELEGRAM_LEADS_CHAT_ID = '-100';
    svc = new TelegramService(
      {} as never,
      {} as never,
      {} as never,
      prisma,
      undefined,
      outbox as never,
    );
  });

  it('own chat + completed → saved', async () => {
    await expect(svc.saveFeedback(555, 'b1', 5)).resolves.toBe('saved');
    expect(prisma.booking.updateMany.mock.calls[0][0].data.feedbackRating).toBe(
      5,
    );
  });

  it('someone else’s chat → denied, nothing written', async () => {
    await expect(svc.saveFeedback(999, 'b1', 5)).resolves.toBe('denied');
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it('not completed / unknown / bad rating → denied', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ status: 'pending' }));
    await expect(svc.saveFeedback(555, 'b1', 5)).resolves.toBe('denied');
    prisma.booking.findUnique.mockResolvedValue(null);
    await expect(svc.saveFeedback(555, 'b1', 5)).resolves.toBe('denied');
    await expect(svc.saveFeedback(555, 'b1', 9)).resolves.toBe('denied');
  });

  it('already rated → already', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ feedbackRating: 4 }));
    await expect(svc.saveFeedback(555, 'b1', 5)).resolves.toBe('already');
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it('low rating (<=3) → staff group alert; 5 stars → none', async () => {
    await svc.saveFeedback(555, 'b1', 2);
    const msg = outbox.enqueue.mock.calls[0][0];
    expect(msg.kind).toBe('feedback_low_group');
    expect(msg.chatId).toBe('-100');
    expect(msg.text).toContain('2/5');
    expect(msg.text).toContain('02.11.2026 10:00');
    outbox.enqueue.mockClear();
    await svc.saveFeedback(555, 'b1', 5);
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });
});
