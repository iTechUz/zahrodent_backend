import {
  GROUP_FAILURE_THRESHOLD,
  TelegramBotRegistry,
} from './telegram-bot.registry';

describe('TelegramBotRegistry', () => {
  it('bot yo‘q — mavjud emas, sendMessage ok:false', async () => {
    const r = new TelegramBotRegistry();
    expect(r.isAvailable()).toBe(false);
    await expect(r.sendMessage('1', 'x')).resolves.toEqual({
      ok: false,
      error: 'bot not running',
    });
  });

  it('register → yuboradi; xato ok:false (throw yo‘q); null → o‘chadi', async () => {
    const r = new TelegramBotRegistry();
    const sender = { sendMessage: jest.fn().mockResolvedValue({}) };
    r.register(sender);
    expect(r.isAvailable()).toBe(true);
    await expect(r.sendMessage('123', 'Salom')).resolves.toEqual({ ok: true });
    expect(sender.sendMessage).toHaveBeenCalledWith('123', 'Salom');

    sender.sendMessage.mockRejectedValueOnce(new Error('403 blocked'));
    await expect(r.sendMessage('123', 'x')).resolves.toEqual({
      ok: false,
      error: '403 blocked',
    });

    r.register(null);
    expect(r.isAvailable()).toBe(false);
  });

  describe('health', () => {
    it('bot yo‘q — disabled', async () => {
      await expect(new TelegramBotRegistry().health()).resolves.toBe(
        'disabled',
      );
    });

    it('getMe ok — ok, 60s keshlanadi', async () => {
      const r = new TelegramBotRegistry();
      const getMe = jest.fn().mockResolvedValue({});
      r.register({ sendMessage: jest.fn(), getMe });
      await expect(r.health(1000)).resolves.toBe('ok');
      await expect(r.health(30_000)).resolves.toBe('ok');
      expect(getMe).toHaveBeenCalledTimes(1);
      await r.health(1000 + 60_001);
      expect(getMe).toHaveBeenCalledTimes(2);
    });

    it('getMe xato — down', async () => {
      const r = new TelegramBotRegistry();
      r.register({
        sendMessage: jest.fn(),
        getMe: jest.fn().mockRejectedValue(new Error('net')),
      });
      await expect(r.health()).resolves.toBe('down');
    });

    it('getMe osilib qolsa — timeout → down', async () => {
      jest.useFakeTimers();
      try {
        const r = new TelegramBotRegistry();
        r.register({
          sendMessage: jest.fn(),
          getMe: () => new Promise(() => undefined),
        });
        const p = r.health();
        await jest.advanceTimersByTimeAsync(5_001);
        await expect(p).resolves.toBe('down');
      } finally {
        jest.useRealTimers();
      }
    });

    it('reportFailure — down (getMe chaqirilmaydi); register() tiklaydi', async () => {
      const r = new TelegramBotRegistry();
      const getMe = jest.fn().mockResolvedValue({});
      r.register({ sendMessage: jest.fn(), getMe });
      r.reportFailure('409 Conflict');
      await expect(r.health()).resolves.toBe('down');
      expect(getMe).not.toHaveBeenCalled();
      r.register({ sendMessage: jest.fn(), getMe });
      await expect(r.health()).resolves.toBe('ok');
      r.register(null);
      await expect(r.health()).resolves.toBe('disabled');
    });
  });

  describe('supergroup migration and group health', () => {
    it('migrate_to_chat_id xatodan olinadi, keyingi xabarlar yangi id ga yo‘naltiriladi', async () => {
      const r = new TelegramBotRegistry();
      const err = Object.assign(new Error('400: group chat was upgraded'), {
        response: { parameters: { migrate_to_chat_id: -1009 } },
      });
      const sender = {
        sendMessage: jest.fn().mockRejectedValueOnce(err).mockResolvedValue({}),
      };
      r.register(sender);
      await expect(r.sendMessage('-100', 'a')).resolves.toMatchObject({
        ok: false,
        migrateToChatId: '-1009',
      });
      expect(r.migratedTo('-100')).toBe('-1009');
      await expect(r.sendMessage('-100', 'a')).resolves.toEqual({ ok: true });
      expect(sender.sendMessage).toHaveBeenLastCalledWith('-1009', 'a');
      expect(r.groupHealth()).toBe('migrated');
    });

    it('oddiy xatoda migrateToChatId yo‘q', async () => {
      const r = new TelegramBotRegistry();
      r.register({ sendMessage: jest.fn().mockRejectedValue(new Error('x')) });
      const res = await r.sendMessage('1', 'a');
      expect(res).toEqual({ ok: false, error: 'x' });
    });

    it('ketma-ket doimiy xatolar → failing; bitta muvaffaqiyat tiklaydi', () => {
      const r = new TelegramBotRegistry();
      expect(r.groupHealth()).toBe('ok');
      for (let i = 0; i < GROUP_FAILURE_THRESHOLD - 1; i++)
        r.reportGroupFailure();
      expect(r.groupHealth()).toBe('ok');
      r.reportGroupFailure();
      expect(r.groupHealth()).toBe('failing');
      r.reportGroupSuccess();
      expect(r.groupHealth()).toBe('ok');
    });
  });
});
