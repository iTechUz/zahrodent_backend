import { ClientNotifierService } from './client-notifier.service';

describe('ClientNotifierService', () => {
  let prisma: any;
  let patients: any;
  let outbox: any;
  let eskiz: any;
  let svc: ClientNotifierService;
  const lead = {
    id: 'l1',
    name: 'Ali <b>evil</b>',
    phone: '+998901234567',
    doctor: 'Dr. Karimov',
    preferredAt: '2026-11-02 10:00',
    message: 'secret note',
  } as any;
  const saved = process.env.TELEGRAM_BOT_USERNAME;

  beforeEach(() => {
    prisma = { patient: { findFirst: jest.fn() } };
    patients = { findActiveIdsByMobile: jest.fn().mockResolvedValue([]) };
    outbox = { enqueue: jest.fn().mockResolvedValue({}) };
    eskiz = {
      isConfigured: jest.fn().mockReturnValue(true),
      normalizeMobile: jest.fn().mockReturnValue('998901234567'),
      sendSms: jest.fn().mockResolvedValue({ ok: true }),
    };
    process.env.TELEGRAM_BOT_USERNAME = '@zahro_bot';
    svc = new ClientNotifierService(prisma, patients, outbox, eskiz);
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.TELEGRAM_BOT_USERNAME;
    else process.env.TELEGRAM_BOT_USERNAME = saved;
  });

  it('linked phone → Telegram via outbox, no name/note in text', async () => {
    patients.findActiveIdsByMobile.mockResolvedValue([{ id: 'p1' }]);
    prisma.patient.findFirst.mockResolvedValue({ telegramChatId: '555' });
    await expect(svc.notifyLeadReceived(lead)).resolves.toBe('telegram');
    const arg = outbox.enqueue.mock.calls[0][0];
    expect(arg.chatId).toBe('555');
    expect(arg.text).toContain('2026-11-02 10:00');
    expect(arg.text).toContain('Dr. Karimov');
    expect(arg.text).not.toContain('evil');
    expect(arg.text).not.toContain('secret');
    expect(eskiz.sendSms).not.toHaveBeenCalled();
  });

  it('not linked → SMS with bot deep link', async () => {
    await expect(svc.notifyLeadReceived(lead)).resolves.toBe('sms');
    expect(eskiz.sendSms).toHaveBeenCalledWith(
      '998901234567',
      expect.stringContaining('https://t.me/zahro_bot?start=lead'),
    );
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('not linked and no Eskiz → none', async () => {
    eskiz.isConfigured.mockReturnValue(false);
    await expect(svc.notifyLeadReceived(lead)).resolves.toBe('none');
  });

  it('invalid bot username → no link in SMS', async () => {
    process.env.TELEGRAM_BOT_USERNAME = 'x y"';
    expect(svc.botDeepLink()).toBeNull();
  });

  it('never throws', async () => {
    patients.findActiveIdsByMobile.mockRejectedValue(new Error('db'));
    await expect(svc.notifyLeadReceived(lead)).resolves.toBe('none');
  });

  it('findChatId: non-Uz phone → null without DB', async () => {
    await expect(svc.findChatId('123')).resolves.toBeNull();
    expect(patients.findActiveIdsByMobile).not.toHaveBeenCalled();
  });
});
