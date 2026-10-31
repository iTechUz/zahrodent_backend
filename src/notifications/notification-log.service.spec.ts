import { NotFoundException } from '@nestjs/common';
import {
  MAX_ATTEMPTS,
  NotificationLogService,
  isPermanentTelegramError,
  retryDelayMs,
} from './notification-log.service';

describe('NotificationLogService', () => {
  let db: any;
  let tg: { sendMessage: jest.Mock };
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
      },
      $transaction: jest.fn((x) => Promise.all(x)),
    };
    tg = { sendMessage: jest.fn().mockResolvedValue({ ok: true }) };
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
});
