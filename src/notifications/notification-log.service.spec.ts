import { Logger, NotFoundException } from '@nestjs/common';
import {
  DELIVERY_ALERT_KIND,
  MAX_ATTEMPTS,
  TELEGRAM_TEXT_MAX,
  clampText,
  isDeadChatError,
  NotificationLogService,
  isPermanentTelegramError,
  retryDelayMs,
} from './notification-log.service';

const NO_PREVIEW = { link_preview_options: { is_disabled: true } };

describe('NotificationLogService', () => {
  let db: any;
  let tg: {
    sendMessage: jest.Mock;
    reportGroupSuccess: jest.Mock;
    reportGroupFailure: jest.Mock;
  };
  let svc: NotificationLogService;
  const row = (o: object = {}) => ({
    id: 'n1',
    kind: 'lead_group',
    chatId: '-100',
    text: 'hi',
    replyMarkup: null,
    status: 'pending',
    attempts: 0,
    ...o,
  });

  beforeEach(() => {
    db = {
      notificationLog: {
        create: jest.fn().mockImplementation(({ data }) => row(data)),
        update: jest.fn().mockImplementation(({ data }) => row(data)),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn((x) => Promise.all(x)),
    };
    tg = {
      sendMessage: jest.fn().mockResolvedValue({ ok: true }),
      reportGroupSuccess: jest.fn(),
      reportGroupFailure: jest.fn(),
    };
    svc = new NotificationLogService(db, tg as never);
  });

  it('enqueue: saves, sends, marks sent', async () => {
    await svc.enqueue({ kind: 'lead_group', chatId: '-100', text: 'hi' });
    expect(tg.sendMessage).toHaveBeenCalledWith('-100', 'hi', undefined);
    expect(db.notificationLog.update.mock.calls[0][0].data).toMatchObject({
      status: 'sent',
      attempts: 1,
    });
  });

  describe('bookings topic', () => {
    const OLD = { ...process.env };
    beforeEach(() => {
      process.env.TELEGRAM_STATUS_CHAT_ID = '-100';
    });
    afterEach(() => {
      process.env = { ...OLD };
    });

    it('booking group message goes to TELEGRAM_BOOKINGS_TOPIC_ID', async () => {
      process.env.TELEGRAM_BOOKINGS_TOPIC_ID = '77';
      await svc.enqueue({
        kind: 'booking_status_group',
        chatId: '-100',
        text: 'hi',
      });
      expect(tg.sendMessage).toHaveBeenCalledWith('-100', 'hi', {
        message_thread_id: 77,
        link_preview_options: { is_disabled: true },
      });
    });

    it('without the env var it stays in General (no thread id)', async () => {
      delete process.env.TELEGRAM_BOOKINGS_TOPIC_ID;
      await svc.enqueue({
        kind: 'booking_status_group',
        chatId: '-100',
        text: 'hi',
      });
      expect(tg.sendMessage).toHaveBeenCalledWith('-100', 'hi', NO_PREVIEW);
    });

    it('an invalid topic id is ignored', async () => {
      process.env.TELEGRAM_BOOKINGS_TOPIC_ID = 'abc';
      await svc.enqueue({
        kind: 'booking_status_group',
        chatId: '-100',
        text: 'hi',
      });
      expect(tg.sendMessage).toHaveBeenCalledWith('-100', 'hi', NO_PREVIEW);
    });

    it('other kinds (leads) and patient chats are not moved to the topic', async () => {
      process.env.TELEGRAM_BOOKINGS_TOPIC_ID = '77';
      await svc.enqueue({ kind: 'lead_group', chatId: '-100', text: 'a' });
      await svc.enqueue({
        kind: 'booking_status_group',
        chatId: '555',
        text: 'b',
      });
      expect(tg.sendMessage).toHaveBeenNthCalledWith(
        1,
        '-100',
        'a',
        NO_PREVIEW,
      );
      expect(tg.sendMessage).toHaveBeenNthCalledWith(2, '555', 'b', undefined);
    });

    it('a deleted topic falls back to General instead of losing the message', async () => {
      process.env.TELEGRAM_BOOKINGS_TOPIC_ID = '77';
      tg.sendMessage
        .mockResolvedValueOnce({
          ok: false,
          error: '400: Bad Request: message thread not found',
        })
        .mockResolvedValueOnce({ ok: true });
      await svc.enqueue({
        kind: 'booking_status_group',
        chatId: '-100',
        text: 'hi',
      });
      expect(tg.sendMessage).toHaveBeenNthCalledWith(
        2,
        '-100',
        'hi',
        NO_PREVIEW,
      );
      expect(db.notificationLog.update.mock.calls[0][0].data).toMatchObject({
        status: 'sent',
      });
    });
  });

  it('passes inline keyboard as reply_markup', async () => {
    const kb = { inline_keyboard: [[{ text: 'a', callback_data: 'b' }]] };
    db.notificationLog.create.mockResolvedValue(
      row({ replyMarkup: kb, chatId: '1', text: 'x' }),
    );
    await svc.enqueue({
      kind: 'reminder',
      chatId: '1',
      text: 'x',
      replyMarkup: kb,
    });
    expect(tg.sendMessage).toHaveBeenCalledWith('1', 'x', {
      reply_markup: kb,
    });
  });

  it('transient error → stays pending with backoff', async () => {
    tg.sendMessage.mockResolvedValue({ ok: false, error: '429: Too Many' });
    await svc.enqueue({ kind: 'k', chatId: '1', text: 'x' });
    const d = db.notificationLog.update.mock.calls[0][0].data;
    expect(d.status).toBe('pending');
    expect(d.attempts).toBe(1);
    expect(d.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    expect(d.lastError).toContain('429');
  });

  it('403 bot blocked → failed at once (no retries)', async () => {
    tg.sendMessage.mockResolvedValue({
      ok: false,
      error: '403: Forbidden: bot was blocked by the user',
    });
    await svc.enqueue({ kind: 'k', chatId: '1', text: 'x' });
    expect(db.notificationLog.update.mock.calls[0][0].data.status).toBe(
      'failed',
    );
  });

  it('gives up after MAX_ATTEMPTS', async () => {
    tg.sendMessage.mockResolvedValue({ ok: false, error: 'bot not running' });
    db.notificationLog.findMany.mockResolvedValue([
      row({ attempts: MAX_ATTEMPTS - 1 }),
    ]);
    await expect(svc.processDue()).resolves.toBe(1);
    expect(db.notificationLog.update.mock.calls[0][0].data.status).toBe(
      'failed',
    );
  });

  it('processDue skips rows another worker claimed', async () => {
    db.notificationLog.findMany.mockResolvedValue([row()]);
    db.notificationLog.updateMany.mockResolvedValue({ count: 0 });
    await expect(svc.processDue()).resolves.toBe(0);
    expect(tg.sendMessage).not.toHaveBeenCalled();
  });

  it('enqueue never throws when DB fails', async () => {
    db.notificationLog.create.mockRejectedValue(new Error('db'));
    await expect(
      svc.enqueue({ kind: 'k', chatId: '1', text: 'x' }),
    ).resolves.toBeNull();
  });

  it('retry: unknown id → 404; sent row untouched', async () => {
    db.notificationLog.findUnique.mockResolvedValue(null);
    await expect(svc.retry('x')).rejects.toBeInstanceOf(NotFoundException);
    db.notificationLog.findUnique.mockResolvedValue(row({ status: 'sent' }));
    await svc.retry('n1');
    expect(tg.sendMessage).not.toHaveBeenCalled();
  });

  it('summary counts failed24h + pending', async () => {
    db.notificationLog.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    await expect(svc.summary()).resolves.toEqual({ failed24h: 3, pending: 2 });
  });

  it('helpers', () => {
    expect(isPermanentTelegramError('400: Bad Request: chat not found')).toBe(
      true,
    );
    expect(isPermanentTelegramError('ETIMEDOUT')).toBe(false);
    expect(retryDelayMs(1)).toBe(60_000);
  });

  describe('reliability', () => {
    const saved = {
      a: process.env.TELEGRAM_LEADS_CHAT_ID,
      b: process.env.TELEGRAM_STATUS_CHAT_ID,
    };
    beforeEach(() => {
      process.env.TELEGRAM_LEADS_CHAT_ID = '-100';
      delete process.env.TELEGRAM_STATUS_CHAT_ID;
      db.patient = {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({
          firstName: 'Ali',
          lastName: 'V',
          phone: '+998901234567',
        }),
      };
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

    it('enqueue creates the row already claimed (poller cannot double-send)', async () => {
      await svc.enqueue({ kind: 'k', chatId: '1', text: 'x' });
      const at = db.notificationLog.create.mock.calls[0][0].data.nextAttemptAt;
      expect(at.getTime()).toBeGreaterThan(Date.now() + 60_000);
    });

    it('long text is clamped to Telegram limit', async () => {
      await svc.enqueue({ kind: 'k', chatId: '1', text: 'a'.repeat(5000) });
      const text = db.notificationLog.create.mock.calls[0][0].data.text;
      expect(text).toHaveLength(TELEGRAM_TEXT_MAX);
      expect(clampText('short')).toBe('short');
    });

    it('patient blocked the bot → chat unlinked + staff alert with patient', async () => {
      tg.sendMessage
        .mockResolvedValueOnce({
          ok: false,
          error: '403: Forbidden: bot was blocked by the user',
        })
        .mockResolvedValue({ ok: true });
      await svc.enqueue({
        kind: 'reminder_24h',
        chatId: '555',
        text: 'x',
        patientId: 'p1',
      });
      expect(db.patient.updateMany).toHaveBeenCalledWith({
        where: { id: 'p1', telegramChatId: '555' },
        data: { telegramChatId: null },
      });
      const alert = db.notificationLog.create.mock.calls.find(
        (c: any) => c[0].data.kind === DELIVERY_ALERT_KIND,
      )[0].data;
      expect(alert.chatId).toBe('-100');
      expect(alert.text).toContain('reminder_24h');
      expect(alert.text).toContain('Ali V');
      expect(alert.text).toContain('+998901234567');
    });

    it('failed alert itself / failure of the group chat → no alert loop', async () => {
      tg.sendMessage.mockResolvedValue({
        ok: false,
        error: '400: Bad Request: chat not found',
      });
      await svc.enqueue({
        kind: DELIVERY_ALERT_KIND,
        chatId: '-100',
        text: 'x',
      });
      await svc.enqueue({ kind: 'lead_group', chatId: '-100', text: 'x' });
      expect(db.notificationLog.create).toHaveBeenCalledTimes(2);
    });

    it('transient failure → no unlink, no alert', async () => {
      tg.sendMessage.mockResolvedValue({ ok: false, error: 'ETIMEDOUT' });
      await svc.enqueue({ kind: 'k', chatId: '5', text: 'x', patientId: 'p1' });
      expect(db.patient.updateMany).not.toHaveBeenCalled();
      expect(db.notificationLog.create).toHaveBeenCalledTimes(1);
    });

    it('retry: failed row is claimed atomically, then sent; lost claim → no send', async () => {
      db.notificationLog.findUnique.mockResolvedValue(
        row({ status: 'failed', attempts: 3 }),
      );
      await svc.retry('n1');
      expect(db.notificationLog.updateMany.mock.calls[0][0].where).toEqual({
        id: 'n1',
        status: 'failed',
      });
      expect(tg.sendMessage).toHaveBeenCalledTimes(1);
      tg.sendMessage.mockClear();
      db.notificationLog.updateMany.mockResolvedValue({ count: 0 });
      await svc.retry('n1');
      expect(tg.sendMessage).not.toHaveBeenCalled();
    });

    it('retry: pending (in flight) row is not sent a second time', async () => {
      db.notificationLog.findUnique.mockResolvedValue(row());
      await svc.retry('n1');
      expect(tg.sendMessage).not.toHaveBeenCalled();
    });

    it('isDeadChatError', () => {
      expect(
        isDeadChatError('403: Forbidden: bot was blocked by the user'),
      ).toBe(true);
      expect(isDeadChatError('400: Bad Request: chat not found')).toBe(true);
      expect(isDeadChatError('429: Too Many Requests')).toBe(false);
    });
  });

  describe('expiry, preview, migration, health signal, cleanup', () => {
    const saved = {
      a: process.env.TELEGRAM_LEADS_CHAT_ID,
      b: process.env.TELEGRAM_STATUS_CHAT_ID,
    };
    beforeEach(() => {
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

    it('expiresAt saqlanadi; muddati o‘tmagan xabar yuboriladi', async () => {
      const expiresAt = new Date(Date.now() + 3600_000);
      await svc.enqueue({
        kind: 'reminder_2h',
        chatId: '5',
        text: 'x',
        expiresAt,
      });
      expect(db.notificationLog.create.mock.calls[0][0].data.expiresAt).toBe(
        expiresAt,
      );
      expect(tg.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('muddati o‘tgan xabar yuborilmaydi — "expired"', async () => {
      await svc.enqueue({
        kind: 'reminder_2h',
        chatId: '5',
        text: 'x',
        expiresAt: new Date(Date.now() - 1000),
      });
      expect(tg.sendMessage).not.toHaveBeenCalled();
      expect(db.notificationLog.update.mock.calls[0][0].data.status).toBe(
        'expired',
      );
    });

    it('poller: kutib qolgan eskirgan qator yuborilmaydi, muddatsiz turlar o‘zgarmaydi', async () => {
      db.notificationLog.findMany.mockResolvedValue([
        row({ id: 'a', chatId: '5', expiresAt: new Date(Date.now() - 5) }),
        row({ id: 'b', chatId: '5', expiresAt: null }),
      ]);
      await svc.processDue();
      expect(tg.sendMessage).toHaveBeenCalledTimes(1);
      const statuses = db.notificationLog.update.mock.calls.map(
        (c: any) => c[0].data.status,
      );
      expect(statuses).toEqual(['expired', 'sent']);
    });

    it('guruh xabarlarida link preview o‘chiriladi; bemor chatida ta’sir yo‘q', async () => {
      await svc.enqueue({ kind: 'lead_group', chatId: '-100', text: 'a' });
      await svc.enqueue({ kind: 'reminder', chatId: '5', text: 'b' });
      expect(tg.sendMessage).toHaveBeenNthCalledWith(
        1,
        '-100',
        'a',
        NO_PREVIEW,
      );
      expect(tg.sendMessage).toHaveBeenNthCalledWith(2, '5', 'b', undefined);
    });

    it('guruh supergroup bo‘ldi (migrate_to_chat_id) — baland ovozda log + bir marta qayta yuboriladi', async () => {
      const err = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      tg.sendMessage
        .mockResolvedValueOnce({
          ok: false,
          error:
            '400: Bad Request: group chat was upgraded to a supergroup chat',
          migrateToChatId: '-1009',
        })
        .mockResolvedValueOnce({ ok: true });
      await svc.enqueue({ kind: 'lead_group', chatId: '-100', text: 'a' });
      expect(tg.sendMessage).toHaveBeenCalledTimes(2);
      expect(err).toHaveBeenCalledWith(expect.stringContaining('-1009'));
      expect(db.notificationLog.update.mock.calls[0][0].data.status).toBe(
        'sent',
      );
      err.mockRestore();
    });

    it('migratsiya qayta urinishi ham xato bersa — ikkinchi qayta urinish yo‘q', async () => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation();
      tg.sendMessage.mockResolvedValue({
        ok: false,
        error: '400: Bad Request: upgraded',
        migrateToChatId: '-1009',
      });
      await svc.enqueue({ kind: 'lead_group', chatId: '-100', text: 'a' });
      expect(tg.sendMessage).toHaveBeenCalledTimes(2);
    });

    it('guruh: muvaffaqiyat → reportGroupSuccess; doimiy xato → reportGroupFailure + log.error (alert sikli yo‘q)', async () => {
      const err = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      await svc.enqueue({ kind: 'lead_group', chatId: '-100', text: 'a' });
      expect(tg.reportGroupSuccess).toHaveBeenCalledTimes(1);
      tg.sendMessage.mockResolvedValue({
        ok: false,
        error: '403: Forbidden: bot was kicked from the supergroup chat',
      });
      await svc.enqueue({ kind: 'lead_group', chatId: '-100', text: 'a' });
      expect(tg.reportGroupFailure).toHaveBeenCalledTimes(1);
      expect(err).toHaveBeenCalledWith(expect.stringContaining('guruhiga'));
      err.mockRestore();
    });

    it('bemor chatidagi xato guruh signaliga ta’sir qilmaydi', async () => {
      tg.sendMessage.mockResolvedValueOnce({
        ok: false,
        error: '403: blocked',
      });
      await svc.enqueue({ kind: 'reminder', chatId: '5', text: 'a' });
      expect(tg.reportGroupFailure).not.toHaveBeenCalled();
    });

    it('cleanupOld — 90 kundan eski sent/failed/expired o‘chiriladi, pending tegilmaydi', async () => {
      db.notificationLog.deleteMany.mockResolvedValue({ count: 4 });
      const now = new Date('2026-11-12T00:00:00Z');
      await expect(svc.cleanupOld(now)).resolves.toBe(4);
      const where = db.notificationLog.deleteMany.mock.calls[0][0].where;
      expect(where.status).toEqual({ in: ['sent', 'failed', 'expired'] });
      expect(where.createdAt.lt).toEqual(new Date('2026-08-14T00:00:00Z'));
    });

    it('cleanupOld — DB xatosi yutiladi', async () => {
      jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      db.notificationLog.deleteMany.mockRejectedValue(new Error('db'));
      await expect(svc.cleanupOld()).resolves.toBe(0);
    });
  });
});
