import { TelegramBotRegistry } from './telegram-bot.registry';

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
});
