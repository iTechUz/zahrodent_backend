import {
  DEV_TELEGRAM_BOT_TOKEN,
  statusChatId,
  telegramBotToken,
} from './dev-defaults';

describe('dev-defaults', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('dev: env yo‘q bo‘lsa token default ishlatiladi', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.TELEGRAM_BOT_TOKEN;
    expect(telegramBotToken()).toBe(DEV_TELEGRAM_BOT_TOKEN);
  });

  it('env har doim default’dan ustun', () => {
    process.env.NODE_ENV = 'development';
    process.env.TELEGRAM_BOT_TOKEN = 'env-token';
    process.env.TELEGRAM_STATUS_CHAT_ID = ' -100123 ';
    expect(telegramBotToken()).toBe('env-token');
    expect(statusChatId()).toBe('-100123');
  });

  it('production: default token ishlatilmaydi', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.TELEGRAM_BOT_TOKEN;
    expect(telegramBotToken()).toBeUndefined();
  });
});
